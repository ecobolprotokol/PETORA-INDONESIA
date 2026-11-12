import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeStaff } from "@/server/access/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { apiError, hasSameOrigin } from "@/server/http";
import {
  createWarehouse,
  InventoryBatchConflictError,
  listWarehouses,
  WarehouseNotFoundError,
} from "@/server/inventory/service";
import { warehouseSchema } from "@/server/inventory/validation";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;
  if (!staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }
  const branchId = z.string().uuid().safeParse(request.nextUrl.searchParams.get("branchId"));
  if (!branchId.success) {
    return apiError("INPUT_INVALID", "Cabang gudang tidak valid.", 400);
  }
  const [
    readGrant,
    manageGrant,
    adjustGrant,
    transferGrant,
    approveGrant,
    procurementReadGrant,
    procurementManageGrant,
  ] = await Promise.all([
    authorizeStaff(staff, "inventory.read", branchId.data),
    authorizeStaff(staff, "inventory.manage", branchId.data),
    authorizeStaff(staff, "inventory.adjust", branchId.data),
    authorizeStaff(staff, "inventory.transfer", branchId.data),
    authorizeStaff(staff, "inventory.approve", branchId.data),
    authorizeStaff(staff, "procurement.read", branchId.data),
    authorizeStaff(staff, "procurement.manage", branchId.data),
  ]);
  if (
    !readGrant &&
    !manageGrant &&
    !adjustGrant &&
    !transferGrant &&
    !approveGrant &&
    !procurementReadGrant &&
    !procurementManageGrant
  ) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin melihat gudang cabang ini.", 403);
  }
  return NextResponse.json({ warehouses: await listWarehouses(branchId.data) });
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
  const parsed = warehouseSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("INPUT_INVALID", "Periksa kembali cabang, kode, dan nama gudang.", 400);
  }
  if (!(await authorizeStaff(staff, "inventory.manage", parsed.data.branchId))) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin mengelola gudang cabang ini.", 403);
  }
  try {
    const warehouse = await createWarehouse(parsed.data, staff.id);
    return NextResponse.json({ warehouse }, { status: 201 });
  } catch (error) {
    if (error instanceof WarehouseNotFoundError) {
      return apiError("WAREHOUSE_BRANCH_INVALID", error.message, 400);
    }
    if (error instanceof InventoryBatchConflictError) {
      return apiError("WAREHOUSE_CODE_EXISTS", error.message, 409);
    }
    throw error;
  }
}
