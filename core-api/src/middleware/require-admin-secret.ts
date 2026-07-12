import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { UnauthorizedError } from "../lib/errors";

// /admin/* routes use a static secret header, never JWT — api-contract.md §3/§5.
export function requireAdminSecret(req: Request, _res: Response, next: NextFunction): void {
  const provided = req.headers["x-admin-secret"];
  if (!provided || provided !== env.adminSecret) {
    throw new UnauthorizedError("Invalid admin secret.");
  }
  next();
}
