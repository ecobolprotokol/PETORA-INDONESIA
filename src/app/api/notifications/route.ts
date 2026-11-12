import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { apiError, hasSameOrigin } from "@/server/http";
import { listStaffNotifications, markStaffNotificationRead } from "@/server/notifications/queue";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;
  if (!staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }

  return NextResponse.json({ notifications: await listStaffNotifications(staff.id) });
}

export async function PATCH(request: NextRequest) {
  if (!hasSameOrigin(request)) {
    return apiError("ORIGIN_INVALID", "Permintaan tidak dapat diverifikasi.", 403);
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;
  if (!staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }

  const body: unknown = await request.json().catch(() => null);
  if (
    typeof body !== "object" ||
    body === null ||
    !("notificationId" in body) ||
    typeof body.notificationId !== "string" ||
    !z.string().uuid().safeParse(body.notificationId).success
  ) {
    return apiError("INPUT_INVALID", "Notifikasi tidak valid.", 400);
  }

  const updated = await markStaffNotificationRead(body.notificationId, staff.id);
  if (!updated) {
    return apiError("NOTIFICATION_NOT_FOUND", "Notifikasi tidak ditemukan.", 404);
  }
  return NextResponse.json({ ok: true });
}
