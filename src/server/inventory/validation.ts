import { z } from "zod";

const quantitySchema = z
  .string()
  .regex(/^(0|[1-9]\d{0,10})(?:\.\d{1,3})?$/u)
  .refine((value) => Number(value) > 0, "Jumlah harus lebih dari nol.");
const costSchema = z.number().int().min(0).max(999_999_999_999);
const optionalDateSchema = z.iso.date().nullable().optional();

export const warehouseSchema = z.object({
  branchId: z.string().uuid(),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9_-]{0,19}$/u),
  name: z.string().trim().min(2).max(120),
});

export const supplierSchema = z.object({
  name: z.string().trim().min(2).max(160),
  contactName: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().email().max(254).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  isActive: z.boolean().default(true),
});

const productLineSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional().nullable(),
  quantity: quantitySchema,
  unitCostCents: costSchema.optional(),
});

export const purchaseRequestSchema = z.object({
  branchId: z.string().uuid(),
  notes: z.string().trim().max(2000).optional().nullable(),
  lines: z.array(productLineSchema).min(1).max(100),
});

export const purchaseOrderSchema = z.object({
  branchId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  supplierId: z.string().uuid(),
  requestId: z.string().uuid().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  lines: z
    .array(productLineSchema.extend({ unitCostCents: costSchema }))
    .min(1)
    .max(100),
});

export const receivePurchaseSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(120),
  notes: z.string().trim().max(2000).optional().nullable(),
  lines: z
    .array(
      z.object({
        orderLineId: z.string().uuid(),
        batchNumber: z.string().trim().min(1).max(100),
        expiresOn: optionalDateSchema,
        quantity: quantitySchema,
        unitCostCents: costSchema.optional(),
      }),
    )
    .min(1)
    .max(100),
});

export const inventoryAdjustmentSchema = z.object({
  warehouseId: z.string().uuid(),
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional().nullable(),
  direction: z.enum(["in", "out"]),
  quantity: quantitySchema,
  batchNumber: z.string().trim().min(1).max(100).optional(),
  expiresOn: optionalDateSchema,
  unitCostCents: costSchema.optional(),
  reason: z.string().trim().min(5).max(500),
  supervisorPin: z
    .string()
    .regex(/^\d{4,12}$/u)
    .optional(),
});

export const inventoryTransferSchema = z.object({
  sourceWarehouseId: z.string().uuid(),
  destinationWarehouseId: z.string().uuid(),
  reason: z.string().trim().min(5).max(500),
  lines: z
    .array(productLineSchema.omit({ unitCostCents: true }))
    .min(1)
    .max(100),
});

export const receiveTransferSchema = z.object({
  discrepancyReason: z.string().trim().min(5).max(500).optional(),
  lines: z
    .array(
      z.object({
        transferBatchLineId: z.string().uuid(),
        receivedQuantity: z.string().regex(/^(0|[1-9]\d{0,10})(?:\.\d{1,3})?$/u),
      }),
    )
    .min(1)
    .max(500),
});

export const stocktakeSchema = z.object({
  warehouseId: z.string().uuid(),
  reason: z.string().trim().min(5).max(500),
  lines: z
    .array(
      z.object({
        batchId: z.string().uuid(),
        countedQuantity: z.string().regex(/^(0|[1-9]\d{0,10})(?:\.\d{1,3})?$/u),
      }),
    )
    .min(1)
    .max(1000),
});

export const supplierReturnSchema = z
  .object({
    warehouseId: z.string().uuid(),
    supplierId: z.string().uuid(),
    reason: z.string().trim().min(5).max(500),
    lines: z
      .array(z.object({ batchId: z.string().uuid(), quantity: quantitySchema }))
      .min(1)
      .max(100),
  })
  .refine(({ lines }) => new Set(lines.map(({ batchId }) => batchId)).size === lines.length, {
    path: ["lines"],
    message: "Batch retur yang sama tidak boleh diulang.",
  });

export const reorderLevelsSchema = z.object({
  warehouseId: z.string().uuid(),
  lines: z
    .array(
      z.object({
        productId: z.string().uuid(),
        variantId: z.string().uuid().optional().nullable(),
        minimumQuantity: quantitySchema,
        reorderQuantity: quantitySchema,
      }),
    )
    .max(500),
});

export type WarehouseInput = z.infer<typeof warehouseSchema>;
export type SupplierInput = z.infer<typeof supplierSchema>;
export type PurchaseRequestInput = z.infer<typeof purchaseRequestSchema>;
export type PurchaseOrderInput = z.infer<typeof purchaseOrderSchema>;
export type ReceivePurchaseInput = z.infer<typeof receivePurchaseSchema>;
export type InventoryAdjustmentInput = z.infer<typeof inventoryAdjustmentSchema>;
export type InventoryTransferInput = z.infer<typeof inventoryTransferSchema>;
export type ReceiveTransferInput = z.infer<typeof receiveTransferSchema>;
export type StocktakeInput = z.infer<typeof stocktakeSchema>;
export type SupplierReturnInput = z.infer<typeof supplierReturnSchema>;
export type ReorderLevelsInput = z.infer<typeof reorderLevelsSchema>;
