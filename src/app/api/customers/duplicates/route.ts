import { type NextRequest, NextResponse } from "next/server";
import { authorizeStaff } from "@/server/access/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { findPotentialCustomerDuplicates } from "@/server/customers/service";
import { customerSchema } from "@/server/customers/validation";
import { apiError } from "@/server/http";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;
  if (!staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }
  const grant = await authorizeStaff(staff, "customers.manage");
  if (!grant) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin memeriksa duplikasi pelanggan.", 403);
  }
  const params = request.nextUrl.searchParams;
  const parsed = customerSchema.safeParse({
    name: params.get("name"),
    phone: params.get("phone"),
    email: params.get("email"),
  });
  if (!parsed.success) {
    return apiError("INPUT_INVALID", "Nama dan nomor telepon harus valid.", 400);
  }
  const customers = await findPotentialCustomerDuplicates(
    parsed.data.name,
    parsed.data.phone,
    parsed.data.email ?? null,
    staff.id,
    grant.dataScope,
  );
  return NextResponse.json({
    customers: customers.map(({ id, name, phone }) => ({ id, name, phone })),
  });
}
