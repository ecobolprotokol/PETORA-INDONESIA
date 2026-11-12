import { z } from "zod";

export const passwordSchema = z.string().min(12).max(128);
export const emailSchema = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((email) => email.toLowerCase());

export const setupSchema = z
  .object({
    businessName: z.string().trim().min(2).max(120),
    name: z.string().trim().min(2).max(80),
    email: emailSchema,
    password: passwordSchema,
    branchName: z.string().trim().min(2).max(120),
    branchCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9_-]{1,11}$/u),
    timezone: z
      .string()
      .trim()
      .min(1)
      .refine((timezone) => {
        try {
          new Intl.DateTimeFormat("en-US", { timeZone: timezone });
          return true;
        } catch {
          return false;
        }
      }),
    locale: z.enum(["id-ID", "en-US"]),
    taxEnabled: z.boolean(),
    taxRateBps: z.number().int().min(0).max(10_000),
    taxIncluded: z.boolean(),
    includeSampleData: z.boolean().optional(),
  })
  .refine(({ taxEnabled, taxRateBps }) => !taxEnabled || taxRateBps > 0, {
    path: ["taxRateBps"],
    message: "Tarif pajak harus lebih dari nol jika pajak diaktifkan.",
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const totpCodeSchema = z
  .string()
  .trim()
  .max(40)
  .regex(/^(?:\d{6}|[A-Fa-f\d -]{20,39})$/u);

export const totpLoginChallengeSchema = z.object({
  challengeToken: z.string().min(32).max(128),
  code: totpCodeSchema,
});

export const totpEnrollmentConfirmationSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/u),
});

export const totpDisableSchema = z.object({
  password: passwordSchema,
  code: totpCodeSchema,
});

export type SetupInput = z.infer<typeof setupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
