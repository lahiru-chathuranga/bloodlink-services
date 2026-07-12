import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";
import { ValidationError } from "../lib/errors";

interface ValidationTargets {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export function validate(targets: ValidationTargets) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    for (const [key, schema] of Object.entries(targets) as [keyof ValidationTargets, ZodSchema][]) {
      const result = schema.safeParse(req[key]);
      if (!result.success) {
        const details = result.error.issues.map((issue) => ({
          field: issue.path.join(".") || key,
          message: issue.message,
        }));
        throw new ValidationError(details);
      }
      if (key === "query") {
        // Express 5 makes req.query a getter-only property — mutate its keys
        // in place instead of reassigning (found during 2.9 verification).
        Object.assign(req.query, result.data);
      } else {
        req[key] = result.data;
      }
    }
    next();
  };
}
