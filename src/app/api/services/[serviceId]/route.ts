import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeStaff } from "@/server/access/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { apiError, hasSameOrigin } from "@/server/http";
import {
  ServiceNotFoundError,
  ServiceReferenceInvalidError,
  updateService,
} from "@/server/services/service";
import { serviceSchema } from "@/server/services/validation";

export const runtime = "nodejs";

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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ serviceId: string }> },
) {
  if (!hasSameOrigin(request)) {
    return apiError("ORIGIN_INVALID", "Permintaan tidak dapat diverifikasi.", 403);
  }
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;
  if (!staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }
  const grant = await authorizeStaff(staff, "services.manage");
  if (!grant) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin mengelola layanan.", 403);
  }
  const { serviceId } = await context.params;
  const parsedId = z.string().uuid().safeParse(serviceId);
  if (!parsedId.success) {
    return apiError("INPUT_INVALID", "ID layanan tidak valid.", 400);
  }
  const body: unknown = await request.json().catch(() => null);
  const parsed = serviceSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("INPUT_INVALID", "Periksa kembali layanan dan harganya.", 400);
  }
  try {
    await updateService(parsedId.data, parsed.data, staff.id, grant.dataScope);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ServiceNotFoundError) {
      return apiError("SERVICE_NOT_FOUND", "Layanan tidak ditemukan.", 404);
    }
    if (error instanceof ServiceReferenceInvalidError) {
      return apiError("SERVICE_REFERENCE_INVALID", error.message, 400);
    }
    if (hasUniqueConstraint(error, "services_code_lower_unique")) {
      return apiError("SERVICE_CODE_EXISTS", "Kode layanan sudah digunakan.", 409);
    }
    throw error;
  }
}
