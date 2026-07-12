import type { Request, Response } from "express";
import { ApiError } from "../lib/errors";
import { param } from "../lib/request";
import { ok } from "../lib/response";
import * as donationsService from "../services/donations.service";
import * as usersService from "../services/users.service";

export async function getMe(req: Request, res: Response): Promise<void> {
  const result = await usersService.getMe(req.user!.userId);
  ok(res, result);
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  const result = await usersService.updateProfile(req.user!.userId, req.body);
  ok(res, result);
}

export async function updateVisibility(req: Request, res: Response): Promise<void> {
  const result = await usersService.updateVisibility(req.user!.userId, req.body.visibleToUrgentRequests);
  ok(res, result);
}

export async function uploadAvatar(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    throw new ApiError(400, "VALIDATION_ERROR", "No file uploaded.");
  }
  const result = await usersService.uploadAvatar(req.file.buffer, req.file.originalname, req.file.mimetype);
  ok(res, result);
}

export async function organizerRequest(req: Request, res: Response): Promise<void> {
  const result = await usersService.submitOrganizerRequest(req.user!.userId, req.body.nic, req.body.address);
  ok(res, result);
}

export async function getDonations(req: Request, res: Response): Promise<void> {
  const result = await donationsService.getUserDonations(req.user!.userId);
  ok(res, result);
}

export async function getDonationById(req: Request, res: Response): Promise<void> {
  const result = await donationsService.getUserDonationById(req.user!.userId, param(req, "id"));
  ok(res, result);
}

export async function getAlerts(req: Request, res: Response): Promise<void> {
  const result = await usersService.listAlerts(req.user!.userId);
  ok(res, result);
}

export async function markAlertRead(req: Request, res: Response): Promise<void> {
  const result = await usersService.markAlertRead(req.user!.userId, param(req, "id"));
  ok(res, result);
}
