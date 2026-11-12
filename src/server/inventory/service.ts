import type { ExtractTablesWithRelations } from "drizzle-orm";
import { and, asc, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";
import type { NodePgTransaction } from "drizzle-orm/node-postgres";
import { getDatabase } from "@/db";
import type * as schema from "@/db/schema";
import {
  auditEvents,
  branches,
  businessSettings,
  inventoryAdjustments,
  inventoryBatches,
  inventoryMovements,
  inventoryReorderLevels,
  products,
  productVariants,
  warehouses,
} from "@/db/schema";
import { verifySupervisorPin } from "@/server/supervisor/pin";
import { centsForQuantity, formatQuantity, parseQuantity, weightedAverageCost } from "./quantity";
import type { InventoryAdjustmentInput, WarehouseInput } from "./validation";

export type InventoryTransaction = NodePgTransaction<
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

interface AvailableBatch {
  id: string;
  warehouseId: string;
  productId: string;
  variantId: string | null;
  batchNumber: string;
  expiresOn: string | null;
  unitCostCents: number;
  quantity: string;
}

export class WarehouseNotFoundError extends Error {}
export class InventoryProductInvalidError extends Error {}
export class InventoryInsufficientStockError extends Error {}
export class InventoryBatchConflictError extends Error {}
export class InventoryApprovalRequiredError extends Error {}

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

export async function lockWarehouse(tx: InventoryTransaction, warehouseId: string) {
  const [warehouse] = await tx
    .select({
      id: warehouses.id,
      branchId: warehouses.branchId,
      isActive: warehouses.isActive,
      timezone: branches.timezone,
    })
    .from(warehouses)
    .innerJoin(branches, eq(warehouses.branchId, branches.id))
    .where(eq(warehouses.id, warehouseId))
    .for("update")
    .limit(1);
  if (!warehouse?.isActive) {
    throw new WarehouseNotFoundError("Gudang tidak ditemukan atau tidak aktif.");
  }
  return warehouse;
}

export async function validateProductVariant(
  tx: InventoryTransaction,
  productId: string,
  variantId: string | null | undefined,
) {
  const [product] = await tx
    .select({ id: products.id, isActive: products.isActive })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!product?.isActive) {
    throw new InventoryProductInvalidError("Produk tidak ditemukan atau tidak aktif.");
  }
  if (variantId) {
    const [variant] = await tx
      .select({ id: productVariants.id })
      .from(productVariants)
      .where(
        and(
          eq(productVariants.id, variantId),
          eq(productVariants.productId, productId),
          eq(productVariants.isActive, true),
        ),
      )
      .limit(1);
    if (!variant) {
      throw new InventoryProductInvalidError("Varian tidak ditemukan atau tidak aktif.");
    }
  }
}

function dateAtTimezone(timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: "year" | "month" | "day") => parts.find((item) => item.type === type)?.value;
  const year = part("year");
  const month = part("month");
  const day = part("day");
  if (!year || !month || !day) {
    throw new Error("Tanggal bisnis cabang tidak dapat dihitung.");
  }
  return `${year}-${month}-${day}`;
}

function minimumQuantity(left: bigint, right: bigint): bigint {
  return left < right ? left : right;
}

async function availableBatches(
  tx: InventoryTransaction,
  warehouseId: string,
  productId: string,
  variantId: string | null,
  timezone: string,
  includeExpired = false,
): Promise<AvailableBatch[]> {
  const today = dateAtTimezone(timezone);
  const rows = await tx
    .select({
      id: inventoryBatches.id,
      warehouseId: inventoryBatches.warehouseId,
      productId: inventoryBatches.productId,
      variantId: inventoryBatches.variantId,
      batchNumber: inventoryBatches.batchNumber,
      expiresOn: inventoryBatches.expiresOn,
      unitCostCents: inventoryBatches.unitCostCents,
      quantity: sql<string>`COALESCE(SUM(${inventoryMovements.quantityDelta}), 0)::text`,
    })
    .from(inventoryBatches)
    .leftJoin(inventoryMovements, eq(inventoryMovements.batchId, inventoryBatches.id))
    .where(
      and(
        eq(inventoryBatches.warehouseId, warehouseId),
        eq(inventoryBatches.productId, productId),
        variantId ? eq(inventoryBatches.variantId, variantId) : isNull(inventoryBatches.variantId),
        includeExpired
          ? undefined
          : or(isNull(inventoryBatches.expiresOn), gte(inventoryBatches.expiresOn, today)),
      ),
    )
    .groupBy(inventoryBatches.id)
    .having(sql`COALESCE(SUM(${inventoryMovements.quantityDelta}), 0) > 0`)
    .orderBy(
      sql`CASE WHEN ${inventoryBatches.expiresOn} IS NULL THEN 1 ELSE 0 END`,
      asc(inventoryBatches.expiresOn),
      asc(inventoryBatches.createdAt),
      asc(inventoryBatches.id),
    );
  return rows;
}

export async function appendInventoryMovement(
  tx: InventoryTransaction,
  input: {
    warehouseId: string;
    batchId: string;
    productId: string;
    variantId: string | null;
    movementType: typeof inventoryMovements.$inferInsert.movementType;
    quantityDelta: string;
    unitCostCents: number;
    sourceType: string;
    sourceId: string;
    reason?: string | null;
    actorUserId: string;
  },
) {
  await tx.insert(inventoryMovements).values({
    ...input,
    reason: input.reason ?? null,
  });
}

export async function consumeFromBatches(
  tx: InventoryTransaction,
  input: {
    warehouseId: string;
    productId: string;
    variantId: string | null;
    timezone: string;
    quantityMilli: bigint;
    sourceType: string;
    sourceId: string;
    actorUserId: string;
    reason?: string;
    movementType?: "adjustment_out" | "transfer_out" | "bundle_component_out";
  },
) {
  const batches = await availableBatches(
    tx,
    input.warehouseId,
    input.productId,
    input.variantId,
    input.timezone,
  );
  const totalAvailable = batches.reduce(
    (total, batch) => total + parseQuantity(batch.quantity),
    0n,
  );
  if (totalAvailable < input.quantityMilli) {
    throw new InventoryInsufficientStockError("Stok yang dapat digunakan tidak mencukupi.");
  }

  const [settings] = await tx
    .select({ inventoryCostMethod: businessSettings.inventoryCostMethod })
    .from(businessSettings)
    .where(eq(businessSettings.id, 1))
    .limit(1);
  if (!settings) {
    throw new Error("Pengaturan metode HPP tidak ditemukan.");
  }

  const costMethod = settings.inventoryCostMethod;
  const averageCost =
    costMethod === "average"
      ? weightedAverageCost(
          batches.map(({ quantity }) => parseQuantity(quantity)),
          batches.map(({ unitCostCents }) => unitCostCents),
        )
      : null;
  let remaining = input.quantityMilli;
  let totalCostCents = 0;
  const allocations: Array<{ batchId: string; quantity: string; unitCostCents: number }> = [];

  for (const batch of batches) {
    if (remaining === 0n) {
      break;
    }
    const batchQuantity = parseQuantity(batch.quantity);
    const consumed = minimumQuantity(batchQuantity, remaining);
    const unitCostCents = averageCost ?? batch.unitCostCents;
    await appendInventoryMovement(tx, {
      warehouseId: input.warehouseId,
      batchId: batch.id,
      productId: input.productId,
      variantId: input.variantId,
      movementType: input.movementType ?? "adjustment_out",
      quantityDelta: `-${formatQuantity(consumed)}`,
      unitCostCents,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      reason: input.reason,
      actorUserId: input.actorUserId,
    });
    remaining -= consumed;
    totalCostCents += centsForQuantity(consumed, unitCostCents);
    allocations.push({
      batchId: batch.id,
      quantity: formatQuantity(consumed),
      unitCostCents,
    });
  }

  return { totalCostCents, allocations };
}

export async function listWarehouses(branchId: string) {
  return getDatabase()
    .select({
      id: warehouses.id,
      branchId: warehouses.branchId,
      branchName: branches.name,
      code: warehouses.code,
      name: warehouses.name,
      isActive: warehouses.isActive,
    })
    .from(warehouses)
    .innerJoin(branches, eq(warehouses.branchId, branches.id))
    .where(and(eq(warehouses.branchId, branchId), eq(warehouses.isActive, true)))
    .orderBy(asc(warehouses.name));
}

export async function createWarehouse(input: WarehouseInput, actorUserId: string) {
  try {
    return await getDatabase().transaction(async (tx) => {
      const [branch] = await tx
        .select({ id: branches.id })
        .from(branches)
        .where(and(eq(branches.id, input.branchId), eq(branches.isActive, true)))
        .limit(1);
      if (!branch) {
        throw new WarehouseNotFoundError("Cabang tidak ditemukan atau tidak aktif.");
      }
      const [warehouse] = await tx
        .insert(warehouses)
        .values({
          branchId: input.branchId,
          code: input.code,
          name: input.name,
          createdBy: actorUserId,
        })
        .returning({
          id: warehouses.id,
          branchId: warehouses.branchId,
          code: warehouses.code,
          name: warehouses.name,
        });
      if (!warehouse) {
        throw new Error("Gudang gagal dibuat.");
      }
      await tx.insert(auditEvents).values({
        actorUserId,
        action: "inventory.warehouse_created",
        targetType: "warehouse",
        targetId: warehouse.id,
        metadata: { branchId: input.branchId },
      });
      return warehouse;
    });
  } catch (error) {
    if (isConstraint(error, "warehouses_branch_code_lower_unique")) {
      throw new InventoryBatchConflictError("Kode gudang sudah digunakan pada cabang ini.");
    }
    throw error;
  }
}

export async function listInventoryBalances(
  warehouseId: string,
  includeCosts: boolean,
  actorUserId: string,
) {
  const rows = await getDatabase()
    .select({
      batchId: inventoryBatches.id,
      productId: inventoryBatches.productId,
      supplierId: inventoryBatches.supplierId,
      productName: products.name,
      sku: products.sku,
      variantId: inventoryBatches.variantId,
      batchNumber: inventoryBatches.batchNumber,
      expiresOn: inventoryBatches.expiresOn,
      unitCostCents: inventoryBatches.unitCostCents,
      quantity: sql<string>`COALESCE(SUM(${inventoryMovements.quantityDelta}), 0)::text`,
    })
    .from(inventoryBatches)
    .innerJoin(products, eq(inventoryBatches.productId, products.id))
    .leftJoin(inventoryMovements, eq(inventoryMovements.batchId, inventoryBatches.id))
    .where(eq(inventoryBatches.warehouseId, warehouseId))
    .groupBy(inventoryBatches.id, products.id)
    .having(sql`COALESCE(SUM(${inventoryMovements.quantityDelta}), 0) <> 0`)
    .orderBy(asc(products.name), asc(inventoryBatches.expiresOn), asc(inventoryBatches.batchNumber))
    .limit(5000);
  let averageCosts = new Map<string, number>();
  if (includeCosts) {
    const [settings] = await getDatabase()
      .select({ inventoryCostMethod: businessSettings.inventoryCostMethod })
      .from(businessSettings)
      .where(eq(businessSettings.id, 1))
      .limit(1);
    if (!settings) {
      throw new Error("Pengaturan metode HPP tidak ditemukan.");
    }
    if (settings.inventoryCostMethod === "average") {
      const grouped = new Map<string, Array<{ quantity: bigint; cost: number }>>();
      for (const row of rows) {
        const key = `${row.productId}:${row.variantId ?? ""}`;
        grouped.set(key, [
          ...(grouped.get(key) ?? []),
          { quantity: parseQuantity(row.quantity), cost: row.unitCostCents },
        ]);
      }
      averageCosts = new Map(
        [...grouped].map(([key, batches]) => [
          key,
          weightedAverageCost(
            batches.map(({ quantity }) => quantity),
            batches.map(({ cost }) => cost),
          ),
        ]),
      );
    }
  }
  const result = rows.map(({ unitCostCents, ...row }) => {
    const unitCost = averageCosts.get(`${row.productId}:${row.variantId ?? ""}`) ?? unitCostCents;
    return {
      ...row,
      ...(includeCosts
        ? {
            unitCostCents: unitCost,
            inventoryValueCents: centsForQuantity(parseQuantity(row.quantity), unitCost),
          }
        : {}),
    };
  });
  await getDatabase()
    .insert(auditEvents)
    .values({
      actorUserId,
      action: includeCosts ? "inventory.cost_listed" : "inventory.listed",
      targetType: "inventory_collection",
      metadata: {
        warehouseId,
        batchCount: String(result.length),
        costIncluded: includeCosts ? "true" : "false",
      },
    });
  return result;
}

export async function listInventoryCard(
  warehouseId: string,
  productId: string,
  includeCosts: boolean,
  actorUserId: string,
) {
  const rows = await getDatabase()
    .select({
      id: inventoryMovements.id,
      batchId: inventoryMovements.batchId,
      batchNumber: inventoryBatches.batchNumber,
      movementType: inventoryMovements.movementType,
      quantityDelta: inventoryMovements.quantityDelta,
      unitCostCents: inventoryMovements.unitCostCents,
      sourceType: inventoryMovements.sourceType,
      sourceId: inventoryMovements.sourceId,
      reason: inventoryMovements.reason,
      actorUserId: inventoryMovements.actorUserId,
      createdAt: inventoryMovements.createdAt,
    })
    .from(inventoryMovements)
    .innerJoin(inventoryBatches, eq(inventoryMovements.batchId, inventoryBatches.id))
    .where(
      and(
        eq(inventoryMovements.warehouseId, warehouseId),
        eq(inventoryMovements.productId, productId),
      ),
    )
    .orderBy(sql`${inventoryMovements.createdAt} DESC`, sql`${inventoryMovements.id} DESC`)
    .limit(500);
  const result = rows.map(({ unitCostCents, ...row }) => ({
    ...row,
    ...(includeCosts ? { unitCostCents } : {}),
  }));
  await getDatabase()
    .insert(auditEvents)
    .values({
      actorUserId,
      action: includeCosts ? "inventory.cost_card_listed" : "inventory.card_listed",
      targetType: "inventory_product",
      targetId: productId,
      metadata: { warehouseId, movementCount: String(result.length) },
    });
  return result;
}

export async function listInventoryReorderLevels(warehouseId: string) {
  return getDatabase()
    .select({
      id: inventoryReorderLevels.id,
      productId: inventoryReorderLevels.productId,
      productName: products.name,
      sku: products.sku,
      variantId: inventoryReorderLevels.variantId,
      variantName: productVariants.name,
      minimumQuantity: inventoryReorderLevels.minimumQuantity,
      reorderQuantity: inventoryReorderLevels.reorderQuantity,
    })
    .from(inventoryReorderLevels)
    .innerJoin(products, eq(inventoryReorderLevels.productId, products.id))
    .leftJoin(productVariants, eq(inventoryReorderLevels.variantId, productVariants.id))
    .where(eq(inventoryReorderLevels.warehouseId, warehouseId))
    .orderBy(asc(products.name), asc(productVariants.name));
}

export async function listInventoryReorderSuggestions(warehouseId: string) {
  const rows = await getDatabase()
    .select({
      productId: inventoryReorderLevels.productId,
      productName: products.name,
      sku: products.sku,
      variantId: inventoryReorderLevels.variantId,
      variantName: productVariants.name,
      minimumQuantity: inventoryReorderLevels.minimumQuantity,
      reorderQuantity: inventoryReorderLevels.reorderQuantity,
      currentQuantity: sql<string>`COALESCE(SUM(${inventoryMovements.quantityDelta}), 0)::text`,
    })
    .from(inventoryReorderLevels)
    .innerJoin(products, eq(inventoryReorderLevels.productId, products.id))
    .leftJoin(productVariants, eq(inventoryReorderLevels.variantId, productVariants.id))
    .leftJoin(
      inventoryBatches,
      and(
        eq(inventoryBatches.warehouseId, inventoryReorderLevels.warehouseId),
        eq(inventoryBatches.productId, inventoryReorderLevels.productId),
        sql`${inventoryBatches.variantId} IS NOT DISTINCT FROM ${inventoryReorderLevels.variantId}`,
      ),
    )
    .leftJoin(inventoryMovements, eq(inventoryMovements.batchId, inventoryBatches.id))
    .where(eq(inventoryReorderLevels.warehouseId, warehouseId))
    .groupBy(inventoryReorderLevels.id, products.id, productVariants.id)
    .having(
      sql`COALESCE(SUM(${inventoryMovements.quantityDelta}), 0) < ${inventoryReorderLevels.minimumQuantity}`,
    )
    .orderBy(asc(products.name), asc(productVariants.name));
  return rows;
}

export async function replaceInventoryReorderLevels(
  warehouseId: string,
  lines: Array<{
    productId: string;
    variantId?: string | null;
    minimumQuantity: string;
    reorderQuantity: string;
  }>,
  actorUserId: string,
) {
  return getDatabase().transaction(async (tx) => {
    const warehouse = await lockWarehouse(tx, warehouseId);
    const keys = new Set<string>();
    for (const line of lines) {
      const key = `${line.productId}:${line.variantId ?? ""}`;
      if (keys.has(key)) {
        throw new InventoryProductInvalidError(
          "Produk atau varian ambang stok tidak boleh berulang.",
        );
      }
      keys.add(key);
      if (parseQuantity(line.minimumQuantity) <= 0n || parseQuantity(line.reorderQuantity) <= 0n) {
        throw new InventoryProductInvalidError("Ambang dan jumlah pemesanan ulang harus positif.");
      }
      await validateProductVariant(tx, line.productId, line.variantId);
    }
    await tx
      .delete(inventoryReorderLevels)
      .where(eq(inventoryReorderLevels.warehouseId, warehouse.id));
    if (lines.length) {
      await tx.insert(inventoryReorderLevels).values(
        lines.map((line) => ({
          warehouseId: warehouse.id,
          productId: line.productId,
          variantId: line.variantId ?? null,
          minimumQuantity: line.minimumQuantity,
          reorderQuantity: line.reorderQuantity,
          updatedBy: actorUserId,
        })),
      );
    }
    await tx.insert(auditEvents).values({
      actorUserId,
      action: "inventory.reorder_levels_updated",
      targetType: "inventory_reorder_levels",
      metadata: { branchId: warehouse.branchId, lineCount: String(lines.length) },
    });
    return lines.length;
  });
}

export async function createInventoryAdjustment(
  input: InventoryAdjustmentInput,
  actorUserId: string,
  policy: { maxTransferCents: number | null; requiresSupervisorPin: boolean },
) {
  return getDatabase().transaction(async (tx) => {
    const warehouse = await lockWarehouse(tx, input.warehouseId);
    await validateProductVariant(tx, input.productId, input.variantId);
    const quantityMilli = parseQuantity(input.quantity);
    const adjustment = await tx
      .insert(inventoryAdjustments)
      .values({
        warehouseId: warehouse.id,
        reason: input.reason,
        createdBy: actorUserId,
      })
      .returning({ id: inventoryAdjustments.id });
    const adjustmentId = adjustment[0]?.id;
    if (!adjustmentId) {
      throw new Error("Penyesuaian stok gagal dibuat.");
    }

    let valueCents = 0;
    if (input.direction === "in") {
      if (!input.batchNumber || input.unitCostCents === undefined) {
        throw new InventoryProductInvalidError(
          "Stok masuk harus memiliki nomor batch dan biaya per unit.",
        );
      }
      const [existingBatch] = await tx
        .select({
          id: inventoryBatches.id,
          unitCostCents: inventoryBatches.unitCostCents,
        })
        .from(inventoryBatches)
        .where(
          and(
            eq(inventoryBatches.warehouseId, warehouse.id),
            eq(inventoryBatches.productId, input.productId),
            input.variantId
              ? eq(inventoryBatches.variantId, input.variantId)
              : isNull(inventoryBatches.variantId),
            eq(inventoryBatches.batchNumber, input.batchNumber),
          ),
        )
        .limit(1);
      if (existingBatch && existingBatch.unitCostCents !== input.unitCostCents) {
        throw new InventoryBatchConflictError(
          "Batch yang sama tidak dapat dicatat dengan biaya berbeda.",
        );
      }
      const [batch] = existingBatch
        ? [existingBatch]
        : await tx
            .insert(inventoryBatches)
            .values({
              warehouseId: warehouse.id,
              productId: input.productId,
              variantId: input.variantId ?? null,
              batchNumber: input.batchNumber,
              expiresOn: input.expiresOn ?? null,
              unitCostCents: input.unitCostCents,
            })
            .returning({
              id: inventoryBatches.id,
              unitCostCents: inventoryBatches.unitCostCents,
            });
      if (!batch) {
        throw new Error("Batch stok gagal disimpan.");
      }
      if (existingBatch) {
        const [storedBatch] = await tx
          .select({ expiresOn: inventoryBatches.expiresOn })
          .from(inventoryBatches)
          .where(eq(inventoryBatches.id, batch.id))
          .limit(1);
        if (storedBatch?.expiresOn !== (input.expiresOn ?? null)) {
          throw new InventoryBatchConflictError(
            "Tanggal kedaluwarsa batch yang sama tidak boleh berubah.",
          );
        }
      }
      valueCents = centsForQuantity(quantityMilli, batch.unitCostCents);
      await appendInventoryMovement(tx, {
        warehouseId: warehouse.id,
        batchId: batch.id,
        productId: input.productId,
        variantId: input.variantId ?? null,
        movementType: "adjustment_in",
        quantityDelta: formatQuantity(quantityMilli),
        unitCostCents: batch.unitCostCents,
        sourceType: "inventory_adjustment",
        sourceId: adjustmentId,
        reason: input.reason,
        actorUserId,
      });
    } else {
      const result = await consumeFromBatches(tx, {
        warehouseId: warehouse.id,
        productId: input.productId,
        variantId: input.variantId ?? null,
        timezone: warehouse.timezone,
        quantityMilli,
        sourceType: "inventory_adjustment",
        sourceId: adjustmentId,
        actorUserId,
        reason: input.reason,
        movementType: "adjustment_out",
      });
      valueCents = result.totalCostCents;
    }

    const needsSupervisorPin =
      policy.requiresSupervisorPin ||
      (policy.maxTransferCents !== null && valueCents > policy.maxTransferCents);
    if (needsSupervisorPin && !input.supervisorPin) {
      throw new InventoryApprovalRequiredError(
        "Penyesuaian ini memerlukan persetujuan PIN supervisor.",
      );
    }
    if (needsSupervisorPin) {
      await verifySupervisorPin(actorUserId, input.supervisorPin ?? "");
    }

    await tx.insert(auditEvents).values({
      actorUserId,
      action: "inventory.adjusted",
      targetType: "inventory_adjustment",
      targetId: adjustmentId,
      metadata: {
        branchId: warehouse.branchId,
        direction: input.direction,
        lineCount: "1",
        supervisorApproval: needsSupervisorPin ? "true" : "false",
      },
    });
    return adjustmentId;
  });
}

export async function consumeInventory(input: {
  warehouseId: string;
  productId: string;
  variantId?: string | null;
  quantity: string;
  sourceType: string;
  sourceId: string;
  actorUserId: string;
  reason?: string;
}) {
  return getDatabase().transaction(async (tx) => {
    const warehouse = await lockWarehouse(tx, input.warehouseId);
    await validateProductVariant(tx, input.productId, input.variantId);
    const result = await consumeFromBatches(tx, {
      warehouseId: warehouse.id,
      productId: input.productId,
      variantId: input.variantId ?? null,
      timezone: warehouse.timezone,
      quantityMilli: parseQuantity(input.quantity),
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      actorUserId: input.actorUserId,
      reason: input.reason,
      movementType: "bundle_component_out",
    });
    return result;
  });
}

export async function getWarehouseBranchId(warehouseId: string) {
  const [warehouse] = await getDatabase()
    .select({ id: warehouses.id, branchId: warehouses.branchId })
    .from(warehouses)
    .where(and(eq(warehouses.id, warehouseId), eq(warehouses.isActive, true)))
    .limit(1);
  return warehouse ?? null;
}

export async function listInventoryBranches(warehouseIds: string[]) {
  if (warehouseIds.length === 0) {
    return [];
  }
  return getDatabase()
    .select({ id: warehouses.id, branchId: warehouses.branchId })
    .from(warehouses)
    .where(inArray(warehouses.id, warehouseIds));
}
