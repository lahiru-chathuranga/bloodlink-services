import jwt from "jsonwebtoken";
import { env } from "../config/env";

// Same JwtPayload shape as core-api (api-contract.md §0) — chat-api only ever
// verifies tokens issued by core-api's auth flow, never issues its own.
export interface JwtPayload {
  userId: string;
  email: string;
  isOrganizer: boolean;
  isHospitalStaff: boolean;
}

export function verifyJwt(token: string): JwtPayload & { iat: number; exp: number } {
  return jwt.verify(token, env.jwtSecret) as JwtPayload & { iat: number; exp: number };
}
