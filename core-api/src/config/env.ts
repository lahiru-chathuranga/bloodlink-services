import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Treats an empty string the same as unset — Render/`.env.example` conventions
// leave optional vars present-but-blank rather than absent, and `??` alone
// doesn't catch that.
function optional(name: string): string | null {
  const value = process.env[name];
  return value ? value : null;
}

export const env = {
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  port: Number(process.env.PORT ?? 4000),
  adminSecret: required("ADMIN_SECRET"),

  // Optional — email sending stubs to console logging when absent (decisions-log E1).
  resendApiKey: optional("RESEND_API_KEY"),

  // Optional — Gmail SMTP + App Password, local-testing-only fallback when
  // RESEND_API_KEY is absent (decisions-log E2's explicit one-off-manual-test
  // exception). Never the primary path — see mailer.ts.
  gmailUser: optional("GMAIL_USER"),
  gmailAppPassword: optional("GMAIL_APP_PASSWORD"),
  gmailSenderName: optional("GMAIL_SENDER_NAME") ?? "BloodLink",

  // Optional — avatar/poster uploads stub to a local no-op when absent (Requirements §13).
  r2AccountId: optional("R2_ACCOUNT_ID"),
  r2AccessKeyId: optional("R2_ACCESS_KEY_ID"),
  r2SecretAccessKey: optional("R2_SECRET_ACCESS_KEY"),
  r2BucketName: optional("R2_BUCKET_NAME"),
  // Optional — a connected custom domain or the bucket's r2.dev public URL.
  // Without it, uploads still succeed but the returned URL won't resolve
  // publicly until one of those is enabled in the Cloudflare dashboard.
  r2PublicBaseUrl: optional("R2_PUBLIC_BASE_URL"),
};
