import type { User, UrgentRequest } from "@prisma/client";
import { decryptField } from "../lib/encryption";
import { ApiError, ForbiddenError, NotFoundError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { toDonorContact, type DonorContactDto } from "./users.service";

const MATCH_RADIUS_KM = 20;

export interface UrgentRequestSummaryDto {
  id: string;
  bloodType: string;
  hospitalName: string;
  hospitalCityId: string;
  contactPhone: string;
  status: string;
  isMine: boolean;
  createdAt: string;
}

export interface RequesterProfileDto {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  hospitalName: string | null;
  isHospitalStaff: boolean;
  position: string | null;
}

export interface UrgentRequestDetailDto extends UrgentRequestSummaryDto {
  postedBy: string;
  requester: RequesterProfileDto;
}

export function toSummary(req: UrgentRequest, callerId: string): UrgentRequestSummaryDto {
  return {
    id: req.id,
    bloodType: req.bloodType,
    hospitalName: req.hospitalName,
    hospitalCityId: req.hospitalCityId,
    contactPhone: req.contactPhone,
    status: req.status,
    isMine: req.postedBy === callerId,
    createdAt: req.createdAt.toISOString(),
  };
}

function toRequesterProfile(user: User): RequesterProfileDto {
  return {
    id: user.id,
    fullName: user.fullName ?? "",
    email: user.email,
    avatarUrl: user.avatarUrl,
    hospitalName: user.hospitalName,
    isHospitalStaff: user.isHospitalStaff,
    position: user.position,
  };
}

export function toDetail(
  req: UrgentRequest & { poster: User },
  callerId: string,
): UrgentRequestDetailDto {
  return {
    ...toSummary(req, callerId),
    postedBy: req.postedBy,
    requester: toRequesterProfile(req.poster),
  };
}

interface CreateRequestInput {
  bloodType: string;
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
      hospitalName: input.hospitalName,
      hospitalCityId: input.hospitalCityId,
      contactPhone: input.contactPhone,
    },
  });
  return toSummary(created, userId);
}

// Haversine SQL against UrgentRequest joined to City for hospitalCityId's coordinates.
// A request always matches if the caller posted it themselves — bloodType is the
// *requested* type, independent of the poster's own blood type, so "My Requests"
// must surface a poster's own post regardless of whether it matches their type.
async function findActiveRequestsForUser(
  userId: string,
  bloodType: string,
  lat: number,
  lng: number,
): Promise<UrgentRequest[]> {
  return prisma.$queryRaw<UrgentRequest[]>`
    SELECT ur.* FROM "UrgentRequest" ur
    JOIN "City" c ON c.id = ur."hospitalCityId"
    WHERE ur.status = 'open'
      AND (
        ur."postedBy" = ${userId}
        OR (
          ur."bloodType" = ${bloodType}
          AND (6371 * acos(
            cos(radians(${lat})) * cos(radians(c.lat)) *
            cos(radians(c.lng) - radians(${lng})) +
            sin(radians(${lat})) * sin(radians(c.lat))
          )) <= ${MATCH_RADIUS_KM}
        )
      )
    ORDER BY ur."createdAt" DESC
  `;
}

// Used by GET /requests?scope=active|mine — api-contract.md §2.9.
// scope=active: open requests matching the caller's blood type within 20km of
// home, plus every request the caller posted themselves (any match). scope=mine
// is the caller's own full request log, any status — not community history.
export async function listRequestsForUser(
  userId: string,
  scope: "active" | "mine",
): Promise<{ items: UrgentRequestSummaryDto[] }> {
  if (scope === "mine") {
    const items = await prisma.urgentRequest.findMany({
      where: { postedBy: userId },
      orderBy: { createdAt: "desc" },
    });
    return { items: items.map((r) => toSummary(r, userId)) };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError("User not found.");

  const bloodType = user.bloodType ? decryptField(user.bloodType) : null;
  const homeCity = user.homeCityId
    ? await prisma.city.findUnique({ where: { id: user.homeCityId } })
    : null;

  // Without a bloodType/homeCity we can't compute the proximity match, but the
  // caller's own posted requests should still show up under "My Requests".
  const items =
    bloodType && homeCity
      ? await findActiveRequestsForUser(userId, bloodType, homeCity.lat, homeCity.lng)
      : await prisma.urgentRequest.findMany({
          where: { status: "open", postedBy: userId },
          orderBy: { createdAt: "desc" },
        });

  return { items: items.map((r) => toSummary(r, userId)) };
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
    ORDER BY ur."createdAt" DESC
  `;
}

// Used by GET /home/feed's urgentRequests section — same matching rule, but keyed
// off both home AND work city per HomeFeed's convention (api-contract.md §1), and
// caller passes decrypted bloodType directly since home.service already has it.
// No "OR postedBy=caller" carve-out here — the Home Feed has no "mine" section.
export async function getMatchingRequestsForFeed(
  userId: string,
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
  const sorted = [...seen.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return sorted.map((r) => toSummary(r, userId));
}

export async function getRequestById(id: string, callerId: string): Promise<UrgentRequestDetailDto> {
  const req = await prisma.urgentRequest.findUnique({ where: { id }, include: { poster: true } });
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

  const updated = await prisma.urgentRequest.update({
    where: { id },
    data: { status: "completed" },
    include: { poster: true },
  });
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
