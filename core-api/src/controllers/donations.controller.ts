import type { Request, Response } from "express";
import { param } from "../lib/request";
import { ok } from "../lib/response";
import * as donationsService from "../services/donations.service";

export async function createDonation(req: Request, res: Response): Promise<void> {
  const result = await donationsService.createDonation(
    req.user!.userId,
    req.user!.isHospitalStaff,
    param(req, "id"),
    req.body,
  );
  ok(res, result, 201);
}

export async function getDonationStats(req: Request, res: Response): Promise<void> {
  const result = await donationsService.getDonationStats(req.user!.userId, req.user!.isHospitalStaff, param(req, "id"));
  ok(res, result);
}
