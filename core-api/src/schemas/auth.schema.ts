import { z } from "zod";

const otpPurpose = z.enum(["register", "reset_password", "staff_invite"]);
const otpCode = z.string().regex(/^\d{6}$/, "OTP code must be 6 digits");
const password = z.string().min(8, "Password must be at least 8 characters");

export const checkEmailSchema = z.object({
  email: z.string().email(),
});

export const resendOtpSchema = z.object({
  email: z.string().email(),
  purpose: otpPurpose,
});

export const verifyOtpSchema = z.object({
  email: z.string().email(),
  code: otpCode,
  purpose: otpPurpose,
});

export const setPasswordSchema = z.object({
  email: z.string().email(),
  password,
  purpose: otpPurpose,
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  email: z.string().email(),
  code: otpCode,
  newPassword: password,
});
