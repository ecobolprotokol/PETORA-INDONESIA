import { and, desc, eq, gte, isNull, lte } from "drizzle-orm";
import { getDatabase } from "@/db";
import { posPromotions } from "@/db/schema";

export class PosPromotionNotFoundError extends Error {}
export class PosPromotionInvalidError extends Error {}
export class PosPromotionExpiredError extends Error {}
export class PosPromotionUsageLimitExceededError extends Error {}
export class PosPromotionNotApplicableError extends Error {}

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

export interface PromoApplicableResult {
  promotionId: string;
  name: string;
  discountType: "percentage" | "fixed_amount" | "buy_x_get_y";
  discountValue: number;
  discountCents: number;
  appliesTo: "all" | "products" | "services" | "categories" | "specific";
  targetIds: string[];
}

export async function listPromotions(branchId: string | null, includeInactive = false) {
  const database = getDatabase();
  const conditions = branchId
    ? eq(posPromotions.branchId, branchId)
    : isNull(posPromotions.branchId);
  if (!includeInactive) {
    const now = new Date();
    return database
      .select()
      .from(posPromotions)
      .where(
        and(
          conditions,
          eq(posPromotions.isActive, true),
          lte(posPromotions.startsAt, now),
          gte(posPromotions.endsAt, now),
        ),
      )
      .orderBy(desc(posPromotions.priority), posPromotions.startsAt);
  }
  return database
    .select()
    .from(posPromotions)
    .where(conditions)
    .orderBy(desc(posPromotions.priority), posPromotions.startsAt);
}

export async function getPromotion(id: string) {
  const [promo] = await getDatabase()
    .select()
    .from(posPromotions)
    .where(eq(posPromotions.id, id))
    .limit(1);
  return promo ?? null;
}

export interface CreatePromotionInput {
  branchId: string | null;
  name: string;
  description: string | null;
  discountType: "percentage" | "fixed_amount" | "buy_x_get_y";
  discountValue: number;
  minPurchaseCents: number | null;
  maxDiscountCents: number | null;
  appliesTo: "all" | "products" | "services" | "categories" | "specific";
  targetIds: string[];
  priceTierId: string | null;
  startsAt: Date;
  endsAt: Date;
  usageLimit: number | null;
}

export async function createPromotion(input: CreatePromotionInput, actorUserId: string) {
  try {
    return await getDatabase().transaction(async (tx) => {
      const [promo] = await tx
        .insert(posPromotions)
        .values({
          branchId: input.branchId,
          name: input.name,
          description: input.description,
          discountType: input.discountType,
          discountValue: input.discountValue.toString(),
          minPurchaseCents: input.minPurchaseCents,
          maxDiscountCents: input.maxDiscountCents,
          appliesTo: input.appliesTo,
          targetIds: input.targetIds,
          priceTierId: input.priceTierId,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          usageLimit: input.usageLimit,
          createdBy: actorUserId,
          updatedBy: actorUserId,
        })
        .returning();
      if (!promo) throw new Error("Promo gagal dibuat.");
      return promo;
    });
  } catch (error) {
    if (isConstraint(error, "pos_promotions_branch_code_lower_unique")) {
      throw new PosPromotionInvalidError("Kode promo sudah digunakan pada cabang ini.");
    }
    throw error;
  }
}

export interface UpdatePromotionInput {
  name?: string;
  description?: string | null;
  discountType?: "percentage" | "fixed_amount" | "buy_x_get_y";
  discountValue?: number;
  minPurchaseCents?: number | null;
  maxDiscountCents?: number | null;
  appliesTo?: "all" | "products" | "services" | "categories" | "specific";
  targetIds?: string[];
  priceTierId?: string | null;
  startsAt?: Date;
  endsAt?: Date;
  isActive?: boolean;
  usageLimit?: number | null;
}

export async function updatePromotion(
  id: string,
  input: UpdatePromotionInput,
  actorUserId: string,
) {
  try {
    const [promo] = await getDatabase()
      .update(posPromotions)
      .set({
        ...input,
        discountValue: input.discountValue?.toString(),
        updatedBy: actorUserId,
        updatedAt: new Date(),
      })
      .where(eq(posPromotions.id, id))
      .returning();
    if (!promo) throw new PosPromotionNotFoundError("Promo tidak ditemukan.");
    return promo;
  } catch (error) {
    if (isConstraint(error, "pos_promotions_branch_code_lower_unique")) {
      throw new PosPromotionInvalidError("Kode promo sudah digunakan pada cabang ini.");
    }
    throw error;
  }
}

export async function deletePromotion(id: string, _actorUserId: string) {
  const [promo] = await getDatabase()
    .delete(posPromotions)
    .where(eq(posPromotions.id, id))
    .returning({ id: posPromotions.id });
  if (!promo) throw new PosPromotionNotFoundError("Promo tidak ditemukan.");
  return promo.id;
}

export function checkPromotionApplicable(
  promo: typeof posPromotions.$inferSelect,
  branchId: string,
  priceTierId: string | null,
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
  if (!promo.isActive) throw new PosPromotionInvalidError("Promo tidak aktif.");
  const now = new Date();
  if (promo.startsAt > now || promo.endsAt < now)
    throw new PosPromotionExpiredError("Promo sudah kedaluwarsa.");
  if (promo.usageLimit !== null && promo.usageCount >= promo.usageLimit) {
    throw new PosPromotionUsageLimitExceededError("Batas penggunaan promo tercapai.");
  }
  if (promo.minPurchaseCents !== null && subtotalCents < promo.minPurchaseCents) {
    throw new PosPromotionNotApplicableError(
      `Minimum pembelian Rp ${(promo.minPurchaseCents / 100).toLocaleString("id-ID")}.`,
    );
  }
  if (promo.branchId && promo.branchId !== branchId) {
    throw new PosPromotionNotApplicableError("Promo tidak berlaku untuk cabang ini.");
  }
  if (promo.priceTierId && promo.priceTierId !== priceTierId) {
    throw new PosPromotionNotApplicableError("Promo tidak berlaku untuk tier harga ini.");
  }

  if (promo.appliesTo !== "all" && lineItems.length > 0) {
    const applicableItems = lineItems.filter((item) => {
      if (promo.appliesTo === "products" && item.itemType === "product") return true;
      if (promo.appliesTo === "services" && item.itemType === "service") return true;
      if (promo.appliesTo === "specific" && promo.targetIds.length > 0) {
        if (
          item.itemType === "product" &&
          item.productId &&
          promo.targetIds.includes(item.productId)
        )
          return true;
        if (
          item.itemType === "service" &&
          item.serviceId &&
          promo.targetIds.includes(item.serviceId)
        )
          return true;
      }
      return false;
    });
    if (applicableItems.length === 0) {
      throw new PosPromotionNotApplicableError("Tidak ada item yang memenuhi syarat promo.");
    }
  }
}

export function calculatePromotionDiscount(
  promo: typeof posPromotions.$inferSelect,
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
  if (promo.discountType === "percentage") {
    const applicableSubtotal =
      promo.appliesTo === "all"
        ? subtotalCents
        : lineItems
            .filter((item) => {
              if (promo.appliesTo === "products" && item.itemType === "product") return true;
              if (promo.appliesTo === "services" && item.itemType === "service") return true;
              if (promo.appliesTo === "specific" && promo.targetIds.length > 0) {
                if (
                  item.itemType === "product" &&
                  item.productId &&
                  promo.targetIds.includes(item.productId)
                )
                  return true;
                if (
                  item.itemType === "service" &&
                  item.serviceId &&
                  promo.targetIds.includes(item.serviceId)
                )
                  return true;
              }
              return false;
            })
            .reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
    const discount = Math.floor((applicableSubtotal * Number(promo.discountValue)) / 100);
    return promo.maxDiscountCents !== null ? Math.min(discount, promo.maxDiscountCents) : discount;
  }
  if (promo.discountType === "fixed_amount") {
    const discountValue = Number(promo.discountValue);
    return promo.maxDiscountCents !== null
      ? Math.min(discountValue, promo.maxDiscountCents)
      : discountValue;
  }
  if (promo.discountType === "buy_x_get_y") {
    const x = Math.floor(Number(promo.discountValue));
    const applicableItems = lineItems.filter((item) => {
      if (promo.appliesTo === "all") return true;
      if (promo.appliesTo === "products" && item.itemType === "product") return true;
      if (promo.appliesTo === "services" && item.itemType === "service") return true;
      if (promo.appliesTo === "specific" && promo.targetIds.length > 0) {
        if (
          item.itemType === "product" &&
          item.productId &&
          promo.targetIds.includes(item.productId)
        )
          return true;
        if (
          item.itemType === "service" &&
          item.serviceId &&
          promo.targetIds.includes(item.serviceId)
        )
          return true;
      }
      return false;
    });
    const totalQuantity = applicableItems.reduce((sum, item) => sum + item.quantity, 0);
    const freeCount = Math.floor(totalQuantity / x);
    if (freeCount === 0) return 0;
    applicableItems.sort((a, b) => a.unitPriceCents - b.unitPriceCents);
    let freeQuantity = freeCount;
    let discount = 0;
    for (const item of applicableItems) {
      if (freeQuantity <= 0) break;
      const give = Math.min(freeQuantity, item.quantity);
      discount += give * item.unitPriceCents;
      freeQuantity -= give;
    }
    return promo.maxDiscountCents !== null ? Math.min(discount, promo.maxDiscountCents) : discount;
  }
  return 0;
}

export async function findApplicablePromotions(
  branchId: string,
  priceTierId: string | null,
  lineItems: Array<{
    itemType: "product" | "service";
    productId?: string;
    variantId?: string;
    serviceId?: string;
    quantity: number;
    unitPriceCents: number;
  }>,
  subtotalCents: number,
): Promise<PromoApplicableResult[]> {
  const promotions = await listPromotions(branchId);
  const results: PromoApplicableResult[] = [];

  for (const promo of promotions) {
    try {
      checkPromotionApplicable(promo, branchId, priceTierId, lineItems, subtotalCents);
      const discountCents = calculatePromotionDiscount(promo, lineItems, subtotalCents);
      if (discountCents > 0) {
        results.push({
          promotionId: promo.id,
          name: promo.name,
          discountType: promo.discountType,
          discountValue: Number(promo.discountValue),
          discountCents,
          appliesTo: promo.appliesTo,
          targetIds: promo.targetIds,
        });
      }
    } catch {
      // Promotion not applicable, skip
    }
  }

  results.sort((a, b) => {
    const promoA = promotions.find((p) => p.id === a.promotionId);
    const promoB = promotions.find((p) => p.id === b.promotionId);
    return (promoB?.priority ?? 0) - (promoA?.priority ?? 0);
  });

  return results;
}

export async function applyPromotionToSale(
  tx: PromoTransaction,
  promotionId: string,
  _saleId: string,
  _discountCents: number,
) {
  const [promo] = await tx
    .select()
    .from(posPromotions)
    .where(eq(posPromotions.id, promotionId))
    .for("update")
    .limit(1);
  if (!promo) throw new PosPromotionNotFoundError("Promo tidak ditemukan.");
  if (promo.usageLimit !== null && promo.usageCount >= promo.usageLimit) {
    throw new PosPromotionUsageLimitExceededError("Batas penggunaan promo tercapai.");
  }
  await tx
    .update(posPromotions)
    .set({ usageCount: promo.usageCount + 1, updatedAt: new Date() })
    .where(eq(posPromotions.id, promotionId));
}
