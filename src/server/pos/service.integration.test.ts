import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase } from "@/db";
import {
  auditEvents,
  branches,
  documentNumberSequences,
  inventoryBatches,
  inventoryMovements,
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
  productPrices,
  products,
  staffUsers,
  warehouses,
} from "@/db/schema";
import { createBranch } from "@/server/branches/service";
import { InventoryInsufficientStockError } from "@/server/inventory/service";
import {
  addPosCashMovement,
  closePosShift,
  createPosSale,
  openPosShift,
  PosDiscountApprovalRequiredError,
  PosIdempotencyConflictError,
  PosRefundApprovalRequiredError,
  refundPosSale,
  resumePosSale,
  settlePosSale,
  voidPosSale,
} from "./service";

const suffix = randomUUID();
let staffId: string;
let branchId: string;
let warehouseId: string;
let productId: string;
let priceTierId: string;
let shiftId: string;
const saleIds: string[] = [];

const grant = {
  dataScope: "all" as const,
  branchScope: "all" as const,
  maxDiscountBps: null,
  maxRefundCents: null,
  maxVoidCents: null,
  maxTransferCents: null,
  requiresSupervisorPin: false,
};

beforeAll(async () => {
  const [staff] = await getDatabase()
    .insert(staffUsers)
    .values({
      name: "POS Test",
      email: `pos-${suffix}@example.test`,
      passwordHash: "unused-test-hash",
    })
    .returning({ id: staffUsers.id });
  staffId = staff.id;
  const branch = await createBranch(
    {
      code: `POS-${suffix.slice(0, 6).toUpperCase()}`,
      name: `POS ${suffix.slice(0, 6)}`,
      timezone: "Asia/Jakarta",
    },
    staffId,
  );
  branchId = branch.id;
  await getDatabase()
    .insert(documentNumberSequences)
    .values([
      {
        documentType: "invoice",
        branchId,
        prefix: "INV",
        nextNumber: 1,
        minimumWidth: 5,
      },
      {
        documentType: "refund",
        branchId,
        prefix: "REF",
        nextNumber: 1,
        minimumWidth: 5,
      },
    ]);
  const [warehouse] = await getDatabase()
    .select({ id: warehouses.id })
    .from(warehouses)
    .where(eq(warehouses.branchId, branchId))
    .limit(1);
  warehouseId = warehouse.id;
  const [product] = await getDatabase()
    .insert(products)
    .values({
      name: `POS product ${suffix}`,
      sku: `POS-${suffix}`,
      productType: "general",
      createdBy: staffId,
      updatedBy: staffId,
    })
    .returning({ id: products.id });
  productId = product.id;
  await getDatabase().insert(productPrices).values({
    productId,
    branchId,
    sellingPriceCents: 10_000,
  });
  const [tier] = await getDatabase()
    .insert(priceTiers)
    .values({ name: `POS tier ${suffix}`, createdBy: staffId })
    .returning({ id: priceTiers.id });
  priceTierId = tier.id;
  await getDatabase().insert(productPrices).values({
    productId,
    branchId,
    priceTierId,
    sellingPriceCents: 8_000,
  });
  const [batch] = await getDatabase()
    .insert(inventoryBatches)
    .values({
      warehouseId,
      productId,
      batchNumber: `POS-${suffix}`,
      unitCostCents: 3_000,
    })
    .returning({ id: inventoryBatches.id });
  await getDatabase().insert(inventoryMovements).values({
    warehouseId,
    productId,
    batchId: batch.id,
    movementType: "receipt",
    quantityDelta: "5",
    unitCostCents: 3_000,
    sourceType: "pos_test_receipt",
    sourceId: randomUUID(),
    actorUserId: staffId,
  });
});

afterAll(async () => {
  const database = getDatabase();
  await database.execute(
    sql`ALTER TABLE inventory_movements DISABLE TRIGGER inventory_movements_immutable`,
  );
  try {
    if (staffId) {
      await database.delete(auditEvents).where(eq(auditEvents.actorUserId, staffId));
    }
    for (const id of saleIds) {
      await database.delete(posRefundStockAllocations).where(
        sql`${posRefundStockAllocations.saleLineId} IN (
          SELECT id FROM pos_sale_lines WHERE sale_id = ${id}
        )`,
      );
      await database.delete(posRefundPayments).where(
        sql`${posRefundPayments.refundId} IN (
          SELECT id FROM pos_refunds WHERE sale_id = ${id}
        )`,
      );
      await database.delete(posRefundLines).where(
        sql`${posRefundLines.refundId} IN (
          SELECT id FROM pos_refunds WHERE sale_id = ${id}
        )`,
      );
      await database.delete(posRefunds).where(eq(posRefunds.saleId, id));
      await database.delete(posPayments).where(eq(posPayments.saleId, id));
      await database.delete(posSaleStockAllocations).where(
        sql`${posSaleStockAllocations.saleLineId} IN (
          SELECT id FROM pos_sale_lines WHERE sale_id = ${id}
        )`,
      );
      await database.delete(posSaleLines).where(eq(posSaleLines.saleId, id));
      await database.delete(posSales).where(eq(posSales.id, id));
    }
    if (shiftId) {
      await database.delete(posCashMovements).where(eq(posCashMovements.shiftId, shiftId));
      await database.delete(posShifts).where(eq(posShifts.id, shiftId));
    }
    if (warehouseId) {
      await database
        .delete(inventoryMovements)
        .where(eq(inventoryMovements.warehouseId, warehouseId));
      await database.delete(inventoryBatches).where(eq(inventoryBatches.warehouseId, warehouseId));
      await database.delete(warehouses).where(eq(warehouses.id, warehouseId));
    }
    if (branchId) {
      await database
        .delete(documentNumberSequences)
        .where(eq(documentNumberSequences.branchId, branchId));
    }
    if (branchId) await database.delete(branches).where(eq(branches.id, branchId));
    if (productId) {
      await database.delete(productPrices).where(eq(productPrices.productId, productId));
      await database.delete(products).where(eq(products.id, productId));
    }
    if (priceTierId) await database.delete(priceTiers).where(eq(priceTiers.id, priceTierId));
    if (staffId) await database.delete(staffUsers).where(eq(staffUsers.id, staffId));
  } finally {
    await database.execute(
      sql`ALTER TABLE inventory_movements ENABLE TRIGGER inventory_movements_immutable`,
    );
  }
});

describe("POS shifts and checkout", () => {
  it("opens a shift, posts an idempotent sale with FEFO stock deduction, and reconciles cash", async () => {
    const shift = await openPosShift({ branchId, warehouseId, openingCashCents: 1_000 }, staffId);
    shiftId = shift.id;
    const input = {
      shiftId,
      idempotencyKey: `pos-sale-${suffix}`,
      hold: false,
      discountBps: 0,
      useDeposit: false,
      lines: [{ itemType: "product" as const, productId, quantity: "2" }],
      payments: [{ method: "cash" as const, amountCents: 3_000 }],
    };
    const sale = await createPosSale(input, staffId, grant);
    saleIds.push(sale.id);
    expect(sale.invoiceNumber).toContain("INV/");
    expect(sale.totalCents).toBeGreaterThanOrEqual(20_000);
    const retried = await createPosSale(input, staffId, grant);
    expect(retried.id).toBe(sale.id);
    await expect(
      createPosSale(
        { ...input, lines: [{ itemType: "product", productId, quantity: "1" }] },
        staffId,
        grant,
      ),
    ).rejects.toBeInstanceOf(PosIdempotencyConflictError);

    await expect(
      createPosSale(
        {
          ...input,
          idempotencyKey: `pos-insufficient-${suffix}`,
          lines: [{ itemType: "product", productId, quantity: "999" }],
          payments: [],
        },
        staffId,
        grant,
      ),
    ).rejects.toBeInstanceOf(InventoryInsufficientStockError);

    const [saleLine] = await getDatabase()
      .select({ id: posSaleLines.id, lineTotalCents: posSaleLines.lineTotalCents })
      .from(posSaleLines)
      .where(eq(posSaleLines.saleId, sale.id));
    const refundAmountCents = Math.round(saleLine.lineTotalCents / 20);
    const refundInput = {
      shiftId,
      idempotencyKey: `pos-refund-${suffix}`,
      reason: "Retur sebagian untuk pengujian",
      lines: [{ saleLineId: saleLine.id, quantity: "0.1" }],
      payments: [{ method: "cash" as const, amountCents: refundAmountCents }],
    };
    const refund = await refundPosSale(sale.id, refundInput, staffId, grant);
    expect(refund.amountCents).toBe(refundAmountCents);
    expect((await refundPosSale(sale.id, refundInput, staffId, grant)).id).toBe(refund.id);
    await expect(
      refundPosSale(
        sale.id,
        {
          ...refundInput,
          idempotencyKey: `pos-refund-limited-${suffix}`,
        },
        staffId,
        { ...grant, maxRefundCents: 1 },
      ),
    ).rejects.toBeInstanceOf(PosRefundApprovalRequiredError);
    await expect(
      createPosSale(
        {
          ...input,
          idempotencyKey: `pos-discount-limited-${suffix}`,
          discountBps: 100,
        },
        staffId,
        { ...grant, maxDiscountBps: 0 },
      ),
    ).rejects.toBeInstanceOf(PosDiscountApprovalRequiredError);

    const tierSale = await createPosSale(
      {
        ...input,
        idempotencyKey: `pos-tier-${suffix}`,
        priceTierId,
        lines: [{ itemType: "product", productId, quantity: "0.2" }],
        payments: [],
      },
      staffId,
      grant,
    );
    saleIds.push(tierSale.id);
    const [tierSaleLine] = await getDatabase()
      .select({ unitPriceCents: posSaleLines.unitPriceCents })
      .from(posSaleLines)
      .where(eq(posSaleLines.saleId, tierSale.id));
    expect(tierSaleLine?.unitPriceCents).toBe(8_000);
    await voidPosSale(
      tierSale.id,
      {
        shiftId,
        idempotencyKey: `pos-tier-void-${suffix}`,
        reason: "Pembatalan uji tier harga",
      },
      staffId,
      grant,
    );

    const [balance] = await getDatabase()
      .select({
        quantity: sql<string>`COALESCE(SUM(${inventoryMovements.quantityDelta}), 0)::text`,
      })
      .from(inventoryMovements)
      .where(eq(inventoryMovements.productId, productId));
    expect(balance?.quantity).toBe("3.100");

    const heldSale = await createPosSale(
      {
        shiftId,
        idempotencyKey: `pos-held-${suffix}`,
        hold: true,
        discountBps: 0,
        useDeposit: false,
        lines: [{ itemType: "product", productId, quantity: "1" }],
        payments: [],
      },
      staffId,
      grant,
    );
    saleIds.push(heldSale.id);
    expect(heldSale.status).toBe("held");
    const [heldBalance] = await getDatabase()
      .select({
        quantity: sql<string>`COALESCE(SUM(${inventoryMovements.quantityDelta}), 0)::text`,
      })
      .from(inventoryMovements)
      .where(eq(inventoryMovements.productId, productId));
    expect(heldBalance?.quantity).toBe("3.100");

    const resumeInput = {
      shiftId,
      idempotencyKey: `pos-resume-${suffix}`,
      useDeposit: false,
      payments: [
        { method: "bank_transfer" as const, amountCents: Math.floor(heldSale.totalCents / 2) },
        {
          method: "qris" as const,
          amountCents: heldSale.totalCents - Math.floor(heldSale.totalCents / 2),
        },
      ],
    };
    const resumed = await resumePosSale(heldSale.id, resumeInput, staffId);
    expect(resumed.status).toBe("paid");
    expect((await resumePosSale(heldSale.id, resumeInput, staffId)).paidCents).toBe(
      heldSale.totalCents,
    );

    const partiallyPaidSale = await createPosSale(
      {
        shiftId,
        idempotencyKey: `pos-partial-${suffix}`,
        hold: false,
        discountBps: 0,
        useDeposit: false,
        lines: [{ itemType: "product", productId, quantity: "0.2" }],
        payments: [{ method: "bank_transfer", amountCents: 100 }],
      },
      staffId,
      grant,
    );
    saleIds.push(partiallyPaidSale.id);
    const settlementAmount = partiallyPaidSale.totalCents - 100;
    const settlementInput = {
      shiftId,
      idempotencyKey: `pos-settlement-${suffix}`,
      payments: [
        { method: "bank_transfer" as const, amountCents: Math.floor(settlementAmount / 2) },
        {
          method: "qris" as const,
          amountCents: settlementAmount - Math.floor(settlementAmount / 2),
        },
      ],
    };
    expect((await settlePosSale(partiallyPaidSale.id, settlementInput, staffId)).status).toBe(
      "paid",
    );
    expect((await settlePosSale(partiallyPaidSale.id, settlementInput, staffId)).paidCents).toBe(
      partiallyPaidSale.totalCents,
    );

    const unpaidSale = await createPosSale(
      {
        shiftId,
        idempotencyKey: `pos-void-${suffix}`,
        hold: false,
        discountBps: 0,
        useDeposit: false,
        lines: [{ itemType: "product", productId, quantity: "0.5" }],
        payments: [],
      },
      staffId,
      grant,
    );
    saleIds.push(unpaidSale.id);
    const voidInput = {
      shiftId,
      idempotencyKey: `pos-void-key-${suffix}`,
      reason: "Pembatalan sebelum dibayar",
    };
    expect((await voidPosSale(unpaidSale.id, voidInput, staffId, grant)).id).toBe(unpaidSale.id);
    await expect(
      voidPosSale(unpaidSale.id, { ...voidInput, reason: "Alasan berbeda" }, staffId, grant),
    ).rejects.toBeInstanceOf(PosIdempotencyConflictError);
    expect((await voidPosSale(unpaidSale.id, voidInput, staffId, grant)).id).toBe(unpaidSale.id);

    const heldWithoutPayment = await createPosSale(
      {
        shiftId,
        idempotencyKey: `pos-held-no-pay-${suffix}`,
        hold: true,
        discountBps: 0,
        useDeposit: false,
        lines: [{ itemType: "product", productId, quantity: "0.1" }],
        payments: [],
      },
      staffId,
      grant,
    );
    saleIds.push(heldWithoutPayment.id);
    const noPaymentResumeInput = {
      shiftId,
      idempotencyKey: `pos-resume-no-pay-${suffix}`,
      useDeposit: false,
      payments: [],
    };
    const resumedWithoutPayment = await resumePosSale(
      heldWithoutPayment.id,
      noPaymentResumeInput,
      staffId,
    );
    expect(resumedWithoutPayment.status).toBe("partially_paid");
    expect((await resumePosSale(heldWithoutPayment.id, noPaymentResumeInput, staffId)).status).toBe(
      "partially_paid",
    );
    await voidPosSale(
      heldWithoutPayment.id,
      {
        shiftId,
        idempotencyKey: `pos-void-no-pay-${suffix}`,
        reason: "Pembatalan tagihan tanpa pembayaran",
      },
      staffId,
      grant,
    );

    await addPosCashMovement(
      shiftId,
      { movementType: "cash_in", amountCents: 100, reason: "Kas kecil uji" },
      staffId,
    );
    const expectedCashCents = 4_100 - refundAmountCents;
    const closed = await closePosShift(shiftId, staffId, expectedCashCents, null);
    expect(closed.expectedCashCents).toBe(expectedCashCents);
    expect(closed.differenceCents).toBe(0);
  });
});
