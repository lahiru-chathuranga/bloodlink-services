import { z } from "zod";

export const postMessageSchema = z.object({
  message: z.string().min(1),
});
