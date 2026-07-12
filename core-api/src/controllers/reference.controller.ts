import type { Request, Response } from "express";
import { ok } from "../lib/response";
import { listCities } from "../services/reference.service";

export async function getCities(_req: Request, res: Response): Promise<void> {
  const result = await listCities();
  ok(res, result);
}
