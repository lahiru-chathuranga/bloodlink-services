import type { UrgencyLevel, UrgentRequest } from "@prisma/client";
import { decryptField } from "../lib/encryption";
import { ApiError, ForbiddenError, NotFoundError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { toDonorContact, type DonorContactDto } from "./users.service";

const MATCH_RADIUS_KM = 20;
const URGENCY_RANK: Record<UrgencyLevel, number> = { critical: 2, urgent: 1, normal: 0 };

export interface UrgentRequestSummaryDto {
  id: string;
  bloodType: string;
  urgencyLevel: UrgencyLevel;
  hospitalName: string;
  hospitalCityId: string;
  status: string;
  createdAt: string;
}

export interface UrgentRequestDetailDto extends UrgentRequestSummaryDto {
  contactPhone: string;
  postedBy: string;
  isMine: boolean;
}

export function toSummary(req: UrgentRequest): UrgentRequestSummaryDto {
  return {
    id: req.id,
    bloodType: req.bloodType,
    urgencyLevel: req.urgencyLevel,
    hospitalName: req.hospitalName,
    hospitalCityId: req.hospitalCityId,
    status: req.status,
    createdAt: req.createdAt.toISOString(),
  };
}

export function toDetail(req: UrgentRequest, callerId: string): UrgentRequestDetailDto {
  return {
    ...toSummary(req),
    contactPhone: req.contactPhone,
    postedBy: req.postedBy,
    isMine: req.postedBy === callerId,
  };
}

interface CreateRequestInput {
  bloodType: string;
  urgencyLevel: UrgencyLevel;
  hospitalName: string;
  hospitalCityId: string;
  contactPhone: string;
}

export async function createRequest(
  userId: string,
  input: CreateRequestInput,
): Promise<UrgentRequestSummaryDto> {
  const city = await prisma.city.findUnique({ where: { id: input.hospitalCityId } });
  if (!city) {
    throw new ApiError(400, "INVALID_CITY", "hospitalCityId does not match a known city.");
  }

  const created = await prisma.urgentRequest.create({
    data: {
      postedBy: userId,
      bloodType: input.bloodType,
      urgencyLevel: input.urgencyLevel,
      hospitalName: input.hospitalName,
      hospitalCityId: input.hospitalCityId,
      contactPhone: input.contactPhone,
    },
  });
  return toSummary(created);
}

// Haversine SQL against UrgentRequest joined to City for hospitalCityId's coordinates.
async function findRequestsNearPoint(
  lat: number,
  lng: number,
  statuses: string[],
): Promise<UrgentRequest[]> {
  return prisma.$queryRaw<UrgentRequest[]>`
    SELECT ur.* FROM "UrgentRequest" ur
    JOIN "City" c ON c.id = ur."hospitalCityId"
    WHERE ur.status::text = ANY(${statuses})
      AND (6371 * acos(
        cos(radians(${lat})) * cos(radians(c.lat)) *
        cos(radians(c.lng) - radians(${lng})) +
        sin(radians(${lat})) * sin(radians(c.lat))
      )) <= ${MATCH_RADIUS_KM}
  `;
}

function sortByUrgencyThenDate(items: UrgentRequest[], dateDesc: boolean): UrgentRequest[] {
  return [...items].sort((a, b) => {
    const urgencyDiff = URGENCY_RANK[b.urgencyLevel] - URGENCY_RANK[a.urgencyLevel];
    if (urgencyDiff !== 0) return urgencyDiff;
    const dateDiff = b.createdAt.getTime() - a.createdAt.getTime();
    return dateDesc ? dateDiff : -dateDiff;
  });
}

// Used by GET /requests?scope=active|history — api-contract.md §2.9.
export async function listRequestsForUser(
  userId: string,
  scope: "active" | "history",
): Promise<{ items: UrgentRequestSummaryDto[] }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError("User not found.");

  const bloodType = user.bloodType ? decryptField(user.bloodType) : null;
  if (!bloodType || !user.homeCityId) {
    return { items: [] };
  }

  const homeCity = await prisma.city.findUnique({ where: { id: user.homeCityId } });
  if (!homeCity) return { items: [] };

  const statuses = scope === "active" ? ["open"] : ["completed", "closed"];
  const nearby = await findRequestsNearPoint(homeCity.lat, homeCity.lng, statuses);
  const matching = nearby.filter((r) => r.bloodType === bloodType);
  const sorted = sortByUrgencyThenDate(matching, scope === "history");
  return { items: sorted.map(toSummary) };
}

// Used by GET /home/feed's urgentRequests section — same matching rule, but keyed
// off both home AND work city per HomeFeed's convention (api-contract.md §1), and
// caller passes decrypted bloodType directly since home.service already has it.
export async function getMatchingRequestsForFeed(
  bloodType: string | null,
  cityIds: string[],
): Promise<UrgentRequestSummaryDto[]> {
  if (!bloodType || cityIds.length === 0) return [];

  const cities = await prisma.city.findMany({ where: { id: { in: cityIds } } });
  const seen = new Map<string, UrgentRequest>();
  for (const city of cities) {
    const nearby = await findRequestsNearPoint(city.lat, city.lng, ["open"]);
    for (const r of nearby) {
      if (r.bloodType === bloodType) seen.set(r.id, r);
    }
  }
  const sorted = sortByUrgencyThenDate([...seen.values()], true);
  return sorted.map(toSummary);
}

export async function getRequestById(id: string, callerId: string): Promise<UrgentRequestDetailDto> {
  const req = await prisma.urgentRequest.findUnique({ where: { id } });
  if (!req) throw new NotFoundError("Urgent request not found.");
  return toDetail(req, callerId);
}

export async function completeRequest(
  id: string,
  callerId: string,
  isHospitalStaff: boolean,
): Promise<UrgentRequestDetailDto> {
  const req = await prisma.urgentRequest.findUnique({ where: { id } });
  if (!req) throw new NotFoundError("Urgent request not found.");

  if (req.postedBy !== callerId && !isHospitalStaff) {
    throw new ForbiddenError("Only the poster or hospital staff can mark this request complete.");
  }

  const updated = await prisma.urgentRequest.update({ where: { id }, data: { status: "completed" } });
  return toDetail(updated, callerId);
}

// data-model.md §7 — trimmed User view, decrypted, staff-search-only (Requirements
// §9.1 / decision #16 — respects visibleToUrgentRequests, unlike normal feed matching).
export async function searchDonors(bloodType?: string, cityId?: string): Promise<{ items: DonorContactDto[] }> {
  const users = await prisma.user.findMany({
    where: {
      visibleToUrgentRequests: true,
      ...(cityId ? { homeCityId: cityId } : {}),
    },
  });

  const items = users.map(toDonorContact).filter((u) => !bloodType || u.bloodType === bloodType);
  return { items };
}
