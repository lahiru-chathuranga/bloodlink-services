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

// eligibilityToken — data-model.md §6: { userId, driveId, passed: true, exp }, 15-min TTL, signed, stateless.
// Extended here with `answers`: the documented payload alone can't reproduce
// Booking.eligibilityResult (data-model.md §4.5, `{ passed, answers }`) at
// booking-creation time, since POST /bookings never resubmits the answers —
// see docs gap note tracked for data-model.md §6/§9.
export interface EligibilityTokenPayload {
  userId: string;
  driveId: string;
  passed: true;
  answers: Record<string, string>;
}

export function signEligibilityToken(payload: EligibilityTokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: "15m" });
}

export function verifyEligibilityToken(
  token: string,
): EligibilityTokenPayload & { iat: number; exp: number } {
  return jwt.verify(token, env.jwtSecret) as EligibilityTokenPayload & {
    iat: number;
    exp: number;
  };
}
