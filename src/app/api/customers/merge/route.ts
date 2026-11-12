import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeStaff } from "@/server/access/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import {
  CustomerMergeConflictError,
  CustomerNotFoundError,
  mergeCustomers,
} from "@/server/customers/service";
import { apiError, hasSameOrigin } from "@/server/http";

export const runtime = "nodejs";

const mergeSchema = z
  .object({
    duplicateCustomerId: z.string().uuid(),
    keepCustomerId: z.string().uuid(),
  })
  .refine(({ duplicateCustomerId, keepCustomerId }) => duplicateCustomerId !== keepCustomerId);

export async function POST(request: NextRequest) {
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
    return apiError("FORBIDDEN", "Anda tidak memiliki izin menggabungkan pelanggan.", 403);
  }
  const body: unknown = await request.json().catch(() => null);
  const parsed = mergeSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("INPUT_INVALID", "Pilih dua pelanggan yang berbeda.", 400);
  }
  try {
    const result = await mergeCustomers(
      parsed.data.duplicateCustomerId,
      parsed.data.keepCustomerId,
      staff.id,
      grant.dataScope,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CustomerNotFoundError) {
      return apiError("CUSTOMER_NOT_FOUND", "Pelanggan tidak ditemukan.", 404);
    }
    if (error instanceof CustomerMergeConflictError) {
      return apiError("CUSTOMER_MERGE_CONFLICT", error.message, 409);
    }
    throw error;
  }
}
