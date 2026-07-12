import type { Donation } from "@prisma/client";
import { ApiError, ConflictError, ForbiddenError, NotFoundError } from "../lib/errors";
import { prisma } from "../lib/prisma";

export interface DonationDto {
  id: string;
  userId: string;
  driveId: string;
  bookingId: string;
  confirmedBy: string;
  confirmedAt: string;
  driveTitle: string;
  date: string;
  badgeCount: number;
}

export function toDonationDto(donation: Donation): DonationDto {
  return {
    id: donation.id,
    userId: donation.userId,
    driveId: donation.driveId,
    bookingId: donation.bookingId,
    confirmedBy: donation.confirmedBy,
    confirmedAt: donation.confirmedAt.toISOString(),
    driveTitle: donation.driveTitle,
    date: donation.date.toISOString().slice(0, 10),
    badgeCount: donation.badgeCount,
  };
}

export async function getUserDonations(userId: string): Promise<{ items: DonationDto[] }> {
  const donations = await prisma.donation.findMany({
    where: { userId },
    orderBy: { confirmedAt: "desc" },
  });
  return { items: donations.map(toDonationDto) };
}

export async function getUserDonationById(userId: string, id: string): Promise<DonationDto> {
  const donation = await prisma.donation.findUnique({ where: { id } });
  if (!donation || donation.userId !== userId) {
    throw new NotFoundError("Donation not found.");
  }
  return toDonationDto(donation);
}

// JWT + (isOrganizer owner OR isHospitalStaff) — api-contract.md §2.8. Ownership
// requires a DB lookup, so this access check lives in the service layer rather
// than a role-only middleware.
async function assertDonationAccess(driveId: string, callerId: string, isHospitalStaff: boolean) {
  const drive = await prisma.drive.findFirst({ where: { id: driveId, deletedAt: null } });
  if (!drive) throw new NotFoundError("Drive not found.");
  if (!isHospitalStaff && drive.createdBy !== callerId) {
    throw new ForbiddenError("Only this drive's organizer or hospital staff can manage donations.");
  }
  return drive;
}

interface CreateDonationInput {
  qrIdentifier?: string;
  userId?: string;
}

export async function createDonation(
  callerId: string,
  isHospitalStaff: boolean,
  driveId: string,
  input: CreateDonationInput,
): Promise<DonationDto> {
  const drive = await assertDonationAccess(driveId, callerId, isHospitalStaff);

  let targetUserId = input.userId;
  if (input.qrIdentifier) {
    const donor = await prisma.user.findUnique({ where: { qrIdentifier: input.qrIdentifier } });
    if (!donor) throw new ApiError(404, "NOT_FOUND", "No donor matches this QR code.");
    targetUserId = donor.id;
  }
  if (!targetUserId) {
    throw new ApiError(400, "VALIDATION_ERROR", "No donor identified.");
  }

  const booking = await prisma.booking.findFirst({
    where: { userId: targetUserId, driveId, status: "confirmed" },
  });
  if (!booking) {
    throw new ConflictError("NOT_BOOKED", "This donor has no confirmed booking for this drive.");
  }

  const existingDonation = await prisma.donation.findUnique({ where: { bookingId: booking.id } });
  if (existingDonation) {
    throw new ConflictError("ALREADY_DONATED", "This donor has already been marked as donated for this drive.");
  }

  const priorCount = await prisma.donation.count({ where: { userId: targetUserId } });

  const donation = await prisma.donation.create({
    data: {
      userId: targetUserId,
      driveId,
      bookingId: booking.id,
      confirmedBy: callerId,
      driveTitle: drive.title,
      date: drive.date,
      badgeCount: priorCount + 1,
    },
  });

  return toDonationDto(donation);
}

export async function getDonationStats(
  callerId: string,
  isHospitalStaff: boolean,
  driveId: string,
): Promise<{ donated: number; remaining: number }> {
  await assertDonationAccess(driveId, callerId, isHospitalStaff);

  const [donated, totalBookings] = await Promise.all([
    prisma.donation.count({ where: { driveId } }),
    prisma.booking.count({ where: { driveId, status: "confirmed" } }),
  ]);

  return { donated, remaining: Math.max(0, totalBookings - donated) };
}
