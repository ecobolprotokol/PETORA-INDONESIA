import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeStaff } from "@/server/access/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { apiError } from "@/server/http";
import { getWarehouseBranchId, listInventoryCard } from "@/server/inventory/service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;
  if (!staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }
  const warehouseId = z.string().uuid().safeParse(request.nextUrl.searchParams.get("warehouseId"));
  const productId = z.string().uuid().safeParse(request.nextUrl.searchParams.get("productId"));
  if (!warehouseId.success || !productId.success) {
    return apiError("INPUT_INVALID", "Gudang atau produk tidak valid.", 400);
  }
  const warehouse = await getWarehouseBranchId(warehouseId.data);
  if (!warehouse) {
    return apiError("WAREHOUSE_NOT_FOUND", "Gudang tidak ditemukan atau tidak aktif.", 404);
  }
  const [readGrant, manageGrant, costGrant] = await Promise.all([
    authorizeStaff(staff, "inventory.read", warehouse.branchId),
    authorizeStaff(staff, "inventory.manage", warehouse.branchId),
    authorizeStaff(staff, "inventory.cost.read", warehouse.branchId),
  ]);
  if (!readGrant && !manageGrant) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin melihat kartu stok cabang ini.", 403);
  }
  return NextResponse.json({
    movements: await listInventoryCard(warehouse.id, productId.data, costGrant !== null, staff.id),
  });
}
