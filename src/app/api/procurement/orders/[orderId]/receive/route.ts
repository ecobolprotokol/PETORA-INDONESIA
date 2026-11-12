import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeStaff } from "@/server/access/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { apiError, hasSameOrigin } from "@/server/http";
import {
  InventoryBatchConflictError,
  InventoryProductInvalidError as ProductInvalidError,
} from "@/server/inventory/service";
import { receivePurchaseSchema } from "@/server/inventory/validation";
import {
  getPurchaseOrderBranch,
  ProcurementReferenceInvalidError,
  ProcurementStatusError,
  PurchaseIdempotencyConflictError,
  PurchaseQuantityExceededError,
  receivePurchase,
} from "@/server/procurement/service";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> },
) {
  if (!hasSameOrigin(request)) {
    return apiError("ORIGIN_INVALID", "Permintaan tidak dapat diverifikasi.", 403);
  }
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;
  if (!staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }
  const { orderId } = await context.params;
  const parsedId = z.string().uuid().safeParse(orderId);
  if (!parsedId.success) {
    return apiError("INPUT_INVALID", "ID pesanan tidak valid.", 400);
  }
  const body: unknown = await request.json().catch(() => null);
  const parsed = receivePurchaseSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("INPUT_INVALID", "Periksa kembali batch, kedaluwarsa, jumlah, dan biaya.", 400);
  }
  const order = await getPurchaseOrderBranch(parsedId.data);
  if (!order) {
    return apiError("PURCHASE_ORDER_NOT_FOUND", "Pesanan pembelian tidak ditemukan.", 404);
  }
  const [procurementGrant, inventoryGrant] = await Promise.all([
    authorizeStaff(staff, "procurement.manage", order.branchId),
    authorizeStaff(staff, "inventory.manage", order.branchId),
  ]);
  if (!procurementGrant || !inventoryGrant) {
    return apiError(
      "FORBIDDEN",
      "Izin pengadaan dan pengelolaan stok diperlukan untuk menerima barang.",
      403,
    );
  }
  try {
    const receipt = await receivePurchase(order.id, parsed.data, staff.id);
    return NextResponse.json({ receipt });
  } catch (error) {
    if (error instanceof ProcurementReferenceInvalidError || error instanceof ProductInvalidError) {
      return apiError("PURCHASE_RECEIPT_INVALID", error.message, 400);
    }
    if (error instanceof ProcurementStatusError) {
      return apiError("PURCHASE_ORDER_STATUS_INVALID", error.message, 409);
    }
    if (error instanceof PurchaseQuantityExceededError) {
      return apiError("PURCHASE_QUANTITY_EXCEEDED", error.message, 409);
    }
    if (error instanceof PurchaseIdempotencyConflictError) {
      return apiError("PURCHASE_IDEMPOTENCY_CONFLICT", error.message, 409);
    }
    if (error instanceof InventoryBatchConflictError) {
      return apiError("INVENTORY_BATCH_CONFLICT", error.message, 409);
    }
    throw error;
  }
}
