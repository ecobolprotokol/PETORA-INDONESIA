import { z } from "zod";

export const FEATURE_KEYS = ["commissions", "loyalty", "inpatient"] as const;
export const DOCUMENT_TYPES = ["invoice", "purchase_order", "receipt"] as const;

function isValidTimeZone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export const updateBusinessSettingsSchema = z
  .object({
    businessName: z.string().trim().min(2).max(120),
    defaultTimezone: z.string().trim().min(1).max(80).refine(isValidTimeZone),
    locale: z.enum(["id-ID", "en-US"]),
    taxEnabled: z.boolean(),
    taxRateBps: z.number().int().min(0).max(10_000),
    taxIncluded: z.boolean(),
    quietHoursEnabled: z.boolean(),
    quietHoursStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/u),
    quietHoursEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/u),
    primaryColor: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^#[0-9A-F]{6}$/u),
    theme: z.enum(["light", "dark", "system"]),
    logoUrl: z.string().trim().url().max(2048).optional().nullable(),
    invoiceTemplate: z.string().trim().max(8192).optional().nullable(),
    receiptTemplate: z.string().trim().max(8192).optional().nullable(),
    certificateTemplate: z.string().trim().max(8192).optional().nullable(),
    features: z.object({
      commissions: z.boolean(),
      loyalty: z.boolean(),
      inpatient: z.boolean(),
    }),
  })
  .strict()
  .refine(({ taxEnabled, taxRateBps }) => !taxEnabled || taxRateBps > 0, {
    path: ["taxRateBps"],
    message: "Tarif pajak harus lebih dari nol jika pajak diaktifkan.",
  })
  .refine(
    ({ quietHoursEnabled, quietHoursStart, quietHoursEnd }) =>
      !quietHoursEnabled || quietHoursStart !== quietHoursEnd,
    {
      path: ["quietHoursEnd"],
      message: "Jam mulai dan selesai tenang harus berbeda.",
    },
  );

export const updateDocumentSequenceSchema = z
  .object({
    documentType: z.enum(DOCUMENT_TYPES),
    branchId: z.string().uuid().nullable(),
    prefix: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9/_-]{0,15}$/u),
    nextNumber: z.number().int().min(1).max(999_999_999_999),
    minimumWidth: z.number().int().min(1).max(12),
  })
  .strict();

export type UpdateBusinessSettingsInput = z.infer<typeof updateBusinessSettingsSchema>;
export type UpdateDocumentSequenceInput = z.infer<typeof updateDocumentSequenceSchema>;
export type FeatureKey = (typeof FEATURE_KEYS)[number];
export type DocumentType = (typeof DOCUMENT_TYPES)[number];
