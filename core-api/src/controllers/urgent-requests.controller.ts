import type { Request, Response } from "express";
import { param } from "../lib/request";
import { ok } from "../lib/response";
import * as urgentRequestsService from "../services/urgent-requests.service";

export async function listRequests(req: Request, res: Response): Promise<void> {
  const scope = req.query.scope as "active" | "mine";
  const result = await urgentRequestsService.listRequestsForUser(req.user!.userId, scope);
  ok(res, result);
}

export async function createRequest(req: Request, res: Response): Promise<void> {
  const result = await urgentRequestsService.createRequest(req.user!.userId, req.body);
  ok(res, result, 201);
}

export async function getRequestById(req: Request, res: Response): Promise<void> {
  const result = await urgentRequestsService.getRequestById(param(req, "id"), req.user!.userId);
  ok(res, result);
}

export async function completeRequest(req: Request, res: Response): Promise<void> {
  const result = await urgentRequestsService.completeRequest(
    param(req, "id"),
    req.user!.userId,
    req.user!.isHospitalStaff,
  );
  ok(res, result);
}

export async function searchDonors(req: Request, res: Response): Promise<void> {
  const { bloodType, cityId } = req.query as { bloodType?: string; cityId?: string };
  const result = await urgentRequestsService.searchDonors(bloodType, cityId);
  ok(res, result);
}
