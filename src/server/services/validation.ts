import { z } from "zod";

const nullableUuid = z
  .string()
  .uuid()
  .nullable()
  .optional()
  .transform((value) => value || null);

export const serviceSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    code: z.string().trim().min(1).max(80),
    categoryId: nullableUuid,
    description: z.string().trim().max(4000).nullable().optional(),
    durationMinutes: z.number().int().min(1).max(1440),
    isActive: z.boolean().default(true),
    prices: z
      .array(
        z.object({
          branchId: nullableUuid,
          priceTierId: nullableUuid,
          priceCents: z.number().int().min(0).max(9_000_000_000_000),
        }),
      )
      .min(1)
      .max(100)
      .refine(
        (prices) =>
          new Set(
            prices.map(({ branchId, priceTierId }) => `${branchId ?? "*"}:${priceTierId ?? "*"}`),
          ).size === prices.length,
      ),
  })
  .strict();

export const serviceCategorySchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export type ServiceInput = z.infer<typeof serviceSchema>;
