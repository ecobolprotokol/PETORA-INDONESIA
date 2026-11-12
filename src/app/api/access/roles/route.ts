import { type NextRequest, NextResponse } from "next/server";
import {
  authorizeStaff,
  createAccessRole,
  listAccessRoles,
  listPermissionCatalog,
  RoleNameConflictError,
} from "@/server/access/service";
import { createRoleSchema } from "@/server/access/validation";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { apiError, hasSameOrigin } from "@/server/http";

export const runtime = "nodejs";

async function getStaff(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return token ? getStaffSession(token) : null;
}

export async function GET(request: NextRequest) {
  const staff = await getStaff(request);

  if (!staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }

  if (!(await authorizeStaff(staff, "access.manage"))) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin mengelola peran.", 403);
  }

  const [roles, permissions] = await Promise.all([listAccessRoles(), listPermissionCatalog()]);
  return NextResponse.json({ roles, permissions });
}

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) {
    return apiError("ORIGIN_INVALID", "Permintaan tidak dapat diverifikasi.", 403);
  }

  const staff = await getStaff(request);

  if (!staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }

  if (!(await authorizeStaff(staff, "access.manage"))) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin mengelola peran.", 403);
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = createRoleSchema.safeParse(body);

  if (!parsed.success) {
    return apiError("INPUT_INVALID", "Periksa kembali nama peran dan daftar izinnya.", 400);
  }

  try {
    const role = await createAccessRole(parsed.data, staff.id);
    return NextResponse.json({ role }, { status: 201 });
  } catch (error) {
    if (error instanceof RoleNameConflictError) {
      return apiError("ROLE_NAME_EXISTS", "Nama peran sudah digunakan.", 409);
    }
    throw error;
  }
}
