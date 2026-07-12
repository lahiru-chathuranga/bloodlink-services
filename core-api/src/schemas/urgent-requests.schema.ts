import { z } from "zod";
import { BLOOD_TYPES } from "../constants/blood-type";

export const createRequestSchema = z.object({
  bloodType: z.enum(BLOOD_TYPES),
  urgencyLevel: z.enum(["normal", "urgent", "critical"]),
  hospitalName: z.string().min(1),
  hospitalCityId: z.string().min(1),
  contactPhone: z.string().min(1),
});

export const listRequestsQuerySchema = z.object({
  scope: z.enum(["active", "history"]),
});

export const staffDonorSearchQuerySchema = z.object({
  bloodType: z.enum(BLOOD_TYPES).optional(),
  cityId: z.string().optional(),
});
