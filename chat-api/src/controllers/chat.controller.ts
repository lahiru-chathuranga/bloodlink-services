import type { Request, Response } from "express";
import { ok } from "../lib/response";
import * as chatService from "../services/chat.service";

export async function getHistory(req: Request, res: Response): Promise<void> {
  const result = await chatService.getHistory(req.user!.userId);
  ok(res, result);
}

export async function postMessage(req: Request, res: Response): Promise<void> {
  const result = await chatService.postMessage(req.user!.userId, req.body.message);
  ok(res, result, 201);
}
