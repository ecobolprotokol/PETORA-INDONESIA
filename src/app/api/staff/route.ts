import { type NextRequest, NextResponse } from "next/server";
import { authorizeStaff } from "@/server/access/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { apiError, hasSameOrigin } from "@/server/http";
import {
  createStaffAccount,
  listStaffUsers,
  StaffEmailConflictError,
} from "@/server/staff/service";
import { createStaffSchema } from "@/server/staff/validation";

export const runtime = "nodejs";

async function getStaff(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return token ? getStaffSession(token) : null;
}

export async function GET(request: NextRequest) {
  const actor = await getStaff(request);

  if (!actor) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }

  if (!(await authorizeStaff(actor, "access.manage"))) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin mengelola akun staf.", 403);
  }

  return NextResponse.json({ staff: await listStaffUsers() });
}

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) {
    return apiError("ORIGIN_INVALID", "Permintaan tidak dapat diverifikasi.", 403);
  }

  const actor = await getStaff(request);

  if (!actor) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }

  if (!(await authorizeStaff(actor, "access.manage"))) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin membuat akun staf.", 403);
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = createStaffSchema.safeParse(body);

  if (!parsed.success) {
    return apiError("INPUT_INVALID", "Periksa kembali nama, email, dan kata sandi staf.", 400);
  }

  try {
    const staff = await createStaffAccount(parsed.data, actor.id);
    return NextResponse.json({ staff }, { status: 201 });
  } catch (error) {
    if (error instanceof StaffEmailConflictError) {
      return apiError("EMAIL_EXISTS", "Email tersebut sudah digunakan.", 409);
    }

    throw error;
  }
}
