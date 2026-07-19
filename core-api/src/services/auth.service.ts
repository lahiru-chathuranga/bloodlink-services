import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import type { OtpPurpose } from "@prisma/client";
import { ApiError, ConflictError } from "../lib/errors";
import { signJwt } from "../lib/jwt";
import { logger } from "../lib/logger";
import { generateQrIdentifier } from "../lib/qr";
import { sendMail } from "../lib/mailer";
import { otpEmail } from "../lib/otp-templates";
import { prisma } from "../lib/prisma";
import { toUserProfile, type UserProfile } from "./users.service";

const OTP_TTL_MINUTES = 10;

interface EmailCheckResult {
  status: "not_found" | "registered" | "invited" | "blocked";
  otpSent: boolean;
}

interface AuthSession {
  token: string;
  user: UserProfile;
}

// Returns whether the notification email actually sent — the OTP row above
// is already valid and usable regardless, so a mail-provider failure (bad
// domain config, provider outage, etc.) must not crash the whole request;
// the caller decides what to do with a false (e.g. surface it, or — for
// forgot-password's account-enumeration protection — deliberately ignore it).
async function issueOtp(email: string, purpose: OtpPurpose): Promise<boolean> {
  const code = randomInt(100000, 1000000).toString();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
  await prisma.otp.create({ data: { email, code, purpose, expiresAt } });
  const { subject, html } = otpEmail(purpose, code);

  try {
    await sendMail(email, subject, html);
    return true;
  } catch (err) {
    logger.error({ err, email, purpose }, "Failed to send OTP email — OTP was still issued");
    return false;
  }
}

export async function checkEmail(email: string): Promise<EmailCheckResult> {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    const otpSent = await issueOtp(email, "register");
    return { status: "not_found", otpSent };
  }

  if (user.status === "blocked") {
    return { status: "blocked", otpSent: false };
  }

  if (user.status === "invited") {
    const otpSent = await issueOtp(email, "staff_invite");
    return { status: "invited", otpSent };
  }

  return { status: "registered", otpSent: false };
}

export async function resendOtp(email: string, purpose: OtpPurpose): Promise<{ otpSent: boolean }> {
  const otpSent = await issueOtp(email, purpose);
  return { otpSent };
}

// Otp.used doubles as "verified" — set true here, then set-password/reset-password
// (which don't always receive the code again) look for a used=true, still-unexpired
// row for the same email+purpose as proof verify-otp already succeeded within the
// OTP's own TTL window. This is a documented gap resolution — see
// docs/decisions-log.md's OTP-verification-state entry.
export async function verifyOtp(
  email: string,
  code: string,
  purpose: OtpPurpose,
): Promise<{ valid: boolean }> {
  const otp = await prisma.otp.findFirst({
    where: { email, purpose, code, used: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) {
    return { valid: false };
  }

  await prisma.otp.update({ where: { id: otp.id }, data: { used: true } });
  return { valid: true };
}

async function findVerifiedOtp(email: string, purpose: OtpPurpose, code?: string) {
  return prisma.otp.findFirst({
    where: {
      email,
      purpose,
      used: true,
      expiresAt: { gt: new Date() },
      ...(code ? { code } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function setPassword(
  email: string,
  password: string,
  purpose: OtpPurpose,
): Promise<AuthSession> {
  const verified = await findVerifiedOtp(email, purpose);
  if (!verified) {
    throw new ApiError(401, "OTP_NOT_VERIFIED", "Verify your OTP again before setting a password.");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  let user = await prisma.user.findUnique({ where: { email } });

  if (purpose === "staff_invite") {
    if (!user) {
      throw new ApiError(401, "OTP_NOT_VERIFIED", "No staff invite found for this email.");
    }
    user = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, status: "active" },
    });
  } else {
    // register flow — create the row now if it doesn't exist yet.
    // qrIdentifier is NOT NULL @unique in data-model.md §4.1, so it must be
    // generated at row-creation time, not deferred to profile completion as
    // the requirements.md prose suggests — see docs/data-model.md gap note.
    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, status: "active" },
      });
    } else {
      user = await prisma.user.create({
        data: { email, passwordHash, status: "active", qrIdentifier: generateQrIdentifier() },
      });
    }
  }

  const token = signJwt({
    userId: user.id,
    email: user.email,
    isOrganizer: user.isOrganizer,
    isHospitalStaff: user.isHospitalStaff,
  });

  return { token, user: toUserProfile(user) };
}

export async function login(email: string, password: string): Promise<AuthSession> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Incorrect email or password.");
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Incorrect email or password.");
  }

  if (user.status === "blocked") {
    throw new ApiError(401, "ACCOUNT_BLOCKED", "This account has been blocked.");
  }

  const token = signJwt({
    userId: user.id,
    email: user.email,
    isOrganizer: user.isOrganizer,
    isHospitalStaff: user.isHospitalStaff,
  });

  return { token, user: toUserProfile(user) };
}

export async function forgotPassword(email: string): Promise<{ otpSent: true }> {
  // Same generic response regardless of whether the email exists — Requirements §4.4,
  // avoids account enumeration. issueOtp's real success/failure is deliberately
  // discarded for the same reason: surfacing it would leak whether the email
  // was valid enough to attempt a send.
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    await issueOtp(email, "reset_password");
  }
  return { otpSent: true };
}

export async function resetPassword(
  email: string,
  code: string,
  newPassword: string,
): Promise<{ success: true }> {
  const verified = await findVerifiedOtp(email, "reset_password", code);
  if (!verified) {
    throw new ApiError(401, "OTP_NOT_VERIFIED", "Invalid or expired code.");
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new ConflictError("USER_NOT_FOUND", "No account found for this email.");
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  return { success: true };
}
