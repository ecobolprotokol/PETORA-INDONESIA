import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeStaff } from "@/server/access/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { apiError, hasSameOrigin } from "@/server/http";
import {
  listPosBranchData,
  openPosShift,
  PosShiftConflictError,
  PosShiftNotFoundError,
} from "@/server/pos/service";
import { openShiftSchema } from "@/server/pos/validation";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;
  if (!staff) return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  const branchId = z.string().uuid().safeParse(request.nextUrl.searchParams.get("branchId"));
  if (!branchId.success) return apiError("INPUT_INVALID", "Cabang tidak valid.", 400);
  const [readGrant, manageGrant, refundGrant] = await Promise.all([
    authorizeStaff(staff, "pos.read", branchId.data),
    authorizeStaff(staff, "pos.manage", branchId.data),
    authorizeStaff(staff, "pos.refund", branchId.data),
  ]);
  if (!readGrant && !manageGrant && !refundGrant) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin melihat kasir cabang ini.", 403);
  }
  return NextResponse.json(await listPosBranchData(branchId.data));
}

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request))
    return apiError("ORIGIN_INVALID", "Permintaan tidak dapat diverifikasi.", 403);
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;
  if (!staff) return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  const body: unknown = await request.json().catch(() => null);
  const parsed = openShiftSchema.safeParse(body);
  if (!parsed.success)
    return apiError("INPUT_INVALID", "Cabang, gudang, atau kas awal tidak valid.", 400);
  const grant = await authorizeStaff(staff, "pos.manage", parsed.data.branchId);
  if (!grant)
    return apiError("FORBIDDEN", "Anda tidak memiliki izin membuka shift cabang ini.", 403);
  try {
    const shift = await openPosShift(parsed.data, staff.id);
    return NextResponse.json({ shift }, { status: 201 });
  } catch (error) {
    if (error instanceof PosShiftConflictError)
      return apiError("POS_SHIFT_OPEN", error.message, 409);
    if (error instanceof PosShiftNotFoundError)
      return apiError("WAREHOUSE_NOT_FOUND", error.message, 404);
    throw error;
  }
}
