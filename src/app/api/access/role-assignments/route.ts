import { type NextRequest, NextResponse } from "next/server";
import {
  AccessBranchNotFoundError,
  AccessRoleNotFoundError,
  assignAccessRole,
  authorizeStaff,
  RoleAssignmentConflictError,
  StaffNotAssignableError,
  StaffNotFoundError,
  TwoFactorEnrollmentRequiredError,
} from "@/server/access/service";
import { assignRoleSchema } from "@/server/access/validation";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { apiError, hasSameOrigin } from "@/server/http";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) {
    return apiError("ORIGIN_INVALID", "Permintaan tidak dapat diverifikasi.", 403);
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;

  if (!staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }

  if (!(await authorizeStaff(staff, "access.manage"))) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin menugaskan peran.", 403);
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = assignRoleSchema.safeParse(body);

  if (!parsed.success) {
    return apiError("INPUT_INVALID", "Periksa kembali staf, peran, dan cabang.", 400);
  }

  try {
    const assignment = await assignAccessRole(parsed.data, staff.id);
    return NextResponse.json({ assignment }, { status: 201 });
  } catch (error) {
    if (error instanceof StaffNotFoundError || error instanceof AccessRoleNotFoundError) {
      return apiError("RESOURCE_NOT_FOUND", "Staf atau peran tidak ditemukan.", 404);
    }

    if (error instanceof AccessBranchNotFoundError) {
      return apiError("BRANCH_NOT_FOUND", "Cabang tidak ditemukan atau tidak aktif.", 404);
    }

    if (error instanceof StaffNotAssignableError) {
      return apiError("STAFF_NOT_ASSIGNABLE", "Peran tidak dapat ditugaskan ke akun ini.", 409);
    }

    if (error instanceof TwoFactorEnrollmentRequiredError) {
      return apiError("TWO_FACTOR_REQUIRED", error.message, 409);
    }

    if (error instanceof RoleAssignmentConflictError) {
      return apiError(
        "ROLE_ASSIGNMENT_EXISTS",
        "Peran sudah ditugaskan dalam cakupan tersebut.",
        409,
      );
    }

    throw error;
  }
}
