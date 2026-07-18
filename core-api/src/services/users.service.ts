import type { User } from "@prisma/client";
import { encryptField, decryptField } from "../lib/encryption";
import { ApiError, NotFoundError } from "../lib/errors";
import { logger } from "../lib/logger";
import { generateQrIdentifier } from "../lib/qr";
import { prisma } from "../lib/prisma";
import { deleteFile, uploadFile } from "../lib/storage";
import type { AlertDto } from "../constants/alerts";

export interface UserProfile {
  id: string;
  email: string;
  avatarUrl: string | null;
  fullName: string | null;
  phone: string | null;
  bloodType: string | null;
  homeCityId: string | null;
  workCityId: string | null;
  role: string;
  isOrganizer: boolean;
  isHospitalStaff: boolean;
  hospitalName: string | null;
  hospitalRegId: string | null;
  position: string | null;
  status: string;
  lastDonatedDate: string | null;
  visibleToUrgentRequests: boolean;
  qrIdentifier: string;
  createdAt: string;
  updatedAt: string;
  profileComplete: boolean;
}

// data-model.md §4.1 — computed, not stored.
function isProfileComplete(user: User): boolean {
  return Boolean(user.fullName && user.homeCityId && user.workCityId);
}

// Encryption/decryption stays exclusively in the lib/service layer — a controller
// should never see ciphertext (data-model.md §5).
export function toUserProfile(user: User): UserProfile {
  return {
    id: user.id,
    email: user.email,
    avatarUrl: user.avatarUrl,
    fullName: user.fullName,
    phone: user.phone ? decryptField(user.phone) : null,
    bloodType: user.bloodType ? decryptField(user.bloodType) : null,
    homeCityId: user.homeCityId,
    workCityId: user.workCityId,
    role: user.role,
    isOrganizer: user.isOrganizer,
    isHospitalStaff: user.isHospitalStaff,
    hospitalName: user.hospitalName,
    hospitalRegId: user.hospitalRegId,
    position: user.position,
    status: user.status,
    lastDonatedDate: user.lastDonatedDate ? user.lastDonatedDate.toISOString().slice(0, 10) : null,
    visibleToUrgentRequests: user.visibleToUrgentRequests,
    qrIdentifier: user.qrIdentifier,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    profileComplete: isProfileComplete(user),
  };
}

export interface DonorContactDto {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
  bloodType: string | null;
  phone: string | null;
}

// data-model.md §7 — trimmed User view, decrypted, staff/organizer-only.
export function toDonorContact(user: User): DonorContactDto {
  return {
    id: user.id,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    bloodType: user.bloodType ? decryptField(user.bloodType) : null,
    phone: user.phone ? decryptField(user.phone) : null,
  };
}

export async function getUserOrThrow(userId: string): Promise<User> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError("User not found.");
  return user;
}

export async function getMe(userId: string): Promise<UserProfile> {
  const user = await getUserOrThrow(userId);
  return toUserProfile(user);
}

interface UpdateProfileInput {
  avatarUrl?: string;
  fullName: string;
  phone: string;
  bloodType?: string;
  homeCityId: string;
  workCityId: string;
}

export async function updateProfile(userId: string, input: UpdateProfileInput): Promise<UserProfile> {
  const [homeCity, workCity] = await Promise.all([
    prisma.city.findUnique({ where: { id: input.homeCityId } }),
    prisma.city.findUnique({ where: { id: input.workCityId } }),
  ]);
  if (!homeCity) throw new ApiError(400, "INVALID_CITY", "homeCityId does not match a known city.");
  if (!workCity) throw new ApiError(400, "INVALID_CITY", "workCityId does not match a known city.");

  const existing = await getUserOrThrow(userId);

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      avatarUrl: input.avatarUrl ?? existing.avatarUrl,
      fullName: input.fullName,
      phone: encryptField(input.phone),
      bloodType: input.bloodType ? encryptField(input.bloodType) : existing.bloodType,
      homeCityId: input.homeCityId,
      workCityId: input.workCityId,
      // Defensive fallback only — data-model.md §4.1's qrIdentifier is NOT NULL,
      // so it's already generated at row-creation time (auth.service.ts). This
      // branch should never actually fire under the normal flow.
      qrIdentifier: existing.qrIdentifier ?? generateQrIdentifier(),
    },
  });

  if (input.avatarUrl && existing.avatarUrl && input.avatarUrl !== existing.avatarUrl) {
    void deleteFile(existing.avatarUrl);
  }

  return toUserProfile(user);
}

export async function updateVisibility(
  userId: string,
  visibleToUrgentRequests: boolean,
): Promise<UserProfile> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { visibleToUrgentRequests },
  });
  return toUserProfile(user);
}

export async function uploadAvatar(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
): Promise<{ url: string }> {
  const url = await uploadFile(buffer, originalName, mimeType);
  return { url };
}

// No OrganizerRequest table exists in data-model.md — organizer approval is a
// manual, physical review at the blood bank (Requirements §3/decision #3), and
// the request itself isn't queried back through the app anywhere. Logged here
// so it's visible to whoever reviews it manually (e.g. via Render logs), rather
// than inventing an unused table ad hoc.
export async function submitOrganizerRequest(
  userId: string,
  nic: string,
  address: string,
): Promise<{ submitted: true }> {
  logger.info({ userId, nic, address }, "Organizer request submitted — pending physical review");
  return { submitted: true };
}

export async function listAlerts(userId: string): Promise<{ items: AlertDto[] }> {
  const alerts = await prisma.alert.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return {
    items: alerts.map((a) => ({
      id: a.id,
      userId: a.userId,
      type: a.type,
      driveId: a.driveId,
      requestId: a.requestId,
      message: a.message,
      read: a.read,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}

export async function markAlertRead(userId: string, alertId: string): Promise<AlertDto> {
  const alert = await prisma.alert.findUnique({ where: { id: alertId } });
  if (!alert || alert.userId !== userId) {
    throw new NotFoundError("Alert not found.");
  }
  const updated = await prisma.alert.update({ where: { id: alertId }, data: { read: true } });
  return {
    id: updated.id,
    userId: updated.userId,
    type: updated.type,
    driveId: updated.driveId,
    requestId: updated.requestId,
    message: updated.message,
    read: updated.read,
    createdAt: updated.createdAt.toISOString(),
  };
}
