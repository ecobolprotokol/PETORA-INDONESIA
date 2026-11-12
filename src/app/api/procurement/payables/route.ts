import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeStaff } from "@/server/access/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { apiError } from "@/server/http";
import { listSupplierPayables } from "@/server/procurement/service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;
  if (!staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }
  const branchId = z.string().uuid().safeParse(request.nextUrl.searchParams.get("branchId"));
  if (!branchId.success) {
    return apiError("INPUT_INVALID", "Cabang hutang supplier tidak valid.", 400);
  }
  if (!(await authorizeStaff(staff, "procurement.cost.read", branchId.data))) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin melihat saldo hutang supplier.", 403);
  }
  return NextResponse.json({ payables: await listSupplierPayables(branchId.data) });
}
