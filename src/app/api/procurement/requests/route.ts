import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeStaff } from "@/server/access/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { apiError, hasSameOrigin } from "@/server/http";
import { purchaseRequestSchema } from "@/server/inventory/validation";
import { createPurchaseRequest, listPurchaseRequests } from "@/server/procurement/service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;
  if (!staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }
  const branchId = z.string().uuid().safeParse(request.nextUrl.searchParams.get("branchId"));
  if (!branchId.success) {
    return apiError("INPUT_INVALID", "Cabang permintaan tidak valid.", 400);
  }
  if (!(await authorizeStaff(staff, "procurement.read", branchId.data))) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin melihat permintaan pembelian.", 403);
  }
  return NextResponse.json({ requests: await listPurchaseRequests(branchId.data) });
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
  const parsed = purchaseRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("INPUT_INVALID", "Periksa kembali cabang, barang, dan jumlah permintaan.", 400);
  }
  if (!(await authorizeStaff(staff, "procurement.manage", parsed.data.branchId))) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin membuat permintaan pembelian.", 403);
  }
  const requestRecord = await createPurchaseRequest(parsed.data, staff.id);
  return NextResponse.json({ request: requestRecord }, { status: 201 });
}
