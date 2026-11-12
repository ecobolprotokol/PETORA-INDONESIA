import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "@/server/auth/cookies";
import {
  disableTotp,
  getStaffSession,
  TotpNotEnabledError,
  TotpRateLimitedError,
  TotpRequiredByRoleError,
  TotpVerificationError,
} from "@/server/auth/service";
import { TotpEncryptionKeyError } from "@/server/auth/two-factor";
import { totpDisableSchema } from "@/server/auth/validation";
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
  const parsed = totpDisableSchema.safeParse(body);

  if (!parsed.success) {
    return apiError("INPUT_INVALID", "Kata sandi atau kode autentikator tidak valid.", 400);
  }

  try {
    await disableTotp(staff.id, parsed.data.password, parsed.data.code);
  } catch (error) {
    if (error instanceof TotpNotEnabledError) {
      return apiError("TWO_FACTOR_NOT_ENABLED", error.message, 409);
    }
    if (error instanceof TotpRequiredByRoleError) {
      return apiError("TWO_FACTOR_REQUIRED", error.message, 409);
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

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    ...sessionCookieOptions(),
    expires: new Date(0),
    maxAge: 0,
  });
  return response;
}
