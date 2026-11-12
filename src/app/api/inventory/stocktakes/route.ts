import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeStaff } from "@/server/access/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { apiError, hasSameOrigin } from "@/server/http";
import { createStocktake, listStocktakes } from "@/server/inventory/operations";
import { getWarehouseBranchId, InventoryProductInvalidError } from "@/server/inventory/service";
import { stocktakeSchema } from "@/server/inventory/validation";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;
  if (!staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }
  const warehouseId = z.string().uuid().safeParse(request.nextUrl.searchParams.get("warehouseId"));
  if (!warehouseId.success) {
    return apiError("INPUT_INVALID", "Gudang opname tidak valid.", 400);
  }
  const warehouse = await getWarehouseBranchId(warehouseId.data);
  if (!warehouse) {
    return apiError("WAREHOUSE_NOT_FOUND", "Gudang tidak ditemukan atau tidak aktif.", 404);
  }
  const [readGrant, adjustGrant, approveGrant] = await Promise.all([
    authorizeStaff(staff, "inventory.read", warehouse.branchId),
    authorizeStaff(staff, "inventory.adjust", warehouse.branchId),
    authorizeStaff(staff, "inventory.approve", warehouse.branchId),
  ]);
  if (!readGrant && !adjustGrant && !approveGrant) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin melihat sesi opname ini.", 403);
  }
  return NextResponse.json({ stocktakes: await listStocktakes(warehouse.id) });
}

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
  const parsed = stocktakeSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "INPUT_INVALID",
      "Periksa kembali gudang, batch, jumlah, dan alasan opname.",
      400,
    );
  }
  const warehouse = await getWarehouseBranchId(parsed.data.warehouseId);
  if (!warehouse) {
    return apiError("WAREHOUSE_NOT_FOUND", "Gudang tidak ditemukan atau tidak aktif.", 404);
  }
  if (!(await authorizeStaff(staff, "inventory.adjust", warehouse.branchId))) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin membuat sesi opname cabang ini.", 403);
  }
  try {
    const stocktakeId = await createStocktake(parsed.data, staff.id);
    return NextResponse.json({ stocktakeId }, { status: 201 });
  } catch (error) {
    if (error instanceof InventoryProductInvalidError) {
      return apiError("STOCKTAKE_BATCH_INVALID", error.message, 400);
    }
    throw error;
  }
}
