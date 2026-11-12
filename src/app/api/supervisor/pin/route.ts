import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { apiError, hasSameOrigin } from "@/server/http";
import {
  getSupervisorPinStatus,
  resetSupervisorPin,
  SupervisorPinAlreadySetError,
  SupervisorPinInvalidError,
  SupervisorPinNotSetError,
  setSupervisorPin,
} from "@/server/supervisor/pin";
import { pinSchema } from "@/server/supervisor/validation";

export const runtime = "nodejs";

async function getAuthorizedStaff(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;

  if (!staff) {
    return {
      staff: null,
      response: apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401),
    };
  }

  return { staff, response: null };
}

export async function GET(request: NextRequest) {
  const { staff, response } = await getAuthorizedStaff(request);
  if (response || !staff) {
    return response;
  }

  try {
    const status = await getSupervisorPinStatus(staff.id);
    return NextResponse.json({ ok: true, data: status });
  } catch (error) {
    if (error instanceof Error) {
      return apiError("SERVER_ERROR", error.message, 500);
    }
    throw error;
  }
}

export async function PATCH(request: NextRequest) {
  if (!hasSameOrigin(request)) {
    return apiError("ORIGIN_INVALID", "Permintaan tidak dapat diverifikasi.", 403);
  }

  const { staff, response } = await getAuthorizedStaff(request);
  if (response || !staff) {
    return response;
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = pinSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("INPUT_INVALID", "Periksa kembali PIN supervisor.", 400);
  }

  try {
    if (parsed.data.reset) {
      await resetSupervisorPin(
        staff.id,
        parsed.data.pin,
        staff.id,
        parsed.data.currentPassword,
        parsed.data.currentPin,
      );
    } else {
      await setSupervisorPin(staff.id, parsed.data.pin, staff.id, parsed.data.currentPassword);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SupervisorPinAlreadySetError) {
      return apiError("PIN_ALREADY_SET", error.message, 409);
    }
    if (error instanceof SupervisorPinInvalidError) {
      return apiError("PIN_INVALID", error.message, 400);
    }
    if (error instanceof SupervisorPinNotSetError) {
      return apiError("PIN_NOT_SET", error.message, 404);
    }
    if (error instanceof Error) {
      return apiError("SERVER_ERROR", error.message, 500);
    }
    throw error;
  }
}
