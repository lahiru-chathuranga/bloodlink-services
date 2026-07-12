import type { Request, Response } from "express";
import { ok } from "../lib/response";
import { checkEligibility } from "../services/eligibility.service";

export async function postEligibilityCheck(req: Request, res: Response): Promise<void> {
  const result = await checkEligibility(req.user!.userId, req.body.driveId, req.body.answers);
  ok(res, result);
}
