// data-model.md §2.1 — not a Prisma enum (encrypted-at-rest column, invalid enum-member chars).
// Validated only at this Zod layer, on write and after decrypt-verification is unnecessary
// since every value written here has already passed this check.
export const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
export type BloodType = (typeof BLOOD_TYPES)[number];
