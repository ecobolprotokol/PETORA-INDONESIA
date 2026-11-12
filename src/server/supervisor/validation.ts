import { z } from "zod";

export const pinSchema = z
  .object({
    pin: z.string().trim().min(4).max(8).regex(/^\d+$/u),
    currentPin: z.string().trim().min(4).max(8).regex(/^\d+$/u).optional(),
    currentPassword: z.string().min(12).max(128),
    reset: z.boolean().default(false),
  })
  .strict()
  .refine(({ reset, currentPin }) => !reset || Boolean(currentPin), {
    path: ["currentPin"],
    message: "Berikan PIN supervisor saat ini untuk mereset.",
  });

export type PinInput = z.infer<typeof pinSchema>;
