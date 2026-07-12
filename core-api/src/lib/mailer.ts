import nodemailer from "nodemailer";
import { env } from "../config/env";
import { logger } from "./logger";

// Nodemailer -> Resend SMTP relay, decisions-log E1. When RESEND_API_KEY is
// absent (local dev before the key is provisioned), fall back to logging the
// email to the console instead of sending — same call signature either way,
// so wiring in the real key later is a zero-code-change env var addition.
const transporter = env.resendApiKey
  ? nodemailer.createTransport({
      host: "smtp.resend.com",
      port: 465,
      secure: true,
      auth: { user: "resend", pass: env.resendApiKey },
    })
  : null;

export async function sendMail(to: string, subject: string, html: string): Promise<void> {
  if (!transporter) {
    logger.info({ to, subject, html }, "[stub mailer] RESEND_API_KEY not set — logging email instead of sending");
    return;
  }
  await transporter.sendMail({ from: "BloodLink <no-reply@bloodlink.app>", to, subject, html });
}
