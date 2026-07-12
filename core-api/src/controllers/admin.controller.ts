import type { Request, Response } from "express";
import { param } from "../lib/request";
import { ok } from "../lib/response";
import * as adminService from "../services/admin.service";

export async function staffInvite(req: Request, res: Response): Promise<void> {
  const result = await adminService.staffInvite(req.body);
  ok(res, result, 201);
}

export async function updateStaff(req: Request, res: Response): Promise<void> {
  const result = await adminService.updateStaff(param(req, "id"), req.body);
  ok(res, result);
}
