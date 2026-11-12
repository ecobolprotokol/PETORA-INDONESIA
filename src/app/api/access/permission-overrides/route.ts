import { type NextRequest, NextResponse } from "next/server";
import {
  AccessBranchNotFoundError,
  authorizeStaff,
  listPermissionOverrides,
  PermissionOverrideConflictError,
  StaffNotAssignableError,
  setPermissionOverride,
} from "@/server/access/service";
import { permissionOverrideSchema } from "@/server/access/validation";
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
    return apiError("FORBIDDEN", "Anda tidak memiliki izin mengelola pengecualian izin.", 403);
  }

  return NextResponse.json({ overrides: await listPermissionOverrides() });
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
    return apiError("FORBIDDEN", "Anda tidak memiliki izin mengelola pengecualian izin.", 403);
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = permissionOverrideSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("INPUT_INVALID", "Periksa kembali staf, izin, cabang, dan alasannya.", 400);
  }

  try {
    const override = await setPermissionOverride(parsed.data, staff.id);
    return NextResponse.json({ override }, { status: 201 });
  } catch (error) {
    if (error instanceof AccessBranchNotFoundError) {
      return apiError("BRANCH_NOT_FOUND", "Cabang tidak ditemukan atau tidak aktif.", 404);
    }
    if (error instanceof StaffNotAssignableError) {
      return apiError("STAFF_NOT_ASSIGNABLE", error.message, 409);
    }
    if (error instanceof PermissionOverrideConflictError) {
      return apiError("OVERRIDE_CONFLICT", error.message, 409);
    }
    throw error;
  }
}
