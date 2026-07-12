import type { Request, Response } from "express";
import { ok } from "../lib/response";
import { getHomeFeed } from "../services/home.service";

export async function getFeed(req: Request, res: Response): Promise<void> {
  const result = await getHomeFeed(req.user!.userId);
  ok(res, result);
}
