import nodemailer from "nodemailer";
import { env } from "../config/env";
import { logger } from "./logger";

// Nodemailer -> Resend SMTP relay, decisions-log E1 — the primary path.
// Gmail SMTP + App Password is the decisions-log E2 explicit one-off-manual-
// local-test exception, used only when RESEND_API_KEY is absent. Neither
// wired up (RESEND_API_KEY unset, no GMAIL_* vars) falls back to logging the
// email to the console instead of sending — same call signature all three
// ways, so switching between them later is a zero-code-change env var swap.
const fromAddress = env.resendApiKey
  ? "BloodLink <no-reply@bloodlink.app>"
  : `"${env.gmailSenderName}" <${env.gmailUser}>`;

const transporter = env.resendApiKey
  ? nodemailer.createTransport({
      host: "smtp.resend.com",
      port: 465,
      secure: true,
      auth: { user: "resend", pass: env.resendApiKey },
    })
  : env.gmailUser && env.gmailAppPassword
    ? nodemailer.createTransport({
        service: "gmail",
        auth: { user: env.gmailUser, pass: env.gmailAppPassword },
      })
    : null;

export async function sendMail(to: string, subject: string, html: string): Promise<void> {
  if (!transporter) {
    logger.info({ to, subject, html }, "[stub mailer] no mail transport configured — logging email instead of sending");
    return;
  }
  await transporter.sendMail({ from: fromAddress, to, subject, html });
}
