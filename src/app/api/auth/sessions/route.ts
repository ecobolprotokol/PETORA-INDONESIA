import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "@/server/auth/cookies";
import { getStaffSession, listStaffSessions, revokeStaffSessionById } from "@/server/auth/service";
import { apiError, hasSameOrigin } from "@/server/http";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;

  if (!token || !staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }

  return NextResponse.json({ sessions: await listStaffSessions(staff.id, token) });
}

export async function DELETE(request: NextRequest) {
  if (!hasSameOrigin(request)) {
    return apiError("ORIGIN_INVALID", "Permintaan tidak dapat diverifikasi.", 403);
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;

  if (!token || !staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = z.object({ sessionId: z.string().uuid() }).safeParse(body);

  if (!parsed.success) {
    return apiError("INPUT_INVALID", "ID perangkat tidak valid.", 400);
  }

  const result = await revokeStaffSessionById(staff.id, parsed.data.sessionId, token);

  if (!result.revoked) {
    return apiError("SESSION_NOT_FOUND", "Sesi aktif tidak ditemukan.", 404);
  }

  const response = NextResponse.json({ ok: true });

  if (result.isCurrent) {
    response.cookies.set(SESSION_COOKIE_NAME, "", {
      ...sessionCookieOptions(),
      expires: new Date(0),
      maxAge: 0,
    });
  }

  return response;
}
