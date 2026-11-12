import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeStaff } from "@/server/access/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { apiError, hasSameOrigin } from "@/server/http";
import {
  getPosSaleContext,
  PosIdempotencyConflictError,
  PosPaymentInvalidError,
  PosSaleInvalidError,
  PosShiftClosedError,
  PosShiftNotFoundError,
  settlePosSale,
} from "@/server/pos/service";
import { settleSaleSchema } from "@/server/pos/validation";

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
  const parsed = settleSaleSchema.safeParse(body);
  if (!parsed.success) return apiError("INPUT_INVALID", "Pembayaran tidak valid.", 400);
  const sale = await getPosSaleContext(saleId);
  if (!sale) return apiError("POS_SALE_NOT_FOUND", "Penjualan tidak ditemukan.", 404);
  if (!(await authorizeStaff(staff, "pos.manage", sale.branchId)))
    return apiError("FORBIDDEN", "Anda tidak memiliki izin mengelola kasir cabang ini.", 403);
  try {
    const updated = await settlePosSale(saleId, parsed.data, staff.id);
    return NextResponse.json({ sale: updated });
  } catch (error) {
    if (error instanceof PosSaleInvalidError || error instanceof PosPaymentInvalidError)
      return apiError("POS_PAYMENT_INVALID", error.message, 409);
    if (error instanceof PosShiftNotFoundError)
      return apiError("POS_SHIFT_NOT_FOUND", error.message, 404);
    if (error instanceof PosShiftClosedError)
      return apiError("POS_SHIFT_CLOSED", error.message, 409);
    if (error instanceof PosIdempotencyConflictError)
      return apiError("POS_IDEMPOTENCY_CONFLICT", error.message, 409);
    throw error;
  }
}
