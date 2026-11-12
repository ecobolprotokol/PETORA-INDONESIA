import { and, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import { getDatabase } from "@/db";
import { posVoucherUsages, posVouchers } from "@/db/schema";

type VoucherTransaction = PgTransaction<
  Record<string, unknown>,
  Record<string, unknown>,
  Record<string, unknown>
>;

export class PosVoucherNotFoundError extends Error {}
export class PosVoucherInvalidError extends Error {}
export class PosVoucherExpiredError extends Error {}
export class PosVoucherUsageLimitExceededError extends Error {}
export class PosVoucherNotApplicableError extends Error {}
export class PosVoucherAlreadyUsedError extends Error {}

function isConstraint(error: unknown, constraint: string) {
  const cause =
    typeof error === "object" && error !== null && "cause" in error ? error.cause : error;
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    cause.code === "23505" &&
    "constraint" in cause &&
    cause.constraint === constraint
  );
}

export interface VoucherApplicableResult {
  voucherId: string;
  code: string;
  name: string;
  discountType: "percentage" | "fixed_amount";
  discountValue: number;
  discountCents: number;
  appliesTo: "all" | "products" | "services" | "categories" | "specific";
  targetIds: string[];
}

export async function listVouchers(branchId: string | null, includeInactive = false) {
  const database = getDatabase();
  const conditions = branchId ? eq(posVouchers.branchId, branchId) : isNull(posVouchers.branchId);
  if (!includeInactive) {
    const now = new Date();
    return database
      .select()
      .from(posVouchers)
      .where(
        and(
          conditions,
          eq(posVouchers.isActive, true),
          lte(posVouchers.startsAt, now),
          gte(posVouchers.endsAt, now),
        ),
      )
      .orderBy(posVouchers.createdAt);
  }
  return database.select().from(posVouchers).where(conditions).orderBy(desc(posVouchers.createdAt));
}

export async function getVoucher(id: string) {
  const [voucher] = await getDatabase()
    .select()
    .from(posVouchers)
    .where(eq(posVouchers.id, id))
    .limit(1);
  return voucher ?? null;
}

export async function getVoucherByCode(branchId: string | null, code: string) {
  const [voucher] = await getDatabase()
    .select()
    .from(posVouchers)
    .where(
      and(
        branchId ? eq(posVouchers.branchId, branchId) : isNull(posVouchers.branchId),
        eq(posVouchers.code, code.toUpperCase()),
      ),
    )
    .limit(1);
  return voucher ?? null;
}

export interface CreateVoucherInput {
  branchId: string | null;
  code: string;
  name: string;
  description: string | null;
  discountType: "percentage" | "fixed_amount";
  discountValue: number;
  minPurchaseCents: number | null;
  maxDiscountCents: number | null;
  appliesTo: "all" | "products" | "services" | "categories" | "specific";
  targetIds: string[];
  startsAt: Date;
  endsAt: Date;
  usageLimit: number | null;
  perCustomerLimit: number | null;
}

export async function createVoucher(input: CreateVoucherInput, actorUserId: string) {
  try {
    return await getDatabase().transaction(async (tx) => {
      const [voucher] = await tx
        .insert(posVouchers)
        .values({
          branchId: input.branchId,
          code: input.code.toUpperCase(),
          name: input.name,
          description: input.description,
          discountType: input.discountType,
          discountValue: input.discountValue.toString(),
          minPurchaseCents: input.minPurchaseCents,
          maxDiscountCents: input.maxDiscountCents,
          appliesTo: input.appliesTo,
          targetIds: input.targetIds,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          usageLimit: input.usageLimit,
          perCustomerLimit: input.perCustomerLimit,
          createdBy: actorUserId,
          updatedBy: actorUserId,
        })
        .returning();
      if (!voucher) throw new Error("Voucher gagal dibuat.");
      return voucher;
    });
  } catch (error) {
    if (isConstraint(error, "pos_vouchers_code_branch_lower_unique")) {
      throw new PosVoucherInvalidError("Kode voucher sudah digunakan pada cabang ini.");
    }
    throw error;
  }
}

export interface UpdateVoucherInput {
  code?: string;
  name?: string;
  description?: string | null;
  discountType?: "percentage" | "fixed_amount";
  discountValue?: number;
  minPurchaseCents?: number | null;
  maxDiscountCents?: number | null;
  appliesTo?: "all" | "products" | "services" | "categories" | "specific";
  targetIds?: string[];
  startsAt?: Date;
  endsAt?: Date;
  isActive?: boolean;
  usageLimit?: number | null;
  perCustomerLimit?: number | null;
}

export async function updateVoucher(id: string, input: UpdateVoucherInput, actorUserId: string) {
  try {
    const [voucher] = await getDatabase()
      .update(posVouchers)
      .set({
        ...input,
        code: input.code?.toUpperCase(),
        discountValue: input.discountValue?.toString(),
        updatedBy: actorUserId,
        updatedAt: new Date(),
      })
      .where(eq(posVouchers.id, id))
      .returning();
    if (!voucher) throw new PosVoucherNotFoundError("Voucher tidak ditemukan.");
    return voucher;
  } catch (error) {
    if (isConstraint(error, "pos_vouchers_code_branch_lower_unique")) {
      throw new PosVoucherInvalidError("Kode voucher sudah digunakan pada cabang ini.");
    }
    throw error;
  }
}

export async function deleteVoucher(id: string, _actorUserId: string) {
  const [voucher] = await getDatabase()
    .delete(posVouchers)
    .where(eq(posVouchers.id, id))
    .returning({ id: posVouchers.id });
  if (!voucher) throw new PosVoucherNotFoundError("Voucher tidak ditemukan.");
  return voucher.id;
}

function checkVoucherApplicable(
  voucher: typeof posVouchers.$inferSelect,
  branchId: string,
  customerId: string | null,
  lineItems: Array<{
    itemType: "product" | "service";
    productId?: string;
    variantId?: string;
    serviceId?: string;
    quantity: number;
    unitPriceCents: number;
  }>,
  subtotalCents: number,
) {
  if (!voucher.isActive) throw new PosVoucherInvalidError("Voucher tidak aktif.");
  const now = new Date();
  if (voucher.startsAt > now || voucher.endsAt < now)
    throw new PosVoucherExpiredError("Voucher sudah kedaluwarsa.");
  if (voucher.usageLimit !== null && voucher.usageCount >= voucher.usageLimit) {
    throw new PosVoucherUsageLimitExceededError("Batas penggunaan voucher tercapai.");
  }
  if (voucher.minPurchaseCents !== null && subtotalCents < voucher.minPurchaseCents) {
    throw new PosVoucherNotApplicableError(
      `Minimum pembelian Rp ${(voucher.minPurchaseCents / 100).toLocaleString("id-ID")}.`,
    );
  }
  if (voucher.branchId && voucher.branchId !== branchId) {
    throw new PosVoucherNotApplicableError("Voucher tidak berlaku untuk cabang ini.");
  }
  if (voucher.perCustomerLimit !== null && customerId) {
    throw new PosVoucherNotApplicableError("Batas per pelanggan perlu diverifikasi di transaksi.");
  }

  if (voucher.appliesTo !== "all" && lineItems.length > 0) {
    const applicableItems = lineItems.filter((item) => {
      if (voucher.appliesTo === "products" && item.itemType === "product") return true;
      if (voucher.appliesTo === "services" && item.itemType === "service") return true;
      if (voucher.appliesTo === "specific" && voucher.targetIds.length > 0) {
        if (
          item.itemType === "product" &&
          item.productId &&
          voucher.targetIds.includes(item.productId)
        )
          return true;
        if (
          item.itemType === "service" &&
          item.serviceId &&
          voucher.targetIds.includes(item.serviceId)
        )
          return true;
      }
      return false;
    });
    if (applicableItems.length === 0) {
      throw new PosVoucherNotApplicableError("Tidak ada item yang memenuhi syarat voucher.");
    }
  }
}

function calculateVoucherDiscount(
  voucher: typeof posVouchers.$inferSelect,
  lineItems: Array<{
    itemType: "product" | "service";
    productId?: string;
    variantId?: string;
    serviceId?: string;
    quantity: number;
    unitPriceCents: number;
  }>,
  subtotalCents: number,
): number {
  if (voucher.discountType === "percentage") {
    const applicableSubtotal =
      voucher.appliesTo === "all"
        ? subtotalCents
        : lineItems
            .filter((item) => {
              if (voucher.appliesTo === "products" && item.itemType === "product") return true;
              if (voucher.appliesTo === "services" && item.itemType === "service") return true;
              if (voucher.appliesTo === "specific" && voucher.targetIds.length > 0) {
                if (
                  item.itemType === "product" &&
                  item.productId &&
                  voucher.targetIds.includes(item.productId)
                )
                  return true;
                if (
                  item.itemType === "service" &&
                  item.serviceId &&
                  voucher.targetIds.includes(item.serviceId)
                )
                  return true;
              }
              return false;
            })
            .reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
    const discount = Math.floor((applicableSubtotal * Number(voucher.discountValue)) / 100);
    return voucher.maxDiscountCents !== null
      ? Math.min(discount, voucher.maxDiscountCents)
      : discount;
  }
  if (voucher.discountType === "fixed_amount") {
    const discountValue = Number(voucher.discountValue);
    return voucher.maxDiscountCents !== null
      ? Math.min(discountValue, voucher.maxDiscountCents)
      : discountValue;
  }
  return 0;
}

export async function validateVoucherForSale(
  branchId: string,
  code: string,
  customerId: string | null,
  lineItems: Array<{
    itemType: "product" | "service";
    productId?: string;
    variantId?: string;
    serviceId?: string;
    quantity: number;
    unitPriceCents: number;
  }>,
  subtotalCents: number,
): Promise<VoucherApplicableResult> {
  const voucher = await getVoucherByCode(branchId, code);
  if (!voucher) throw new PosVoucherNotFoundError("Voucher tidak ditemukan.");

  checkVoucherApplicable(voucher, branchId, customerId, lineItems, subtotalCents);

  if (customerId && voucher.perCustomerLimit !== null) {
    const [usageCount] = await getDatabase()
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(posVoucherUsages)
      .where(
        and(
          eq(posVoucherUsages.voucherId, voucher.id),
          eq(posVoucherUsages.customerId, customerId),
        ),
      );
    if ((usageCount?.count ?? 0) >= voucher.perCustomerLimit) {
      throw new PosVoucherUsageLimitExceededError(
        "Batas penggunaan voucher per pelanggan tercapai.",
      );
    }
  }

  const discountCents = calculateVoucherDiscount(voucher, lineItems, subtotalCents);
  if (discountCents <= 0) {
    throw new PosVoucherNotApplicableError("Voucher tidak memberikan diskon pada item ini.");
  }

  return {
    voucherId: voucher.id,
    code: voucher.code,
    name: voucher.name,
    discountType: voucher.discountType,
    discountValue: Number(voucher.discountValue),
    discountCents,
    appliesTo: voucher.appliesTo,
    targetIds: voucher.targetIds,
  };
}

export async function recordVoucherUsage(
  tx: VoucherTransaction,
  voucherId: string,
  customerId: string | null,
  saleId: string,
  discountCents: number,
) {
  const [voucher] = await tx
    .select()
    .from(posVouchers)
    .where(eq(posVouchers.id, voucherId))
    .for("update")
    .limit(1);
  if (!voucher) throw new PosVoucherNotFoundError("Voucher tidak ditemukan.");
  if (voucher.usageLimit !== null && voucher.usageCount >= voucher.usageLimit) {
    throw new PosVoucherUsageLimitExceededError("Batas penggunaan voucher tercapai.");
  }
  await tx
    .update(posVouchers)
    .set({ usageCount: voucher.usageCount + 1, updatedAt: new Date() })
    .where(eq(posVouchers.id, voucherId));

  await tx.insert(posVoucherUsages).values({
    voucherId,
    customerId,
    saleId,
    discountCents,
  });
}
