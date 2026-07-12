import type { Response } from "express";

// API_CONVENTIONS.md success envelope — { success, data }.
export function ok<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ success: true, data });
}
