import { type NextRequest, NextResponse } from "next/server";
import { authorizeStaff } from "@/server/access/service";
import { getCurrentStaff, SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { apiError, hasSameOrigin } from "@/server/http";
import { createServiceCategory, listServiceCategories } from "@/server/services/service";
import { serviceCategorySchema } from "@/server/services/validation";

export const runtime = "nodejs";

export async function GET() {
  const staff = await getCurrentStaff();
  if (!staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }
  if (
    !(await authorizeStaff(staff, "services.read")) &&
    !(await authorizeStaff(staff, "services.manage"))
  ) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin melihat kategori layanan.", 403);
  }
  return NextResponse.json({ categories: await listServiceCategories() });
}

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) {
    return apiError("ORIGIN_INVALID", "Permintaan tidak dapat diverifikasi.", 403);
  }
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;
  if (!staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }
  if (!(await authorizeStaff(staff, "services.manage"))) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin mengelola kategori layanan.", 403);
  }
  const body: unknown = await request.json().catch(() => null);
  const parsed = serviceCategorySchema.safeParse(body);
  if (!parsed.success) {
    return apiError("INPUT_INVALID", "Nama kategori layanan tidak valid.", 400);
  }
  try {
    const category = await createServiceCategory(parsed.data.name, staff.id);
    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "cause" in error &&
      typeof error.cause === "object" &&
      error.cause !== null &&
      "constraint" in error.cause &&
      error.cause.constraint === "service_categories_name_lower_unique"
    ) {
      return apiError("SERVICE_CATEGORY_EXISTS", "Kategori layanan sudah ada.", 409);
    }
    throw error;
  }
}
