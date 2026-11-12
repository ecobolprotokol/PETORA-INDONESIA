import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeStaff } from "@/server/access/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { apiError } from "@/server/http";
import { getWarehouseBranchId, listInventoryReports } from "@/server/inventory/service";

export const runtime = "nodejs";

const daysSchema = z.coerce.number().int().min(1).max(3650).default(90);

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;
  if (!staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }
  const warehouseId = z.string().uuid().safeParse(request.nextUrl.searchParams.get("warehouseId"));
  const expiryDays = daysSchema.safeParse(request.nextUrl.searchParams.get("expiryDays") ?? 90);
  const slowDays = daysSchema.safeParse(request.nextUrl.searchParams.get("slowDays") ?? 90);
  if (!warehouseId.success || !expiryDays.success || !slowDays.success) {
    return apiError("INPUT_INVALID", "Gudang atau rentang hari laporan tidak valid.", 400);
  }
  const warehouse = await getWarehouseBranchId(warehouseId.data);
  if (!warehouse) {
    return apiError("WAREHOUSE_NOT_FOUND", "Gudang tidak ditemukan atau tidak aktif.", 404);
  }
  const [readGrant, manageGrant, adjustGrant] = await Promise.all([
    authorizeStaff(staff, "inventory.read", warehouse.branchId),
    authorizeStaff(staff, "inventory.manage", warehouse.branchId),
    authorizeStaff(staff, "inventory.adjust", warehouse.branchId),
  ]);
  if (!readGrant && !manageGrant && !adjustGrant) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin melihat laporan stok cabang ini.", 403);
  }
  const reports = await listInventoryReports(
    warehouse.id,
    warehouse.timezone,
    expiryDays.data,
    slowDays.data,
    staff.id,
  );
  return NextResponse.json({ reports });
}
