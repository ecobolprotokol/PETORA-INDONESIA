import { type NextRequest, NextResponse } from "next/server";
import { authorizeStaff, listBranchesForStaff } from "@/server/access/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { BranchCodeConflictError, createBranch } from "@/server/branches/service";
import { branchSchema } from "@/server/branches/validation";
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

  const branches = await listBranchesForStaff(staff);

  if (branches === null) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin melihat cabang.", 403);
  }

  return NextResponse.json({ branches });
}

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) {
    return apiError("ORIGIN_INVALID", "Permintaan tidak dapat diverifikasi.", 403);
  }

  const staff = await getStaff(request);

  if (!staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }

  if (!(await authorizeStaff(staff, "branches.manage"))) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin mengelola cabang.", 403);
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = branchSchema.safeParse(body);

  if (!parsed.success) {
    return apiError("INPUT_INVALID", "Periksa kembali kode, nama, dan zona waktu cabang.", 400);
  }

  try {
    const branch = await createBranch(parsed.data, staff.id);
    return NextResponse.json({ branch }, { status: 201 });
  } catch (error) {
    if (error instanceof BranchCodeConflictError) {
      return apiError("BRANCH_CODE_EXISTS", "Kode cabang sudah digunakan.", 409);
    }

    throw error;
  }
}
