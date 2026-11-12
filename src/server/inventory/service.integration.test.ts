import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase } from "@/db";
import {
  auditEvents,
  branches,
  inventoryBatches,
  inventoryMovements,
  products,
  staffUsers,
  warehouses,
} from "@/db/schema";
import { createBranch } from "@/server/branches/service";
import {
  consumeInventory,
  createInventoryAdjustment,
  InventoryInsufficientStockError,
  listInventoryCard,
  listInventoryReports,
} from "./service";

const suffix = randomUUID();
let staffId: string;
let branchId: string;
let warehouseId: string;
let productId: string;
let expiredBatchId: string;
let fefoBatchId: string;
let laterBatchId: string;
let reportProductId: string;

beforeAll(async () => {
  const [staff] = await getDatabase()
    .insert(staffUsers)
    .values({
      name: "Inventory Test",
      email: `inventory-${suffix}@example.test`,
      passwordHash: "unused-test-hash",
    })
    .returning({ id: staffUsers.id });
  staffId = staff.id;
  const branch = await createBranch(
    {
      code: `INV-${suffix.slice(0, 6).toUpperCase()}`,
      name: `Inventory ${suffix.slice(0, 6)}`,
      timezone: "Asia/Jakarta",
    },
    staffId,
  );
  branchId = branch.id;
  const [warehouse] = await getDatabase()
    .select({ id: warehouses.id })
    .from(warehouses)
    .where(eq(warehouses.branchId, branchId))
    .limit(1);
  warehouseId = warehouse.id;
  const [product] = await getDatabase()
    .insert(products)
    .values({
      name: `Inventory test ${suffix}`,
      sku: `INV-${suffix}`,
      productType: "general",
      createdBy: staffId,
      updatedBy: staffId,
    })
    .returning({ id: products.id });
  productId = product.id;

  const [expired, fefo, later] = await getDatabase()
    .insert(inventoryBatches)
    .values([
      {
        warehouseId,
        productId,
        batchNumber: "EXPIRED",
        expiresOn: "2020-01-01",
        unitCostCents: 50,
      },
      {
        warehouseId,
        productId,
        batchNumber: "FEFO",
        expiresOn: "2099-01-01",
        unitCostCents: 100,
      },
      {
        warehouseId,
        productId,
        batchNumber: "LATER",
        expiresOn: "2099-02-01",
        unitCostCents: 200,
      },
    ])
    .returning({ id: inventoryBatches.id });
  [expiredBatchId, fefoBatchId, laterBatchId] = [expired.id, fefo.id, later.id];
  await getDatabase()
    .insert(inventoryMovements)
    .values([
      {
        warehouseId,
        productId,
        batchId: expired.id,
        movementType: "receipt",
        quantityDelta: "10",
        unitCostCents: 50,
        sourceType: "test_receipt",
        sourceId: randomUUID(),
        actorUserId: staffId,
      },
      {
        warehouseId,
        productId,
        batchId: fefo.id,
        movementType: "receipt",
        quantityDelta: "2",
        unitCostCents: 100,
        sourceType: "test_receipt",
        sourceId: randomUUID(),
        actorUserId: staffId,
      },
      {
        warehouseId,
        productId,
        batchId: later.id,
        movementType: "receipt",
        quantityDelta: "3",
        unitCostCents: 200,
        sourceType: "test_receipt",
        sourceId: randomUUID(),
        actorUserId: staffId,
      },
    ]);
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
    if (warehouseId) {
      await database
        .delete(inventoryMovements)
        .where(eq(inventoryMovements.warehouseId, warehouseId));
      await database.delete(inventoryBatches).where(eq(inventoryBatches.warehouseId, warehouseId));
      await database.delete(warehouses).where(eq(warehouses.id, warehouseId));
    }
    if (branchId) {
      await database.delete(branches).where(eq(branches.id, branchId));
    }
    if (productId) {
      await database.delete(products).where(eq(products.id, productId));
    }
    if (reportProductId) {
      await database.delete(products).where(eq(products.id, reportProductId));
    }
    if (staffId) {
      await database.delete(staffUsers).where(eq(staffUsers.id, staffId));
    }
  } finally {
    await database.execute(
      sql`ALTER TABLE inventory_movements ENABLE TRIGGER inventory_movements_immutable`,
    );
  }
});

describe("inventory ledger and FEFO", () => {
  it("consumes the nearest unexpired batches and never consumes expired stock", async () => {
    const result = await consumeInventory({
      warehouseId,
      productId,
      quantity: "4",
      sourceType: "test_sale",
      sourceId: randomUUID(),
      actorUserId: staffId,
    });

    expect(result.allocations).toEqual([
      { batchId: fefoBatchId, quantity: "2", unitCostCents: 100 },
      { batchId: laterBatchId, quantity: "2", unitCostCents: 200 },
    ]);
    expect(result.totalCostCents).toBe(600);
    await expect(
      consumeInventory({
        warehouseId,
        productId,
        quantity: "2",
        sourceType: "test_sale",
        sourceId: randomUUID(),
        actorUserId: staffId,
      }),
    ).rejects.toBeInstanceOf(InventoryInsufficientStockError);

    const expiredMovements = await getDatabase()
      .select({ id: inventoryMovements.id })
      .from(inventoryMovements)
      .where(eq(inventoryMovements.batchId, expiredBatchId));
    expect(expiredMovements).toHaveLength(1);
  });

  it("rolls back a stock adjustment when supervisor approval is missing", async () => {
    await expect(
      createInventoryAdjustment(
        {
          warehouseId,
          productId,
          direction: "in",
          quantity: "1",
          batchNumber: "PIN-TEST",
          expiresOn: null,
          unitCostCents: 100,
          reason: "Penyesuaian uji",
        },
        staffId,
        { maxTransferCents: null, requiresSupervisorPin: true },
      ),
    ).rejects.toThrow("memerlukan persetujuan PIN");
    const rows = await getDatabase()
      .select({ id: inventoryBatches.id })
      .from(inventoryBatches)
      .where(eq(inventoryBatches.batchNumber, "PIN-TEST"));
    expect(rows).toHaveLength(0);
  });

  it("reports expiring stock and slow-moving balances and calculates each batch balance", async () => {
    const [reportProduct] = await getDatabase()
      .insert(products)
      .values({
        name: `Report test ${suffix}`,
        sku: `REPORT-${suffix}`,
        productType: "general",
        createdBy: staffId,
        updatedBy: staffId,
      })
      .returning({ id: products.id });
    reportProductId = reportProduct.id;

    const [reportBatch] = await getDatabase()
      .insert(inventoryBatches)
      .values({
        warehouseId,
        productId: reportProductId,
        batchNumber: `REPORT-${suffix}`,
        expiresOn: new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Jakarta",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date()),
        unitCostCents: 100,
      })
      .returning({ id: inventoryBatches.id });

    const receiptDate = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);
    const outboundDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
    await getDatabase()
      .insert(inventoryMovements)
      .values([
        {
          warehouseId,
          productId: reportProductId,
          batchId: reportBatch.id,
          movementType: "receipt",
          quantityDelta: "5",
          unitCostCents: 100,
          sourceType: "test_receipt",
          sourceId: randomUUID(),
          actorUserId: staffId,
          createdAt: receiptDate,
        },
        {
          warehouseId,
          productId: reportProductId,
          batchId: reportBatch.id,
          movementType: "adjustment_out",
          quantityDelta: "-1",
          unitCostCents: 100,
          sourceType: "test_adjustment",
          sourceId: randomUUID(),
          actorUserId: staffId,
          createdAt: outboundDate,
        },
      ]);

    const [card, reports] = await Promise.all([
      listInventoryCard(warehouseId, reportProductId, false, staffId),
      listInventoryReports(warehouseId, "Asia/Jakarta", 30, 90, staffId),
    ]);
    const reportBatchMovement = card.find(({ batchId }) => batchId === reportBatch.id);
    expect(reportBatchMovement?.balanceAfter).toBe("4.000");
    expect(reportBatchMovement).not.toHaveProperty("unitCostCents");
    expect(reports.expiringBatches.map(({ batchId }) => batchId)).toContain(reportBatch.id);
    expect(
      reports.expiringBatches.find(({ batchId }) => batchId === reportBatch.id)?.isExpired,
    ).toBe(false);
    expect(
      reports.expiringBatches.find(({ batchId }) => batchId === expiredBatchId)?.isExpired,
    ).toBe(true);
    expect(reports.slowMovingProducts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ productId: reportProductId, currentQuantity: "4.000" }),
      ]),
    );
    const lastOutboundAt = reports.slowMovingProducts.find(
      ({ productId }) => productId === reportProductId,
    )?.lastOutboundAt;
    expect(Date.parse(String(lastOutboundAt))).toBe(outboundDate.getTime());
  });
});
