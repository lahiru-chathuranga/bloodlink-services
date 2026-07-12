import { Router } from "express";
import { ok } from "../lib/response";
import { prisma } from "../lib/prisma";

const router = Router();

// Checks this service's own Prisma/DB connection, independent of core-api's
// health — api-contract.md §4.
router.get("/health", async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  ok(res, { status: "ok" });
});

export default router;
