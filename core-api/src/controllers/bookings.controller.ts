import type { Request, Response } from "express";
import { ok } from "../lib/response";
import * as bookingsService from "../services/bookings.service";

export async function createBooking(req: Request, res: Response): Promise<void> {
  const { driveId, slotId, eligibilityToken } = req.body;
  const result = await bookingsService.createBooking(req.user!.userId, driveId, slotId, eligibilityToken);
  ok(res, result, 201);
}

export async function cancelMyBooking(req: Request, res: Response): Promise<void> {
  const result = await bookingsService.cancelMyBooking(req.user!.userId);
  ok(res, result);
}
