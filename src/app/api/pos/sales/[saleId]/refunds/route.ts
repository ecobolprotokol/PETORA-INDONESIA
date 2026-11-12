import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeStaff } from "@/server/access/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { apiError, hasSameOrigin } from "@/server/http";
import {
  getPosSaleContext,
  PosIdempotencyConflictError,
  PosRefundApprovalRequiredError,
  PosRefundInvalidError,
  PosShiftClosedError,
  PosShiftNotFoundError,
  refundPosSale,
} from "@/server/pos/service";
import { refundSaleSchema } from "@/server/pos/validation";
import { SupervisorPinInvalidError, SupervisorPinNotSetError } from "@/server/supervisor/pin";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ saleId: string }> }) {
  if (!hasSameOrigin(request))
    return apiError("ORIGIN_INVALID", "Permintaan tidak dapat diverifikasi.", 403);
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;
  if (!staff) return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  const { saleId } = await context.params;
  if (!z.string().uuid().safeParse(saleId).success)
    return apiError("INPUT_INVALID", "Penjualan tidak valid.", 400);
  const body: unknown = await request.json().catch(() => null);
  const parsed = refundSaleSchema.safeParse(body);
  if (!parsed.success) return apiError("INPUT_INVALID", "Data refund tidak valid.", 400);
  const sale = await getPosSaleContext(saleId);
  if (!sale) return apiError("POS_SALE_NOT_FOUND", "Penjualan tidak ditemukan.", 404);
  const grant = await authorizeStaff(staff, "pos.refund", sale.branchId);
  if (!grant)
    return apiError("FORBIDDEN", "Anda tidak memiliki izin memproses refund cabang ini.", 403);
  try {
    return NextResponse.json({
      refund: await refundPosSale(saleId, parsed.data, staff.id, grant),
    });
  } catch (error) {
    if (error instanceof PosRefundInvalidError)
      return apiError("POS_REFUND_INVALID", error.message, 409);
    if (error instanceof PosRefundApprovalRequiredError)
      return apiError("POS_REFUND_PIN_REQUIRED", error.message, 403);
    if (error instanceof SupervisorPinInvalidError || error instanceof SupervisorPinNotSetError)
      return apiError("SUPERVISOR_PIN_INVALID", error.message, 403);
    if (error instanceof PosShiftNotFoundError)
      return apiError("POS_SHIFT_NOT_FOUND", error.message, 404);
    if (error instanceof PosShiftClosedError)
      return apiError("POS_SHIFT_CLOSED", error.message, 409);
    if (error instanceof PosIdempotencyConflictError)
      return apiError("POS_IDEMPOTENCY_CONFLICT", error.message, 409);
    throw error;
  }
}
