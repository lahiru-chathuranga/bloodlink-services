import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string): string | null {
  const value = process.env[name];
  return value ? value : null;
}

export const env = {
  databaseUrl: required("DATABASE_URL"),
  // Same value as core-api's — lets either service verify a token issued by
  // core-api's auth flow with no shared auth service (DEVELOPMENT_GUIDE.md).
  jwtSecret: required("JWT_SECRET"),
  port: Number(process.env.PORT ?? 4001),

  // Optional — chat falls back to a canned response when absent (decisions-log F1-F3).
  dialogflowProjectId: optional("DIALOGFLOW_PROJECT_ID"),
  dialogflowCredentialsJson: optional("DIALOGFLOW_CREDENTIALS_JSON"),
};
