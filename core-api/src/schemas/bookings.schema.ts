import { z } from "zod";

export const createBookingSchema = z.object({
  driveId: z.string().min(1),
  slotId: z.string().min(1),
  eligibilityToken: z.string().min(1),
});
