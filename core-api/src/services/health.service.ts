import { prisma } from "../lib/prisma";

export async function checkHealth(): Promise<{ status: "ok" }> {
  // Returns 200 only if the DB connection is actually alive — API_CONVENTIONS.md.
  await prisma.$queryRaw`SELECT 1`;
  return { status: "ok" };
}
