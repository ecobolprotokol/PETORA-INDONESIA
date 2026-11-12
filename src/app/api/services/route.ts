import { type NextRequest, NextResponse } from "next/server";
import { authorizeStaff } from "@/server/access/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { apiError, hasSameOrigin } from "@/server/http";
import {
  createService,
  listServices,
  ServiceReferenceInvalidError,
} from "@/server/services/service";
import { serviceSchema } from "@/server/services/validation";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;
  if (!staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }
  const grant = await authorizeStaff(staff, "services.read");
  if (!grant) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin melihat katalog layanan.", 403);
  }
  const query = request.nextUrl.searchParams.get("q")?.trim();
  if (query && query.length > 120) {
    return apiError("INPUT_INVALID", "Kata pencarian terlalu panjang.", 400);
  }
  return NextResponse.json({
    services: await listServices(staff.id, grant.dataScope, query),
  });
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
    return apiError("FORBIDDEN", "Anda tidak memiliki izin mengelola layanan.", 403);
  }
  const body: unknown = await request.json().catch(() => null);
  const parsed = serviceSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("INPUT_INVALID", "Periksa kembali layanan dan harganya.", 400);
  }
  try {
    const serviceId = await createService(parsed.data, staff.id);
    return NextResponse.json({ serviceId }, { status: 201 });
  } catch (error) {
    if (error instanceof ServiceReferenceInvalidError) {
      return apiError("SERVICE_REFERENCE_INVALID", error.message, 400);
    }
    if (hasUniqueConstraint(error, "services_code_lower_unique")) {
      return apiError("SERVICE_CODE_EXISTS", "Kode layanan sudah digunakan.", 409);
    }
    throw error;
  }
}

function hasUniqueConstraint(error: unknown, constraint: string) {
  const cause =
    typeof error === "object" && error !== null && "cause" in error ? error.cause : error;
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    cause.code === "23505" &&
    "constraint" in cause &&
    cause.constraint === constraint
  );
}
