import { z } from "zod";

const centsSchema = z.number().int().min(0).max(999_999_999_999);
const paymentSchema = z.object({
  method: z.enum([
    "cash",
    "bank_transfer",
    "card",
    "qris",
    "ewallet",
    "virtual_account",
    "deposit",
  ]),
  amountCents: z.number().int().min(1).max(999_999_999_999),
  reference: z.string().trim().max(120).optional().nullable(),
});
const quantitySchema = z
  .string()
  .regex(/^(0|[1-9]\d{0,10})(?:\.\d{1,3})?$/u)
  .refine((value) => Number(value) > 0);

const saleLineSchema = z.discriminatedUnion("itemType", [
  z.object({
    itemType: z.literal("product"),
    productId: z.string().uuid(),
    variantId: z.string().uuid().optional().nullable(),
    quantity: quantitySchema,
    notes: z.string().trim().max(500).optional().nullable(),
  }),
  z.object({
    itemType: z.literal("service"),
    serviceId: z.string().uuid(),
    quantity: quantitySchema,
    notes: z.string().trim().max(500).optional().nullable(),
  }),
]);

export const openShiftSchema = z.object({
  branchId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  openingCashCents: centsSchema,
});

export const closeShiftSchema = z.object({
  closingCashCents: centsSchema,
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const cashMovementSchema = z.object({
  movementType: z.enum(["cash_in", "cash_out"]),
  amountCents: z.number().int().min(1).max(999_999_999_999),
  reason: z.string().trim().min(5).max(500),
});

export const createSaleSchema = z.object({
  shiftId: z.string().uuid(),
  idempotencyKey: z.string().trim().min(8).max(120),
  priceTierId: z.string().uuid().optional().nullable(),
  hold: z.boolean().default(false),
  customerId: z.string().uuid().optional().nullable(),
  petId: z.string().uuid().optional().nullable(),
  discountBps: z.number().int().min(0).max(10_000).default(0),
  supervisorPin: z
    .string()
    .regex(/^\d{4,12}$/u)
    .optional(),
  voucherCode: z.string().trim().max(50).optional().nullable(),
  redeemLoyaltyPoints: z.number().int().min(0).optional().nullable(),
  useDeposit: z.boolean().default(false),
  notes: z.string().trim().max(1000).optional().nullable(),
  lines: z.array(saleLineSchema).min(1).max(100),
  payments: z.array(paymentSchema).max(20).default([]),
});

export const refundSaleSchema = z.object({
  shiftId: z.string().uuid(),
  idempotencyKey: z.string().trim().min(8).max(120),
  reason: z.string().trim().min(5).max(500),
  supervisorPin: z
    .string()
    .regex(/^\d{4,12}$/u)
    .optional(),
  lines: z
    .array(z.object({ saleLineId: z.string().uuid(), quantity: quantitySchema }))
    .min(1)
    .max(100)
    .refine((lines) => new Set(lines.map(({ saleLineId }) => saleLineId)).size === lines.length),
  payments: z.array(paymentSchema).min(1).max(20),
});

export const settleSaleSchema = z.object({
  shiftId: z.string().uuid(),
  idempotencyKey: z.string().trim().min(8).max(120),
  payments: z.array(paymentSchema).min(1).max(20),
});

export const resumeSaleSchema = z.object({
  shiftId: z.string().uuid(),
  idempotencyKey: z.string().trim().min(8).max(120),
  payments: z.array(paymentSchema).max(20).default([]),
  redeemLoyaltyPoints: z.number().int().min(0).optional().nullable(),
  useDeposit: z.boolean().default(false),
});

export const voidSaleSchema = z.object({
  shiftId: z.string().uuid(),
  idempotencyKey: z.string().trim().min(8).max(120),
  reason: z.string().trim().min(5).max(500),
  supervisorPin: z
    .string()
    .regex(/^\d{4,12}$/u)
    .optional(),
});

export const promotionSchema = z.object({
  branchId: z.string().uuid().optional().nullable(),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional().nullable(),
  discountType: z.enum(["percentage", "fixed_amount", "buy_x_get_y"]),
  discountValue: z.number().positive().max(999_999_999.999),
  minPurchaseCents: z.number().int().min(0).optional().nullable(),
  maxDiscountCents: z.number().int().min(0).optional().nullable(),
  appliesTo: z.enum(["all", "products", "services", "categories", "specific"]),
  targetIds: z.array(z.string().uuid()).max(100).default([]),
  priceTierId: z.string().uuid().optional().nullable(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  isActive: z.boolean().default(true),
  usageLimit: z.number().int().positive().optional().nullable(),
});

export const updatePromotionSchema = promotionSchema.partial();

export const voucherSchema = z.object({
  branchId: z.string().uuid().optional().nullable(),
  code: z.string().trim().min(1).max(50).toUpperCase(),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional().nullable(),
  discountType: z.enum(["percentage", "fixed_amount"]),
  discountValue: z.number().positive().max(999_999_999.999),
  minPurchaseCents: z.number().int().min(0).optional().nullable(),
  maxDiscountCents: z.number().int().min(0).optional().nullable(),
  appliesTo: z.enum(["all", "products", "services", "categories", "specific"]),
  targetIds: z.array(z.string().uuid()).max(100).default([]),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  isActive: z.boolean().default(true),
  usageLimit: z.number().int().positive().optional().nullable(),
  perCustomerLimit: z.number().int().positive().optional().nullable(),
});

export const updateVoucherSchema = voucherSchema.partial();

export const loyaltyTierSchema = z.object({
  branchId: z.string().uuid(),
  name: z.enum(["member", "silver", "gold", "platinum"]),
  minPoints: z.number().int().min(0),
  earnRateBps: z.number().int().min(0).max(10_000),
  redeemRateBps: z.number().int().min(1).max(10_000),
  minRedeemPoints: z.number().int().min(0).default(0),
  benefits: z.record(z.string(), z.unknown()).optional(),
});

export const customerDepositTransactionSchema = z.object({
  customerId: z.string().uuid(),
  branchId: z.string().uuid(),
  type: z.enum(["topup", "payment", "refund", "adjust", "transfer_in", "transfer_out"]),
  amountCents: z.number().int().min(1).max(999_999_999_999),
  sourceType: z.enum(["pos_sale", "pos_refund", "manual", "transfer", "system"]),
  sourceId: z.string().uuid().optional().nullable(),
  reference: z.string().trim().max(120).optional().nullable(),
});

export type OpenShiftInput = z.infer<typeof openShiftSchema>;
export type CloseShiftInput = z.infer<typeof closeShiftSchema>;
export type CashMovementInput = z.infer<typeof cashMovementSchema>;
export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type RefundSaleInput = z.infer<typeof refundSaleSchema>;
export type SettleSaleInput = z.infer<typeof settleSaleSchema>;
export type ResumeSaleInput = z.infer<typeof resumeSaleSchema>;
export type VoidSaleInput = z.infer<typeof voidSaleSchema>;
export type PromotionInput = z.infer<typeof promotionSchema>;
export type UpdatePromotionInput = z.infer<typeof updatePromotionSchema>;
export type VoucherInput = z.infer<typeof voucherSchema>;
export type UpdateVoucherInput = z.infer<typeof updateVoucherSchema>;
export type LoyaltyTierInput = z.infer<typeof loyaltyTierSchema>;
export type CustomerDepositTransactionInput = z.infer<typeof customerDepositTransactionSchema>;
