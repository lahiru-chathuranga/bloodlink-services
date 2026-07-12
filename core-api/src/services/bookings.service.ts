import type { Booking } from "@prisma/client";
import { ConflictError, NotFoundError } from "../lib/errors";
import { verifyEligibilityToken } from "../lib/jwt";
import { prisma } from "../lib/prisma";
import { getUserOrThrow } from "./users.service";
import { toSlotDto, type SlotDto } from "./drives.service";

const COOLDOWN_DAYS = 120;

export interface BookingDto {
  id: string;
  userId: string;
  slotId: string;
  driveId: string;
  eligibilityResult: unknown;
  status: string;
  createdAt: string;
  cancelledAt: string | null;
}

function toBookingDto(booking: Booking): BookingDto {
  return {
    id: booking.id,
    userId: booking.userId,
    slotId: booking.slotId,
    driveId: booking.driveId,
    eligibilityResult: booking.eligibilityResult,
    status: booking.status,
    createdAt: booking.createdAt.toISOString(),
    cancelledAt: booking.cancelledAt ? booking.cancelledAt.toISOString() : null,
  };
}

// Requirements §7.2 / decision #9 — checked against the SLOT's date, not today.
function isCooldownActive(lastDonatedDate: Date | null, driveDate: Date): boolean {
  if (!lastDonatedDate) return false;
  const daysBetween = Math.floor(
    (driveDate.getTime() - lastDonatedDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  return daysBetween < COOLDOWN_DAYS;
}

async function findNearestSlotWithRoom(
  driveId: string,
  excludeSlotId: string,
): Promise<{ nearestSlot: SlotDto } | undefined> {
  // Prisma can't compare two columns (bookedCount < capacity) in a `where`
  // directly, and this is small per-drive data — filter in JS instead of raw SQL.
  const slots = await prisma.slot.findMany({ where: { driveId } });
  const candidates = slots
    .filter((s) => s.id !== excludeSlotId && s.bookedCount < s.capacity)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  if (candidates.length === 0) return undefined;
  return { nearestSlot: toSlotDto(candidates[0]) };
}

// Server validates, in this exact order (first failing rule wins) — api-contract.md §2.6.
export async function createBooking(
  userId: string,
  driveId: string,
  slotId: string,
  eligibilityToken: string,
): Promise<BookingDto> {
  // 1. eligibilityToken signature/expiry/driveId match
  let tokenPayload;
  try {
    tokenPayload = verifyEligibilityToken(eligibilityToken);
  } catch {
    throw new ConflictError("ELIGIBILITY_TOKEN_INVALID", "Your eligibility check has expired — please retake it.");
  }
  if (tokenPayload.userId !== userId || tokenPayload.driveId !== driveId || !tokenPayload.passed) {
    throw new ConflictError("ELIGIBILITY_TOKEN_INVALID", "Your eligibility check does not match this booking.");
  }

  const slot = await prisma.slot.findUnique({ where: { id: slotId }, include: { drive: true } });
  if (!slot || slot.driveId !== driveId) {
    throw new NotFoundError("Slot not found on this drive.");
  }

  const user = await getUserOrThrow(userId);

  // 2. Cooldown vs. the drive's date, not today
  if (isCooldownActive(user.lastDonatedDate, slot.drive.date)) {
    throw new ConflictError("COOLDOWN_NOT_ELIGIBLE", "You will not be eligible to donate again by this drive's date.");
  }

  // 3. One-active-booking-system-wide (defense layer 1 — see the partial unique
  // index added to the migration for layer 2, data-model.md §4.5).
  const existingBooking = await prisma.booking.findFirst({ where: { userId, status: "confirmed" } });
  if (existingBooking) {
    throw new ConflictError("ALREADY_BOOKED", "You already have an active booking. Cancel it before booking another drive.");
  }

  // 4. Slot capacity — locked with SELECT ... FOR UPDATE so concurrent bookings
  // can't both pass the capacity check for the last remaining seat.
  const booking = await prisma.$transaction(async (tx) => {
    const [locked] = await tx.$queryRaw<{ id: string; bookedCount: number; capacity: number }[]>`
      SELECT id, "bookedCount", capacity FROM "Slot" WHERE id = ${slotId} FOR UPDATE
    `;
    if (!locked || locked.bookedCount >= locked.capacity) {
      throw new ConflictError("SLOT_FULL", "This slot is full.", await findNearestSlotWithRoom(driveId, slotId));
    }

    const stillNoBooking = await tx.booking.findFirst({ where: { userId, status: "confirmed" } });
    if (stillNoBooking) {
      throw new ConflictError("ALREADY_BOOKED", "You already have an active booking.");
    }

    await tx.slot.update({ where: { id: slotId }, data: { bookedCount: { increment: 1 } } });
    return tx.booking.create({
      data: {
        userId,
        slotId,
        driveId,
        status: "confirmed",
        eligibilityResult: { passed: true, answers: tokenPayload.answers },
      },
    });
  });
  return toBookingDto(booking);
}

export async function cancelMyBooking(userId: string): Promise<{ cancelled: true }> {
  const booking = await prisma.booking.findFirst({ where: { userId, status: "confirmed" } });
  if (!booking) {
    throw new NotFoundError("No active booking to cancel.");
  }

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: booking.id },
      data: { status: "cancelled", cancelledAt: new Date() },
    }),
    prisma.slot.update({ where: { id: booking.slotId }, data: { bookedCount: { decrement: 1 } } }),
  ]);

  return { cancelled: true };
}
