import { type NextRequest, NextResponse } from "next/server";
import { authorizeStaff } from "@/server/access/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { apiError, hasSameOrigin } from "@/server/http";
import { getBusinessSettings, updateBusinessSettings } from "@/server/settings/service";
import { updateBusinessSettingsSchema } from "@/server/settings/validation";

export const runtime = "nodejs";

async function getAuthorizedStaff(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;

  if (!staff) {
    return {
      staff: null,
      response: apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401),
    };
  }
  if (!(await authorizeStaff(staff, "settings.manage"))) {
    return {
      staff: null,
      response: apiError("FORBIDDEN", "Anda tidak memiliki izin mengubah pengaturan.", 403),
    };
  }

  return { staff, response: null };
}

export async function GET(request: NextRequest) {
  const { staff, response } = await getAuthorizedStaff(request);
  if (response || !staff) {
    return response;
  }

  return NextResponse.json(await getBusinessSettings());
}

export async function PATCH(request: NextRequest) {
  if (!hasSameOrigin(request)) {
    return apiError("ORIGIN_INVALID", "Permintaan tidak dapat diverifikasi.", 403);
  }

  const { staff, response } = await getAuthorizedStaff(request);
  if (response || !staff) {
    return response;
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = updateBusinessSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("INPUT_INVALID", "Periksa kembali profil dan pengaturan bisnis.", 400);
  }

  await updateBusinessSettings(parsed.data, staff.id);
  return NextResponse.json({ ok: true });
}
