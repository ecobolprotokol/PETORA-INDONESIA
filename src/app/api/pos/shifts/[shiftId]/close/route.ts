import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeStaff } from "@/server/access/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { apiError, hasSameOrigin } from "@/server/http";
import {
  closePosShift,
  getPosShiftContext,
  PosShiftClosedError,
  PosShiftNotFoundError,
} from "@/server/pos/service";
import { closeShiftSchema } from "@/server/pos/validation";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ shiftId: string }> },
) {
  if (!hasSameOrigin(request))
    return apiError("ORIGIN_INVALID", "Permintaan tidak dapat diverifikasi.", 403);
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;
  if (!staff) return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  const { shiftId } = await context.params;
  if (!z.string().uuid().safeParse(shiftId).success)
    return apiError("INPUT_INVALID", "Shift tidak valid.", 400);
  const body: unknown = await request.json().catch(() => null);
  const parsed = closeShiftSchema.safeParse(body);
  if (!parsed.success)
    return apiError("INPUT_INVALID", "Kas akhir atau catatan penutupan tidak valid.", 400);
  const shift = await getPosShiftContext(shiftId);
  if (!shift) return apiError("POS_SHIFT_NOT_FOUND", "Shift kasir tidak ditemukan.", 404);
  const grant = await authorizeStaff(staff, "pos.manage", shift.branchId);
  if (!grant)
    return apiError("FORBIDDEN", "Anda tidak memiliki izin menutup shift cabang ini.", 403);
  try {
    return NextResponse.json({
      shift: await closePosShift(
        shiftId,
        staff.id,
        parsed.data.closingCashCents,
        parsed.data.notes ?? null,
      ),
    });
  } catch (error) {
    if (error instanceof PosShiftNotFoundError)
      return apiError("POS_SHIFT_NOT_FOUND", error.message, 404);
    if (error instanceof PosShiftClosedError)
      return apiError("POS_SHIFT_CLOSED", error.message, 409);
    throw error;
  }
}
