import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeStaff } from "@/server/access/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { apiError, hasSameOrigin } from "@/server/http";
import {
  InventoryBatchConflictError,
  InventoryInsufficientStockError,
  InventoryProductInvalidError,
  WarehouseNotFoundError,
} from "@/server/inventory/service";
import {
  getPosSaleContext,
  PosIdempotencyConflictError,
  PosPaymentInvalidError,
  PosSaleInvalidError,
  PosShiftClosedError,
  PosShiftNotFoundError,
  resumePosSale,
} from "@/server/pos/service";
import { resumeSaleSchema } from "@/server/pos/validation";

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
  const parsed = resumeSaleSchema.safeParse(body);
  if (!parsed.success) return apiError("INPUT_INVALID", "Data penjualan tidak valid.", 400);
  const sale = await getPosSaleContext(saleId);
  if (!sale) return apiError("POS_SALE_NOT_FOUND", "Penjualan tidak ditemukan.", 404);
  if (!(await authorizeStaff(staff, "pos.manage", sale.branchId)))
    return apiError("FORBIDDEN", "Anda tidak memiliki izin mengelola kasir cabang ini.", 403);
  try {
    return NextResponse.json({
      sale: await resumePosSale(saleId, parsed.data, staff.id),
    });
  } catch (error) {
    if (error instanceof PosSaleInvalidError || error instanceof PosPaymentInvalidError)
      return apiError("POS_SALE_INVALID", error.message, 409);
    if (error instanceof PosShiftNotFoundError)
      return apiError("POS_SHIFT_NOT_FOUND", error.message, 404);
    if (error instanceof PosShiftClosedError)
      return apiError("POS_SHIFT_CLOSED", error.message, 409);
    if (
      error instanceof InventoryInsufficientStockError ||
      error instanceof InventoryBatchConflictError
    )
      return apiError("INVENTORY_STOCK_INSUFFICIENT", error.message, 409);
    if (error instanceof InventoryProductInvalidError)
      return apiError("POS_PRODUCT_INVALID", error.message, 400);
    if (error instanceof WarehouseNotFoundError)
      return apiError("POS_WAREHOUSE_NOT_FOUND", error.message, 404);
    if (error instanceof PosIdempotencyConflictError)
      return apiError("POS_IDEMPOTENCY_CONFLICT", error.message, 409);
    throw error;
  }
}
