import { z } from "zod";

const nullableUuid = z
  .string()
  .uuid()
  .nullable()
  .optional()
  .transform((value) => value || null);
const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .or(z.literal(""))
    .nullable()
    .optional()
    .transform((value) => value || null);

export const productPriceSchema = z.object({
  branchId: nullableUuid,
  priceTierId: nullableUuid,
  purchasePriceCents: z.number().int().min(0).max(9_000_000_000_000).nullable().optional(),
  sellingPriceCents: z.number().int().min(0).max(9_000_000_000_000),
});

const productPricesSchema = z
  .array(productPriceSchema)
  .min(1)
  .max(100)
  .refine(
    (prices) =>
      new Set(prices.map(({ branchId, priceTierId }) => `${branchId ?? "*"}:${priceTierId ?? "*"}`))
        .size === prices.length,
  );

const productVariantSchema = z.object({
  name: z.string().trim().min(1).max(120),
  sku: z.string().trim().min(1).max(80),
  barcodes: z.array(z.string().trim().min(4).max(80)).max(20).default([]),
  prices: productPricesSchema,
});

export const productSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    sku: z.string().trim().min(1).max(80),
    productType: z.enum(["general", "medicine", "feed", "accessory"]),
    categoryId: nullableUuid,
    brand: nullableText(120),
    photoUrl: z
      .string()
      .trim()
      .url()
      .max(2048)
      .or(z.literal(""))
      .nullable()
      .optional()
      .transform((value) => value || null),
    description: nullableText(4000),
    baseUnitId: nullableUuid,
    medicineClass: nullableText(120),
    prescriptionRequired: z.boolean().default(false),
    isActive: z.boolean().default(true),
    barcodes: z.array(z.string().trim().min(4).max(80)).max(20).default([]),
    unitConversions: z
      .array(
        z.object({
          unitId: z.string().uuid(),
          conversionFactor: z.number().positive().max(1_000_000),
        }),
      )
      .max(20)
      .default([]),
    prices: productPricesSchema,
    variants: z.array(productVariantSchema).max(100).default([]),
  })
  .strict()
  .superRefine((product, context) => {
    if (
      product.productType !== "medicine" &&
      (product.medicineClass || product.prescriptionRequired)
    ) {
      context.addIssue({
        code: "custom",
        path: ["medicineClass"],
        message: "Golongan dan resep hanya berlaku untuk produk obat.",
      });
    }

    const identifiers = [
      product.sku,
      ...product.variants.map(({ sku }) => sku),
      ...product.barcodes,
      ...product.variants.flatMap(({ barcodes }) => barcodes),
    ];
    if (new Set(identifiers.map((value) => value.toLowerCase())).size !== identifiers.length) {
      context.addIssue({
        code: "custom",
        path: ["variants"],
        message: "SKU atau barcode produk dan variannya tidak boleh duplikat.",
      });
    }
    if (
      new Set(product.unitConversions.map(({ unitId }) => unitId)).size !==
      product.unitConversions.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["unitConversions"],
        message: "Satuan konversi tidak boleh berulang.",
      });
    }
  });

export const productCategorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  parentId: nullableUuid,
});

export const unitSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    abbreviation: z.string().trim().min(1).max(20),
    dimension: z.enum(["count", "mass", "volume", "length"]),
    baseUnitId: nullableUuid,
    toBaseFactor: z.number().positive().max(1_000_000).default(1),
  })
  .superRefine((unit, context) => {
    if (!unit.baseUnitId && unit.toBaseFactor !== 1) {
      context.addIssue({
        code: "custom",
        path: ["toBaseFactor"],
        message: "Satuan dasar harus memiliki faktor konversi 1.",
      });
    }
  });

export const priceTierSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).default(""),
});

export type ProductInput = z.infer<typeof productSchema>;
