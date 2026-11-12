import { randomUUID } from "node:crypto";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase } from "@/db";
import {
  auditEvents,
  branches,
  inventoryAdjustments,
  inventoryBatches,
  inventoryMovements,
  productBundleComponents,
  products,
  staffUsers,
  warehouses,
} from "@/db/schema";
import { createBranch } from "@/server/branches/service";
import {
  consumeBundleInventory,
  ProductBundleInvalidError,
  replaceBundleComponents,
} from "./bundles";
import { createInventoryAdjustment, InventoryInsufficientStockError } from "./service";

const suffix = randomUUID();
let staffId: string;
let branchId: string;
let warehouseId: string;
let cycleBundleId: string;
let nestedBundleId: string;
let stockBundleId: string;
let firstComponentId: string;
let secondComponentId: string;
const productIds: string[] = [];

beforeAll(async () => {
  const [staff] = await getDatabase()
    .insert(staffUsers)
    .values({
      name: "Bundle Inventory Test",
      email: `bundle-${suffix}@example.test`,
      passwordHash: "unused-test-hash",
    })
    .returning({ id: staffUsers.id });
  staffId = staff.id;
  const branch = await createBranch(
    {
      code: `BND-${suffix.slice(0, 6).toUpperCase()}`,
      name: `Bundle ${suffix.slice(0, 6)}`,
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

  const inserted = await getDatabase()
    .insert(products)
    .values(
      ["Cycle bundle", "Nested bundle", "Stock bundle", "First component", "Second component"].map(
        (name, index) => ({
          name: `${name} ${suffix}`,
          sku: `BND-${suffix}-${index}`,
          productType: "general" as const,
          createdBy: staffId,
          updatedBy: staffId,
        }),
      ),
    )
    .returning({ id: products.id, name: products.name });
  productIds.push(...inserted.map(({ id }) => id));
  cycleBundleId = inserted[0].id;
  nestedBundleId = inserted[1].id;
  stockBundleId = inserted[2].id;
  firstComponentId = inserted[3].id;
  secondComponentId = inserted[4].id;
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
    if (productIds.length) {
      await database
        .delete(productBundleComponents)
        .where(
          or(
            inArray(productBundleComponents.bundleProductId, productIds),
            inArray(productBundleComponents.componentProductId, productIds),
          ),
        );
    }
    if (warehouseId) {
      await database
        .delete(inventoryAdjustments)
        .where(eq(inventoryAdjustments.warehouseId, warehouseId));
      await database
        .delete(inventoryMovements)
        .where(eq(inventoryMovements.warehouseId, warehouseId));
      await database.delete(inventoryBatches).where(eq(inventoryBatches.warehouseId, warehouseId));
      await database.delete(warehouses).where(eq(warehouses.id, warehouseId));
    }
    if (productIds.length) {
      await database.delete(products).where(inArray(products.id, productIds));
    }
    if (branchId) {
      await database.delete(branches).where(eq(branches.id, branchId));
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

describe("product bundle inventory", () => {
  it("rejects composition cycles and rolls back partial component consumption", async () => {
    await replaceBundleComponents(
      cycleBundleId,
      [{ productId: nestedBundleId, quantity: "1" }],
      staffId,
      "all",
    );
    await expect(
      replaceBundleComponents(
        nestedBundleId,
        [{ productId: cycleBundleId, quantity: "1" }],
        staffId,
        "all",
      ),
    ).rejects.toBeInstanceOf(ProductBundleInvalidError);

    await replaceBundleComponents(
      stockBundleId,
      [
        { productId: firstComponentId, quantity: "2" },
        { productId: secondComponentId, quantity: "2" },
      ],
      staffId,
      "all",
    );
    await createInventoryAdjustment(
      {
        warehouseId,
        productId: firstComponentId,
        direction: "in",
        quantity: "2",
        batchNumber: "BUNDLE-FIRST",
        expiresOn: "2099-12-31",
        unitCostCents: 100,
        reason: "Stok komponen bundel",
      },
      staffId,
      { maxTransferCents: null, requiresSupervisorPin: false },
    );

    await expect(
      consumeBundleInventory({
        warehouseId,
        bundleProductId: stockBundleId,
        quantity: "1",
        sourceId: randomUUID(),
        actorUserId: staffId,
      }),
    ).rejects.toBeInstanceOf(InventoryInsufficientStockError);
    const movementsAfterRollback = await getDatabase()
      .select({ id: inventoryMovements.id })
      .from(inventoryMovements)
      .where(
        and(
          eq(inventoryMovements.sourceType, "bundle"),
          eq(inventoryMovements.actorUserId, staffId),
        ),
      );
    expect(movementsAfterRollback).toHaveLength(0);

    await createInventoryAdjustment(
      {
        warehouseId,
        productId: secondComponentId,
        direction: "in",
        quantity: "2",
        batchNumber: "BUNDLE-SECOND",
        expiresOn: "2099-12-31",
        unitCostCents: 200,
        reason: "Stok komponen bundel",
      },
      staffId,
      { maxTransferCents: null, requiresSupervisorPin: false },
    );
    const result = await consumeBundleInventory({
      warehouseId,
      bundleProductId: stockBundleId,
      quantity: "1",
      sourceId: randomUUID(),
      actorUserId: staffId,
    });
    expect(result).toEqual({ totalCostCents: 600, componentCount: 2 });
  });
});
