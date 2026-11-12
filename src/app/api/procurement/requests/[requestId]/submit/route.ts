import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeStaff } from "@/server/access/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { apiError, hasSameOrigin } from "@/server/http";
import {
  getPurchaseRequestBranch,
  ProcurementStatusError,
  submitPurchaseRequest,
} from "@/server/procurement/service";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> },
) {
  if (!hasSameOrigin(request)) {
    return apiError("ORIGIN_INVALID", "Permintaan tidak dapat diverifikasi.", 403);
  }
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;
  if (!staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }
  const { requestId } = await context.params;
  const parsedId = z.string().uuid().safeParse(requestId);
  if (!parsedId.success) {
    return apiError("INPUT_INVALID", "ID permintaan tidak valid.", 400);
  }
  const purchaseRequest = await getPurchaseRequestBranch(parsedId.data);
  if (!purchaseRequest) {
    return apiError("PURCHASE_REQUEST_NOT_FOUND", "Permintaan pembelian tidak ditemukan.", 404);
  }
  if (!(await authorizeStaff(staff, "procurement.manage", purchaseRequest.branchId))) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin mengirim permintaan pembelian.", 403);
  }
  try {
    await submitPurchaseRequest(purchaseRequest.id, staff.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ProcurementStatusError) {
      return apiError("PURCHASE_REQUEST_STATUS_INVALID", error.message, 409);
    }
    throw error;
  }
}
