import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeStaff } from "@/server/access/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { apiError, hasSameOrigin } from "@/server/http";
import { supplierSchema } from "@/server/inventory/validation";
import {
  listSuppliers,
  ProcurementReferenceInvalidError,
  saveSupplier,
} from "@/server/procurement/service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;
  if (!staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }
  const branchId = z.string().uuid().safeParse(request.nextUrl.searchParams.get("branchId"));
  if (!branchId.success) {
    return apiError("INPUT_INVALID", "Cabang pengadaan tidak valid.", 400);
  }
  const [readGrant, manageGrant, supplierManageGrant] = await Promise.all([
    authorizeStaff(staff, "procurement.read", branchId.data),
    authorizeStaff(staff, "procurement.manage", branchId.data),
    authorizeStaff(staff, "suppliers.manage"),
  ]);
  if (!readGrant && !manageGrant && !supplierManageGrant) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin melihat supplier.", 403);
  }
  return NextResponse.json({ suppliers: await listSuppliers() });
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
  if (!(await authorizeStaff(staff, "suppliers.manage"))) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin mengelola supplier.", 403);
  }
  const body: unknown = await request.json().catch(() => null);
  const parsed = supplierSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("INPUT_INVALID", "Periksa kembali nama dan informasi supplier.", 400);
  }
  try {
    const supplierId = await saveSupplier(parsed.data, staff.id);
    return NextResponse.json({ supplierId }, { status: 201 });
  } catch (error) {
    if (error instanceof ProcurementReferenceInvalidError) {
      return apiError("SUPPLIER_NAME_EXISTS", error.message, 409);
    }
    throw error;
  }
}
