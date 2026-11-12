import { type NextRequest, NextResponse } from "next/server";
import { authorizeStaff } from "@/server/access/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { apiError, hasSameOrigin } from "@/server/http";
import { createUnit, ProductReferenceInvalidError } from "@/server/products/service";
import { unitSchema } from "@/server/products/validation";

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
  if (!(await authorizeStaff(staff, "products.manage"))) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin mengelola satuan.", 403);
  }
  const body: unknown = await request.json().catch(() => null);
  const parsed = unitSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "INPUT_INVALID",
      "Nama, singkatan, dimensi, dan konversi satuan harus valid.",
      400,
    );
  }
  try {
    const unit = await createUnit(parsed.data, staff.id);
    return NextResponse.json({ unit }, { status: 201 });
  } catch (error) {
    if (error instanceof ProductReferenceInvalidError) {
      return apiError("UNIT_BASE_INVALID", error.message, 400);
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "cause" in error &&
      typeof error.cause === "object" &&
      error.cause !== null &&
      "constraint" in error.cause &&
      error.cause.constraint === "units_abbreviation_lower_unique"
    ) {
      return apiError("UNIT_EXISTS", "Singkatan satuan tersebut sudah digunakan.", 409);
    }
    throw error;
  }
}
