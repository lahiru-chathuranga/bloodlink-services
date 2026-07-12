import { z } from "zod";

export const eligibilityCheckSchema = z.object({
  driveId: z.string().min(1),
  answers: z.array(
    z.object({
      questionId: z.string().min(1),
      value: z.string().min(1),
    }),
  ),
});
