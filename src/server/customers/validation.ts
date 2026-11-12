import { z } from "zod";

export const customerSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    phone: z
      .string()
      .trim()
      .regex(/^(?:\+62|62|0)[0-9 ()-]{7,18}$/u),
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .or(z.literal(""))
      .nullable()
      .optional()
      .transform((value) => value || null),
  })
  .strict();

export type CustomerInput = z.infer<typeof customerSchema>;
