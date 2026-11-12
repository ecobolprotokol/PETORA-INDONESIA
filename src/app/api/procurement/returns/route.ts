import { type NextRequest, NextResponse } from "next/server";
import { authorizeStaff } from "@/server/access/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { apiError, hasSameOrigin } from "@/server/http";
import { getWarehouseBranchId, InventoryInsufficientStockError } from "@/server/inventory/service";
import { supplierReturnSchema } from "@/server/inventory/validation";
import {
  createSupplierReturn,
  SupplierNotFoundError,
  SupplierReturnStockError,
} from "@/server/procurement/service";

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
  const parsed = supplierReturnSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "INPUT_INVALID",
      "Periksa kembali supplier, batch, jumlah, dan alasan retur.",
      400,
    );
  }
  const warehouse = await getWarehouseBranchId(parsed.data.warehouseId);
  if (!warehouse) {
    return apiError("WAREHOUSE_NOT_FOUND", "Gudang tidak ditemukan atau tidak aktif.", 404);
  }
  const [procurementGrant, inventoryGrant] = await Promise.all([
    authorizeStaff(staff, "procurement.manage", warehouse.branchId),
    authorizeStaff(staff, "inventory.manage", warehouse.branchId),
  ]);
  if (!procurementGrant || !inventoryGrant) {
    return apiError(
      "FORBIDDEN",
      "Izin pengadaan dan pengelolaan stok diperlukan untuk retur supplier.",
      403,
    );
  }
  try {
    const returnId = await createSupplierReturn(parsed.data, staff.id);
    return NextResponse.json({ returnId }, { status: 201 });
  } catch (error) {
    if (error instanceof SupplierNotFoundError || error instanceof SupplierReturnStockError) {
      return apiError("SUPPLIER_RETURN_INVALID", error.message, 409);
    }
    if (error instanceof InventoryInsufficientStockError) {
      return apiError("INVENTORY_STOCK_INSUFFICIENT", error.message, 409);
    }
    throw error;
  }
}
