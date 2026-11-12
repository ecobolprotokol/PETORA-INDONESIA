import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  authorizeStaff,
  PermissionOverrideNotFoundError,
  removePermissionOverride,
} from "@/server/access/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { apiError, hasSameOrigin } from "@/server/http";

export const runtime = "nodejs";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ overrideId: string }> },
) {
  if (!hasSameOrigin(request)) {
    return apiError("ORIGIN_INVALID", "Permintaan tidak dapat diverifikasi.", 403);
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;
  if (!staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }
  if (!(await authorizeStaff(staff, "access.manage"))) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin mengelola pengecualian izin.", 403);
  }

  const { overrideId } = await context.params;
  const parsedId = z.string().uuid().safeParse(overrideId);
  if (!parsedId.success) {
    return apiError("INPUT_INVALID", "ID pengecualian izin tidak valid.", 400);
  }

  try {
    await removePermissionOverride(parsedId.data, staff.id);
    return NextResponse.json({ removed: true });
  } catch (error) {
    if (error instanceof PermissionOverrideNotFoundError) {
      return apiError("OVERRIDE_NOT_FOUND", "Pengecualian izin tidak ditemukan.", 404);
    }
    throw error;
  }
}
