import { z } from "zod";

export const createDonationSchema = z
  .object({
    qrIdentifier: z.string().min(1).optional(),
    userId: z.string().min(1).optional(),
  })
  .refine((data) => Boolean(data.qrIdentifier) !== Boolean(data.userId), {
    message: "Provide exactly one of qrIdentifier or userId.",
  });
