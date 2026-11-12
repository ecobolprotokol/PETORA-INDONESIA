import { NextResponse } from "next/server";
import { authorizeStaff } from "@/server/access/service";
import { getCurrentStaff } from "@/server/auth/cookies";
import { apiError } from "@/server/http";
import { listProductCatalogOptions } from "@/server/products/service";

export const runtime = "nodejs";

export async function GET() {
  const staff = await getCurrentStaff();
  if (!staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }
  if (
    !(await authorizeStaff(staff, "products.read")) &&
    !(await authorizeStaff(staff, "products.manage"))
  ) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin melihat referensi produk.", 403);
  }
  return NextResponse.json(await listProductCatalogOptions());
}
