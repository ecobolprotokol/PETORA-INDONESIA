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
    address: z.string().trim().max(500).optional(),
    notes: z.string().trim().max(4000).optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
    marketingConsent: z.boolean().optional(),
    notificationPreferences: z
      .object({
        appointments: z.boolean().optional(),
        marketing: z.boolean().optional(),
      })
      .optional(),
  })
  .strict();

export type CustomerInput = z.infer<typeof customerSchema>;
