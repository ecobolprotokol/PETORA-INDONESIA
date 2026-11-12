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
} from "./service";

const suffix = randomUUID();
let staffId: string;
let branchId: string;
let warehouseId: string;
let productId: string;
let expiredBatchId: string;
let fefoBatchId: string;
let laterBatchId: string;

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
});
