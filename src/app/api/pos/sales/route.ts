import { type NextRequest, NextResponse } from "next/server";
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
  createPosSale,
  getPosShiftContext,
  PosDiscountApprovalRequiredError,
  PosIdempotencyConflictError,
  PosPaymentInvalidError,
  PosSaleInvalidError,
  PosShiftClosedError,
  PosShiftNotFoundError,
} from "@/server/pos/service";
import { createSaleSchema } from "@/server/pos/validation";
import { SupervisorPinInvalidError, SupervisorPinNotSetError } from "@/server/supervisor/pin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request))
    return apiError("ORIGIN_INVALID", "Permintaan tidak dapat diverifikasi.", 403);
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;
  if (!staff) return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  const body: unknown = await request.json().catch(() => null);
  const parsed = createSaleSchema.safeParse(body);
  if (!parsed.success)
    return apiError("INPUT_INVALID", "Periksa kembali item, diskon, dan pembayaran.", 400);
  const shift = await getPosShiftContext(parsed.data.shiftId);
  if (!shift) return apiError("POS_SHIFT_NOT_FOUND", "Shift kasir tidak ditemukan.", 404);
  const grant = await authorizeStaff(staff, "pos.manage", shift.branchId);
  if (!grant)
    return apiError(
      "FORBIDDEN",
      "Anda tidak memiliki izin membuat penjualan pada cabang ini.",
      403,
    );
  try {
    const sale = await createPosSale(parsed.data, staff.id, grant);
    return NextResponse.json({ sale }, { status: 201 });
  } catch (error) {
    if (error instanceof PosShiftNotFoundError)
      return apiError("POS_SHIFT_NOT_FOUND", error.message, 404);
    if (error instanceof PosShiftClosedError)
      return apiError("POS_SHIFT_CLOSED", error.message, 409);
    if (error instanceof PosSaleInvalidError)
      return apiError("POS_SALE_INVALID", error.message, 400);
    if (error instanceof InventoryProductInvalidError)
      return apiError("POS_PRODUCT_INVALID", error.message, 400);
    if (error instanceof WarehouseNotFoundError)
      return apiError("POS_WAREHOUSE_NOT_FOUND", error.message, 404);
    if (error instanceof PosPaymentInvalidError)
      return apiError("POS_PAYMENT_INVALID", error.message, 400);
    if (error instanceof InventoryInsufficientStockError)
      return apiError("INVENTORY_STOCK_INSUFFICIENT", error.message, 409);
    if (error instanceof InventoryBatchConflictError)
      return apiError("INVENTORY_BATCH_CONFLICT", error.message, 409);
    if (error instanceof PosDiscountApprovalRequiredError)
      return apiError("POS_DISCOUNT_PIN_REQUIRED", error.message, 403);
    if (error instanceof SupervisorPinInvalidError || error instanceof SupervisorPinNotSetError) {
      return apiError("SUPERVISOR_PIN_INVALID", error.message, 403);
    }
    if (error instanceof PosIdempotencyConflictError)
      return apiError("POS_IDEMPOTENCY_CONFLICT", error.message, 409);
    throw error;
  }
}
