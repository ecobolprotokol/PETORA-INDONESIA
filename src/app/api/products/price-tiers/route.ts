import { type NextRequest, NextResponse } from "next/server";
import { authorizeStaff } from "@/server/access/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { apiError, hasSameOrigin } from "@/server/http";
import { createPriceTier } from "@/server/products/service";
import { priceTierSchema } from "@/server/products/validation";

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
    return apiError("FORBIDDEN", "Anda tidak memiliki izin mengelola tingkat harga.", 403);
  }
  const body: unknown = await request.json().catch(() => null);
  const parsed = priceTierSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("INPUT_INVALID", "Nama atau keterangan tingkat harga tidak valid.", 400);
  }
  try {
    const priceTier = await createPriceTier(parsed.data.name, parsed.data.description, staff.id);
    return NextResponse.json({ priceTier }, { status: 201 });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "cause" in error &&
      typeof error.cause === "object" &&
      error.cause !== null &&
      "constraint" in error.cause &&
      error.cause.constraint === "price_tiers_name_lower_unique"
    ) {
      return apiError("PRICE_TIER_EXISTS", "Tingkat harga tersebut sudah ada.", 409);
    }
    throw error;
  }
}
