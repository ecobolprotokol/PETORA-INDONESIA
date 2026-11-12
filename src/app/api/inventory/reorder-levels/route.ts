import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeStaff } from "@/server/access/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { apiError, hasSameOrigin } from "@/server/http";
import {
  getWarehouseBranchId,
  InventoryProductInvalidError,
  listInventoryReorderLevels,
  listInventoryReorderSuggestions,
  replaceInventoryReorderLevels,
  WarehouseNotFoundError,
} from "@/server/inventory/service";
import { reorderLevelsSchema } from "@/server/inventory/validation";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;
  if (!staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }
  const warehouseId = z.string().uuid().safeParse(request.nextUrl.searchParams.get("warehouseId"));
  if (!warehouseId.success) {
    return apiError("INPUT_INVALID", "Gudang tidak valid.", 400);
  }
  const warehouse = await getWarehouseBranchId(warehouseId.data);
  if (!warehouse) {
    return apiError("WAREHOUSE_NOT_FOUND", "Gudang tidak ditemukan atau tidak aktif.", 404);
  }
  const [readGrant, manageGrant] = await Promise.all([
    authorizeStaff(staff, "inventory.read", warehouse.branchId),
    authorizeStaff(staff, "inventory.manage", warehouse.branchId),
  ]);
  if (!readGrant && !manageGrant) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin melihat ambang stok.", 403);
  }
  const [levels, suggestions] = await Promise.all([
    listInventoryReorderLevels(warehouse.id),
    listInventoryReorderSuggestions(warehouse.id),
  ]);
  return NextResponse.json({ levels, suggestions });
}

export async function PUT(request: NextRequest) {
  if (!hasSameOrigin(request)) {
    return apiError("ORIGIN_INVALID", "Permintaan tidak dapat diverifikasi.", 403);
  }
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;
  if (!staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }
  const body: unknown = await request.json().catch(() => null);
  const parsed = reorderLevelsSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("INPUT_INVALID", "Ambang stok atau jumlah pemesanan ulang tidak valid.", 400);
  }
  const warehouse = await getWarehouseBranchId(parsed.data.warehouseId);
  if (!warehouse) {
    return apiError("WAREHOUSE_NOT_FOUND", "Gudang tidak ditemukan atau tidak aktif.", 404);
  }
  if (!(await authorizeStaff(staff, "inventory.manage", warehouse.branchId))) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin mengubah ambang stok.", 403);
  }
  try {
    const updated = await replaceInventoryReorderLevels(warehouse.id, parsed.data.lines, staff.id);
    return NextResponse.json({ updated });
  } catch (error) {
    if (error instanceof WarehouseNotFoundError) {
      return apiError("WAREHOUSE_NOT_FOUND", error.message, 404);
    }
    if (error instanceof InventoryProductInvalidError) {
      return apiError("REORDER_PRODUCT_INVALID", error.message, 400);
    }
    throw error;
  }
}
