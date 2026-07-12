import type { Request } from "express";

// Express 5 types req.params values as `string | string[]` to account for
// repeated wildcard segments — none of our routes use those, every param here
// is a single named segment (":id", ":slotId", etc.), so this narrows safely.
export function param(req: Request, key: string): string {
  const value = req.params[key];
  return Array.isArray(value) ? value[0] : value;
}
