import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { deleteSampleCustomers } from "@/server/customers/service";
import { apiError, hasSameOrigin } from "@/server/http";

export const runtime = "nodejs";

export async function DELETE(request: NextRequest) {
  if (!hasSameOrigin(request)) {
    return apiError("ORIGIN_INVALID", "Permintaan tidak dapat diverifikasi.", 403);
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;
  if (!staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }
  if (!staff.isOwner) {
    return apiError("FORBIDDEN", "Hanya Owner yang dapat menghapus data contoh.", 403);
  }

  const deleted = await deleteSampleCustomers(staff.id);
  return NextResponse.json({ deleted });
}
