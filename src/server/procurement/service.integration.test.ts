import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase } from "@/db";
import {
  auditEvents,
  branches,
  inventoryBatches,
  inventoryMovements,
  products,
  purchaseOrderLines,
  purchaseOrders,
  purchaseReceiptLines,
  purchaseReceipts,
  purchaseRequestLines,
  purchaseRequests,
  staffUsers,
  supplierPayableEntries,
  supplierReturnLines,
  supplierReturns,
  suppliers,
  warehouses,
} from "@/db/schema";
import { createBranch } from "@/server/branches/service";
import {
  createPurchaseOrder,
  createPurchaseRequest,
  createSupplierReturn,
  listPurchaseRequests,
  listSupplierPayables,
  PurchaseQuantityExceededError,
  receivePurchase,
  reviewPurchaseRequest,
  saveSupplier,
  submitPurchaseOrder,
  submitPurchaseRequest,
} from "./service";

const suffix = randomUUID();
let staffId: string;
let reviewerId: string;
let branchId: string;
let warehouseId: string;
let productId: string;
let supplierId: string;
let orderId: string;
let requestId: string;

beforeAll(async () => {
  const [staff] = await getDatabase()
    .insert(staffUsers)
    .values({
      name: "Procurement Test",
      email: `procurement-${suffix}@example.test`,
      passwordHash: "unused-test-hash",
    })
    .returning({ id: staffUsers.id });
  staffId = staff.id;
  const [reviewer] = await getDatabase()
    .insert(staffUsers)
    .values({
      name: "Procurement Reviewer",
      email: `procurement-reviewer-${suffix}@example.test`,
      passwordHash: "unused-test-hash",
    })
    .returning({ id: staffUsers.id });
  reviewerId = reviewer.id;
  const branch = await createBranch(
    {
      code: `PO-${suffix.slice(0, 6).toUpperCase()}`,
      name: `Procurement ${suffix.slice(0, 6)}`,
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
      name: `Procurement test ${suffix}`,
      sku: `PO-${suffix}`,
      productType: "general",
      createdBy: staffId,
      updatedBy: staffId,
    })
    .returning({ id: products.id });
  productId = product.id;
  supplierId = await saveSupplier(
    {
      name: `Supplier ${suffix}`,
      contactName: null,
      phone: null,
      email: null,
      address: null,
      notes: null,
      isActive: true,
    },
    staffId,
  );
  const order = await createPurchaseOrder(
    {
      branchId,
      warehouseId,
      supplierId,
      lines: [{ productId, variantId: null, quantity: "3", unitCostCents: 1250 }],
    },
    staffId,
  );
  orderId = order.id;
  await submitPurchaseOrder(orderId, staffId);
});

afterAll(async () => {
  const database = getDatabase();
  await database.execute(
    sql`ALTER TABLE inventory_movements DISABLE TRIGGER inventory_movements_immutable`,
  );
  try {
    if (staffId || reviewerId) {
      await database
        .delete(auditEvents)
        .where(inArray(auditEvents.actorUserId, [staffId, reviewerId].filter(Boolean)));
    }
    if (requestId) {
      await database
        .delete(purchaseRequestLines)
        .where(eq(purchaseRequestLines.requestId, requestId));
      await database.delete(purchaseRequests).where(eq(purchaseRequests.id, requestId));
    }
    if (orderId) {
      const receipts = await database
        .select({ id: purchaseReceipts.id })
        .from(purchaseReceipts)
        .where(eq(purchaseReceipts.orderId, orderId));
      const receiptIds = receipts.map(({ id }) => id);
      if (receiptIds.length) {
        await database
          .delete(purchaseReceiptLines)
          .where(inArray(purchaseReceiptLines.receiptId, receiptIds));
        await database
          .delete(supplierPayableEntries)
          .where(inArray(supplierPayableEntries.sourceId, receiptIds));
      }
      await database.delete(purchaseReceipts).where(eq(purchaseReceipts.orderId, orderId));
      await database.delete(purchaseOrderLines).where(eq(purchaseOrderLines.orderId, orderId));
      await database.delete(purchaseOrders).where(eq(purchaseOrders.id, orderId));
    }
    if (warehouseId) {
      const returns = await database
        .select({ id: supplierReturns.id })
        .from(supplierReturns)
        .where(eq(supplierReturns.warehouseId, warehouseId));
      const returnIds = returns.map(({ id }) => id);
      if (returnIds.length) {
        await database
          .delete(supplierReturnLines)
          .where(inArray(supplierReturnLines.returnId, returnIds));
        await database
          .delete(supplierPayableEntries)
          .where(inArray(supplierPayableEntries.sourceId, returnIds));
      }
      await database.delete(supplierReturns).where(eq(supplierReturns.warehouseId, warehouseId));
      await database
        .delete(supplierPayableEntries)
        .where(eq(supplierPayableEntries.branchId, branchId));
      await database
        .delete(inventoryMovements)
        .where(eq(inventoryMovements.warehouseId, warehouseId));
      await database.delete(inventoryBatches).where(eq(inventoryBatches.warehouseId, warehouseId));
      await database.delete(warehouses).where(eq(warehouses.id, warehouseId));
    }
    if (productId) {
      await database.delete(products).where(eq(products.id, productId));
    }
    if (supplierId) {
      await database.delete(suppliers).where(eq(suppliers.id, supplierId));
    }
    if (branchId) {
      await database.delete(branches).where(eq(branches.id, branchId));
    }
    if (staffId) {
      await database.delete(staffUsers).where(eq(staffUsers.id, staffId));
    }
    if (reviewerId) {
      await database.delete(staffUsers).where(eq(staffUsers.id, reviewerId));
    }
  } finally {
    await database.execute(
      sql`ALTER TABLE inventory_movements ENABLE TRIGGER inventory_movements_immutable`,
    );
  }
});

describe("purchase receiving and supplier payable ledger", () => {
  it("submits and separately approves a purchase request with its item lines", async () => {
    const request = await createPurchaseRequest(
      {
        branchId,
        notes: "Permintaan stok mingguan",
        lines: [{ productId, variantId: null, quantity: "3" }],
      },
      staffId,
    );
    requestId = request.id;
    await submitPurchaseRequest(request.id, staffId);
    await reviewPurchaseRequest(request.id, reviewerId, "approved");

    await expect(listPurchaseRequests(branchId)).resolves.toContainEqual(
      expect.objectContaining({
        id: request.id,
        requestNumber: request.requestNumber,
        status: "approved",
        lines: [
          expect.objectContaining({
            productId,
            quantity: "3.000",
          }),
        ],
      }),
    );
  });

  it("receives idempotently, tracks stock and payable, and returns supplier goods", async () => {
    const [orderLine] = await getDatabase()
      .select({ id: purchaseOrderLines.id })
      .from(purchaseOrderLines)
      .where(eq(purchaseOrderLines.orderId, orderId))
      .limit(1);
    const input = {
      idempotencyKey: `receive-${suffix}`,
      lines: [
        {
          orderLineId: orderLine.id,
          batchNumber: "LOT-1",
          expiresOn: "2099-12-31",
          quantity: "2",
        },
      ],
    };
    const first = await receivePurchase(orderId, input, staffId);
    expect(first.replayed).toBe(false);
    await expect(receivePurchase(orderId, input, staffId)).resolves.toEqual({
      id: first.id,
      replayed: true,
    });

    await expect(
      receivePurchase(
        orderId,
        {
          idempotencyKey: `excess-${suffix}`,
          lines: [
            {
              orderLineId: orderLine.id,
              batchNumber: "LOT-2",
              expiresOn: "2099-12-31",
              quantity: "2",
            },
          ],
        },
        staffId,
      ),
    ).rejects.toBeInstanceOf(PurchaseQuantityExceededError);

    const returnId = await createSupplierReturn(
      {
        warehouseId,
        supplierId,
        reason: "Kemasan rusak saat penerimaan",
        lines: [
          {
            batchId: (
              await getDatabase()
                .select({ id: inventoryBatches.id })
                .from(inventoryBatches)
                .where(eq(inventoryBatches.warehouseId, warehouseId))
                .limit(1)
            )[0].id,
            quantity: "1",
          },
        ],
      },
      staffId,
    );
    expect(returnId).toBeTruthy();

    const payables = await listSupplierPayables(branchId);
    expect(payables.find(({ supplierId: id }) => id === supplierId)?.balanceCents).toBe(1250);
    const movementRows = await getDatabase()
      .select({
        movementType: inventoryMovements.movementType,
        quantity: inventoryMovements.quantityDelta,
      })
      .from(inventoryMovements)
      .where(eq(inventoryMovements.warehouseId, warehouseId));
    expect(movementRows).toEqual([
      { movementType: "receipt", quantity: "2.000" },
      { movementType: "supplier_return", quantity: "-1.000" },
    ]);
  });
});
