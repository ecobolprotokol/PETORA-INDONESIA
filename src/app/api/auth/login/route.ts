import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "@/server/auth/cookies";
import { loginStaff } from "@/server/auth/service";
import { loginSchema } from "@/server/auth/validation";
import { apiError, hasSameOrigin } from "@/server/http";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) {
    return apiError("ORIGIN_INVALID", "Permintaan tidak dapat diverifikasi.", 403);
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return apiError("INPUT_INVALID", "Email atau kata sandi tidak valid.", 400);
  }

  const result = await loginStaff(parsed.data, request.headers.get("user-agent") ?? undefined);

  if (!result) {
    return apiError(
      "CREDENTIALS_INVALID",
      "Email atau kata sandi salah, atau akses sementara dibatasi.",
      401,
    );
  }

  if ("twoFactorRequired" in result) {
    return NextResponse.json({
      ok: true,
      twoFactorRequired: true,
      challengeToken: result.challengeToken,
    });
  }

  const response = NextResponse.json({ ok: true, redirectTo: "/dashboard" });
  response.cookies.set(SESSION_COOKIE_NAME, result.token, {
    ...sessionCookieOptions(),
    expires: result.expiresAt,
  });
  return response;
}
