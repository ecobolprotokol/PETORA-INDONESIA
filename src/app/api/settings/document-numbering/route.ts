import { type NextRequest, NextResponse } from "next/server";
import { authorizeStaff } from "@/server/access/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { apiError, hasSameOrigin } from "@/server/http";
import {
  DocumentSequenceConflictError,
  SettingsBranchNotFoundError,
  updateDocumentNumberSequence,
} from "@/server/settings/service";
import { updateDocumentSequenceSchema } from "@/server/settings/validation";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest) {
  if (!hasSameOrigin(request)) {
    return apiError("ORIGIN_INVALID", "Permintaan tidak dapat diverifikasi.", 403);
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;
  if (!staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }
  if (!(await authorizeStaff(staff, "settings.manage"))) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin mengubah penomoran.", 403);
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = updateDocumentSequenceSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("INPUT_INVALID", "Periksa kembali jenis dokumen dan format nomornya.", 400);
  }

  try {
    const sequence = await updateDocumentNumberSequence(parsed.data, staff.id);
    return NextResponse.json({ sequence });
  } catch (error) {
    if (error instanceof SettingsBranchNotFoundError) {
      return apiError("BRANCH_NOT_FOUND", error.message, 404);
    }
    if (error instanceof DocumentSequenceConflictError) {
      return apiError("SEQUENCE_CONFLICT", error.message, 409);
    }
    throw error;
  }
}
