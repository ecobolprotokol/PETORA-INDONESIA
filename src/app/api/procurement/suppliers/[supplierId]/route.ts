import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeStaff } from "@/server/access/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { apiError, hasSameOrigin } from "@/server/http";
import { supplierSchema } from "@/server/inventory/validation";
import { ProcurementReferenceInvalidError, saveSupplier } from "@/server/procurement/service";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ supplierId: string }> },
) {
  if (!hasSameOrigin(request)) {
    return apiError("ORIGIN_INVALID", "Permintaan tidak dapat diverifikasi.", 403);
  }
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;
  if (!staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }
  if (!(await authorizeStaff(staff, "suppliers.manage"))) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin mengelola supplier.", 403);
  }
  const { supplierId } = await context.params;
  const parsedId = z.string().uuid().safeParse(supplierId);
  if (!parsedId.success) {
    return apiError("INPUT_INVALID", "ID supplier tidak valid.", 400);
  }
  const body: unknown = await request.json().catch(() => null);
  const parsed = supplierSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("INPUT_INVALID", "Periksa kembali nama dan informasi supplier.", 400);
  }
  try {
    await saveSupplier(parsed.data, staff.id, parsedId.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ProcurementReferenceInvalidError) {
      return apiError("SUPPLIER_NAME_EXISTS", error.message, 409);
    }
    throw error;
  }
}
