import type { Drive, Slot } from "@prisma/client";
import { decryptField } from "../lib/encryption";
import { ApiError, ConflictError, ForbiddenError, NotFoundError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { toDonorContact, type DonorContactDto } from "./users.service";

const WAITLIST_MAX = 10;

const MATCH_RADIUS_KM = 20;

export type DriveStatus = "registering" | "active" | "completed";

// data-model.md §2.2 — derived, never stored. Compared at UTC midnight since
// drive.date is stored as @db.Date (no time-of-day component).
export function toDriveStatus(date: Date): DriveStatus {
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const driveUtc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  if (driveUtc > todayUtc) return "registering";
  if (driveUtc === todayUtc) return "active";
  return "completed";
}

export interface SlotDto {
  id: string;
  driveId: string;
  startTime: string;
  capacity: number;
  bookedCount: number;
}

export function toSlotDto(slot: Slot): SlotDto {
  return {
    id: slot.id,
    driveId: slot.driveId,
    startTime: slot.startTime,
    capacity: slot.capacity,
    bookedCount: slot.bookedCount,
  };
}

export type MyBookingStatus = "none" | "confirmed" | "waitlisted";

export interface DriveSummaryDto {
  id: string;
  title: string;
  venue: string;
  cityId: string;
  date: string;
  posterUrl: string | null;
  status: DriveStatus;
  slots: SlotDto[];
  myBookingStatus: MyBookingStatus;
  isFullyBooked: boolean;
}

// data-model.md §2.2.1 — every slot full AND waitlist at max. Deliberately
// separate from DriveStatus (see that section's note on why) — never lets a
// full-but-registering drive become non-editable.
export function computeIsFullyBooked(slots: Slot[], waitlistCount: number): boolean {
  return slots.every((s) => s.bookedCount >= s.capacity) && waitlistCount >= WAITLIST_MAX;
}

export interface DriveDetailDto extends DriveSummaryDto {
  description: string;
  lat: number;
  lng: number;
  organizer: { id: string; fullName: string; phone: string } | null;
}

// One confirmed booking system-wide (data-model.md §4.5) means at most one
// driveId maps to "confirmed"; waitlist entries can span multiple drives.
export async function getUserBookingStatusMap(
  userId: string,
  driveIds: string[],
): Promise<Map<string, MyBookingStatus>> {
  const map = new Map<string, MyBookingStatus>();
  if (driveIds.length === 0) return map;

  const [confirmedBooking, waitlistEntries] = await Promise.all([
    prisma.booking.findFirst({ where: { userId, status: "confirmed" } }),
    prisma.waitlist.findMany({ where: { userId, driveId: { in: driveIds } } }),
  ]);

  for (const entry of waitlistEntries) {
    map.set(entry.driveId, "waitlisted");
  }
  if (confirmedBooking && driveIds.includes(confirmedBooking.driveId)) {
    map.set(confirmedBooking.driveId, "confirmed");
  }
  return map;
}

export function toDriveSummary(
  drive: Drive,
  slots: Slot[],
  myBookingStatus: MyBookingStatus,
  waitlistCount: number,
): DriveSummaryDto {
  return {
    id: drive.id,
    title: drive.title,
    venue: drive.venue,
    cityId: drive.cityId,
    date: drive.date.toISOString().slice(0, 10),
    posterUrl: drive.posterUrl,
    status: toDriveStatus(drive.date),
    slots: slots.map(toSlotDto),
    myBookingStatus,
    isFullyBooked: computeIsFullyBooked(slots, waitlistCount),
  };
}

export interface DriveWithDistance extends Drive {
  distanceKm: number;
}

// Haversine SQL, per docs/cities.md's reference implementation — filters at the
// DB layer using the indexed (lat, lng) columns rather than pulling every row
// into application memory. Returns distanceKm too — Requirements §5/decision #29
// sorts the home feed's drives nearest-first, not by date.
export async function findDrivesNearPoint(lat: number, lng: number): Promise<DriveWithDistance[]> {
  return prisma.$queryRaw<DriveWithDistance[]>`
    SELECT *, (6371 * acos(
      cos(radians(${lat})) * cos(radians(lat)) *
      cos(radians(lng) - radians(${lng})) +
      sin(radians(${lat})) * sin(radians(lat))
    )) AS "distanceKm"
    FROM "Drive"
    WHERE "deletedAt" IS NULL
      AND (6371 * acos(
      cos(radians(${lat})) * cos(radians(lat)) *
      cos(radians(lng) - radians(${lng})) +
      sin(radians(${lat})) * sin(radians(lat))
    )) <= ${MATCH_RADIUS_KM}
    ORDER BY "distanceKm" ASC
  `;
}

export async function getDriveDetail(driveId: string, userId: string): Promise<DriveDetailDto> {
  const drive = await prisma.drive.findFirst({ where: { id: driveId, deletedAt: null }, include: { organizer: true } });
  if (!drive) throw new NotFoundError("Drive not found.");

  const [slots, statusMap, waitlistCount] = await Promise.all([
    prisma.slot.findMany({ where: { driveId } }),
    getUserBookingStatusMap(userId, [driveId]),
    prisma.waitlist.count({ where: { driveId } }),
  ]);
  const myBookingStatus = statusMap.get(driveId) ?? "none";

  // organizer info populated only if caller has a confirmed booking on this drive — api-contract.md §1.
  let organizer: DriveDetailDto["organizer"] = null;
  if (myBookingStatus === "confirmed") {
    organizer = {
      id: drive.organizer.id,
      fullName: drive.organizer.fullName ?? "",
      phone: drive.organizer.phone ? decryptField(drive.organizer.phone) : "",
    };
  }

  return {
    ...toDriveSummary(drive, slots, myBookingStatus, waitlistCount),
    description: drive.description,
    lat: drive.lat,
    lng: drive.lng,
    organizer,
  };
}

export async function getDriveSlots(driveId: string): Promise<{ items: SlotDto[] }> {
  const drive = await prisma.drive.findFirst({ where: { id: driveId, deletedAt: null } });
  if (!drive) throw new NotFoundError("Drive not found.");
  const slots = await prisma.slot.findMany({ where: { driveId } });
  return { items: slots.map(toSlotDto) };
}

export async function getDriveOrThrow(driveId: string): Promise<Drive> {
  const drive = await prisma.drive.findFirst({ where: { id: driveId, deletedAt: null } });
  if (!drive) throw new NotFoundError("Drive not found.");
  return drive;
}

export interface WaitlistEntryDto {
  id: string;
  driveId: string;
  userId: string;
  position: number;
  createdAt: string;
}

// Waitlist is per-drive (not per-slot), max 10 — data-model.md §4.6 / Requirements
// §7.1 / decision #10. Count + insert happen inside one transaction to keep the
// max-10 check atomic under concurrent joins.
export async function joinWaitlist(userId: string, driveId: string): Promise<WaitlistEntryDto> {
  await getDriveOrThrow(driveId);

  const existing = await prisma.waitlist.findUnique({
    where: { driveId_userId: { driveId, userId } },
  });
  if (existing) {
    // Not explicitly listed in api-contract.md — flagged as a gap resolution
    // (added alongside WAITLIST_FULL) rather than letting the @@unique
    // constraint surface as a raw 500.
    throw new ConflictError("ALREADY_WAITLISTED", "You're already on this drive's waitlist.");
  }

  const entry = await prisma.$transaction(async (tx) => {
    const count = await tx.waitlist.count({ where: { driveId } });
    if (count >= WAITLIST_MAX) {
      throw new ConflictError("WAITLIST_FULL", "This drive's waitlist is full.");
    }
    return tx.waitlist.create({ data: { driveId, userId, position: count + 1 } });
  });

  return {
    id: entry.id,
    driveId: entry.driveId,
    userId: entry.userId,
    position: entry.position,
    createdAt: entry.createdAt.toISOString(),
  };
}

export async function leaveWaitlist(userId: string, driveId: string): Promise<{ removed: true }> {
  const entry = await prisma.waitlist.findUnique({ where: { driveId_userId: { driveId, userId } } });
  if (!entry) {
    throw new NotFoundError("You are not on this drive's waitlist.");
  }

  // Renumber everyone behind the removed entry so `position` stays a
  // contiguous 1-based queue — without this, a leave-then-join cycle produces
  // duplicate/stale position numbers (found during 2.7 verification).
  await prisma.$transaction(async (tx) => {
    await tx.waitlist.delete({ where: { id: entry.id } });
    await tx.waitlist.updateMany({
      where: { driveId, position: { gt: entry.position } },
      data: { position: { decrement: 1 } },
    });
  });

  return { removed: true };
}

// ---------------------------------------------------------------------------
// Organizer drive management — api-contract.md §2.7. Same file per ARCHITECTURE.md
// ("All /organizer/drives* routes → drives.routes.ts"), ownership checked here
// (service layer) on every :id-scoped function below.
// ---------------------------------------------------------------------------

async function getOwnedDriveOrThrow(driveId: string, organizerId: string): Promise<Drive> {
  const drive = await prisma.drive.findFirst({ where: { id: driveId, deletedAt: null } });
  if (!drive) throw new NotFoundError("Drive not found.");
  if (drive.createdBy !== organizerId) {
    throw new ForbiddenError("You do not own this drive.");
  }
  return drive;
}

export async function listMyDrives(organizerId: string): Promise<{ items: DriveSummaryDto[] }> {
  const drives = await prisma.drive.findMany({
    where: { createdBy: organizerId, deletedAt: null },
    orderBy: { date: "desc" },
  });
  const driveIds = drives.map((d) => d.id);
  const [slots, waitlistEntries] = await Promise.all([
    prisma.slot.findMany({ where: { driveId: { in: driveIds } } }),
    prisma.waitlist.findMany({ where: { driveId: { in: driveIds } } }),
  ]);
  const slotsByDrive = new Map<string, Slot[]>();
  for (const slot of slots) {
    const list = slotsByDrive.get(slot.driveId) ?? [];
    list.push(slot);
    slotsByDrive.set(slot.driveId, list);
  }
  const waitlistCountByDrive = new Map<string, number>();
  for (const entry of waitlistEntries) {
    waitlistCountByDrive.set(entry.driveId, (waitlistCountByDrive.get(entry.driveId) ?? 0) + 1);
  }
  // myBookingStatus is meaningless for the organizer's own list — always "none".
  return {
    items: drives.map((d) =>
      toDriveSummary(d, slotsByDrive.get(d.id) ?? [], "none", waitlistCountByDrive.get(d.id) ?? 0),
    ),
  };
}

interface DriveInput {
  title: string;
  description: string;
  venue: string;
  cityId: string;
  date: string;
  posterUrl?: string;
  slots: { startTime: string; capacity: number }[];
}

export async function createDrive(organizerId: string, input: DriveInput): Promise<DriveSummaryDto> {
  const city = await prisma.city.findUnique({ where: { id: input.cityId } });
  if (!city) throw new ApiError(400, "INVALID_CITY", "cityId does not match a known city.");

  const drive = await prisma.$transaction(async (tx) => {
    const created = await tx.drive.create({
      data: {
        title: input.title,
        description: input.description,
        venue: input.venue,
        cityId: input.cityId,
        lat: city.lat, // derived server-side, never accepted directly — api-contract.md §2.7
        lng: city.lng,
        date: new Date(input.date),
        posterUrl: input.posterUrl,
        createdBy: organizerId,
      },
    });
    await tx.slot.createMany({
      data: input.slots.map((s) => ({ driveId: created.id, startTime: s.startTime, capacity: s.capacity })),
    });
    return created;
  });

  const slots = await prisma.slot.findMany({ where: { driveId: drive.id } });
  return toDriveSummary(drive, slots, "none", 0); // brand new drive — waitlist can't have entries yet
}

export async function updateDrive(
  organizerId: string,
  driveId: string,
  input: DriveInput,
): Promise<DriveSummaryDto> {
  const existing = await getOwnedDriveOrThrow(driveId, organizerId);

  if (toDriveStatus(existing.date) !== "registering") {
    throw new ConflictError("DRIVE_NOT_EDITABLE", "Cannot edit a drive that isn't in the registering stage.");
  }

  const city = await prisma.city.findUnique({ where: { id: input.cityId } });
  if (!city) throw new ApiError(400, "INVALID_CITY", "cityId does not match a known city.");

  const drive = await prisma.$transaction(async (tx) => {
    const updated = await tx.drive.update({
      where: { id: driveId },
      data: {
        title: input.title,
        description: input.description,
        venue: input.venue,
        cityId: input.cityId,
        lat: city.lat,
        lng: city.lng,
        date: new Date(input.date),
        posterUrl: input.posterUrl,
      },
    });

    const currentSlots = await tx.slot.findMany({ where: { driveId } });
    const incomingByStartTime = new Map(input.slots.map((s) => [s.startTime, s]));

    for (const slot of currentSlots) {
      const incoming = incomingByStartTime.get(slot.startTime);
      if (!incoming) {
        // Slot removed from the payload — only safe to drop if nobody's booked into it.
        if (slot.bookedCount > 0) {
          throw new ConflictError(
            "SLOT_HAS_BOOKINGS",
            `Cannot remove slot ${slot.startTime} — it already has bookings.`,
          );
        }
        await tx.slot.delete({ where: { id: slot.id } });
      } else {
        await tx.slot.update({ where: { id: slot.id }, data: { capacity: incoming.capacity } });
        incomingByStartTime.delete(slot.startTime);
      }
    }
    // Whatever's left in incomingByStartTime is genuinely new.
    for (const s of incomingByStartTime.values()) {
      await tx.slot.create({ data: { driveId, startTime: s.startTime, capacity: s.capacity } });
    }

    return updated;
  });

  const [slots, waitlistCount] = await Promise.all([
    prisma.slot.findMany({ where: { driveId } }),
    prisma.waitlist.count({ where: { driveId } }),
  ]);
  return toDriveSummary(drive, slots, "none", waitlistCount);
}

export async function deleteDrive(organizerId: string, driveId: string): Promise<{ deleted: true }> {
  await getOwnedDriveOrThrow(driveId, organizerId);

  await prisma.$transaction(async (tx) => {
    const confirmedBookings = await tx.booking.findMany({ where: { driveId, status: "confirmed" } });

    for (const booking of confirmedBookings) {
      await tx.booking.update({
        where: { id: booking.id },
        data: { status: "cancelled", cancelledAt: new Date() },
      });
      await tx.alert.create({
        data: {
          userId: booking.userId,
          type: "booking_cancelled",
          driveId,
          message: "Your booking was cancelled because the organizer deleted this drive.",
        },
      });
    }

    // Soft delete — see data-model.md §9 D6.
    await tx.drive.update({ where: { id: driveId }, data: { deletedAt: new Date() } });
  });

  return { deleted: true };
}

export interface OrganizerDriveDetailDto extends DriveDetailDto {
  waitlistCount: number;
  totalBooked: number;
  totalCapacity: number;
}

export async function getMyDriveDetail(organizerId: string, driveId: string): Promise<OrganizerDriveDetailDto> {
  const drive = await getOwnedDriveOrThrow(driveId, organizerId);
  const [slots, waitlistCount] = await Promise.all([
    prisma.slot.findMany({ where: { driveId } }),
    prisma.waitlist.count({ where: { driveId } }),
  ]);

  const totalBooked = slots.reduce((sum, s) => sum + s.bookedCount, 0);
  const totalCapacity = slots.reduce((sum, s) => sum + s.capacity, 0);

  return {
    ...toDriveSummary(drive, slots, "none", waitlistCount),
    description: drive.description,
    lat: drive.lat,
    lng: drive.lng,
    organizer: null,
    waitlistCount,
    totalBooked,
    totalCapacity,
  };
}

export async function getSlotBookings(
  organizerId: string,
  driveId: string,
  slotId: string,
): Promise<{ items: { id: string; userId: string; slotId: string; driveId: string; status: string; createdAt: string; donor: DonorContactDto }[] }> {
  await getOwnedDriveOrThrow(driveId, organizerId);

  const bookings = await prisma.booking.findMany({
    where: { slotId, driveId },
    include: { user: true },
  });

  return {
    items: bookings.map((b) => ({
      id: b.id,
      userId: b.userId,
      slotId: b.slotId,
      driveId: b.driveId,
      status: b.status,
      createdAt: b.createdAt.toISOString(),
      donor: toDonorContact(b.user),
    })),
  };
}

export async function getDriveWaitlist(
  organizerId: string,
  driveId: string,
): Promise<{ items: (WaitlistEntryDto & { donor: DonorContactDto })[] }> {
  await getOwnedDriveOrThrow(driveId, organizerId);

  const entries = await prisma.waitlist.findMany({
    where: { driveId },
    include: { user: true },
    orderBy: { position: "asc" },
  });

  return {
    items: entries.map((e) => ({
      id: e.id,
      driveId: e.driveId,
      userId: e.userId,
      position: e.position,
      createdAt: e.createdAt.toISOString(),
      donor: toDonorContact(e.user),
    })),
  };
}

export async function notifyWaitlisted(
  organizerId: string,
  driveId: string,
  targetUserId: string,
): Promise<{ id: string; userId: string; type: string; driveId: string | null; message: string; read: boolean; createdAt: string }> {
  await getOwnedDriveOrThrow(driveId, organizerId);

  const entry = await prisma.waitlist.findUnique({ where: { driveId_userId: { driveId, userId: targetUserId } } });
  if (!entry) {
    throw new NotFoundError("This user is not on this drive's waitlist.");
  }

  const drive = await prisma.drive.findUnique({ where: { id: driveId } });
  const alert = await prisma.alert.create({
    data: {
      userId: targetUserId,
      type: "waitlist_opening",
      driveId,
      message: `A slot opened up for ${drive?.title ?? "a drive"} you're waitlisted for — you're on the list.`,
    },
  });

  return {
    id: alert.id,
    userId: alert.userId,
    type: alert.type,
    driveId: alert.driveId,
    message: alert.message,
    read: alert.read,
    createdAt: alert.createdAt.toISOString(),
  };
}
