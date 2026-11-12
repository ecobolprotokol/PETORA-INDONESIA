import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  AccessRoleNotFoundError,
  authorizeStaff,
  RoleNameConflictError,
  RoleTwoFactorConflictError,
  updateAccessRole,
} from "@/server/access/service";
import { updateRoleSchema } from "@/server/access/validation";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { apiError, hasSameOrigin } from "@/server/http";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ roleId: string }> },
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
    return apiError("FORBIDDEN", "Anda tidak memiliki izin mengubah peran.", 403);
  }

  const { roleId } = await context.params;
  const parsedRoleId = z.string().uuid().safeParse(roleId);
  if (!parsedRoleId.success) {
    return apiError("INPUT_INVALID", "ID peran tidak valid.", 400);
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = updateRoleSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("INPUT_INVALID", "Periksa kembali nama peran dan daftar izinnya.", 400);
  }

  try {
    const role = await updateAccessRole(parsedRoleId.data, parsed.data, staff.id);
    return NextResponse.json({ role });
  } catch (error) {
    if (error instanceof AccessRoleNotFoundError) {
      return apiError("ROLE_NOT_FOUND", "Peran tidak ditemukan.", 404);
    }
    if (error instanceof RoleNameConflictError) {
      return apiError("ROLE_NAME_EXISTS", "Nama peran sudah digunakan.", 409);
    }
    if (error instanceof RoleTwoFactorConflictError) {
      return apiError("TWO_FACTOR_REQUIRED", error.message, 409);
    }
    throw error;
  }
}
