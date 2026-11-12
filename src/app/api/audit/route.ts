import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeStaff } from "@/server/access/service";
import { listAuditEvents, parseAuditCursor } from "@/server/audit/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { apiError } from "@/server/http";

export const runtime = "nodejs";

const limitSchema = z.coerce.number().int().min(1).max(100);

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;

  if (!staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }
  if (!(await authorizeStaff(staff, "audit.read"))) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin melihat log audit.", 403);
  }

  const searchParams = request.nextUrl.searchParams;
  const parsedLimit = limitSchema.safeParse(searchParams.get("limit") ?? "30");
  if (!parsedLimit.success) {
    return apiError("INPUT_INVALID", "Batas daftar audit harus antara 1 dan 100.", 400);
  }

  const cursorValue = searchParams.get("cursor");
  const cursor = cursorValue && cursorValue.length <= 512 ? parseAuditCursor(cursorValue) : null;
  if (cursorValue && !cursor) {
    return apiError("INPUT_INVALID", "Penanda halaman audit tidak valid.", 400);
  }

  const page = await listAuditEvents(parsedLimit.data, cursor);
  return NextResponse.json(page);
}
