import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeStaff } from "@/server/access/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { apiError, hasSameOrigin } from "@/server/http";
import {
  OwnerAccountProtectedError,
  StaffAccountNotFoundError,
  StaffEmailConflictError,
  updateStaffAccount,
} from "@/server/staff/service";
import { updateStaffSchema } from "@/server/staff/validation";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ staffUserId: string }> },
) {
  if (!hasSameOrigin(request)) {
    return apiError("ORIGIN_INVALID", "Permintaan tidak dapat diverifikasi.", 403);
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const actor = token ? await getStaffSession(token) : null;

  if (!actor) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }

  if (!(await authorizeStaff(actor, "access.manage"))) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin mengelola akun staf.", 403);
  }

  const { staffUserId } = await context.params;
  const parsedStaffUserId = z.string().uuid().safeParse(staffUserId);

  if (!parsedStaffUserId.success) {
    return apiError("INPUT_INVALID", "ID staf tidak valid.", 400);
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = updateStaffSchema.safeParse(body);

  if (!parsed.success) {
    return apiError("INPUT_INVALID", "Periksa kembali perubahan akun staf.", 400);
  }

  try {
    const staff = await updateStaffAccount(parsedStaffUserId.data, parsed.data, actor.id);
    return NextResponse.json({ staff });
  } catch (error) {
    if (error instanceof StaffAccountNotFoundError) {
      return apiError("STAFF_NOT_FOUND", "Akun staf tidak ditemukan.", 404);
    }

    if (error instanceof StaffEmailConflictError) {
      return apiError("EMAIL_EXISTS", "Email tersebut sudah digunakan.", 409);
    }

    if (error instanceof OwnerAccountProtectedError) {
      return apiError("OWNER_PROTECTED", "Akun Owner tidak dapat dinonaktifkan.", 409);
    }

    throw error;
  }
}
