import type { Request, Response } from "express";
import { param } from "../lib/request";
import { ok } from "../lib/response";
import * as drivesService from "../services/drives.service";

export async function getDriveDetail(req: Request, res: Response): Promise<void> {
  const result = await drivesService.getDriveDetail(param(req, "id"), req.user!.userId);
  ok(res, result);
}

export async function getDriveSlots(req: Request, res: Response): Promise<void> {
  const result = await drivesService.getDriveSlots(param(req, "id"));
  ok(res, result);
}

export async function joinWaitlist(req: Request, res: Response): Promise<void> {
  const result = await drivesService.joinWaitlist(req.user!.userId, param(req, "id"));
  ok(res, result, 201);
}

export async function leaveWaitlist(req: Request, res: Response): Promise<void> {
  const result = await drivesService.leaveWaitlist(req.user!.userId, param(req, "id"));
  ok(res, result);
}

// Organizer drive management — api-contract.md §2.7.
export async function listMyDrives(req: Request, res: Response): Promise<void> {
  const result = await drivesService.listMyDrives(req.user!.userId);
  ok(res, result);
}

export async function createDrive(req: Request, res: Response): Promise<void> {
  const result = await drivesService.createDrive(req.user!.userId, req.body);
  ok(res, result, 201);
}

export async function updateDrive(req: Request, res: Response): Promise<void> {
  const result = await drivesService.updateDrive(req.user!.userId, param(req, "id"), req.body);
  ok(res, result);
}

export async function deleteDrive(req: Request, res: Response): Promise<void> {
  const result = await drivesService.deleteDrive(req.user!.userId, param(req, "id"));
  ok(res, result);
}

export async function getMyDriveDetail(req: Request, res: Response): Promise<void> {
  const result = await drivesService.getMyDriveDetail(req.user!.userId, param(req, "id"));
  ok(res, result);
}

export async function getSlotBookings(req: Request, res: Response): Promise<void> {
  const result = await drivesService.getSlotBookings(req.user!.userId, param(req, "id"), param(req, "slotId"));
  ok(res, result);
}

export async function getWaitlist(req: Request, res: Response): Promise<void> {
  const result = await drivesService.getDriveWaitlist(req.user!.userId, param(req, "id"));
  ok(res, result);
}

export async function notifyWaitlisted(req: Request, res: Response): Promise<void> {
  const result = await drivesService.notifyWaitlisted(req.user!.userId, param(req, "id"), param(req, "userId"));
  ok(res, result, 201);
}
