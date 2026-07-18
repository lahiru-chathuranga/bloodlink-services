import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface JwtPayload {
  userId: string;
  email: string;
  isOrganizer: boolean;
  isHospitalStaff: boolean;
}

export function signJwt(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: "30d" });
}

export function verifyJwt(token: string): JwtPayload & { iat: number; exp: number } {
  return jwt.verify(token, env.jwtSecret) as JwtPayload & { iat: number; exp: number };
}
