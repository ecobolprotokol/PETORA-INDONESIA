import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeStaff } from "@/server/access/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { apiError, hasSameOrigin } from "@/server/http";
import {
  getPurchaseOrderBranch,
  ProcurementStatusError,
  submitPurchaseOrder,
} from "@/server/procurement/service";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> },
) {
  if (!hasSameOrigin(request)) {
    return apiError("ORIGIN_INVALID", "Permintaan tidak dapat diverifikasi.", 403);
  }
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;
  if (!staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }
  const { orderId } = await context.params;
  const parsedId = z.string().uuid().safeParse(orderId);
  if (!parsedId.success) {
    return apiError("INPUT_INVALID", "ID pesanan tidak valid.", 400);
  }
  const order = await getPurchaseOrderBranch(parsedId.data);
  if (!order) {
    return apiError("PURCHASE_ORDER_NOT_FOUND", "Pesanan pembelian tidak ditemukan.", 404);
  }
  if (!(await authorizeStaff(staff, "procurement.approve", order.branchId))) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin menerbitkan pesanan ini.", 403);
  }
  try {
    await submitPurchaseOrder(order.id, staff.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ProcurementStatusError) {
      return apiError("PURCHASE_ORDER_STATUS_INVALID", error.message, 409);
    }
    throw error;
  }
}
