import type { Request, Response } from "express";
import { ok } from "../lib/response";
import * as authService from "../services/auth.service";

export async function checkEmail(req: Request, res: Response): Promise<void> {
  const result = await authService.checkEmail(req.body.email);
  ok(res, result);
}

export async function resendOtp(req: Request, res: Response): Promise<void> {
  const result = await authService.resendOtp(req.body.email, req.body.purpose);
  ok(res, result);
}

export async function verifyOtp(req: Request, res: Response): Promise<void> {
  const result = await authService.verifyOtp(req.body.email, req.body.code, req.body.purpose);
  ok(res, result);
}

export async function setPassword(req: Request, res: Response): Promise<void> {
  const result = await authService.setPassword(req.body.email, req.body.password, req.body.purpose);
  ok(res, result);
}

export async function login(req: Request, res: Response): Promise<void> {
  const result = await authService.login(req.body.email, req.body.password);
  ok(res, result);
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const result = await authService.forgotPassword(req.body.email);
  ok(res, result);
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const result = await authService.resetPassword(req.body.email, req.body.code, req.body.newPassword);
  ok(res, result);
}
