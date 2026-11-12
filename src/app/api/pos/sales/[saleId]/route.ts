import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeStaff } from "@/server/access/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { apiError } from "@/server/http";
import { getPosSaleContext, getPosSaleReceipt } from "@/server/pos/service";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ saleId: string }> }) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;
  if (!staff) return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  const { saleId } = await context.params;
  if (!z.string().uuid().safeParse(saleId).success)
    return apiError("INPUT_INVALID", "Penjualan tidak valid.", 400);
  const sale = await getPosSaleContext(saleId);
  if (!sale) return apiError("POS_SALE_NOT_FOUND", "Penjualan tidak ditemukan.", 404);
  const [readGrant, manageGrant, refundGrant] = await Promise.all([
    authorizeStaff(staff, "pos.read", sale.branchId),
    authorizeStaff(staff, "pos.manage", sale.branchId),
    authorizeStaff(staff, "pos.refund", sale.branchId),
  ]);
  if (!readGrant && !manageGrant && !refundGrant)
    return apiError("FORBIDDEN", "Anda tidak memiliki izin melihat penjualan ini.", 403);
  const receipt = await getPosSaleReceipt(saleId);
  if (!receipt) return apiError("POS_SALE_NOT_FOUND", "Penjualan tidak ditemukan.", 404);
  return NextResponse.json({ sale: receipt });
}
