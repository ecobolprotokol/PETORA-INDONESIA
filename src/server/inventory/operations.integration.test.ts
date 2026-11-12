import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase } from "@/db";
import {
  auditEvents,
  branches,
  inventoryAdjustments,
  inventoryBatches,
  inventoryMovements,
  inventoryTransferBatchLines,
  inventoryTransferLines,
  inventoryTransfers,
  products,
  staffUsers,
  stocktakeLines,
  stocktakes,
  warehouses,
} from "@/db/schema";
import { createBranch } from "@/server/branches/service";
import {
  createInventoryTransfer,
  createStocktake,
  dispatchInventoryTransfer,
  receiveInventoryTransfer,
  reviewStocktake,
  submitStocktake,
} from "./operations";
import { createInventoryAdjustment } from "./service";

const suffix = randomUUID();
let requesterId: string;
let receiverId: string;
let sourceBranchId: string;
let destinationBranchId: string;
let sourceWarehouseId: string;
let destinationWarehouseId: string;
let productId: string;
let transferId: string;
let stocktakeId: string;

beforeAll(async () => {
  const [[requester], [receiver]] = await Promise.all([
    getDatabase()
      .insert(staffUsers)
      .values({
        name: "Transfer Requester",
        email: `transfer-requester-${suffix}@example.test`,
        passwordHash: "unused-test-hash",
      })
      .returning({ id: staffUsers.id }),
    getDatabase()
      .insert(staffUsers)
      .values({
        name: "Transfer Receiver",
        email: `transfer-receiver-${suffix}@example.test`,
        passwordHash: "unused-test-hash",
      })
      .returning({ id: staffUsers.id }),
  ]);
  requesterId = requester.id;
  receiverId = receiver.id;
  const [sourceBranch, destinationBranch] = await Promise.all([
    createBranch(
      {
        code: `TS-${suffix.slice(0, 6).toUpperCase()}`,
        name: `Transfer Source ${suffix.slice(0, 6)}`,
        timezone: "Asia/Jakarta",
      },
      requesterId,
    ),
    createBranch(
      {
        code: `TD-${suffix.slice(0, 6).toUpperCase()}`,
        name: `Transfer Destination ${suffix.slice(0, 6)}`,
        timezone: "Asia/Jakarta",
      },
      receiverId,
    ),
  ]);
  sourceBranchId = sourceBranch.id;
  destinationBranchId = destinationBranch.id;
  const warehousesForBranches = await getDatabase()
    .select({ id: warehouses.id, branchId: warehouses.branchId })
    .from(warehouses)
    .where(inArray(warehouses.branchId, [sourceBranchId, destinationBranchId]));
  const sourceWarehouse = warehousesForBranches.find(({ branchId }) => branchId === sourceBranchId);
  const destinationWarehouse = warehousesForBranches.find(
    ({ branchId }) => branchId === destinationBranchId,
  );
  if (!sourceWarehouse || !destinationWarehouse) {
    throw new Error("Branch integration test did not create its default warehouses.");
  }
  sourceWarehouseId = sourceWarehouse.id;
  destinationWarehouseId = destinationWarehouse.id;
  const [product] = await getDatabase()
    .insert(products)
    .values({
      name: `Transfer product ${suffix}`,
      sku: `TR-${suffix}`,
      productType: "general",
      createdBy: requesterId,
      updatedBy: requesterId,
    })
    .returning({ id: products.id });
  productId = product.id;
});

afterAll(async () => {
  const database = getDatabase();
  await database.execute(
    sql`ALTER TABLE inventory_movements DISABLE TRIGGER inventory_movements_immutable`,
  );
  try {
    if (requesterId || receiverId) {
      await database
        .delete(auditEvents)
        .where(inArray(auditEvents.actorUserId, [requesterId, receiverId].filter(Boolean)));
    }
    if (stocktakeId) {
      await database.delete(stocktakeLines).where(eq(stocktakeLines.stocktakeId, stocktakeId));
      await database.delete(stocktakes).where(eq(stocktakes.id, stocktakeId));
    }
    if (transferId) {
      const lines = await database
        .select({ id: inventoryTransferLines.id })
        .from(inventoryTransferLines)
        .where(eq(inventoryTransferLines.transferId, transferId));
      const lineIds = lines.map(({ id }) => id);
      if (lineIds.length) {
        await database
          .delete(inventoryTransferBatchLines)
          .where(inArray(inventoryTransferBatchLines.transferLineId, lineIds));
        await database
          .delete(inventoryTransferLines)
          .where(inArray(inventoryTransferLines.id, lineIds));
      }
      await database.delete(inventoryTransfers).where(eq(inventoryTransfers.id, transferId));
    }
    for (const warehouseId of [sourceWarehouseId, destinationWarehouseId].filter(Boolean)) {
      await database
        .delete(inventoryAdjustments)
        .where(eq(inventoryAdjustments.warehouseId, warehouseId));
      await database
        .delete(inventoryMovements)
        .where(eq(inventoryMovements.warehouseId, warehouseId));
      await database.delete(inventoryBatches).where(eq(inventoryBatches.warehouseId, warehouseId));
      await database.delete(warehouses).where(eq(warehouses.id, warehouseId));
    }
    if (sourceBranchId) {
      await database.delete(branches).where(eq(branches.id, sourceBranchId));
    }
    if (destinationBranchId) {
      await database.delete(branches).where(eq(branches.id, destinationBranchId));
    }
    if (productId) {
      await database.delete(products).where(eq(products.id, productId));
    }
    if (requesterId) {
      await database.delete(staffUsers).where(eq(staffUsers.id, requesterId));
    }
    if (receiverId) {
      await database.delete(staffUsers).where(eq(staffUsers.id, receiverId));
    }
  } finally {
    await database.execute(
      sql`ALTER TABLE inventory_movements ENABLE TRIGGER inventory_movements_immutable`,
    );
  }
});

describe("inventory transfer and stocktake", () => {
  it("records dispatch, receiving discrepancy, and separately approved stocktake", async () => {
    await createInventoryAdjustment(
      {
        warehouseId: sourceWarehouseId,
        productId,
        direction: "in",
        quantity: "3",
        batchNumber: "TRANSFER-LOT",
        expiresOn: "2099-12-31",
        unitCostCents: 500,
        reason: "Stok awal untuk transfer",
      },
      requesterId,
      { maxTransferCents: null, requiresSupervisorPin: false },
    );
    const transfer = await createInventoryTransfer(
      {
        sourceWarehouseId,
        destinationWarehouseId,
        reason: "Pengisian stok cabang",
        lines: [
          { productId, quantity: "1", variantId: null },
          { productId, quantity: "2", variantId: null },
        ],
      },
      requesterId,
    );
    transferId = transfer.id;
    await dispatchInventoryTransfer(transfer.id, requesterId, {
      maxTransferCents: null,
      requiresSupervisorPin: false,
    });
    const [batchLine] = await getDatabase()
      .select({
        id: inventoryTransferBatchLines.id,
        destinationBatchId: inventoryTransferBatchLines.destinationBatchId,
      })
      .from(inventoryTransferBatchLines)
      .innerJoin(
        inventoryTransferLines,
        eq(inventoryTransferBatchLines.transferLineId, inventoryTransferLines.id),
      )
      .where(eq(inventoryTransferLines.transferId, transfer.id))
      .limit(1);
    await receiveInventoryTransfer(
      transfer.id,
      {
        discrepancyReason: "Satu unit rusak saat pengiriman",
        lines: [{ transferBatchLineId: batchLine.id, receivedQuantity: "2" }],
      },
      receiverId,
    );

    const [destinationBatch] = await getDatabase()
      .select({ id: inventoryBatches.id })
      .from(inventoryBatches)
      .where(eq(inventoryBatches.id, batchLine.destinationBatchId))
      .limit(1);
    const stocktake = await createStocktake(
      {
        warehouseId: destinationWarehouseId,
        reason: "Pemeriksaan stok cabang",
        lines: [{ batchId: destinationBatch.id, countedQuantity: "1" }],
      },
      requesterId,
    );
    stocktakeId = stocktake;
    await submitStocktake(stocktake, requesterId);
    await reviewStocktake(stocktake, receiverId, "approved");

    const movements = await getDatabase()
      .select({
        warehouseId: inventoryMovements.warehouseId,
        movementType: inventoryMovements.movementType,
        quantityDelta: inventoryMovements.quantityDelta,
      })
      .from(inventoryMovements)
      .where(inArray(inventoryMovements.warehouseId, [sourceWarehouseId, destinationWarehouseId]));
    expect(movements).toContainEqual({
      warehouseId: sourceWarehouseId,
      movementType: "transfer_out",
      quantityDelta: "-3.000",
    });
    expect(movements).toContainEqual({
      warehouseId: destinationWarehouseId,
      movementType: "transfer_in",
      quantityDelta: "2.000",
    });
    expect(movements).toContainEqual({
      warehouseId: destinationWarehouseId,
      movementType: "adjustment_out",
      quantityDelta: "-1.000",
    });
  });
});
