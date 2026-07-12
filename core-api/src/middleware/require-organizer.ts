import type { NextFunction, Request, Response } from "express";
import { ForbiddenError } from "../lib/errors";

export function requireOrganizer(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user?.isOrganizer) {
    throw new ForbiddenError("Organizer access required.");
  }
  next();
}
