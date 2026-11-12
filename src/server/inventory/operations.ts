import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { getDatabase } from "@/db";
import {
  auditEvents,
  inventoryBatches,
  inventoryMovements,
  inventoryTransferBatchLines,
  inventoryTransferLines,
  inventoryTransfers,
  products,
  productVariants,
  stocktakeLines,
  stocktakes,
  warehouses,
} from "@/db/schema";
import { nextDocumentNumber } from "@/server/settings/numbering";
import { verifySupervisorPin } from "@/server/supervisor/pin";
import { formatQuantity, parseQuantity } from "./quantity";
import {
  appendInventoryMovement,
  consumeFromBatches,
  InventoryProductInvalidError,
  lockWarehouse,
  validateProductVariant,
} from "./service";
import type { InventoryTransferInput, ReceiveTransferInput, StocktakeInput } from "./validation";

export class InventoryTransferNotFoundError extends Error {}
export class InventoryOperationStatusError extends Error {}
export class InventoryTransferDiscrepancyError extends Error {}
export class StocktakeStaleError extends Error {}
export class StocktakeNotFoundError extends Error {}

export async function createInventoryTransfer(input: InventoryTransferInput, actorUserId: string) {
  return getDatabase().transaction(async (tx) => {
    const [source] = await tx
      .select({
        id: warehouses.id,
        branchId: warehouses.branchId,
        isActive: warehouses.isActive,
      })
      .from(warehouses)
      .where(eq(warehouses.id, input.sourceWarehouseId))
      .limit(1);
    const [destination] = await tx
      .select({
        id: warehouses.id,
        branchId: warehouses.branchId,
        isActive: warehouses.isActive,
      })
      .from(warehouses)
      .where(eq(warehouses.id, input.destinationWarehouseId))
      .limit(1);
    if (!source?.isActive || !destination?.isActive) {
      throw new InventoryTransferNotFoundError("Gudang sumber atau tujuan tidak aktif.");
    }
    if (source.id === destination.id) {
      throw new InventoryTransferNotFoundError("Gudang sumber dan tujuan harus berbeda.");
    }
    for (const line of input.lines) {
      await validateProductVariant(tx, line.productId, line.variantId);
    }
    const transferNumber = await nextDocumentNumber(tx, {
      documentType: "inventory_transfer",
      branchId: source.branchId,
    });
    const [transfer] = await tx
      .insert(inventoryTransfers)
      .values({
        transferNumber,
        sourceWarehouseId: source.id,
        destinationWarehouseId: destination.id,
        reason: input.reason,
        requestedBy: actorUserId,
      })
      .returning({ id: inventoryTransfers.id });
    if (!transfer) {
      throw new Error("Permintaan transfer stok gagal dibuat.");
    }
    const grouped = new Map<
      string,
      { productId: string; variantId: string | null; quantity: bigint }
    >();
    for (const line of input.lines) {
      const variantId = line.variantId ?? null;
      const key = `${line.productId}:${variantId ?? ""}`;
      const previous = grouped.get(key);
      grouped.set(key, {
        productId: line.productId,
        variantId,
        quantity: (previous?.quantity ?? 0n) + parseQuantity(line.quantity),
      });
    }
    await tx.insert(inventoryTransferLines).values(
      [...grouped.values()].map((line) => ({
        transferId: transfer.id,
        productId: line.productId,
        variantId: line.variantId,
        quantity: formatQuantity(line.quantity),
      })),
    );
    await tx.insert(auditEvents).values({
      actorUserId,
      action: "inventory.transfer_requested",
      targetType: "inventory_transfer",
      targetId: transfer.id,
      metadata: {
        sourceBranchId: source.branchId,
        destinationBranchId: destination.branchId,
        lineCount: String(grouped.size),
      },
    });
    return { id: transfer.id, transferNumber };
  });
}

export async function dispatchInventoryTransfer(
  transferId: string,
  actorUserId: string,
  policy: { maxTransferCents: number | null; requiresSupervisorPin: boolean },
  supervisorPin?: string,
) {
  return getDatabase().transaction(async (tx) => {
    const [transfer] = await tx
      .select({
        id: inventoryTransfers.id,
        sourceWarehouseId: inventoryTransfers.sourceWarehouseId,
        destinationWarehouseId: inventoryTransfers.destinationWarehouseId,
        status: inventoryTransfers.status,
        reason: inventoryTransfers.reason,
      })
      .from(inventoryTransfers)
      .where(eq(inventoryTransfers.id, transferId))
      .for("update")
      .limit(1);
    if (!transfer) {
      throw new InventoryTransferNotFoundError("Transfer stok tidak ditemukan.");
    }
    if (transfer.status !== "requested") {
      throw new InventoryOperationStatusError("Hanya transfer yang diminta dapat dikirim.");
    }

    const warehouseIds = [transfer.sourceWarehouseId, transfer.destinationWarehouseId].sort();
    const warehousesById = new Map<string, Awaited<ReturnType<typeof lockWarehouse>>>();
    for (const warehouseId of warehouseIds) {
      warehousesById.set(warehouseId, await lockWarehouse(tx, warehouseId));
    }

    const lines = await tx
      .select({
        id: inventoryTransferLines.id,
        productId: inventoryTransferLines.productId,
        variantId: inventoryTransferLines.variantId,
        quantity: inventoryTransferLines.quantity,
      })
      .from(inventoryTransferLines)
      .where(eq(inventoryTransferLines.transferId, transfer.id))
      .orderBy(asc(inventoryTransferLines.id));
    let totalValueCents = 0;
    for (const line of lines) {
      const quantityMilli = parseQuantity(line.quantity);
      const consumed = await consumeFromBatches(tx, {
        warehouseId: transfer.sourceWarehouseId,
        productId: line.productId,
        variantId: line.variantId,
        timezone: warehousesById.get(transfer.sourceWarehouseId)?.timezone ?? "UTC",
        quantityMilli,
        sourceType: "inventory_transfer",
        sourceId: transfer.id,
        actorUserId,
        reason: transfer.reason,
        movementType: "transfer_out",
      });
      totalValueCents += consumed.totalCostCents;
      for (const allocation of consumed.allocations) {
        const [sourceBatch] = await tx
          .select({
            productId: inventoryBatches.productId,
            variantId: inventoryBatches.variantId,
            batchNumber: inventoryBatches.batchNumber,
            expiresOn: inventoryBatches.expiresOn,
            unitCostCents: inventoryBatches.unitCostCents,
            supplierId: inventoryBatches.supplierId,
          })
          .from(inventoryBatches)
          .where(eq(inventoryBatches.id, allocation.batchId))
          .limit(1);
        if (!sourceBatch) {
          throw new InventoryProductInvalidError("Batch sumber tidak ditemukan.");
        }
        const [existingDestinationBatch] = await tx
          .select({
            id: inventoryBatches.id,
            unitCostCents: inventoryBatches.unitCostCents,
            supplierId: inventoryBatches.supplierId,
            expiresOn: inventoryBatches.expiresOn,
          })
          .from(inventoryBatches)
          .where(
            and(
              eq(inventoryBatches.warehouseId, transfer.destinationWarehouseId),
              eq(inventoryBatches.productId, sourceBatch.productId),
              sourceBatch.variantId
                ? eq(inventoryBatches.variantId, sourceBatch.variantId)
                : sql`${inventoryBatches.variantId} IS NULL`,
              eq(inventoryBatches.batchNumber, sourceBatch.batchNumber),
            ),
          )
          .limit(1);
        if (
          existingDestinationBatch &&
          (existingDestinationBatch.unitCostCents !== sourceBatch.unitCostCents ||
            existingDestinationBatch.supplierId !== sourceBatch.supplierId ||
            existingDestinationBatch.expiresOn !== sourceBatch.expiresOn)
        ) {
          throw new InventoryProductInvalidError(
            "Batch tujuan memiliki data biaya atau kedaluwarsa yang berbeda.",
          );
        }
        const [destinationBatch] = existingDestinationBatch
          ? [existingDestinationBatch]
          : await tx
              .insert(inventoryBatches)
              .values({
                warehouseId: transfer.destinationWarehouseId,
                productId: sourceBatch.productId,
                variantId: sourceBatch.variantId,
                supplierId: sourceBatch.supplierId,
                batchNumber: sourceBatch.batchNumber,
                expiresOn: sourceBatch.expiresOn,
                unitCostCents: sourceBatch.unitCostCents,
              })
              .returning({
                id: inventoryBatches.id,
                unitCostCents: inventoryBatches.unitCostCents,
                supplierId: inventoryBatches.supplierId,
                expiresOn: inventoryBatches.expiresOn,
              });
        if (!destinationBatch) {
          throw new Error("Batch gudang tujuan gagal dibuat.");
        }
        await tx.insert(inventoryTransferBatchLines).values({
          transferLineId: line.id,
          sourceBatchId: allocation.batchId,
          destinationBatchId: destinationBatch.id,
          shippedQuantity: allocation.quantity,
        });
      }
    }
    const needsPin =
      policy.requiresSupervisorPin ||
      (policy.maxTransferCents !== null && totalValueCents > policy.maxTransferCents);
    if (needsPin && !supervisorPin) {
      throw new InventoryOperationStatusError(
        "Transfer ini memerlukan persetujuan PIN supervisor sebelum dikirim.",
      );
    }
    if (needsPin) {
      await verifySupervisorPin(actorUserId, supervisorPin ?? "");
    }
    await tx
      .update(inventoryTransfers)
      .set({ status: "in_transit", shippedBy: actorUserId, shippedAt: new Date() })
      .where(eq(inventoryTransfers.id, transfer.id));
    const sourceBranchId = warehousesById.get(transfer.sourceWarehouseId)?.branchId;
    const destinationBranchId = warehousesById.get(transfer.destinationWarehouseId)?.branchId;
    await tx.insert(auditEvents).values({
      actorUserId,
      action: "inventory.transfer_dispatched",
      targetType: "inventory_transfer",
      targetId: transfer.id,
      metadata: {
        sourceBranchId: sourceBranchId ?? "",
        destinationBranchId: destinationBranchId ?? "",
        lineCount: String(lines.length),
        supervisorApproval: needsPin ? "true" : "false",
      },
    });
    return transfer.id;
  });
}

export async function receiveInventoryTransfer(
  transferId: string,
  input: ReceiveTransferInput,
  actorUserId: string,
) {
  return getDatabase().transaction(async (tx) => {
    const [transfer] = await tx
      .select({
        id: inventoryTransfers.id,
        sourceWarehouseId: inventoryTransfers.sourceWarehouseId,
        destinationWarehouseId: inventoryTransfers.destinationWarehouseId,
        status: inventoryTransfers.status,
      })
      .from(inventoryTransfers)
      .where(eq(inventoryTransfers.id, transferId))
      .for("update")
      .limit(1);
    if (!transfer) {
      throw new InventoryTransferNotFoundError("Transfer stok tidak ditemukan.");
    }
    if (transfer.status !== "in_transit") {
      throw new InventoryOperationStatusError(
        "Hanya transfer dalam perjalanan yang dapat diterima.",
      );
    }
    const warehouseIds = [transfer.sourceWarehouseId, transfer.destinationWarehouseId].sort();
    const locked = new Map<string, Awaited<ReturnType<typeof lockWarehouse>>>();
    for (const warehouseId of warehouseIds) {
      locked.set(warehouseId, await lockWarehouse(tx, warehouseId));
    }
    const batchLines = await tx
      .select({
        id: inventoryTransferBatchLines.id,
        transferLineId: inventoryTransferBatchLines.transferLineId,
        destinationBatchId: inventoryTransferBatchLines.destinationBatchId,
        shippedQuantity: inventoryTransferBatchLines.shippedQuantity,
      })
      .from(inventoryTransferBatchLines)
      .innerJoin(
        inventoryTransferLines,
        eq(inventoryTransferBatchLines.transferLineId, inventoryTransferLines.id),
      )
      .where(eq(inventoryTransferLines.transferId, transfer.id))
      .orderBy(asc(inventoryTransferBatchLines.id));
    if (!batchLines.length) {
      throw new InventoryOperationStatusError("Transfer tidak memiliki batch yang dikirim.");
    }
    const receivedById = new Map(input.lines.map((line) => [line.transferBatchLineId, line]));
    if (
      receivedById.size !== batchLines.length ||
      batchLines.some(({ id }) => !receivedById.has(id))
    ) {
      throw new InventoryTransferDiscrepancyError(
        "Hitung jumlah penerimaan untuk setiap batch yang dikirim.",
      );
    }
    const discrepancy = batchLines.some(({ id, shippedQuantity }) => {
      const received = receivedById.get(id);
      return (
        received !== undefined &&
        parseQuantity(received.receivedQuantity) !== parseQuantity(shippedQuantity)
      );
    });
    if (discrepancy && !input.discrepancyReason) {
      throw new InventoryTransferDiscrepancyError("Selisih penerimaan harus disertai alasan.");
    }
    const movementQuantities = new Map<string, { quantityMilli: bigint; batchId: string }>();
    for (const batchLine of batchLines) {
      const received = receivedById.get(batchLine.id);
      if (!received) {
        throw new InventoryTransferDiscrepancyError("Data penerimaan batch tidak lengkap.");
      }
      const receivedMilli = parseQuantity(received.receivedQuantity);
      const shippedMilli = parseQuantity(batchLine.shippedQuantity);
      if (receivedMilli > shippedMilli) {
        throw new InventoryTransferDiscrepancyError(
          "Jumlah diterima tidak boleh melebihi jumlah yang dikirim.",
        );
      }
      await tx
        .update(inventoryTransferBatchLines)
        .set({ receivedQuantity: formatQuantity(receivedMilli) })
        .where(eq(inventoryTransferBatchLines.id, batchLine.id));
      const current = movementQuantities.get(batchLine.destinationBatchId);
      movementQuantities.set(batchLine.destinationBatchId, {
        batchId: batchLine.destinationBatchId,
        quantityMilli: (current?.quantityMilli ?? 0n) + receivedMilli,
      });
    }
    for (const movement of movementQuantities.values()) {
      if (movement.quantityMilli === 0n) {
        continue;
      }
      const [batch] = await tx
        .select({
          productId: inventoryBatches.productId,
          variantId: inventoryBatches.variantId,
          unitCostCents: inventoryBatches.unitCostCents,
        })
        .from(inventoryBatches)
        .where(eq(inventoryBatches.id, movement.batchId))
        .limit(1);
      if (!batch) {
        throw new InventoryProductInvalidError("Batch gudang tujuan tidak ditemukan.");
      }
      await appendInventoryMovement(tx, {
        warehouseId: transfer.destinationWarehouseId,
        batchId: movement.batchId,
        productId: batch.productId,
        variantId: batch.variantId,
        movementType: "transfer_in",
        quantityDelta: formatQuantity(movement.quantityMilli),
        unitCostCents: batch.unitCostCents,
        sourceType: "inventory_transfer",
        sourceId: transfer.id,
        reason: input.discrepancyReason ?? null,
        actorUserId,
      });
    }
    await tx
      .update(inventoryTransfers)
      .set({ status: "received", receivedBy: actorUserId, receivedAt: new Date() })
      .where(eq(inventoryTransfers.id, transfer.id));
    await tx.insert(auditEvents).values({
      actorUserId,
      action: "inventory.transfer_received",
      targetType: "inventory_transfer",
      targetId: transfer.id,
      metadata: {
        destinationBranchId: locked.get(transfer.destinationWarehouseId)?.branchId ?? "",
        lineCount: String(batchLines.length),
        discrepancy: discrepancy ? "true" : "false",
      },
    });
    return transfer.id;
  });
}

export async function createStocktake(input: StocktakeInput, actorUserId: string) {
  return getDatabase().transaction(async (tx) => {
    const warehouse = await lockWarehouse(tx, input.warehouseId);
    const batchIds = [...new Set(input.lines.map(({ batchId }) => batchId))];
    if (batchIds.length !== input.lines.length) {
      throw new InventoryOperationStatusError("Batch yang sama tidak boleh diulang dalam opname.");
    }
    const expectedRows = await tx
      .select({
        id: inventoryBatches.id,
        quantity: sql<string>`COALESCE(SUM(${inventoryMovements.quantityDelta}), 0)::text`,
      })
      .from(inventoryBatches)
      .leftJoin(inventoryMovements, eq(inventoryMovements.batchId, inventoryBatches.id))
      .where(
        and(eq(inventoryBatches.warehouseId, warehouse.id), inArray(inventoryBatches.id, batchIds)),
      )
      .groupBy(inventoryBatches.id);
    if (expectedRows.length !== batchIds.length) {
      throw new InventoryProductInvalidError(
        "Satu atau beberapa batch tidak berada di gudang ini.",
      );
    }
    const expectedById = new Map(expectedRows.map(({ id, quantity }) => [id, quantity]));
    const [stocktake] = await tx
      .insert(stocktakes)
      .values({
        warehouseId: warehouse.id,
        reason: input.reason,
        createdBy: actorUserId,
      })
      .returning({ id: stocktakes.id });
    if (!stocktake) {
      throw new Error("Sesi opname gagal dibuat.");
    }
    await tx.insert(stocktakeLines).values(
      input.lines.map((line) => ({
        stocktakeId: stocktake.id,
        batchId: line.batchId,
        expectedQuantity: expectedById.get(line.batchId) ?? "0",
        countedQuantity: line.countedQuantity,
      })),
    );
    await tx.insert(auditEvents).values({
      actorUserId,
      action: "inventory.stocktake_created",
      targetType: "stocktake",
      targetId: stocktake.id,
      metadata: { branchId: warehouse.branchId, lineCount: String(input.lines.length) },
    });
    return stocktake.id;
  });
}

export async function submitStocktake(stocktakeId: string, actorUserId: string) {
  return getDatabase().transaction(async (tx) => {
    const [stocktake] = await tx
      .select({ id: stocktakes.id, status: stocktakes.status })
      .from(stocktakes)
      .where(eq(stocktakes.id, stocktakeId))
      .for("update")
      .limit(1);
    if (stocktake?.status !== "draft") {
      throw new InventoryOperationStatusError("Hanya opname draft yang dapat diajukan.");
    }
    await tx
      .update(stocktakes)
      .set({ status: "pending_approval" })
      .where(eq(stocktakes.id, stocktake.id));
    await tx.insert(auditEvents).values({
      actorUserId,
      action: "inventory.stocktake_submitted",
      targetType: "stocktake",
      targetId: stocktake.id,
    });
    return stocktake.id;
  });
}

export async function reviewStocktake(
  stocktakeId: string,
  actorUserId: string,
  decision: "approved" | "rejected",
) {
  return getDatabase().transaction(async (tx) => {
    const [stocktake] = await tx
      .select({
        id: stocktakes.id,
        warehouseId: stocktakes.warehouseId,
        status: stocktakes.status,
        reason: stocktakes.reason,
        createdBy: stocktakes.createdBy,
      })
      .from(stocktakes)
      .where(eq(stocktakes.id, stocktakeId))
      .for("update")
      .limit(1);
    if (!stocktake) {
      throw new StocktakeNotFoundError("Sesi opname tidak ditemukan.");
    }
    if (stocktake.status !== "pending_approval" || stocktake.createdBy === actorUserId) {
      throw new InventoryOperationStatusError(
        "Opname menunggu persetujuan staf lain dan tidak dapat ditinjau ulang.",
      );
    }
    const warehouse = await lockWarehouse(tx, stocktake.warehouseId);
    if (decision === "rejected") {
      await tx
        .update(stocktakes)
        .set({ status: "rejected", reviewedBy: actorUserId, reviewedAt: new Date() })
        .where(eq(stocktakes.id, stocktake.id));
    } else {
      const lines = await tx
        .select({
          id: stocktakeLines.id,
          batchId: stocktakeLines.batchId,
          expectedQuantity: stocktakeLines.expectedQuantity,
          countedQuantity: stocktakeLines.countedQuantity,
          productId: inventoryBatches.productId,
          variantId: inventoryBatches.variantId,
          unitCostCents: inventoryBatches.unitCostCents,
          currentQuantity: sql<string>`COALESCE(SUM(${inventoryMovements.quantityDelta}), 0)::text`,
        })
        .from(stocktakeLines)
        .innerJoin(inventoryBatches, eq(stocktakeLines.batchId, inventoryBatches.id))
        .leftJoin(inventoryMovements, eq(inventoryMovements.batchId, inventoryBatches.id))
        .where(eq(stocktakeLines.stocktakeId, stocktake.id))
        .groupBy(stocktakeLines.id, inventoryBatches.id);
      if (
        lines.some(
          ({ currentQuantity, expectedQuantity }) =>
            parseQuantity(currentQuantity) !== parseQuantity(expectedQuantity),
        )
      ) {
        throw new StocktakeStaleError(
          "Stok berubah setelah hitung. Buat sesi opname baru sebelum menyetujui.",
        );
      }
      for (const line of lines) {
        const difference =
          parseQuantity(line.countedQuantity) - parseQuantity(line.expectedQuantity);
        if (difference === 0n) {
          continue;
        }
        await appendInventoryMovement(tx, {
          warehouseId: warehouse.id,
          batchId: line.batchId,
          productId: line.productId,
          variantId: line.variantId,
          movementType: difference > 0n ? "adjustment_in" : "adjustment_out",
          quantityDelta: formatQuantity(difference),
          unitCostCents: line.unitCostCents,
          sourceType: "stocktake",
          sourceId: stocktake.id,
          reason: stocktake.reason,
          actorUserId,
        });
      }
      await tx
        .update(stocktakes)
        .set({ status: "approved", reviewedBy: actorUserId, reviewedAt: new Date() })
        .where(eq(stocktakes.id, stocktake.id));
    }
    await tx.insert(auditEvents).values({
      actorUserId,
      action: `inventory.stocktake_${decision}`,
      targetType: "stocktake",
      targetId: stocktake.id,
      metadata: { branchId: warehouse.branchId, createdBy: stocktake.createdBy },
    });
    return stocktake.id;
  });
}

export async function getTransferWarehouses(transferId: string) {
  const [transfer] = await getDatabase()
    .select({
      id: inventoryTransfers.id,
      sourceWarehouseId: inventoryTransfers.sourceWarehouseId,
      sourceBranchId: sql<string>`source_warehouse.branch_id`,
      destinationWarehouseId: inventoryTransfers.destinationWarehouseId,
      destinationBranchId: sql<string>`destination_warehouse.branch_id`,
      status: inventoryTransfers.status,
    })
    .from(inventoryTransfers)
    .innerJoin(
      sql`warehouses AS source_warehouse`,
      sql`source_warehouse.id = ${inventoryTransfers.sourceWarehouseId}`,
    )
    .innerJoin(
      sql`warehouses AS destination_warehouse`,
      sql`destination_warehouse.id = ${inventoryTransfers.destinationWarehouseId}`,
    )
    .where(eq(inventoryTransfers.id, transferId))
    .limit(1);
  return transfer ?? null;
}

export async function listInventoryTransfers(branchId: string) {
  const [sourceRows, destinationRows] = await Promise.all([
    getDatabase()
      .select({ id: inventoryTransfers.id })
      .from(inventoryTransfers)
      .innerJoin(warehouses, eq(inventoryTransfers.sourceWarehouseId, warehouses.id))
      .where(eq(warehouses.branchId, branchId)),
    getDatabase()
      .select({ id: inventoryTransfers.id })
      .from(inventoryTransfers)
      .innerJoin(warehouses, eq(inventoryTransfers.destinationWarehouseId, warehouses.id))
      .where(eq(warehouses.branchId, branchId)),
  ]);
  const transferIds = [...new Set([...sourceRows, ...destinationRows].map(({ id }) => id))];
  if (!transferIds.length) {
    return [];
  }
  const transfers = await getDatabase()
    .select({
      id: inventoryTransfers.id,
      transferNumber: inventoryTransfers.transferNumber,
      sourceWarehouseId: inventoryTransfers.sourceWarehouseId,
      destinationWarehouseId: inventoryTransfers.destinationWarehouseId,
      status: inventoryTransfers.status,
      reason: inventoryTransfers.reason,
      createdAt: inventoryTransfers.createdAt,
      shippedAt: inventoryTransfers.shippedAt,
      receivedAt: inventoryTransfers.receivedAt,
    })
    .from(inventoryTransfers)
    .where(inArray(inventoryTransfers.id, transferIds))
    .orderBy(sql`${inventoryTransfers.createdAt} DESC`)
    .limit(200);
  const lines = await getDatabase()
    .select({
      transferId: inventoryTransferLines.transferId,
      productId: inventoryTransferLines.productId,
      productName: products.name,
      sku: products.sku,
      variantName: productVariants.name,
      quantity: inventoryTransferLines.quantity,
    })
    .from(inventoryTransferLines)
    .innerJoin(products, eq(inventoryTransferLines.productId, products.id))
    .leftJoin(productVariants, eq(inventoryTransferLines.variantId, productVariants.id))
    .where(inArray(inventoryTransferLines.transferId, transferIds));
  const batchLines = await getDatabase()
    .select({
      transferId: inventoryTransferLines.transferId,
      id: inventoryTransferBatchLines.id,
      productName: products.name,
      sku: products.sku,
      shippedQuantity: inventoryTransferBatchLines.shippedQuantity,
      receivedQuantity: inventoryTransferBatchLines.receivedQuantity,
    })
    .from(inventoryTransferBatchLines)
    .innerJoin(
      inventoryTransferLines,
      eq(inventoryTransferBatchLines.transferLineId, inventoryTransferLines.id),
    )
    .innerJoin(products, eq(inventoryTransferLines.productId, products.id))
    .where(inArray(inventoryTransferLines.transferId, transferIds));
  return transfers.map((transfer) => ({
    ...transfer,
    lines: lines
      .filter(({ transferId }) => transferId === transfer.id)
      .map(({ transferId: _transferId, ...line }) => line),
    batchLines: batchLines
      .filter(({ transferId }) => transferId === transfer.id)
      .map(({ transferId: _transferId, ...line }) => line),
  }));
}

export async function getStocktakeWarehouse(stocktakeId: string) {
  const [stocktake] = await getDatabase()
    .select({
      id: stocktakes.id,
      warehouseId: stocktakes.warehouseId,
      branchId: warehouses.branchId,
      status: stocktakes.status,
    })
    .from(stocktakes)
    .innerJoin(warehouses, eq(stocktakes.warehouseId, warehouses.id))
    .where(eq(stocktakes.id, stocktakeId))
    .limit(1);
  return stocktake ?? null;
}

export async function listStocktakes(warehouseId: string) {
  const rows = await getDatabase()
    .select({
      id: stocktakes.id,
      status: stocktakes.status,
      reason: stocktakes.reason,
      createdBy: stocktakes.createdBy,
      createdAt: stocktakes.createdAt,
      reviewedBy: stocktakes.reviewedBy,
      reviewedAt: stocktakes.reviewedAt,
      lineCount: sql<number>`count(${stocktakeLines.id})::int`,
    })
    .from(stocktakes)
    .leftJoin(stocktakeLines, eq(stocktakes.id, stocktakeLines.stocktakeId))
    .where(eq(stocktakes.warehouseId, warehouseId))
    .groupBy(stocktakes.id)
    .orderBy(sql`${stocktakes.createdAt} DESC`)
    .limit(100);
  return rows;
}
