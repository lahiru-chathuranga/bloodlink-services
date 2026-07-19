import { z } from "zod";

// data-model.md §4.4 — hourly, always within 09:00-16:00, so the last valid start is 15:00.
const VALID_START_TIMES = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00"] as const;

const slotInput = z.object({
  startTime: z.enum(VALID_START_TIMES),
  capacity: z.number().int().positive(),
});

const driveBody = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  venue: z.string().min(1),
  cityId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  posterUrl: z.string().url().optional(),
  mapUrl: z.string().url().optional(),
  slots: z.array(slotInput).min(1),
});

export const createDriveSchema = driveBody;
export const updateDriveSchema = driveBody;
