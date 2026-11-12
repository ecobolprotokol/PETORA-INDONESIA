import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeStaff } from "@/server/access/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { apiError, hasSameOrigin } from "@/server/http";
import { InventoryProductInvalidError } from "@/server/inventory/service";
import { purchaseOrderSchema } from "@/server/inventory/validation";
import {
  createPurchaseOrder,
  listPurchaseOrders,
  ProcurementReferenceInvalidError,
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
    return apiError("INPUT_INVALID", "Cabang pesanan tidak valid.", 400);
  }
  const [readGrant, costGrant] = await Promise.all([
    authorizeStaff(staff, "procurement.read", branchId.data),
    authorizeStaff(staff, "procurement.cost.read", branchId.data),
  ]);
  if (!readGrant) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin melihat pesanan cabang ini.", 403);
  }
  return NextResponse.json({
    orders: await listPurchaseOrders(branchId.data, costGrant !== null),
  });
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
  const parsed = purchaseOrderSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "INPUT_INVALID",
      "Periksa kembali pesanan, gudang, supplier, dan biayanya.",
      400,
    );
  }
  if (!(await authorizeStaff(staff, "procurement.manage", parsed.data.branchId))) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin membuat pesanan pembelian.", 403);
  }
  try {
    const order = await createPurchaseOrder(parsed.data, staff.id);
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    if (
      error instanceof ProcurementReferenceInvalidError ||
      error instanceof InventoryProductInvalidError
    ) {
      return apiError("PURCHASE_ORDER_REFERENCE_INVALID", error.message, 400);
    }
    throw error;
  }
}
