import type { Request, Response } from "express";
import { ok } from "../lib/response";
import { checkHealth } from "../services/health.service";

export async function getHealth(_req: Request, res: Response): Promise<void> {
  const result = await checkHealth();
  ok(res, result);
}
