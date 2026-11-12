import { createHash } from "node:crypto";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { NodePgTransaction } from "drizzle-orm/node-postgres";
import { getDatabase } from "@/db";
import type * as schema from "@/db/schema";
import {
  auditEvents,
  businessSettings,
  customerDeposits,
  customers,
  inventoryBatches,
  inventoryMovements,
  loyaltyTransactions,
  petOwners,
  pets,
  posCashMovements,
  posPayments,
  posRefundLines,
  posRefundPayments,
  posRefundStockAllocations,
  posRefunds,
  posSaleLines,
  posSaleStockAllocations,
  posSales,
  posShifts,
  priceTiers,
  productBarcodes,
  productPrices,
  products,
  productVariants,
  servicePrices,
  services,
  systemState,
  warehouses,
} from "@/db/schema";
import type { StaffAuthorization } from "@/server/access/service";
import { centsForQuantity, formatQuantity, parseQuantity } from "@/server/inventory/quantity";
import {
  consumeFromBatches,
  lockWarehouse,
  validateProductVariant,
} from "@/server/inventory/service";
import { nextDocumentNumber } from "@/server/settings/numbering";
import { verifySupervisorPin } from "@/server/supervisor/pin";
import { applyPromotionToSale, findApplicablePromotions } from "./promotions";
import { recordVoucherUsage, validateVoucherForSale } from "./vouchers";
import {
  earnLoyaltyPoints,
  payFromCustomerDeposit,
  redeemLoyaltyPoints,
  refundLoyaltyPoints,
  adjustLoyaltyPoints,
  refundToCustomerDeposit,
} from "./loyalty";
import type {
  CashMovementInput,
  CreateSaleInput,
  OpenShiftInput,
  RefundSaleInput,
  ResumeSaleInput,
  SettleSaleInput,
  VoidSaleInput,
} from "./validation";

type PosTransaction = NodePgTransaction<typeof schema, ExtractTablesWithRelations<typeof schema>>;

export class PosShiftConflictError extends Error {}
export class PosShiftNotFoundError extends Error {}
export class PosShiftClosedError extends Error {}
export class PosSaleInvalidError extends Error {}
export class PosPaymentInvalidError extends Error {}
export class PosDiscountApprovalRequiredError extends Error {}
export class PosIdempotencyConflictError extends Error {}
export class PosRefundInvalidError extends Error {}
export class PosRefundApprovalRequiredError extends Error {}
export class PosVoidInvalidError extends Error {}
export class PosVoidApprovalRequiredError extends Error {}

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

function percentageOf(amount: number, basisPoints: number) {
  return Number((BigInt(amount) * BigInt(basisPoints) + 5_000n) / 10_000n);
}

function taxOf(amount: number, rateBps: number, included: boolean) {
  if (rateBps === 0) return 0;
  const numerator = BigInt(amount) * BigInt(rateBps);
  const denominator = included ? 10_000n + BigInt(rateBps) : 10_000n;
  return Number((numerator + denominator / 2n) / denominator);
}

function ensureSafeCents(amount: number) {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new PosSaleInvalidError("Nilai penjualan melebihi batas yang dapat diproses.");
  }
  return amount;
}

function saleRequestFingerprint(input: CreateSaleInput) {
  const payload = {
    shiftId: input.shiftId,
    hold: input.hold,
    customerId: input.customerId ?? null,
    petId: input.petId ?? null,
    priceTierId: input.priceTierId ?? null,
    discountBps: input.discountBps,
    voucherCode: input.voucherCode ?? null,
    redeemLoyaltyPoints: input.redeemLoyaltyPoints ?? null,
    useDeposit: input.useDeposit ?? false,
    notes: input.notes ?? null,
    lines: input.lines.map((line) =>
      line.itemType === "product"
        ? {
            itemType: line.itemType,
            productId: line.productId,
            variantId: line.variantId ?? null,
            quantity: line.quantity,
            notes: line.notes ?? null,
          }
        : {
            itemType: line.itemType,
            serviceId: line.serviceId,
            quantity: line.quantity,
            notes: line.notes ?? null,
          },
    ),
    payments: input.payments.map((payment) => ({
      method: payment.method,
      amountCents: payment.amountCents,
      reference: payment.reference ?? null,
    })),
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export async function listPosBranchData(branchId: string) {
  const database = getDatabase();
  const [shifts, sales, warehouseRows, productRows, serviceRows, tierRows] = await Promise.all([
    database
      .select({
        id: posShifts.id,
        warehouseId: posShifts.warehouseId,
        warehouseName: warehouses.name,
        cashierId: posShifts.cashierId,
        status: posShifts.status,
        openingCashCents: posShifts.openingCashCents,
        openedAt: posShifts.openedAt,
        closedAt: posShifts.closedAt,
        closingCashCents: posShifts.closingCashCents,
        expectedCashCents: posShifts.expectedCashCents,
      })
      .from(posShifts)
      .innerJoin(warehouses, eq(posShifts.warehouseId, warehouses.id))
      .where(eq(posShifts.branchId, branchId))
      .orderBy(desc(posShifts.openedAt))
      .limit(30),
    database
      .select({
        id: posSales.id,
        invoiceNumber: posSales.invoiceNumber,
        status: posSales.status,
        totalCents: posSales.totalCents,
        paidCents: posSales.paidCents,
        refundedCents: posSales.refundedCents,
        createdAt: posSales.createdAt,
        cashierId: posSales.cashierId,
        customerName: customers.name,
      })
      .from(posSales)
      .leftJoin(customers, eq(posSales.customerId, customers.id))
      .where(eq(posSales.branchId, branchId))
      .orderBy(desc(posSales.createdAt))
      .limit(50),
    database
      .select({ id: warehouses.id, name: warehouses.name, code: warehouses.code })
      .from(warehouses)
      .where(and(eq(warehouses.branchId, branchId), eq(warehouses.isActive, true)))
      .orderBy(warehouses.name),
    database
      .select({
        productId: products.id,
        productName: products.name,
        sku: products.sku,
        variantId: productVariants.id,
        variantName: productVariants.name,
        variantSku: productVariants.sku,
        priceTierId: productPrices.priceTierId,
        priceCents: productPrices.sellingPriceCents,
      })
      .from(productPrices)
      .innerJoin(products, eq(productPrices.productId, products.id))
      .leftJoin(productVariants, eq(productPrices.variantId, productVariants.id))
      .where(
        and(
          eq(products.isActive, true),
          or(isNull(productVariants.id), eq(productVariants.isActive, true)),
          or(eq(productPrices.branchId, branchId), isNull(productPrices.branchId)),
        ),
      )
      .orderBy(desc(sql`CASE WHEN ${productPrices.branchId} = ${branchId} THEN 1 ELSE 0 END`)),
    database
      .select({
        serviceId: services.id,
        name: services.name,
        code: services.code,
        priceTierId: servicePrices.priceTierId,
        priceCents: servicePrices.priceCents,
      })
      .from(servicePrices)
      .innerJoin(services, eq(servicePrices.serviceId, services.id))
      .where(
        and(
          eq(services.isActive, true),
          or(eq(servicePrices.branchId, branchId), isNull(servicePrices.branchId)),
        ),
      )
      .orderBy(desc(sql`CASE WHEN ${servicePrices.branchId} = ${branchId} THEN 1 ELSE 0 END`)),
    database
      .select({ id: priceTiers.id, name: priceTiers.name })
      .from(priceTiers)
      .where(eq(priceTiers.isActive, true))
      .orderBy(priceTiers.name),
  ]);
  const barcodeRows = productRows.length
    ? await database
        .select({
          productId: productBarcodes.productId,
          variantId: productBarcodes.variantId,
          barcode: productBarcodes.barcode,
        })
        .from(productBarcodes)
        .where(
          inArray(productBarcodes.productId, [
            ...new Set(productRows.map(({ productId }) => productId)),
          ]),
        )
    : [];
  const productMap = new Map<
    string,
    {
      productId: string;
      productName: string;
      sku: string;
      variantId: string | null;
      variantName: string | null;
      variantSku: string | null;
      priceCents: number;
      prices: Array<{ priceTierId: string | null; priceCents: number }>;
      barcodes: string[];
    }
  >();
  for (const row of productRows) {
    if (row.variantId && row.variantName === null) continue;
    const key = `${row.productId}:${row.variantId ?? ""}`;
    if (!productMap.has(key)) {
      productMap.set(key, {
        productId: row.productId,
        productName: row.productName,
        sku: row.sku,
        variantId: row.variantId,
        variantName: row.variantName,
        variantSku: row.variantSku,
        priceCents: row.priceTierId === null ? row.priceCents : 0,
        prices: [],
        barcodes: barcodeRows
          .filter(
            ({ productId, variantId }) =>
              productId === row.productId && variantId === row.variantId,
          )
          .map(({ barcode }) => barcode),
      });
    }
    const product = productMap.get(key);
    if (product && !product.prices.some(({ priceTierId }) => priceTierId === row.priceTierId)) {
      product.prices.push({ priceTierId: row.priceTierId, priceCents: row.priceCents });
    }
  }
  const serviceMap = new Map<
    string,
    {
      serviceId: string;
      name: string;
      code: string;
      priceCents: number;
      prices: Array<{ priceTierId: string | null; priceCents: number }>;
    }
  >();
  for (const row of serviceRows) {
    if (!serviceMap.has(row.serviceId)) {
      serviceMap.set(row.serviceId, {
        serviceId: row.serviceId,
        name: row.name,
        code: row.code,
        priceCents: row.priceTierId === null ? row.priceCents : 0,
        prices: [],
      });
    }
    const service = serviceMap.get(row.serviceId);
    if (service && !service.prices.some(({ priceTierId }) => priceTierId === row.priceTierId)) {
      service.prices.push({ priceTierId: row.priceTierId, priceCents: row.priceCents });
    }
  }
  for (const product of productMap.values()) {
    product.priceCents =
      product.prices.find(({ priceTierId }) => priceTierId === null)?.priceCents ?? 0;
  }
  for (const service of serviceMap.values()) {
    service.priceCents =
      service.prices.find(({ priceTierId }) => priceTierId === null)?.priceCents ?? 0;
  }
  return {
    shifts,
    sales,
    warehouses: warehouseRows,
    products: [...productMap.values()],
    services: [...serviceMap.values()],
    priceTiers: tierRows,
  };
}

export async function getPosShiftContext(shiftId: string) {
  const [shift] = await getDatabase()
    .select({
      id: posShifts.id,
      branchId: posShifts.branchId,
      warehouseId: posShifts.warehouseId,
      cashierId: posShifts.cashierId,
      status: posShifts.status,
    })
    .from(posShifts)
    .where(eq(posShifts.id, shiftId))
    .limit(1);
  return shift ?? null;
}

export async function openPosShift(input: OpenShiftInput, cashierId: string) {
  try {
    return await getDatabase().transaction(async (tx) => {
      const [warehouse] = await tx
        .select({ id: warehouses.id, branchId: warehouses.branchId, isActive: warehouses.isActive })
        .from(warehouses)
        .where(eq(warehouses.id, input.warehouseId))
        .limit(1);
      if (!warehouse?.isActive || warehouse.branchId !== input.branchId) {
        throw new PosShiftNotFoundError("Gudang aktif pada cabang tersebut tidak ditemukan.");
      }
      const [shift] = await tx
        .insert(posShifts)
        .values({
          branchId: input.branchId,
          warehouseId: input.warehouseId,
          cashierId,
          openingCashCents: input.openingCashCents,
        })
        .returning();
      if (!shift) throw new Error("Shift kasir gagal dibuka.");
      await tx.insert(auditEvents).values({
        actorUserId: cashierId,
        action: "pos.shift_opened",
        targetType: "pos_shift",
        targetId: shift.id,
        metadata: { branchId: input.branchId, warehouseId: input.warehouseId },
      });
      return shift;
    });
  } catch (error) {
    if (isConstraint(error, "pos_shifts_one_open_per_cashier_idx")) {
      throw new PosShiftConflictError("Kasir sudah memiliki shift terbuka pada cabang ini.");
    }
    if (isConstraint(error, "pos_shifts_one_open_per_warehouse_idx")) {
      throw new PosShiftConflictError("Kasir sudah memiliki shift terbuka pada gudang ini.");
    }
    throw error;
  }
}

async function expectedCash(tx: PosTransaction, shiftId: string) {
  const [shift] = await tx
    .select({ openingCashCents: posShifts.openingCashCents })
    .from(posShifts)
    .where(eq(posShifts.id, shiftId))
    .limit(1);
  if (!shift) throw new PosShiftNotFoundError("Shift kasir tidak ditemukan.");
  const [payments] = await tx
    .select({
      cashCents: sql<number>`COALESCE(SUM(CASE WHEN ${posPayments.method} = 'cash' THEN ${posPayments.amountCents} ELSE 0 END), 0)::bigint`,
    })
    .from(posPayments)
    .where(eq(posPayments.shiftId, shiftId));
  const [refunds] = await tx
    .select({
      cashCents: sql<number>`COALESCE(SUM(CASE WHEN ${posRefundPayments.method} = 'cash' THEN ${posRefundPayments.amountCents} ELSE 0 END), 0)::bigint`,
    })
    .from(posRefundPayments)
    .innerJoin(posRefunds, eq(posRefundPayments.refundId, posRefunds.id))
    .where(eq(posRefunds.shiftId, shiftId));
  const [movements] = await tx
    .select({
      netCents: sql<number>`COALESCE(SUM(CASE WHEN ${posCashMovements.movementType} = 'cash_in' THEN ${posCashMovements.amountCents} ELSE -${posCashMovements.amountCents} END), 0)::bigint`,
    })
    .from(posCashMovements)
    .where(eq(posCashMovements.shiftId, shiftId));
  return (
    shift.openingCashCents +
    Number(payments?.cashCents ?? 0) -
    Number(refunds?.cashCents ?? 0) +
    Number(movements?.netCents ?? 0)
  );
}

export async function addPosCashMovement(
  shiftId: string,
  input: CashMovementInput,
  actorUserId: string,
) {
  return getDatabase().transaction(async (tx) => {
    const [shift] = await tx
      .select({ id: posShifts.id, cashierId: posShifts.cashierId, status: posShifts.status })
      .from(posShifts)
      .where(eq(posShifts.id, shiftId))
      .for("update")
      .limit(1);
    if (!shift) throw new PosShiftNotFoundError("Shift kasir tidak ditemukan.");
    if (shift.status !== "open") throw new PosShiftClosedError("Shift sudah ditutup.");
    if (shift.cashierId !== actorUserId) {
      throw new PosShiftNotFoundError("Shift kasir tidak ditemukan.");
    }
    if (
      input.movementType === "cash_out" &&
      input.amountCents > (await expectedCash(tx, shiftId))
    ) {
      throw new PosPaymentInvalidError("Kas keluar melebihi saldo kas shift.");
    }
    const [movement] = await tx
      .insert(posCashMovements)
      .values({ shiftId, ...input, createdBy: actorUserId })
      .returning({ id: posCashMovements.id });
    if (!movement) throw new Error("Mutasi kas gagal dicatat.");
    await tx.insert(auditEvents).values({
      actorUserId,
      action: `pos.${input.movementType}`,
      targetType: "pos_shift",
      targetId: shiftId,
      metadata: { amountCents: String(input.amountCents), reason: input.reason },
    });
    return movement.id;
  });
}

export async function closePosShift(
  shiftId: string,
  cashierId: string,
  closingCashCents: number,
  notes: string | null,
) {
  return getDatabase().transaction(async (tx) => {
    const [shift] = await tx
      .select({ id: posShifts.id, cashierId: posShifts.cashierId, status: posShifts.status })
      .from(posShifts)
      .where(eq(posShifts.id, shiftId))
      .for("update")
      .limit(1);
    if (!shift || shift.cashierId !== cashierId) {
      throw new PosShiftNotFoundError("Shift kasir tidak ditemukan.");
    }
    if (shift.status !== "open") throw new PosShiftClosedError("Shift sudah ditutup.");
    const expected = await expectedCash(tx, shiftId);
    const [closed] = await tx
      .update(posShifts)
      .set({
        status: "closed",
        closingCashCents,
        expectedCashCents: expected,
        closedAt: new Date(),
        closeNotes: notes,
      })
      .where(eq(posShifts.id, shiftId))
      .returning({ id: posShifts.id, expectedCashCents: posShifts.expectedCashCents });
    if (!closed) throw new Error("Shift kasir gagal ditutup.");
    await tx.insert(auditEvents).values({
      actorUserId: cashierId,
      action: "pos.shift_closed",
      targetType: "pos_shift",
      targetId: shiftId,
      metadata: {
        expectedCashCents: String(expected),
        closingCashCents: String(closingCashCents),
        differenceCents: String(closingCashCents - expected),
      },
    });
    return { ...closed, differenceCents: closingCashCents - expected };
  });
}

async function resolveSaleLine(
  tx: PosTransaction,
  branchId: string,
  priceTierId: string | null,
  line: CreateSaleInput["lines"][number],
) {
  const quantityMilli = parseQuantity(line.quantity);
  if (line.itemType === "product") {
    const [product] = await tx
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        isActive: products.isActive,
      })
      .from(products)
      .where(eq(products.id, line.productId))
      .limit(1);
    if (!product?.isActive)
      throw new PosSaleInvalidError("Produk tidak aktif atau tidak ditemukan.");
    await validateProductVariant(tx, product.id, line.variantId);
    const variantScope = line.variantId
      ? eq(productPrices.variantId, line.variantId)
      : isNull(productPrices.variantId);
    const tierScope = priceTierId
      ? eq(productPrices.priceTierId, priceTierId)
      : isNull(productPrices.priceTierId);
    const [tierPrice] = await tx
      .select({ sellingPriceCents: productPrices.sellingPriceCents })
      .from(productPrices)
      .where(
        and(
          eq(productPrices.productId, product.id),
          variantScope,
          tierScope,
          or(eq(productPrices.branchId, branchId), isNull(productPrices.branchId)),
        ),
      )
      .orderBy(desc(sql`CASE WHEN ${productPrices.branchId} = ${branchId} THEN 1 ELSE 0 END`))
      .limit(1);
    const [basePrice] =
      priceTierId && !tierPrice
        ? await tx
            .select({ sellingPriceCents: productPrices.sellingPriceCents })
            .from(productPrices)
            .where(
              and(
                eq(productPrices.productId, product.id),
                variantScope,
                isNull(productPrices.priceTierId),
                or(eq(productPrices.branchId, branchId), isNull(productPrices.branchId)),
              ),
            )
            .orderBy(desc(sql`CASE WHEN ${productPrices.branchId} = ${branchId} THEN 1 ELSE 0 END`))
            .limit(1)
        : [];
    const price = tierPrice ?? basePrice;
    if (!price) throw new PosSaleInvalidError(`Harga produk "${product.name}" belum diatur.`);
    const variant = line.variantId
      ? await tx
          .select({ name: productVariants.name, sku: productVariants.sku })
          .from(productVariants)
          .where(eq(productVariants.id, line.variantId))
          .limit(1)
          .then((rows) => rows[0])
      : null;
    return {
      itemType: "product" as const,
      productId: product.id,
      variantId: line.variantId ?? null,
      serviceId: null,
      itemName: variant ? `${product.name} · ${variant.name}` : product.name,
      itemSku: variant?.sku ?? product.sku,
      quantityMilli,
      quantity: formatQuantity(quantityMilli),
      unitPriceCents: price.sellingPriceCents,
      notes: line.notes ?? null,
    };
  }
  const [service] = await tx
    .select({
      id: services.id,
      name: services.name,
      code: services.code,
      isActive: services.isActive,
    })
    .from(services)
    .where(eq(services.id, line.serviceId))
    .limit(1);
  if (!service?.isActive)
    throw new PosSaleInvalidError("Layanan tidak aktif atau tidak ditemukan.");
  const tierScope = priceTierId
    ? eq(servicePrices.priceTierId, priceTierId)
    : isNull(servicePrices.priceTierId);
  const [tierPrice] = await tx
    .select({ priceCents: servicePrices.priceCents })
    .from(servicePrices)
    .where(
      and(
        eq(servicePrices.serviceId, service.id),
        tierScope,
        or(eq(servicePrices.branchId, branchId), isNull(servicePrices.branchId)),
      ),
    )
    .orderBy(desc(sql`CASE WHEN ${servicePrices.branchId} = ${branchId} THEN 1 ELSE 0 END`))
    .limit(1);
  const [basePrice] =
    priceTierId && !tierPrice
      ? await tx
          .select({ priceCents: servicePrices.priceCents })
          .from(servicePrices)
          .where(
            and(
              eq(servicePrices.serviceId, service.id),
              isNull(servicePrices.priceTierId),
              or(eq(servicePrices.branchId, branchId), isNull(servicePrices.branchId)),
            ),
          )
          .orderBy(desc(sql`CASE WHEN ${servicePrices.branchId} = ${branchId} THEN 1 ELSE 0 END`))
          .limit(1)
      : [];
  const price = tierPrice ?? basePrice;
  if (!price) throw new PosSaleInvalidError(`Harga layanan "${service.name}" belum diatur.`);
  return {
    itemType: "service" as const,
    productId: null,
    variantId: null,
    serviceId: service.id,
    itemName: service.name,
    itemSku: service.code,
    quantityMilli,
    quantity: formatQuantity(quantityMilli),
    unitPriceCents: price.priceCents,
    notes: line.notes ?? null,
  };
}

export async function createPosSale(
  input: CreateSaleInput,
  cashierId: string,
  grant: StaffAuthorization,
) {
  const requestFingerprint = saleRequestFingerprint(input);
  return getDatabase().transaction(async (tx) => {
    const [existing] = await tx
      .select({
        id: posSales.id,
        invoiceNumber: posSales.invoiceNumber,
        status: posSales.status,
        totalCents: posSales.totalCents,
        requestFingerprint: posSales.requestFingerprint,
      })
      .from(posSales)
      .where(eq(posSales.idempotencyKey, input.idempotencyKey))
      .limit(1);
    if (existing) {
      const [existingSale] = await tx
        .select({ cashierId: posSales.cashierId, shiftId: posSales.shiftId })
        .from(posSales)
        .where(eq(posSales.id, existing.id))
        .limit(1);
      if (existingSale?.cashierId !== cashierId || existingSale.shiftId !== input.shiftId) {
        throw new PosIdempotencyConflictError(
          "Kunci idempotensi sudah digunakan untuk transaksi lain.",
        );
      }
      if (existing.requestFingerprint !== requestFingerprint) {
        throw new PosIdempotencyConflictError(
          "Kunci idempotensi sudah digunakan dengan data penjualan berbeda.",
        );
      }
      return existing;
    }

    const [shift] = await tx
      .select({
        id: posShifts.id,
        branchId: posShifts.branchId,
        warehouseId: posShifts.warehouseId,
        cashierId: posShifts.cashierId,
        status: posShifts.status,
      })
      .from(posShifts)
      .where(eq(posShifts.id, input.shiftId))
      .for("update")
      .limit(1);
    if (!shift || shift.cashierId !== cashierId) {
      throw new PosShiftNotFoundError("Shift kasir tidak ditemukan.");
    }
    if (shift.status !== "open") throw new PosShiftClosedError("Shift sudah ditutup.");
    const warehouse = await lockWarehouse(tx, shift.warehouseId);
    if (warehouse.branchId !== shift.branchId) {
      throw new PosSaleInvalidError("Gudang dan shift tidak berada pada cabang yang sama.");
    }
    if (input.customerId) {
      const [customer] = await tx
        .select({ id: customers.id })
        .from(customers)
        .where(eq(customers.id, input.customerId))
        .limit(1);
      if (!customer) throw new PosSaleInvalidError("Pelanggan tidak ditemukan.");
    }
    if (input.petId) {
      const ownerCondition = input.customerId
        ? and(eq(petOwners.petId, input.petId), eq(petOwners.customerId, input.customerId))
        : eq(petOwners.petId, input.petId);
      const [owner] = await tx
        .select({ petId: pets.id })
        .from(petOwners)
        .innerJoin(pets, eq(petOwners.petId, pets.id))
        .where(ownerCondition)
        .limit(1);
      if (!owner) throw new PosSaleInvalidError("Hewan tidak terdaftar pada pelanggan tersebut.");
    }
    if (input.priceTierId) {
      const [tier] = await tx
        .select({ id: priceTiers.id })
        .from(priceTiers)
        .where(and(eq(priceTiers.id, input.priceTierId), eq(priceTiers.isActive, true)))
        .limit(1);
      if (!tier) throw new PosSaleInvalidError("Tier harga tidak aktif atau tidak ditemukan.");
    }
    const settings = await tx
      .select({
        taxEnabled: businessSettings.taxEnabled,
        taxRateBps: businessSettings.taxRateBps,
        taxIncluded: businessSettings.taxIncluded,
      })
      .from(businessSettings)
      .where(eq(businessSettings.id, 1))
      .limit(1)
      .then((rows) => rows[0]);
    if (!settings) throw new Error("Pengaturan pajak belum tersedia.");

    const lines = [];
    for (const line of input.lines) {
      lines.push(await resolveSaleLine(tx, shift.branchId, input.priceTierId ?? null, line));
    }
    const subtotalCents = ensureSafeCents(
      lines.reduce(
        (sum, line) => sum + centsForQuantity(line.quantityMilli, line.unitPriceCents),
        0,
      ),
    );

    // Apply automatic promotions
    let promotionDiscountCents = 0;
    let appliedPromotionId: string | null = null;
    if (input.customerId) {
      const applicablePromotions = await findApplicablePromotions(
        shift.branchId,
        input.priceTierId ?? null,
        lines.map((line) => ({
          itemType: line.itemType,
          productId: line.productId ?? undefined,
          variantId: line.variantId ?? undefined,
          serviceId: line.serviceId ?? undefined,
          quantity: Number(line.quantity),
          unitPriceCents: line.unitPriceCents,
        })),
        subtotalCents,
      );
      if (applicablePromotions.length > 0) {
        const bestPromo = applicablePromotions[0];
        promotionDiscountCents = bestPromo.discountCents;
        appliedPromotionId = bestPromo.promotionId;
      }
    }

    // Apply voucher discount
    let voucherDiscountCents = 0;
    let appliedVoucherId: string | null = null;
    if (input.voucherCode && input.customerId) {
      const voucherResult = await validateVoucherForSale(
        shift.branchId,
        input.voucherCode,
        input.customerId,
        lines.map((line) => ({
          itemType: line.itemType,
          productId: line.productId ?? undefined,
          variantId: line.variantId ?? undefined,
          serviceId: line.serviceId ?? undefined,
          quantity: Number(line.quantity),
          unitPriceCents: line.unitPriceCents,
        })),
        subtotalCents - promotionDiscountCents,
      );
      voucherDiscountCents = voucherResult.discountCents;
      appliedVoucherId = voucherResult.voucherId;
    }

    // Apply loyalty points redemption
    let loyaltyRedeemCents = 0;
    let _loyaltyPointsRedeemed = 0;
    if (input.redeemLoyaltyPoints && input.redeemLoyaltyPoints > 0 && input.customerId) {
      const result = await redeemLoyaltyPoints(
        tx,
        input.customerId,
        shift.branchId,
        input.redeemLoyaltyPoints,
        "pos_sale",
        null,
        `Penukaran poin untuk pembayaran`,
        cashierId,
      );
      loyaltyRedeemCents = result.redeemValueCents;
      _loyaltyPointsRedeemed = result.pointsRedeemed;
    }

    // Apply deposit payment
    let depositPaymentCents = 0;
    if (input.useDeposit && input.customerId) {
      const deposit = await getDatabase()
        .select({ balanceCents: customerDeposits.balanceCents })
        .from(customerDeposits)
        .where(
          and(
            eq(customerDeposits.customerId, input.customerId),
            eq(customerDeposits.branchId, shift.branchId),
          ),
        )
        .limit(1)
        .then((rows) => rows[0]);
      if (deposit) {
        // We'll calculate depositPaymentCents after totalCents is known
      }
    }

    const discountCents =
      percentageOf(subtotalCents, input.discountBps) +
      promotionDiscountCents +
      voucherDiscountCents;
    const netCents = subtotalCents - discountCents;
    const taxRateBps = settings.taxEnabled ? settings.taxRateBps : 0;
    const taxCents = taxOf(netCents, taxRateBps, settings.taxIncluded);
    let totalCents = ensureSafeCents(netCents + (settings.taxIncluded ? 0 : taxCents));

    // Apply deposit payment (now totalCents is known)
    if (input.useDeposit && input.customerId) {
      const deposit = await getDatabase()
        .select({ balanceCents: customerDeposits.balanceCents })
        .from(customerDeposits)
        .where(
          and(
            eq(customerDeposits.customerId, input.customerId),
            eq(customerDeposits.branchId, shift.branchId),
          ),
        )
        .limit(1)
        .then((rows) => rows[0]);
      if (deposit) {
        depositPaymentCents = Math.min(deposit.balanceCents, totalCents);
      }
    }

    // Apply loyalty redemption and deposit as payment methods
    totalCents = Math.max(0, totalCents - loyaltyRedeemCents - depositPaymentCents);

    const requiresPin =
      discountCents > 0 &&
      (grant.requiresSupervisorPin ||
        (grant.maxDiscountBps !== null && input.discountBps > grant.maxDiscountBps));
    if (requiresPin) {
      if (!input.supervisorPin) {
        throw new PosDiscountApprovalRequiredError("Diskon ini memerlukan PIN supervisor.");
      }
      await verifySupervisorPin(cashierId, input.supervisorPin);
    }

    // Calculate remaining amount to be paid via payments
    const remainingTotal = totalCents;
    const paymentTotal = ensureSafeCents(
      input.payments.reduce((sum, payment) => sum + payment.amountCents, 0),
    );
    if (input.hold && input.payments.length) {
      throw new PosPaymentInvalidError("Tagihan yang ditahan belum menerima pembayaran.");
    }
    if (paymentTotal > remainingTotal) {
      throw new PosPaymentInvalidError("Jumlah pembayaran melebihi total tagihan.");
    }
    const invoiceNumber = await nextDocumentNumber(tx, {
      documentType: "invoice",
      branchId: shift.branchId,
    });
    const [sale] = await tx
      .insert(posSales)
      .values({
        invoiceNumber,
        idempotencyKey: input.idempotencyKey,
        requestFingerprint,
        branchId: shift.branchId,
        warehouseId: shift.warehouseId,
        shiftId: shift.id,
        cashierId,
        customerId: input.customerId ?? null,
        petId: input.petId ?? null,
        priceTierId: input.priceTierId ?? null,
        status: input.hold
          ? "held"
          : paymentTotal + loyaltyRedeemCents + depositPaymentCents === remainingTotal
            ? "paid"
            : "partially_paid",
        subtotalCents,
        discountCents,
        taxCents,
        totalCents: remainingTotal,
        paidCents: paymentTotal + loyaltyRedeemCents + depositPaymentCents,
        taxRateBps,
        taxIncluded: settings.taxIncluded,
        notes: input.notes ?? null,
      })
      .returning({ id: posSales.id, invoiceNumber: posSales.invoiceNumber });
    if (!sale) throw new Error("Penjualan gagal dibuat.");

    // Record promotion usage
    if (appliedPromotionId) {
      await applyPromotionToSale(tx, appliedPromotionId, sale.id, promotionDiscountCents);
    }

    // Record voucher usage
    if (appliedVoucherId) {
      await recordVoucherUsage(
        tx,
        appliedVoucherId,
        input.customerId ?? null,
        sale.id,
        voucherDiscountCents,
      );
    }

    // Process deposit payment
    if (depositPaymentCents > 0 && input.customerId) {
      await payFromCustomerDeposit(
        tx,
        input.customerId,
        shift.branchId,
        depositPaymentCents,
        "pos_sale",
        sale.id,
        `Pembayaran ${sale.invoiceNumber}`,
        cashierId,
      );
    }

    let remainingDiscount = discountCents;
    let remainingTax = taxCents;
    for (const [index, line] of lines.entries()) {
      const lineSubtotal = centsForQuantity(line.quantityMilli, line.unitPriceCents);
      const lineDiscount =
        index === lines.length - 1
          ? remainingDiscount
          : Math.min(
              remainingDiscount,
              subtotalCents
                ? Number((BigInt(discountCents) * BigInt(lineSubtotal)) / BigInt(subtotalCents))
                : 0,
            );
      remainingDiscount -= lineDiscount;
      const lineNet = lineSubtotal - lineDiscount;
      const lineTax =
        index === lines.length - 1
          ? remainingTax
          : netCents
            ? Number((BigInt(taxCents) * BigInt(lineNet)) / BigInt(netCents))
            : 0;
      remainingTax -= lineTax;
      const [saleLine] = await tx
        .insert(posSaleLines)
        .values({
          saleId: sale.id,
          itemType: line.itemType,
          productId: line.productId,
          variantId: line.variantId,
          serviceId: line.serviceId,
          itemName: line.itemName,
          itemSku: line.itemSku,
          quantity: line.quantity,
          unitPriceCents: line.unitPriceCents,
          discountCents: lineDiscount,
          taxCents: lineTax,
          lineTotalCents: lineNet + (settings.taxIncluded ? 0 : lineTax),
          notes: line.notes,
        })
        .returning({ id: posSaleLines.id });
      if (!saleLine) throw new Error("Baris penjualan gagal disimpan.");
      if (!input.hold && line.itemType === "product" && line.productId) {
        const consumed = await consumeFromBatches(tx, {
          warehouseId: shift.warehouseId,
          productId: line.productId,
          variantId: line.variantId,
          timezone: warehouse.timezone,
          quantityMilli: line.quantityMilli,
          sourceType: "pos_sale_line",
          sourceId: saleLine.id,
          actorUserId: cashierId,
          reason: `Penjualan ${sale.invoiceNumber}`,
          movementType: "sale_out",
        });
        if (consumed.allocations.length) {
          await tx.insert(posSaleStockAllocations).values(
            consumed.allocations.map((allocation) => ({
              saleLineId: saleLine.id,
              batchId: allocation.batchId,
              quantity: allocation.quantity,
            })),
          );
        }
      }
    }
    if (input.payments.length) {
      await tx.insert(posPayments).values(
        input.payments.map((payment) => ({
          saleId: sale.id,
          shiftId: shift.id,
          idempotencyKey: `${input.idempotencyKey}:p${input.payments.indexOf(payment)}`,
          method: payment.method,
          amountCents: payment.amountCents,
          reference: payment.reference ?? null,
          receivedBy: cashierId,
        })),
      );
    }

    // Earn loyalty points for paid sales
    if (
      !input.hold &&
      input.customerId &&
      paymentTotal + loyaltyRedeemCents + depositPaymentCents > 0
    ) {
      await earnLoyaltyPoints(
        tx,
        input.customerId,
        shift.branchId,
        paymentTotal + loyaltyRedeemCents + depositPaymentCents,
        "pos_sale",
        sale.id,
        `Pembelian ${sale.invoiceNumber}`,
        cashierId,
      );
    }

    await tx.insert(auditEvents).values({
      actorUserId: cashierId,
      action: input.hold ? "pos.sale_held" : "pos.sale_created",
      targetType: "pos_sale",
      targetId: sale.id,
      metadata: {
        branchId: shift.branchId,
        invoiceNumber: sale.invoiceNumber,
        lineCount: String(lines.length),
        totalCents: String(remainingTotal),
        discountCents: String(discountCents),
        promotionDiscountCents: String(promotionDiscountCents),
        voucherDiscountCents: String(voucherDiscountCents),
        loyaltyRedeemCents: String(loyaltyRedeemCents),
        depositPaymentCents: String(depositPaymentCents),
        paymentCount: String(input.payments.length),
        held: String(input.hold),
      },
    });
    return {
      ...sale,
      status: input.hold
        ? "held"
        : paymentTotal + loyaltyRedeemCents + depositPaymentCents === remainingTotal
          ? "paid"
          : "partially_paid",
      totalCents: remainingTotal,
    };
  });
}

export async function getPosSaleContext(saleId: string) {
  const [sale] = await getDatabase()
    .select({ id: posSales.id, branchId: posSales.branchId, status: posSales.status })
    .from(posSales)
    .where(eq(posSales.id, saleId))
    .limit(1);
  return sale ?? null;
}

export async function getPosSaleReceipt(saleId: string) {
  const database = getDatabase();
  const [sale] = await database
    .select({
      id: posSales.id,
      branchId: posSales.branchId,
      businessName: systemState.businessName,
      invoiceNumber: posSales.invoiceNumber,
      status: posSales.status,
      subtotalCents: posSales.subtotalCents,
      discountCents: posSales.discountCents,
      taxCents: posSales.taxCents,
      taxRateBps: posSales.taxRateBps,
      taxIncluded: posSales.taxIncluded,
      totalCents: posSales.totalCents,
      paidCents: posSales.paidCents,
      refundedCents: posSales.refundedCents,
      createdAt: posSales.createdAt,
      customerName: customers.name,
    })
    .from(posSales)
    .leftJoin(customers, eq(posSales.customerId, customers.id))
    .leftJoin(systemState, eq(systemState.id, 1))
    .where(eq(posSales.id, saleId))
    .limit(1);
  if (!sale) return null;
  const [lines, payments, refundedAmounts] = await Promise.all([
    database
      .select({
        id: posSaleLines.id,
        itemType: posSaleLines.itemType,
        itemName: posSaleLines.itemName,
        itemSku: posSaleLines.itemSku,
        quantity: posSaleLines.quantity,
        returnedQuantity: posSaleLines.returnedQuantity,
        unitPriceCents: posSaleLines.unitPriceCents,
        discountCents: posSaleLines.discountCents,
        taxCents: posSaleLines.taxCents,
        lineTotalCents: posSaleLines.lineTotalCents,
      })
      .from(posSaleLines)
      .where(eq(posSaleLines.saleId, saleId)),
    database
      .select({
        method: posPayments.method,
        amountCents: posPayments.amountCents,
        reference: posPayments.reference,
        createdAt: posPayments.createdAt,
      })
      .from(posPayments)
      .where(eq(posPayments.saleId, saleId))
      .orderBy(posPayments.createdAt),
    database
      .select({
        saleLineId: posRefundLines.saleLineId,
        amountCents: sql<number>`COALESCE(SUM(${posRefundLines.amountCents}), 0)::bigint`,
      })
      .from(posRefundLines)
      .innerJoin(posSaleLines, eq(posRefundLines.saleLineId, posSaleLines.id))
      .where(eq(posSaleLines.saleId, saleId))
      .groupBy(posRefundLines.saleLineId),
  ]);
  const refundedByLine = new Map(
    refundedAmounts.map(({ saleLineId, amountCents }) => [saleLineId, amountCents]),
  );
  return {
    ...sale,
    lines: lines.map((line) => ({
      ...line,
      refundableAmountCents: line.lineTotalCents - (refundedByLine.get(line.id) ?? 0),
    })),
    payments,
  };
}

async function insertSaleStockReturn(
  tx: PosTransaction,
  input: {
    line: {
      id: string;
      productId: string | null;
      variantId: string | null;
      itemType: "product" | "service";
    };
    warehouseId: string;
    quantityMilli: bigint;
    sourceType: string;
    sourceId: string;
    actorUserId: string;
    reason: string;
    refundLineId?: string;
  },
) {
  if (input.line.itemType !== "product" || !input.line.productId) return;
  const allocations = await tx
    .select({
      batchId: posSaleStockAllocations.batchId,
      quantity: posSaleStockAllocations.quantity,
      unitCostCents: inventoryBatches.unitCostCents,
    })
    .from(posSaleStockAllocations)
    .innerJoin(inventoryBatches, eq(posSaleStockAllocations.batchId, inventoryBatches.id))
    .where(eq(posSaleStockAllocations.saleLineId, input.line.id));
  const priorReturns = await tx
    .select({
      batchId: posRefundStockAllocations.batchId,
      quantity: sql<string>`COALESCE(SUM(${posRefundStockAllocations.quantity}), 0)::text`,
    })
    .from(posRefundStockAllocations)
    .where(eq(posRefundStockAllocations.saleLineId, input.line.id))
    .groupBy(posRefundStockAllocations.batchId);
  const priorByBatch = new Map(
    priorReturns.map(({ batchId, quantity }) => [batchId, parseQuantity(quantity)]),
  );
  let remaining = input.quantityMilli;
  for (const allocation of allocations) {
    if (remaining === 0n) break;
    const available =
      parseQuantity(allocation.quantity) - (priorByBatch.get(allocation.batchId) ?? 0n);
    if (available <= 0n) continue;
    let returned = available;
    if (remaining < available) returned = remaining;
    if (input.refundLineId) {
      await tx.insert(posRefundStockAllocations).values({
        refundLineId: input.refundLineId,
        saleLineId: input.line.id,
        batchId: allocation.batchId,
        quantity: formatQuantity(returned),
      });
    }
    await tx.insert(inventoryMovements).values({
      warehouseId: input.warehouseId,
      productId: input.line.productId,
      variantId: input.line.variantId,
      batchId: allocation.batchId,
      movementType: "sale_return_in",
      quantityDelta: formatQuantity(returned),
      unitCostCents: allocation.unitCostCents,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      reason: input.reason,
      actorUserId: input.actorUserId,
    });
    remaining -= returned;
  }
  if (remaining > 0n) {
    throw new PosRefundInvalidError(
      "Alokasi stok retur tidak sesuai dengan jumlah barang terjual.",
    );
  }
}

async function validateCurrentPosShift(
  tx: PosTransaction,
  shiftId: string,
  actorUserId: string,
  branchId: string,
) {
  const [shift] = await tx
    .select({
      id: posShifts.id,
      branchId: posShifts.branchId,
      warehouseId: posShifts.warehouseId,
      status: posShifts.status,
      cashierId: posShifts.cashierId,
    })
    .from(posShifts)
    .where(eq(posShifts.id, shiftId))
    .for("update")
    .limit(1);
  if (!shift || shift.cashierId !== actorUserId || shift.branchId !== branchId) {
    throw new PosShiftNotFoundError("Shift kasir tidak ditemukan.");
  }
  if (shift.status !== "open") throw new PosShiftClosedError("Shift sudah ditutup.");
  return shift;
}

async function addPaymentsToSale(
  saleId: string,
  input: SettleSaleInput | ResumeSaleInput,
  actorUserId: string,
  resume: boolean,
) {
  return getDatabase().transaction(async (tx) => {
    const [sale] = await tx
      .select({
        id: posSales.id,
        branchId: posSales.branchId,
        warehouseId: posSales.warehouseId,
        shiftId: posSales.shiftId,
        invoiceNumber: posSales.invoiceNumber,
        status: posSales.status,
        totalCents: posSales.totalCents,
        paidCents: posSales.paidCents,
        resumeIdempotencyKey: posSales.resumeIdempotencyKey,
      })
      .from(posSales)
      .where(eq(posSales.id, saleId))
      .for("update")
      .limit(1);
    if (!sale) throw new PosSaleInvalidError("Tagihan tidak ditemukan.");
    const paymentKeys = input.payments.map((_, index) => `${input.idempotencyKey}:p${index}`);
    const existingPayments = paymentKeys.length
      ? await tx
          .select({
            saleId: posPayments.saleId,
            shiftId: posPayments.shiftId,
            idempotencyKey: posPayments.idempotencyKey,
            method: posPayments.method,
            amountCents: posPayments.amountCents,
            reference: posPayments.reference,
          })
          .from(posPayments)
          .where(inArray(posPayments.idempotencyKey, paymentKeys))
      : [];
    if (existingPayments.length) {
      const matches =
        existingPayments.length === input.payments.length &&
        existingPayments.every((payment) => {
          const index = paymentKeys.indexOf(payment.idempotencyKey);
          const requested = input.payments[index];
          return (
            index >= 0 &&
            payment.saleId === saleId &&
            payment.shiftId === input.shiftId &&
            payment.method === requested?.method &&
            payment.amountCents === requested?.amountCents &&
            payment.reference === (requested?.reference ?? null)
          );
        });
      if (!matches) {
        throw new PosIdempotencyConflictError(
          "Kunci idempotensi pembayaran sudah digunakan untuk transaksi lain.",
        );
      }
      return sale;
    }

    if (resume && sale.status !== "held" && sale.resumeIdempotencyKey === input.idempotencyKey) {
      if (sale.shiftId !== input.shiftId) {
        throw new PosIdempotencyConflictError(
          "Kunci idempotensi resume digunakan pada shift berbeda.",
        );
      }
      return {
        id: sale.id,
        invoiceNumber: sale.invoiceNumber,
        status: sale.status,
        totalCents: sale.totalCents,
        paidCents: sale.paidCents,
      };
    }
    const shift = await validateCurrentPosShift(tx, input.shiftId, actorUserId, sale.branchId);
    if (resume ? sale.status !== "held" : sale.status !== "partially_paid") {
      throw new PosSaleInvalidError(
        resume ? "Tagihan tidak sedang ditahan." : "Tagihan tidak memiliki saldo terutang.",
      );
    }
    const paymentTotal = ensureSafeCents(
      input.payments.reduce((sum, payment) => sum + payment.amountCents, 0),
    );
    if (paymentTotal > sale.totalCents - sale.paidCents) {
      throw new PosPaymentInvalidError("Jumlah pembayaran melebihi saldo tagihan.");
    }
    if (resume) {
      const warehouse = await lockWarehouse(tx, shift.warehouseId);
      if (warehouse.branchId !== sale.branchId) {
        throw new PosSaleInvalidError("Gudang dan tagihan tidak berada pada cabang yang sama.");
      }
      const lines = await tx
        .select({
          id: posSaleLines.id,
          itemType: posSaleLines.itemType,
          productId: posSaleLines.productId,
          variantId: posSaleLines.variantId,
          quantity: posSaleLines.quantity,
          itemName: posSaleLines.itemName,
        })
        .from(posSaleLines)
        .where(eq(posSaleLines.saleId, sale.id));
      for (const line of lines) {
        if (line.itemType !== "product" || !line.productId) continue;
        const consumed = await consumeFromBatches(tx, {
          warehouseId: shift.warehouseId,
          productId: line.productId,
          variantId: line.variantId,
          timezone: warehouse.timezone,
          quantityMilli: parseQuantity(line.quantity),
          sourceType: "pos_sale_line",
          sourceId: line.id,
          actorUserId,
          reason: `Penjualan dilanjutkan ${saleId}`,
          movementType: "sale_out",
        });
        if (consumed.allocations.length) {
          await tx.insert(posSaleStockAllocations).values(
            consumed.allocations.map((allocation) => ({
              saleLineId: line.id,
              batchId: allocation.batchId,
              quantity: allocation.quantity,
            })),
          );
        }
      }
    }
    if (input.payments.length) {
      await tx.insert(posPayments).values(
        input.payments.map((payment, index) => ({
          saleId,
          shiftId: shift.id,
          idempotencyKey: paymentKeys[index] ?? `${input.idempotencyKey}:p${index}`,
          method: payment.method,
          amountCents: payment.amountCents,
          reference: payment.reference ?? null,
          receivedBy: actorUserId,
        })),
      );
    }
    const paidCents = sale.paidCents + paymentTotal;
    const [updated] = await tx
      .update(posSales)
      .set({
        status: paidCents === sale.totalCents ? "paid" : "partially_paid",
        paidCents,
        shiftId: shift.id,
        warehouseId: shift.warehouseId,
        cashierId: actorUserId,
        ...(resume ? { resumeIdempotencyKey: input.idempotencyKey } : {}),
        updatedAt: new Date(),
      })
      .where(eq(posSales.id, sale.id))
      .returning({
        id: posSales.id,
        invoiceNumber: posSales.invoiceNumber,
        status: posSales.status,
        totalCents: posSales.totalCents,
        paidCents: posSales.paidCents,
      });
    if (!updated) throw new Error("Pembayaran tagihan gagal dicatat.");
    await tx.insert(auditEvents).values({
      actorUserId,
      action: resume ? "pos.sale_resumed" : "pos.sale_payment_added",
      targetType: "pos_sale",
      targetId: sale.id,
      metadata: {
        invoiceNumber: updated.invoiceNumber,
        paymentCount: String(input.payments.length),
        paymentCents: String(paymentTotal),
      },
    });
    return updated;
  });
}

export function settlePosSale(saleId: string, input: SettleSaleInput, actorUserId: string) {
  return addPaymentsToSale(saleId, input, actorUserId, false);
}

export function resumePosSale(saleId: string, input: ResumeSaleInput, actorUserId: string) {
  return addPaymentsToSale(saleId, input, actorUserId, true);
}

async function findMatchingRefund(tx: PosTransaction, saleId: string, input: RefundSaleInput) {
  const [prior] = await tx
    .select({
      id: posRefunds.id,
      saleId: posRefunds.saleId,
      shiftId: posRefunds.shiftId,
      refundNumber: posRefunds.refundNumber,
      amountCents: posRefunds.amountCents,
      reason: posRefunds.reason,
    })
    .from(posRefunds)
    .where(eq(posRefunds.idempotencyKey, input.idempotencyKey))
    .limit(1);
  if (!prior) return null;
  if (prior.saleId !== saleId || prior.shiftId !== input.shiftId || prior.reason !== input.reason) {
    throw new PosIdempotencyConflictError(
      "Kunci idempotensi refund digunakan untuk transaksi lain.",
    );
  }
  const [existingLines, existingPayments] = await Promise.all([
    tx
      .select({ saleLineId: posRefundLines.saleLineId, quantity: posRefundLines.quantity })
      .from(posRefundLines)
      .where(eq(posRefundLines.refundId, prior.id)),
    tx
      .select({
        method: posRefundPayments.method,
        amountCents: posRefundPayments.amountCents,
        reference: posRefundPayments.reference,
      })
      .from(posRefundPayments)
      .where(eq(posRefundPayments.refundId, prior.id)),
  ]);
  const sameLines =
    existingLines.length === input.lines.length &&
    existingLines.every((line) =>
      input.lines.some(
        (requested) =>
          requested.saleLineId === line.saleLineId &&
          parseQuantity(requested.quantity) === parseQuantity(line.quantity),
      ),
    );
  const paymentFingerprint = (payment: {
    method: string;
    amountCents: number;
    reference?: string | null;
  }) => `${payment.method}:${payment.amountCents}:${payment.reference ?? ""}`;
  const samePayments =
    existingPayments.length === input.payments.length &&
    existingPayments.map(paymentFingerprint).sort().join("|") ===
      input.payments.map(paymentFingerprint).sort().join("|");
  if (!sameLines || !samePayments) {
    throw new PosIdempotencyConflictError("Kunci idempotensi refund digunakan untuk data berbeda.");
  }
  return prior;
}

export async function refundPosSale(
  saleId: string,
  input: RefundSaleInput,
  actorUserId: string,
  grant: StaffAuthorization,
) {
  return getDatabase().transaction(async (tx) => {
    const [sale] = await tx
      .select({
        id: posSales.id,
        branchId: posSales.branchId,
        warehouseId: posSales.warehouseId,
        status: posSales.status,
        totalCents: posSales.totalCents,
        paidCents: posSales.paidCents,
        resumeIdempotencyKey: posSales.resumeIdempotencyKey,
        refundedCents: posSales.refundedCents,
        customerId: posSales.customerId,
      })
      .from(posSales)
      .where(eq(posSales.id, saleId))
      .for("update")
      .limit(1);
    if (!sale || sale.status === "held" || sale.status === "voided") {
      throw new PosRefundInvalidError("Penjualan tidak dapat diretur.");
    }
    const prior = await findMatchingRefund(tx, saleId, input);
    if (prior) return prior;
    const shift = await validateCurrentPosShift(tx, input.shiftId, actorUserId, sale.branchId);
    const lineIds = input.lines.map(({ saleLineId }) => saleLineId);
    const saleLines = await tx
      .select({
        id: posSaleLines.id,
        itemType: posSaleLines.itemType,
        productId: posSaleLines.productId,
        variantId: posSaleLines.variantId,
        quantity: posSaleLines.quantity,
        returnedQuantity: posSaleLines.returnedQuantity,
        lineTotalCents: posSaleLines.lineTotalCents,
      })
      .from(posSaleLines)
      .where(and(eq(posSaleLines.saleId, sale.id), inArray(posSaleLines.id, lineIds)))
      .for("update");
    if (saleLines.length !== input.lines.length) {
      throw new PosRefundInvalidError("Salah satu baris tidak termasuk dalam penjualan ini.");
    }
    let refundAmountCents = 0;
    const refundLines: Array<{
      line: (typeof saleLines)[number];
      quantityMilli: bigint;
      quantity: string;
      amountCents: number;
    }> = [];
    for (const requested of input.lines) {
      const line = saleLines.find(({ id }) => id === requested.saleLineId);
      if (!line) throw new PosRefundInvalidError("Baris penjualan tidak ditemukan.");
      const requestedMilli = parseQuantity(requested.quantity);
      const remainingQuantity = parseQuantity(line.quantity) - parseQuantity(line.returnedQuantity);
      if (requestedMilli > remainingQuantity) {
        throw new PosRefundInvalidError("Jumlah retur melebihi jumlah yang belum diretur.");
      }
      const [priorAmounts] = await tx
        .select({
          cents: sql<number>`COALESCE(SUM(${posRefundLines.amountCents}), 0)::bigint`,
        })
        .from(posRefundLines)
        .where(eq(posRefundLines.saleLineId, line.id));
      const remainingAmount = line.lineTotalCents - Number(priorAmounts?.cents ?? 0);
      const amountCents =
        requestedMilli === remainingQuantity
          ? remainingAmount
          : Number(
              (BigInt(remainingAmount) * requestedMilli + remainingQuantity / 2n) /
                remainingQuantity,
            );
      refundAmountCents += amountCents;
      refundLines.push({
        line,
        quantityMilli: requestedMilli,
        quantity: formatQuantity(requestedMilli),
        amountCents,
      });
    }
    refundAmountCents = ensureSafeCents(refundAmountCents);
    if (refundAmountCents < 1 || refundAmountCents > sale.paidCents - sale.refundedCents) {
      throw new PosRefundInvalidError("Nilai retur melebihi pembayaran yang belum dikembalikan.");
    }
    const paymentTotal = ensureSafeCents(
      input.payments.reduce((sum, payment) => sum + payment.amountCents, 0),
    );
    if (paymentTotal !== refundAmountCents) {
      throw new PosRefundInvalidError(
        "Total pembayaran refund harus sama dengan nilai barang retur.",
      );
    }
    const cashRefundCents = input.payments
      .filter(({ method }) => method === "cash")
      .reduce((sum, payment) => sum + payment.amountCents, 0);
    if (cashRefundCents > (await expectedCash(tx, shift.id))) {
      throw new PosRefundInvalidError("Refund tunai melebihi saldo kas shift.");
    }
    const requiresPin =
      grant.requiresSupervisorPin ||
      (grant.maxRefundCents !== null && refundAmountCents > grant.maxRefundCents);
    if (requiresPin) {
      if (!input.supervisorPin) {
        throw new PosRefundApprovalRequiredError("Refund ini memerlukan PIN supervisor.");
      }
      await verifySupervisorPin(actorUserId, input.supervisorPin);
    }
    const refundNumber = await nextDocumentNumber(tx, {
      documentType: "refund",
      branchId: sale.branchId,
    });
    const [refund] = await tx
      .insert(posRefunds)
      .values({
        refundNumber,
        idempotencyKey: input.idempotencyKey,
        saleId: sale.id,
        shiftId: shift.id,
        reason: input.reason,
        amountCents: refundAmountCents,
        createdBy: actorUserId,
      })
      .returning({
        id: posRefunds.id,
        refundNumber: posRefunds.refundNumber,
        amountCents: posRefunds.amountCents,
      });
    if (!refund) throw new Error("Refund gagal dibuat.");
    for (const entry of refundLines) {
      const [refundLine] = await tx
        .insert(posRefundLines)
        .values({
          refundId: refund.id,
          saleLineId: entry.line.id,
          quantity: entry.quantity,
          amountCents: entry.amountCents,
        })
        .returning({ id: posRefundLines.id });
      if (!refundLine) throw new Error("Baris refund gagal disimpan.");
      await insertSaleStockReturn(tx, {
        line: entry.line,
        warehouseId: sale.warehouseId,
        quantityMilli: entry.quantityMilli,
        sourceType: "pos_refund_line",
        sourceId: refundLine.id,
        actorUserId,
        reason: `Retur ${refund.refundNumber}: ${input.reason}`,
        refundLineId: refundLine.id,
      });
      await tx
        .update(posSaleLines)
        .set({
          returnedQuantity: sql`${posSaleLines.returnedQuantity} + ${entry.quantity}`,
        })
        .where(eq(posSaleLines.id, entry.line.id));
    }
    await tx.insert(posRefundPayments).values(
      input.payments.map((payment) => ({
        refundId: refund.id,
        method: payment.method,
        amountCents: payment.amountCents,
        reference: payment.reference ?? null,
      })),
    );

    // Refund loyalty points if they were redeemed
    if (sale.customerId) {
      const loyaltyTxns = await tx
        .select()
        .from(loyaltyTransactions)
        .where(
          and(
            eq(loyaltyTransactions.sourceType, "pos_sale"),
            eq(loyaltyTransactions.sourceId, sale.id),
          ),
        );
      for (const ltxn of loyaltyTxns) {
        if (ltxn.type === "redeem") {
          await refundLoyaltyPoints(
            sale.customerId,
            sale.branchId,
            -ltxn.points,
            sale.id,
            `Refund ${refund.refundNumber}: ${input.reason}`,
            actorUserId,
          );
        } else if (ltxn.type === "earn") {
          await adjustLoyaltyPoints(
            sale.customerId,
            sale.branchId,
            -ltxn.points,
            `Refund ${refund.refundNumber}: ${input.reason}`,
            actorUserId,
          );
        }
      }

      // Refund deposit if used
      const depositPayments = await tx
        .select()
        .from(posPayments)
        .where(and(eq(posPayments.saleId, sale.id), eq(posPayments.method, "deposit")));
      for (const dp of depositPayments) {
        await refundToCustomerDeposit(
          tx,
          sale.customerId,
          sale.branchId,
          dp.amountCents,
          "pos_refund",
          refund.id,
          `Refund ${refund.refundNumber}: ${input.reason}`,
          actorUserId,
        );
      }
    }

    const refundedCents = sale.refundedCents + refundAmountCents;
    const [remainingLines] = await tx
      .select({
        remaining: sql<number>`COUNT(*) FILTER (WHERE ${posSaleLines.returnedQuantity} < ${posSaleLines.quantity})::int`,
      })
      .from(posSaleLines)
      .where(eq(posSaleLines.saleId, sale.id));
    const fullyReturned = Number(remainingLines?.remaining ?? 0) === 0;
    await tx
      .update(posSales)
      .set({
        refundedCents,
        status:
          fullyReturned && refundedCents === sale.paidCents && sale.paidCents > 0
            ? "refunded"
            : sale.status,
        updatedAt: new Date(),
      })
      .where(eq(posSales.id, sale.id));
    await tx.insert(auditEvents).values({
      actorUserId,
      action: "pos.sale_refunded",
      targetType: "pos_sale",
      targetId: sale.id,
      metadata: {
        refundNumber: refund.refundNumber,
        amountCents: String(refundAmountCents),
        lineCount: String(refundLines.length),
      },
    });
    return refund;
  });
}

export async function voidPosSale(
  saleId: string,
  input: VoidSaleInput,
  actorUserId: string,
  grant: StaffAuthorization,
) {
  return getDatabase().transaction(async (tx) => {
    const [sale] = await tx
      .select({
        id: posSales.id,
        branchId: posSales.branchId,
        warehouseId: posSales.warehouseId,
        status: posSales.status,
        totalCents: posSales.totalCents,
        paidCents: posSales.paidCents,
        voidIdempotencyKey: posSales.voidIdempotencyKey,
        voidReason: posSales.voidReason,
        customerId: posSales.customerId,
      })
      .from(posSales)
      .where(eq(posSales.id, saleId))
      .for("update")
      .limit(1);
    if (!sale) throw new PosVoidInvalidError("Penjualan tidak ditemukan.");
    if (sale.status === "voided") {
      if (sale.voidIdempotencyKey === input.idempotencyKey && sale.voidReason === input.reason) {
        return { id: sale.id };
      }
      throw new PosIdempotencyConflictError("Penjualan sudah dibatalkan dengan kunci lain.");
    }
    if (sale.paidCents > 0 || sale.status === "paid" || sale.status === "refunded") {
      throw new PosVoidInvalidError("Penjualan yang sudah dibayar harus diproses melalui retur.");
    }
    const shift = await validateCurrentPosShift(tx, input.shiftId, actorUserId, sale.branchId);
    const requiresPin =
      grant.requiresSupervisorPin ||
      (grant.maxVoidCents !== null && sale.totalCents > grant.maxVoidCents);
    if (requiresPin) {
      if (!input.supervisorPin) {
        throw new PosVoidApprovalRequiredError("Pembatalan ini memerlukan PIN supervisor.");
      }
      await verifySupervisorPin(actorUserId, input.supervisorPin);
    }
    if (sale.status !== "held") {
      const lines = await tx
        .select({
          id: posSaleLines.id,
          itemType: posSaleLines.itemType,
          productId: posSaleLines.productId,
          variantId: posSaleLines.variantId,
          quantity: posSaleLines.quantity,
        })
        .from(posSaleLines)
        .where(eq(posSaleLines.saleId, sale.id))
        .for("update");
      for (const line of lines) {
        await insertSaleStockReturn(tx, {
          line,
          warehouseId: sale.warehouseId,
          quantityMilli: parseQuantity(line.quantity),
          sourceType: "pos_sale_void",
          sourceId: line.id,
          actorUserId,
          reason: `Pembatalan penjualan ${saleId}: ${input.reason}`,
        });
        await tx
          .update(posSaleLines)
          .set({ returnedQuantity: line.quantity })
          .where(eq(posSaleLines.id, line.id));
      }
    }
    await tx
      .update(posSales)
      .set({
        status: "voided",
        voidIdempotencyKey: input.idempotencyKey,
        voidReason: input.reason,
        voidedBy: actorUserId,
        voidedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(posSales.id, sale.id));

    // Refund loyalty points if they were redeemed/earned
    if (sale.customerId) {
      const loyaltyTxns = await tx
        .select()
        .from(loyaltyTransactions)
        .where(
          and(
            eq(loyaltyTransactions.sourceType, "pos_sale"),
            eq(loyaltyTransactions.sourceId, sale.id),
          ),
        );
      for (const ltxn of loyaltyTxns) {
        if (ltxn.type === "redeem") {
          await refundLoyaltyPoints(
            sale.customerId,
            sale.branchId,
            -ltxn.points,
            sale.id,
            `Pembatalan penjualan: ${input.reason}`,
            actorUserId,
          );
        } else if (ltxn.type === "earn") {
          await adjustLoyaltyPoints(
            sale.customerId,
            sale.branchId,
            -ltxn.points,
            `Pembatalan penjualan: ${input.reason}`,
            actorUserId,
          );
        }
      }

      // Refund deposit if used
      const depositPayments = await tx
        .select()
        .from(posPayments)
        .where(and(eq(posPayments.saleId, sale.id), eq(posPayments.method, "deposit")));
      for (const dp of depositPayments) {
        await refundToCustomerDeposit(
          tx,
          sale.customerId,
          sale.branchId,
          dp.amountCents,
          "pos_refund",
          sale.id,
          `Pembatalan penjualan: ${input.reason}`,
          actorUserId,
        );
      }
    }

    await tx.insert(auditEvents).values({
      actorUserId,
      action: "pos.sale_voided",
      targetType: "pos_sale",
      targetId: sale.id,
      metadata: {
        amountCents: String(sale.totalCents),
        shiftId: shift.id,
      },
    });
    return { id: sale.id };
  });
}
