import { z } from "zod";
import { BLOOD_TYPES } from "../constants/blood-type";

export const updateProfileSchema = z.object({
  avatarUrl: z.string().url().optional(),
  fullName: z.string().min(1),
  phone: z.string().min(1),
  bloodType: z.enum(BLOOD_TYPES).optional(),
  homeCityId: z.string().min(1),
  workCityId: z.string().min(1),
});

export const updateVisibilitySchema = z.object({
  visibleToUrgentRequests: z.boolean(),
});

export const organizerRequestSchema = z.object({
  nic: z.string().min(1),
  address: z.string().min(1),
});

export const idParamSchema = z.object({
  id: z.string().min(1),
});
