import { type NextRequest, NextResponse } from "next/server";
import { authorizeStaff } from "@/server/access/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { apiError, hasSameOrigin } from "@/server/http";
import {
  createInventoryAdjustment,
  getWarehouseBranchId,
  InventoryApprovalRequiredError,
  InventoryBatchConflictError,
  InventoryInsufficientStockError,
  InventoryProductInvalidError,
  WarehouseNotFoundError,
} from "@/server/inventory/service";
import { inventoryAdjustmentSchema } from "@/server/inventory/validation";
import { SupervisorPinInvalidError, SupervisorPinNotSetError } from "@/server/supervisor/pin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) {
    return apiError("ORIGIN_INVALID", "Permintaan tidak dapat diverifikasi.", 403);
  }
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;
  if (!staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }
  const body: unknown = await request.json().catch(() => null);
  const parsed = inventoryAdjustmentSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("INPUT_INVALID", "Periksa kembali jumlah, batch, biaya, dan alasan.", 400);
  }
  const warehouse = await getWarehouseBranchId(parsed.data.warehouseId);
  if (!warehouse) {
    return apiError("WAREHOUSE_NOT_FOUND", "Gudang tidak ditemukan atau tidak aktif.", 404);
  }
  const grant = await authorizeStaff(staff, "inventory.adjust", warehouse.branchId);
  if (!grant) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin menyesuaikan stok cabang ini.", 403);
  }
  try {
    const adjustmentId = await createInventoryAdjustment(parsed.data, staff.id, grant);
    return NextResponse.json({ adjustmentId }, { status: 201 });
  } catch (error) {
    if (error instanceof WarehouseNotFoundError) {
      return apiError("WAREHOUSE_NOT_FOUND", error.message, 404);
    }
    if (error instanceof InventoryProductInvalidError) {
      return apiError("INVENTORY_PRODUCT_INVALID", error.message, 400);
    }
    if (error instanceof InventoryBatchConflictError) {
      return apiError("INVENTORY_BATCH_CONFLICT", error.message, 409);
    }
    if (error instanceof InventoryInsufficientStockError) {
      return apiError("INVENTORY_STOCK_INSUFFICIENT", error.message, 409);
    }
    if (error instanceof InventoryApprovalRequiredError) {
      return apiError("INVENTORY_SUPERVISOR_PIN_REQUIRED", error.message, 403);
    }
    if (error instanceof SupervisorPinNotSetError || error instanceof SupervisorPinInvalidError) {
      return apiError("SUPERVISOR_PIN_INVALID", error.message, 403);
    }
    throw error;
  }
}
