import nodemailer from "nodemailer";
import { env } from "../config/env";
import { logger } from "./logger";

// Resend via its HTTPS REST API — deliberately not SMTP. Railway (and most
// PaaS free/hobby tiers) block outbound SMTP on ports 465/587 to protect
// their IP reputation from abuse, which broke this even against Resend's own
// SMTP relay (identical ETIMEDOUT to Gmail's). A plain HTTPS POST sidesteps
// that block entirely — it's an ordinary API call, not raw SMTP.
const RESEND_API_URL = "https://api.resend.com/emails";

// Resend's shared sandbox sender — works with zero setup, but Resend will
// only actually deliver to the email address the Resend account itself is
// registered under. No custom domain is verified for this project, so a real
// "from your own domain, to anyone" sender isn't available yet — swap this
// for a verified-domain address once one exists.
const fromAddress = env.resendApiKey
  ? "BloodLink <onboarding@resend.dev>"
  : `"${env.gmailSenderName}" <${env.gmailUser}>`;

// Gmail SMTP + App Password is the decisions-log E2 explicit one-off-manual-
// local-test exception, used only when RESEND_API_KEY is absent. Still SMTP —
// fine for local dev (no PaaS SMTP block there), never wired for deployment.
const gmailTransporter =
  !env.resendApiKey && env.gmailUser && env.gmailAppPassword
    ? nodemailer.createTransport({
        service: "gmail",
        auth: { user: env.gmailUser, pass: env.gmailAppPassword },
      })
    : null;

async function sendViaResend(to: string, subject: string, html: string): Promise<void> {
  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: fromAddress, to, subject, html }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Resend API request failed: ${response.status} ${body}`);
  }
}

export async function sendMail(to: string, subject: string, html: string): Promise<void> {
  if (env.resendApiKey) {
    await sendViaResend(to, subject, html);
    return;
  }

  if (gmailTransporter) {
    await gmailTransporter.sendMail({ from: fromAddress, to, subject, html });
    return;
  }

  logger.info({ to, subject, html }, "[stub mailer] no mail transport configured — logging email instead of sending");
}
