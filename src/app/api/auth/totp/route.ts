import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import {
  getStaffSession,
  getTotpStatus,
  startTotpEnrollment,
  TotpAlreadyEnabledError,
} from "@/server/auth/service";
import { TotpEncryptionKeyError } from "@/server/auth/two-factor";
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

  return NextResponse.json(await getTotpStatus(staff.id));
}

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) {
    return apiError("ORIGIN_INVALID", "Permintaan tidak dapat diverifikasi.", 403);
  }

  const staff = await getStaff(request);

  if (!staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }

  try {
    return NextResponse.json(await startTotpEnrollment(staff.id));
  } catch (error) {
    if (error instanceof TotpAlreadyEnabledError) {
      return apiError("TWO_FACTOR_ALREADY_ENABLED", error.message, 409);
    }
    if (error instanceof TotpEncryptionKeyError) {
      return apiError("TWO_FACTOR_NOT_CONFIGURED", error.message, 503);
    }

    throw error;
  }
}
