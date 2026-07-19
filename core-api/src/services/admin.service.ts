import { randomInt } from "crypto";
import { ApiError, NotFoundError } from "../lib/errors";
import { logger } from "../lib/logger";
import { generateQrIdentifier } from "../lib/qr";
import { sendMail } from "../lib/mailer";
import { otpEmail } from "../lib/otp-templates";
import { prisma } from "../lib/prisma";

const OTP_TTL_MINUTES = 10;

interface StaffInviteInput {
  email: string;
  hospitalName?: string;
  hospitalRegId?: string;
  position?: string;
}

export async function staffInvite(
  input: StaffInviteInput,
): Promise<{ userId: string; email: string; status: "invited" }> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new ApiError(409, "ALREADY_EXISTS", "A user with this email already exists.");
  }

  const user = await prisma.user.create({
    data: {
      email: input.email,
      status: "invited",
      isHospitalStaff: true,
      hospitalName: input.hospitalName,
      hospitalRegId: input.hospitalRegId,
      position: input.position,
      qrIdentifier: generateQrIdentifier(), // data-model.md §9 D10 — must exist at row-creation time
    },
  });

  const code = randomInt(100000, 1000000).toString();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
  await prisma.otp.create({ data: { email: input.email, code, purpose: "staff_invite", expiresAt } });
  const { subject, html } = otpEmail("staff_invite", code);

  // The invited user account above is already created and usable even if the
  // invite email fails to send — a mail-provider hiccup shouldn't fail the
  // whole invite (the OTP row is still valid; resend-otp can retry the email).
  try {
    await sendMail(input.email, subject, html);
  } catch (err) {
    logger.error({ err, email: input.email }, "Failed to send staff invite email — user was still created");
  }

  return { userId: user.id, email: user.email, status: "invited" };
}

interface UpdateStaffInput {
  hospitalName?: string;
  hospitalRegId?: string;
  position?: string;
}

export async function updateStaff(
  userId: string,
  input: UpdateStaffInput,
): Promise<{ userId: string; hospitalName: string | null; hospitalRegId: string | null; position: string | null }> {
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) throw new NotFoundError("User not found.");

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      hospitalName: input.hospitalName ?? existing.hospitalName,
      hospitalRegId: input.hospitalRegId ?? existing.hospitalRegId,
      position: input.position ?? existing.position,
    },
  });

  return {
    userId: user.id,
    hospitalName: user.hospitalName,
    hospitalRegId: user.hospitalRegId,
    position: user.position,
  };
}
