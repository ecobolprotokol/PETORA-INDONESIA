import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeStaff } from "@/server/access/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { CustomerNotFoundError, updateCustomer } from "@/server/customers/service";
import { customerSchema } from "@/server/customers/validation";
import { apiError, hasSameOrigin } from "@/server/http";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ customerId: string }> },
) {
  if (!hasSameOrigin(request)) {
    return apiError("ORIGIN_INVALID", "Permintaan tidak dapat diverifikasi.", 403);
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;
  if (!staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }

  const grant = await authorizeStaff(staff, "customers.manage");
  if (!grant) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin mengelola pelanggan.", 403);
  }

  const { customerId } = await context.params;
  const parsedCustomerId = z.string().uuid().safeParse(customerId);
  if (!parsedCustomerId.success) {
    return apiError("INPUT_INVALID", "ID pelanggan tidak valid.", 400);
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = customerSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "INPUT_INVALID",
      "Periksa kembali nama, nomor telepon, dan email pelanggan.",
      400,
    );
  }

  try {
    const customer = await updateCustomer(
      parsedCustomerId.data,
      parsed.data,
      staff.id,
      grant.dataScope,
    );
    return NextResponse.json({ customer });
  } catch (error) {
    if (error instanceof CustomerNotFoundError) {
      return apiError("CUSTOMER_NOT_FOUND", "Pelanggan tidak ditemukan.", 404);
    }

    throw error;
  }
}
