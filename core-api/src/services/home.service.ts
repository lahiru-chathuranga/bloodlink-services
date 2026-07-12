import { decryptField } from "../lib/encryption";
import { logger } from "../lib/logger";
import { prisma } from "../lib/prisma";
import {
  findDrivesNearPoint,
  getUserBookingStatusMap,
  toDriveSummary,
  type DriveSummaryDto,
} from "./drives.service";
import { getMatchingRequestsForFeed, type UrgentRequestSummaryDto } from "./urgent-requests.service";
import type { AlertDto } from "../constants/alerts";

const COOLDOWN_DAYS = 120;

export interface CooldownInfo {
  daysLeft: number | null;
  lastDonatedDate: string | null;
  available: boolean;
}

export interface HomeFeed {
  cooldown: CooldownInfo;
  alerts: AlertDto[];
  urgentRequests: UrgentRequestSummaryDto[];
  drives: DriveSummaryDto[];
}

// Requirements §5 — cooldown = 120 days from lastDonatedDate, computed fresh on
// every load, never cached client-side. available: false ONLY on a genuine
// fetch failure (mobile then shows "reconnect", never a stale number).
function computeCooldown(lastDonatedDate: Date | null): CooldownInfo {
  if (!lastDonatedDate) {
    return { daysLeft: null, lastDonatedDate: null, available: true };
  }
  const daysSince = Math.floor((Date.now() - lastDonatedDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysLeft = Math.max(0, COOLDOWN_DAYS - daysSince);
  return {
    daysLeft: daysLeft > 0 ? daysLeft : null,
    lastDonatedDate: lastDonatedDate.toISOString().slice(0, 10),
    available: true,
  };
}

export async function getHomeFeed(userId: string): Promise<HomeFeed> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return {
      cooldown: { daysLeft: null, lastDonatedDate: null, available: false },
      alerts: [],
      urgentRequests: [],
      drives: [],
    };
  }

  let cooldown: CooldownInfo;
  try {
    cooldown = computeCooldown(user.lastDonatedDate);
  } catch (err) {
    logger.error({ err, userId }, "Cooldown computation failed");
    cooldown = { daysLeft: null, lastDonatedDate: null, available: false };
  }

  const alertRows = await prisma.alert.findMany({
    where: { userId, read: false },
    orderBy: { createdAt: "desc" },
  });
  const alerts: AlertDto[] = alertRows.map((a) => ({
    id: a.id,
    userId: a.userId,
    type: a.type,
    driveId: a.driveId,
    requestId: a.requestId,
    message: a.message,
    read: a.read,
    createdAt: a.createdAt.toISOString(),
  }));

  const bloodType = user.bloodType ? decryptField(user.bloodType) : null;
  const requestCityIds = [user.homeCityId, user.workCityId].filter((c): c is string => Boolean(c));
  const urgentRequests = await getMatchingRequestsForFeed(bloodType, requestCityIds);

  const homeCity = user.homeCityId ? await prisma.city.findUnique({ where: { id: user.homeCityId } }) : null;
  const workCity = user.workCityId ? await prisma.city.findUnique({ where: { id: user.workCityId } }) : null;

  const driveResults = await Promise.all(
    [homeCity, workCity].filter((c): c is NonNullable<typeof c> => Boolean(c)).map((c) => findDrivesNearPoint(c.lat, c.lng)),
  );
  const dedupedDrives = new Map<string, (typeof driveResults)[number][number]>();
  for (const list of driveResults) {
    for (const drive of list) dedupedDrives.set(drive.id, drive);
  }
  const drives = [...dedupedDrives.values()].sort((a, b) => a.date.getTime() - b.date.getTime());

  const driveIds = drives.map((d) => d.id);
  const [slotsAll, statusMap] = await Promise.all([
    prisma.slot.findMany({ where: { driveId: { in: driveIds } } }),
    getUserBookingStatusMap(userId, driveIds),
  ]);
  const slotsByDrive = new Map<string, typeof slotsAll>();
  for (const slot of slotsAll) {
    const list = slotsByDrive.get(slot.driveId) ?? [];
    list.push(slot);
    slotsByDrive.set(slot.driveId, list);
  }

  const driveDtos = drives.map((d) =>
    toDriveSummary(d, slotsByDrive.get(d.id) ?? [], statusMap.get(d.id) ?? "none"),
  );

  return { cooldown, alerts, urgentRequests, drives: driveDtos };
}
