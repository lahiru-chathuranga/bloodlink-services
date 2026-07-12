import { z } from "zod";

export const staffInviteSchema = z.object({
  email: z.string().email(),
  hospitalName: z.string().optional(),
  hospitalRegId: z.string().optional(),
  position: z.string().optional(),
});

export const updateStaffSchema = z.object({
  hospitalName: z.string().optional(),
  hospitalRegId: z.string().optional(),
  position: z.string().optional(),
});
