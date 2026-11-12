import type { ExtractTablesWithRelations } from "drizzle-orm";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { NodePgTransaction } from "drizzle-orm/node-postgres";
import { getDatabase } from "@/db";
import type * as schema from "@/db/schema";
import {
  auditEvents,
  branches,
  inventoryBatches,
  inventoryMovements,
  products,
  productVariants,
  purchaseOrderLines,
  purchaseOrders,
  purchaseReceiptLines,
  purchaseReceipts,
  purchaseRequestLines,
  purchaseRequests,
  supplierPayableEntries,
  supplierReturnLines,
  supplierReturns,
  suppliers,
  warehouses,
} from "@/db/schema";
import { formatQuantity, parseQuantity } from "@/server/inventory/quantity";
import {
  appendInventoryMovement,
  InventoryInsufficientStockError,
  lockWarehouse,
  validateProductVariant,
} from "@/server/inventory/service";
import type {
  PurchaseOrderInput,
  PurchaseRequestInput,
  ReceivePurchaseInput,
  SupplierInput,
} from "@/server/inventory/validation";
import { nextDocumentNumber } from "@/server/settings/numbering";

type ProcurementTransaction = NodePgTransaction<
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

export class SupplierNotFoundError extends Error {}
export class ProcurementReferenceInvalidError extends Error {}
export class ProcurementStatusError extends Error {}
export class PurchaseQuantityExceededError extends Error {}
export class PurchaseIdempotencyConflictError extends Error {}
export class SupplierReturnStockError extends Error {}

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

async function validateSupplier(tx: ProcurementTransaction, supplierId: string) {
  const [supplier] = await tx
    .select({ id: suppliers.id, isActive: suppliers.isActive })
    .from(suppliers)
    .where(eq(suppliers.id, supplierId))
    .limit(1);
  if (!supplier?.isActive) {
    throw new SupplierNotFoundError("Supplier tidak ditemukan atau tidak aktif.");
  }
}

async function validateBranch(tx: ProcurementTransaction, branchId: string) {
  const [branch] = await tx
    .select({ id: branches.id })
    .from(branches)
    .where(and(eq(branches.id, branchId), eq(branches.isActive, true)))
    .limit(1);
  if (!branch) {
    throw new ProcurementReferenceInvalidError("Cabang tidak ditemukan atau tidak aktif.");
  }
}

async function validateWarehouseBranch(
  tx: ProcurementTransaction,
  warehouseId: string,
  branchId: string,
) {
  const [warehouse] = await tx
    .select({ id: warehouses.id, branchId: warehouses.branchId, isActive: warehouses.isActive })
    .from(warehouses)
    .where(eq(warehouses.id, warehouseId))
    .limit(1);
  if (!warehouse?.isActive || warehouse.branchId !== branchId) {
    throw new ProcurementReferenceInvalidError("Gudang tidak sesuai dengan cabang pesanan.");
  }
}

async function validateLines(
  tx: ProcurementTransaction,
  lines: Array<{ productId: string; variantId?: string | null }>,
) {
  for (const line of lines) {
    await validateProductVariant(tx, line.productId, line.variantId);
  }
}

export async function listSuppliers() {
  return getDatabase()
    .select({
      id: suppliers.id,
      name: suppliers.name,
      contactName: suppliers.contactName,
      phone: suppliers.phone,
      email: suppliers.email,
      address: suppliers.address,
      notes: suppliers.notes,
      isActive: suppliers.isActive,
    })
    .from(suppliers)
    .orderBy(asc(suppliers.name))
    .limit(500);
}

export async function saveSupplier(input: SupplierInput, actorUserId: string, supplierId?: string) {
  try {
    return await getDatabase().transaction(async (tx) => {
      const values = {
        name: input.name,
        contactName: input.contactName || null,
        phone: input.phone || null,
        email: input.email || null,
        address: input.address || null,
        notes: input.notes || null,
        isActive: input.isActive,
        updatedAt: new Date(),
      };
      const [supplier] = supplierId
        ? await tx
            .update(suppliers)
            .set(values)
            .where(eq(suppliers.id, supplierId))
            .returning({ id: suppliers.id })
        : await tx
            .insert(suppliers)
            .values({ ...values, createdBy: actorUserId })
            .returning({ id: suppliers.id });
      if (!supplier) {
        throw new SupplierNotFoundError("Supplier tidak ditemukan.");
      }
      await tx.insert(auditEvents).values({
        actorUserId,
        action: supplierId ? "supplier.updated" : "supplier.created",
        targetType: "supplier",
        targetId: supplier.id,
        metadata: {
          changedFields: Object.keys(values)
            .filter((key) => key !== "updatedAt")
            .join(","),
        },
      });
      return supplier.id;
    });
  } catch (error) {
    if (isConstraint(error, "suppliers_name_lower_unique")) {
      throw new ProcurementReferenceInvalidError("Nama supplier sudah digunakan.");
    }
    throw error;
  }
}

export async function createPurchaseRequest(input: PurchaseRequestInput, actorUserId: string) {
  return getDatabase().transaction(async (tx) => {
    await validateBranch(tx, input.branchId);
    await validateLines(tx, input.lines);
    const requestNumber = await nextDocumentNumber(tx, {
      documentType: "purchase_request",
      branchId: input.branchId,
    });
    const [request] = await tx
      .insert(purchaseRequests)
      .values({
        branchId: input.branchId,
        requestNumber,
        requestedBy: actorUserId,
        notes: input.notes || null,
      })
      .returning({ id: purchaseRequests.id });
    if (!request) {
      throw new Error("Permintaan pembelian gagal dibuat.");
    }
    await tx.insert(purchaseRequestLines).values(
      input.lines.map((line) => ({
        requestId: request.id,
        productId: line.productId,
        variantId: line.variantId ?? null,
        quantity: line.quantity,
        estimatedUnitCostCents: line.unitCostCents ?? null,
      })),
    );
    await tx.insert(auditEvents).values({
      actorUserId,
      action: "procurement.request_created",
      targetType: "purchase_request",
      targetId: request.id,
      metadata: { branchId: input.branchId, lineCount: String(input.lines.length) },
    });
    return { id: request.id, requestNumber };
  });
}

export async function reviewPurchaseRequest(
  requestId: string,
  actorUserId: string,
  decision: "approved" | "rejected",
) {
  return getDatabase().transaction(async (tx) => {
    const [request] = await tx
      .select({
        id: purchaseRequests.id,
        branchId: purchaseRequests.branchId,
        status: purchaseRequests.status,
        requestedBy: purchaseRequests.requestedBy,
      })
      .from(purchaseRequests)
      .where(eq(purchaseRequests.id, requestId))
      .for("update")
      .limit(1);
    if (!request) {
      throw new ProcurementReferenceInvalidError("Permintaan pembelian tidak ditemukan.");
    }
    if (request.status !== "submitted" || request.requestedBy === actorUserId) {
      throw new ProcurementStatusError(
        "Hanya permintaan terkirim yang dapat ditinjau oleh staf lain.",
      );
    }
    await tx
      .update(purchaseRequests)
      .set({ status: decision, reviewedBy: actorUserId, updatedAt: new Date() })
      .where(eq(purchaseRequests.id, request.id));
    await tx.insert(auditEvents).values({
      actorUserId,
      action: `procurement.request_${decision}`,
      targetType: "purchase_request",
      targetId: request.id,
      metadata: { branchId: request.branchId, requestedBy: request.requestedBy },
    });
    return request.id;
  });
}

export async function submitPurchaseRequest(requestId: string, actorUserId: string) {
  return getDatabase().transaction(async (tx) => {
    const [request] = await tx
      .select({
        id: purchaseRequests.id,
        status: purchaseRequests.status,
        requestedBy: purchaseRequests.requestedBy,
      })
      .from(purchaseRequests)
      .where(eq(purchaseRequests.id, requestId))
      .for("update")
      .limit(1);
    if (request?.status !== "draft" || request.requestedBy !== actorUserId) {
      throw new ProcurementStatusError(
        "Hanya pembuat yang dapat mengirim permintaan pembelian draft.",
      );
    }
    await tx
      .update(purchaseRequests)
      .set({ status: "submitted", updatedAt: new Date() })
      .where(eq(purchaseRequests.id, request.id));
    await tx.insert(auditEvents).values({
      actorUserId,
      action: "procurement.request_submitted",
      targetType: "purchase_request",
      targetId: request.id,
    });
    return request.id;
  });
}

export async function createPurchaseOrder(input: PurchaseOrderInput, actorUserId: string) {
  return getDatabase().transaction(async (tx) => {
    await validateBranch(tx, input.branchId);
    await validateWarehouseBranch(tx, input.warehouseId, input.branchId);
    await validateSupplier(tx, input.supplierId);
    await validateLines(tx, input.lines);
    if (input.requestId) {
      const [request] = await tx
        .select({
          id: purchaseRequests.id,
          branchId: purchaseRequests.branchId,
          status: purchaseRequests.status,
        })
        .from(purchaseRequests)
        .where(
          and(
            eq(purchaseRequests.id, input.requestId),
            eq(purchaseRequests.status, "approved"),
            eq(purchaseRequests.branchId, input.branchId),
          ),
        )
        .for("update")
        .limit(1);
      if (!request) {
        throw new ProcurementReferenceInvalidError(
          "Permintaan harus disetujui dan berasal dari cabang yang sama.",
        );
      }
      const requestLines = await tx
        .select({
          productId: purchaseRequestLines.productId,
          variantId: purchaseRequestLines.variantId,
          quantity: purchaseRequestLines.quantity,
        })
        .from(purchaseRequestLines)
        .where(eq(purchaseRequestLines.requestId, request.id));
      const lineKey = (line: { productId: string; variantId: string | null; quantity: string }) =>
        `${line.productId}:${line.variantId ?? ""}:${parseQuantity(line.quantity)}`;
      const requested = requestLines.map(lineKey).sort();
      const ordered = input.lines
        .map((line) =>
          lineKey({
            productId: line.productId,
            variantId: line.variantId ?? null,
            quantity: line.quantity,
          }),
        )
        .sort();
      if (
        requested.length !== ordered.length ||
        requested.some((key, index) => key !== ordered[index])
      ) {
        throw new ProcurementReferenceInvalidError(
          "Baris purchase order harus sesuai dengan permintaan yang disetujui.",
        );
      }
    }
    const orderNumber = await nextDocumentNumber(tx, {
      documentType: "purchase_order",
      branchId: input.branchId,
    });
    const [order] = await tx
      .insert(purchaseOrders)
      .values({
        branchId: input.branchId,
        warehouseId: input.warehouseId,
        supplierId: input.supplierId,
        requestId: input.requestId ?? null,
        orderNumber,
        orderedBy: actorUserId,
        notes: input.notes || null,
      })
      .returning({ id: purchaseOrders.id });
    if (!order) {
      throw new Error("Purchase order gagal dibuat.");
    }
    await tx.insert(purchaseOrderLines).values(
      input.lines.map((line) => ({
        orderId: order.id,
        productId: line.productId,
        variantId: line.variantId ?? null,
        quantity: line.quantity,
        unitCostCents: line.unitCostCents,
      })),
    );
    if (input.requestId) {
      await tx
        .update(purchaseRequests)
        .set({ status: "converted", updatedAt: new Date() })
        .where(
          and(eq(purchaseRequests.id, input.requestId), eq(purchaseRequests.status, "approved")),
        );
    }
    await tx.insert(auditEvents).values({
      actorUserId,
      action: "procurement.order_created",
      targetType: "purchase_order",
      targetId: order.id,
      metadata: {
        branchId: input.branchId,
        supplierId: input.supplierId,
        lineCount: String(input.lines.length),
      },
    });
    return { id: order.id, orderNumber };
  });
}

export async function submitPurchaseOrder(orderId: string, actorUserId: string) {
  return getDatabase().transaction(async (tx) => {
    const [order] = await tx
      .select({
        id: purchaseOrders.id,
        branchId: purchaseOrders.branchId,
        status: purchaseOrders.status,
      })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, orderId))
      .for("update")
      .limit(1);
    if (order?.status !== "draft") {
      throw new ProcurementStatusError("Hanya purchase order draft yang dapat diterbitkan.");
    }
    await tx
      .update(purchaseOrders)
      .set({ status: "ordered", updatedAt: new Date() })
      .where(eq(purchaseOrders.id, order.id));
    await tx.insert(auditEvents).values({
      actorUserId,
      action: "procurement.order_submitted",
      targetType: "purchase_order",
      targetId: order.id,
      metadata: { branchId: order.branchId },
    });
    return order.id;
  });
}

async function receivePurchaseTransaction(
  orderId: string,
  input: ReceivePurchaseInput,
  actorUserId: string,
) {
  return getDatabase().transaction(async (tx) => {
    const [previousReceipt] = await tx
      .select({ id: purchaseReceipts.id, orderId: purchaseReceipts.orderId })
      .from(purchaseReceipts)
      .where(eq(purchaseReceipts.idempotencyKey, input.idempotencyKey))
      .limit(1);
    if (previousReceipt) {
      if (previousReceipt.orderId !== orderId) {
        throw new PurchaseIdempotencyConflictError(
          "Kunci idempotensi telah digunakan untuk pesanan lain.",
        );
      }
      return { id: previousReceipt.id, replayed: true };
    }

    const [order] = await tx
      .select({
        id: purchaseOrders.id,
        branchId: purchaseOrders.branchId,
        warehouseId: purchaseOrders.warehouseId,
        supplierId: purchaseOrders.supplierId,
        status: purchaseOrders.status,
      })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, orderId))
      .for("update")
      .limit(1);
    if (!order || !["ordered", "partially_received"].includes(order.status)) {
      throw new ProcurementStatusError("Pesanan tidak dapat menerima barang pada status ini.");
    }
    const warehouse = await lockWarehouse(tx, order.warehouseId);
    if (warehouse.branchId !== order.branchId) {
      throw new ProcurementReferenceInvalidError("Gudang pesanan tidak sesuai cabang.");
    }
    const orderLineIds = [...new Set(input.lines.map(({ orderLineId }) => orderLineId))];
    const orderLines = await tx
      .select({
        id: purchaseOrderLines.id,
        productId: purchaseOrderLines.productId,
        variantId: purchaseOrderLines.variantId,
        quantity: purchaseOrderLines.quantity,
        receivedQuantity: purchaseOrderLines.receivedQuantity,
        unitCostCents: purchaseOrderLines.unitCostCents,
      })
      .from(purchaseOrderLines)
      .where(
        and(eq(purchaseOrderLines.orderId, order.id), inArray(purchaseOrderLines.id, orderLineIds)),
      )
      .for("update");
    if (orderLines.length !== orderLineIds.length) {
      throw new ProcurementReferenceInvalidError("Baris penerimaan bukan milik pesanan ini.");
    }
    const lineById = new Map(orderLines.map((line) => [line.id, line]));
    const quantityByLine = new Map<string, bigint>();
    for (const line of input.lines) {
      const orderLine = lineById.get(line.orderLineId);
      if (!orderLine) {
        throw new ProcurementReferenceInvalidError("Baris pesanan tidak ditemukan.");
      }
      const total = (quantityByLine.get(line.orderLineId) ?? 0n) + parseQuantity(line.quantity);
      if (parseQuantity(orderLine.receivedQuantity) + total > parseQuantity(orderLine.quantity)) {
        throw new PurchaseQuantityExceededError(
          "Jumlah penerimaan melebihi sisa jumlah pada pesanan.",
        );
      }
      quantityByLine.set(line.orderLineId, total);
      await validateProductVariant(tx, orderLine.productId, orderLine.variantId);
    }

    const receiptNumber = await nextDocumentNumber(tx, {
      documentType: "goods_receipt",
      branchId: order.branchId,
    });
    const [receipt] = await tx
      .insert(purchaseReceipts)
      .values({
        orderId: order.id,
        receiptNumber,
        idempotencyKey: input.idempotencyKey,
        receivedBy: actorUserId,
        notes: input.notes || null,
      })
      .returning({ id: purchaseReceipts.id });
    if (!receipt) {
      throw new Error("Penerimaan barang gagal dibuat.");
    }

    let payableMilliCents = 0n;
    const movementLines = new Map<
      string,
      {
        batchId: string;
        productId: string;
        variantId: string | null;
        quantityMilli: bigint;
        unitCostCents: number;
      }
    >();
    for (const line of input.lines) {
      const orderLine = lineById.get(line.orderLineId);
      if (!orderLine) {
        throw new Error("Baris pesanan hilang selama penerimaan.");
      }
      const quantityMilli = parseQuantity(line.quantity);
      const unitCostCents = line.unitCostCents ?? orderLine.unitCostCents;
      const [existingBatch] = await tx
        .select({
          id: inventoryBatches.id,
          unitCostCents: inventoryBatches.unitCostCents,
          supplierId: inventoryBatches.supplierId,
          expiresOn: inventoryBatches.expiresOn,
        })
        .from(inventoryBatches)
        .where(
          and(
            eq(inventoryBatches.warehouseId, warehouse.id),
            eq(inventoryBatches.productId, orderLine.productId),
            orderLine.variantId
              ? eq(inventoryBatches.variantId, orderLine.variantId)
              : sql`${inventoryBatches.variantId} IS NULL`,
            eq(inventoryBatches.batchNumber, line.batchNumber),
          ),
        )
        .limit(1);
      if (
        existingBatch &&
        (existingBatch.unitCostCents !== unitCostCents ||
          existingBatch.supplierId !== order.supplierId ||
          existingBatch.expiresOn !== (line.expiresOn ?? null))
      ) {
        throw new ProcurementReferenceInvalidError(
          "Nomor batch yang sama harus konsisten pada biaya, supplier, dan kedaluwarsa.",
        );
      }
      const [batch] = existingBatch
        ? [existingBatch]
        : await tx
            .insert(inventoryBatches)
            .values({
              warehouseId: warehouse.id,
              productId: orderLine.productId,
              variantId: orderLine.variantId,
              supplierId: order.supplierId,
              batchNumber: line.batchNumber,
              expiresOn: line.expiresOn ?? null,
              unitCostCents,
            })
            .returning({
              id: inventoryBatches.id,
              unitCostCents: inventoryBatches.unitCostCents,
              supplierId: inventoryBatches.supplierId,
              expiresOn: inventoryBatches.expiresOn,
            });
      if (!batch) {
        throw new Error("Batch barang gagal dibuat.");
      }
      await tx.insert(purchaseReceiptLines).values({
        receiptId: receipt.id,
        orderLineId: orderLine.id,
        batchId: batch.id,
        quantity: line.quantity,
        unitCostCents,
      });
      const movementKey = batch.id;
      const currentMovement = movementLines.get(movementKey);
      movementLines.set(movementKey, {
        batchId: batch.id,
        productId: orderLine.productId,
        variantId: orderLine.variantId,
        quantityMilli: (currentMovement?.quantityMilli ?? 0n) + quantityMilli,
        unitCostCents,
      });
      payableMilliCents += quantityMilli * BigInt(unitCostCents);
    }

    for (const movement of movementLines.values()) {
      await appendInventoryMovement(tx, {
        warehouseId: warehouse.id,
        batchId: movement.batchId,
        productId: movement.productId,
        variantId: movement.variantId,
        movementType: "receipt",
        quantityDelta: formatQuantity(movement.quantityMilli),
        unitCostCents: movement.unitCostCents,
        sourceType: "goods_receipt",
        sourceId: receipt.id,
        actorUserId,
      });
    }

    for (const [lineId, quantityMilli] of quantityByLine) {
      const orderLine = lineById.get(lineId);
      if (!orderLine) {
        throw new Error("Baris pesanan hilang selama penerimaan.");
      }
      await tx
        .update(purchaseOrderLines)
        .set({
          receivedQuantity: formatQuantity(
            parseQuantity(orderLine.receivedQuantity) + quantityMilli,
          ),
        })
        .where(eq(purchaseOrderLines.id, lineId));
    }
    const payableCentsBig = (payableMilliCents + 999n) / 1000n;
    if (payableCentsBig > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new ProcurementReferenceInvalidError("Nilai penerimaan melebihi batas pencatatan.");
    }
    const payableCents = Number(payableCentsBig);
    if (payableCents > 0) {
      await tx.insert(supplierPayableEntries).values({
        supplierId: order.supplierId,
        branchId: order.branchId,
        entryType: "receipt",
        amountCents: payableCents,
        sourceType: "goods_receipt",
        sourceId: receipt.id,
        createdBy: actorUserId,
      });
    }

    const remaining = await tx
      .select({ id: purchaseOrderLines.id })
      .from(purchaseOrderLines)
      .where(
        and(
          eq(purchaseOrderLines.orderId, order.id),
          sql`${purchaseOrderLines.receivedQuantity} < ${purchaseOrderLines.quantity}`,
        ),
      );
    await tx
      .update(purchaseOrders)
      .set({
        status: remaining.length ? "partially_received" : "received",
        updatedAt: new Date(),
      })
      .where(eq(purchaseOrders.id, order.id));
    await tx.insert(auditEvents).values({
      actorUserId,
      action: "procurement.goods_received",
      targetType: "goods_receipt",
      targetId: receipt.id,
      metadata: {
        branchId: order.branchId,
        lineCount: String(input.lines.length),
        orderId: order.id,
      },
    });
    return { id: receipt.id, replayed: false };
  });
}

export async function receivePurchase(
  orderId: string,
  input: ReceivePurchaseInput,
  actorUserId: string,
) {
  try {
    return await receivePurchaseTransaction(orderId, input, actorUserId);
  } catch (error) {
    if (isConstraint(error, "purchase_receipts_idempotency_key_key")) {
      const [receipt] = await getDatabase()
        .select({ id: purchaseReceipts.id, orderId: purchaseReceipts.orderId })
        .from(purchaseReceipts)
        .where(eq(purchaseReceipts.idempotencyKey, input.idempotencyKey))
        .limit(1);
      if (receipt?.orderId === orderId) {
        return { id: receipt.id, replayed: true };
      }
      throw new PurchaseIdempotencyConflictError(
        "Kunci idempotensi telah digunakan untuk pesanan lain.",
      );
    }
    throw error;
  }
}

export async function listPurchaseOrders(branchId: string, includeCosts: boolean) {
  const orders = await getDatabase()
    .select({
      id: purchaseOrders.id,
      orderNumber: purchaseOrders.orderNumber,
      supplierId: purchaseOrders.supplierId,
      supplierName: suppliers.name,
      warehouseId: purchaseOrders.warehouseId,
      warehouseName: warehouses.name,
      status: purchaseOrders.status,
      createdAt: purchaseOrders.createdAt,
    })
    .from(purchaseOrders)
    .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .innerJoin(warehouses, eq(purchaseOrders.warehouseId, warehouses.id))
    .where(eq(purchaseOrders.branchId, branchId))
    .orderBy(sql`${purchaseOrders.createdAt} DESC`)
    .limit(200);
  const orderIds = orders.map(({ id }) => id);
  if (!orderIds.length) {
    return orders.map((order) => ({ ...order, lines: [] }));
  }
  const lines = await getDatabase()
    .select({
      orderId: purchaseOrderLines.orderId,
      id: purchaseOrderLines.id,
      productId: purchaseOrderLines.productId,
      productName: products.name,
      sku: products.sku,
      variantId: purchaseOrderLines.variantId,
      variantName: productVariants.name,
      quantity: purchaseOrderLines.quantity,
      receivedQuantity: purchaseOrderLines.receivedQuantity,
      unitCostCents: purchaseOrderLines.unitCostCents,
    })
    .from(purchaseOrderLines)
    .innerJoin(products, eq(purchaseOrderLines.productId, products.id))
    .leftJoin(productVariants, eq(purchaseOrderLines.variantId, productVariants.id))
    .where(inArray(purchaseOrderLines.orderId, orderIds));
  const grouped = new Map<string, typeof lines>();
  for (const line of lines) {
    grouped.set(line.orderId, [...(grouped.get(line.orderId) ?? []), line]);
  }
  return orders.map((order) => ({
    ...order,
    lines: (grouped.get(order.id) ?? []).map(({ unitCostCents, ...line }) => ({
      ...line,
      ...(includeCosts ? { unitCostCents } : {}),
    })),
  }));
}

export async function listSupplierPayables(branchId: string) {
  const rows = await getDatabase()
    .select({
      supplierId: supplierPayableEntries.supplierId,
      supplierName: suppliers.name,
      balanceCents: sql<string>`SUM(${supplierPayableEntries.amountCents})::text`,
      lastActivityAt: sql<Date>`MAX(${supplierPayableEntries.createdAt})`,
    })
    .from(supplierPayableEntries)
    .innerJoin(suppliers, eq(supplierPayableEntries.supplierId, suppliers.id))
    .where(eq(supplierPayableEntries.branchId, branchId))
    .groupBy(supplierPayableEntries.supplierId, suppliers.name)
    .orderBy(asc(suppliers.name));
  return rows.map(({ balanceCents, ...row }) => {
    const balance = BigInt(balanceCents);
    if (balance > BigInt(Number.MAX_SAFE_INTEGER) || balance < BigInt(Number.MIN_SAFE_INTEGER)) {
      throw new Error("Saldo hutang supplier melebihi batas nilai yang dapat ditampilkan.");
    }
    return { ...row, balanceCents: Number(balance) };
  });
}

export async function createSupplierReturn(
  input: {
    warehouseId: string;
    supplierId: string;
    reason: string;
    lines: Array<{ batchId: string; quantity: string }>;
  },
  actorUserId: string,
) {
  return getDatabase().transaction(async (tx) => {
    const warehouse = await lockWarehouse(tx, input.warehouseId);
    await validateSupplier(tx, input.supplierId);
    const [record] = await tx
      .insert(supplierReturns)
      .values({
        branchId: warehouse.branchId,
        supplierId: input.supplierId,
        warehouseId: warehouse.id,
        returnNumber: await nextDocumentNumber(tx, {
          documentType: "supplier_return",
          branchId: warehouse.branchId,
        }),
        reason: input.reason,
        createdBy: actorUserId,
      })
      .returning({ id: supplierReturns.id });
    if (!record) {
      throw new Error("Retur supplier gagal dibuat.");
    }
    let totalMilliCents = 0n;
    for (const line of input.lines) {
      const [batch] = await tx
        .select({
          id: inventoryBatches.id,
          productId: inventoryBatches.productId,
          variantId: inventoryBatches.variantId,
          supplierId: inventoryBatches.supplierId,
          unitCostCents: inventoryBatches.unitCostCents,
          quantity: sql<string>`COALESCE(SUM(${inventoryMovements.quantityDelta}), 0)::text`,
        })
        .from(inventoryBatches)
        .leftJoin(inventoryMovements, eq(inventoryMovements.batchId, inventoryBatches.id))
        .where(
          and(
            eq(inventoryBatches.id, line.batchId),
            eq(inventoryBatches.warehouseId, warehouse.id),
          ),
        )
        .groupBy(inventoryBatches.id)
        .limit(1);
      if (!batch || batch.supplierId !== input.supplierId) {
        throw new SupplierReturnStockError("Batch bukan berasal dari supplier yang dipilih.");
      }
      const quantityMilli = parseQuantity(line.quantity);
      if (parseQuantity(batch.quantity) < quantityMilli) {
        throw new InventoryInsufficientStockError("Stok batch tidak mencukupi untuk retur.");
      }
      await tx.insert(supplierReturnLines).values({
        returnId: record.id,
        batchId: batch.id,
        quantity: line.quantity,
        unitCostCents: batch.unitCostCents,
      });
      await appendInventoryMovement(tx, {
        warehouseId: warehouse.id,
        batchId: batch.id,
        productId: batch.productId,
        variantId: batch.variantId,
        movementType: "supplier_return",
        quantityDelta: `-${formatQuantity(quantityMilli)}`,
        unitCostCents: batch.unitCostCents,
        sourceType: "supplier_return",
        sourceId: record.id,
        reason: input.reason,
        actorUserId,
      });
      totalMilliCents += quantityMilli * BigInt(batch.unitCostCents);
    }
    const totalCentsBig = (totalMilliCents + 999n) / 1000n;
    if (totalCentsBig > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new ProcurementReferenceInvalidError("Nilai retur melebihi batas pencatatan.");
    }
    const totalCents = Number(totalCentsBig);
    if (totalCents > 0) {
      await tx.insert(supplierPayableEntries).values({
        supplierId: input.supplierId,
        branchId: warehouse.branchId,
        entryType: "return",
        amountCents: -totalCents,
        sourceType: "supplier_return",
        sourceId: record.id,
        createdBy: actorUserId,
      });
    }
    await tx.insert(auditEvents).values({
      actorUserId,
      action: "procurement.supplier_returned",
      targetType: "supplier_return",
      targetId: record.id,
      metadata: { branchId: warehouse.branchId, lineCount: String(input.lines.length) },
    });
    return record.id;
  });
}

export async function listPurchaseRequests(branchId: string) {
  const requests = await getDatabase()
    .select({
      id: purchaseRequests.id,
      requestNumber: purchaseRequests.requestNumber,
      status: purchaseRequests.status,
      requestedBy: purchaseRequests.requestedBy,
      reviewedBy: purchaseRequests.reviewedBy,
      notes: purchaseRequests.notes,
      createdAt: purchaseRequests.createdAt,
    })
    .from(purchaseRequests)
    .where(eq(purchaseRequests.branchId, branchId))
    .orderBy(sql`${purchaseRequests.createdAt} DESC`)
    .limit(200);
  const requestIds = requests.map(({ id }) => id);
  if (!requestIds.length) {
    return requests.map((request) => ({ ...request, lines: [] }));
  }
  const lines = await getDatabase()
    .select({
      requestId: purchaseRequestLines.requestId,
      productId: purchaseRequestLines.productId,
      productName: products.name,
      sku: products.sku,
      variantId: purchaseRequestLines.variantId,
      variantName: productVariants.name,
      quantity: purchaseRequestLines.quantity,
    })
    .from(purchaseRequestLines)
    .innerJoin(products, eq(purchaseRequestLines.productId, products.id))
    .leftJoin(productVariants, eq(purchaseRequestLines.variantId, productVariants.id))
    .where(inArray(purchaseRequestLines.requestId, requestIds));
  return requests.map((request) => ({
    ...request,
    lines: lines
      .filter(({ requestId }) => requestId === request.id)
      .map(({ requestId: _requestId, ...line }) => line),
  }));
}

export async function getPurchaseRequestBranch(requestId: string) {
  const [request] = await getDatabase()
    .select({
      id: purchaseRequests.id,
      branchId: purchaseRequests.branchId,
      status: purchaseRequests.status,
    })
    .from(purchaseRequests)
    .where(eq(purchaseRequests.id, requestId))
    .limit(1);
  return request ?? null;
}

export async function getPurchaseOrderBranch(orderId: string) {
  const [order] = await getDatabase()
    .select({
      id: purchaseOrders.id,
      branchId: purchaseOrders.branchId,
      status: purchaseOrders.status,
    })
    .from(purchaseOrders)
    .where(eq(purchaseOrders.id, orderId))
    .limit(1);
  return order ?? null;
}
