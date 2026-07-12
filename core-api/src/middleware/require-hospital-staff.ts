import type { NextFunction, Request, Response } from "express";
import { ForbiddenError } from "../lib/errors";

export function requireHospitalStaff(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user?.isHospitalStaff) {
    throw new ForbiddenError("Hospital staff access required.");
  }
  next();
}
