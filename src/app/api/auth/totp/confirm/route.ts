import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import {
  confirmTotpEnrollment,
  getStaffSession,
  TotpAlreadyEnabledError,
  TotpEnrollmentExpiredError,
  TotpRateLimitedError,
  TotpVerificationError,
} from "@/server/auth/service";
import { TotpEncryptionKeyError } from "@/server/auth/two-factor";
import { totpEnrollmentConfirmationSchema } from "@/server/auth/validation";
import { apiError, hasSameOrigin } from "@/server/http";

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

  const body: unknown = await request.json().catch(() => null);
  const parsed = totpEnrollmentConfirmationSchema.safeParse(body);

  if (!parsed.success) {
    return apiError("INPUT_INVALID", "Kode autentikator harus terdiri dari enam angka.", 400);
  }

  try {
    const recoveryCodes = await confirmTotpEnrollment(staff.id, parsed.data.code);
    return NextResponse.json({ ok: true, recoveryCodes });
  } catch (error) {
    if (error instanceof TotpAlreadyEnabledError) {
      return apiError("TWO_FACTOR_ALREADY_ENABLED", error.message, 409);
    }
    if (error instanceof TotpEnrollmentExpiredError) {
      return apiError("TWO_FACTOR_ENROLLMENT_EXPIRED", error.message, 410);
    }
    if (error instanceof TotpRateLimitedError) {
      return apiError("TWO_FACTOR_RATE_LIMITED", error.message, 429);
    }
    if (error instanceof TotpVerificationError) {
      return apiError("TWO_FACTOR_INVALID", error.message, 400);
    }
    if (error instanceof TotpEncryptionKeyError) {
      return apiError("TWO_FACTOR_NOT_CONFIGURED", error.message, 503);
    }

    throw error;
  }
}
