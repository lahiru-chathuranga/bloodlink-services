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

  // Optional — avatar/poster uploads stub to a local no-op when absent (Requirements §13).
  r2AccountId: optional("R2_ACCOUNT_ID"),
  r2AccessKeyId: optional("R2_ACCESS_KEY_ID"),
  r2SecretAccessKey: optional("R2_SECRET_ACCESS_KEY"),
  r2BucketName: optional("R2_BUCKET_NAME"),
};
