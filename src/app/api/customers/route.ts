import { type NextRequest, NextResponse } from "next/server";
import { authorizeStaff } from "@/server/access/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { createCustomer, listCustomers } from "@/server/customers/service";
import { customerSchema } from "@/server/customers/validation";
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

  const grant = await authorizeStaff(staff, "customers.read");
  if (!grant) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin melihat pelanggan.", 403);
  }

  const customers = await listCustomers(staff.id, grant.dataScope);
  return NextResponse.json({
    customers: customers.map(({ createdBy: _createdBy, ...customer }) => customer),
  });
}

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) {
    return apiError("ORIGIN_INVALID", "Permintaan tidak dapat diverifikasi.", 403);
  }

  const staff = await getStaff(request);
  if (!staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }

  if (!(await authorizeStaff(staff, "customers.manage"))) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin mengelola pelanggan.", 403);
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

  const customer = await createCustomer(parsed.data, staff.id);
  return NextResponse.json({ customer }, { status: 201 });
}
