import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "@/server/auth/cookies";
import { verifyTotpLoginChallenge } from "@/server/auth/service";
import { TotpEncryptionKeyError } from "@/server/auth/two-factor";
import { totpLoginChallengeSchema } from "@/server/auth/validation";
import { apiError, hasSameOrigin } from "@/server/http";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) {
    return apiError("ORIGIN_INVALID", "Permintaan tidak dapat diverifikasi.", 403);
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = totpLoginChallengeSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(
      "INPUT_INVALID",
      "Masukkan kode autentikator atau kode pemulihan yang valid.",
      400,
    );
  }

  let result: Awaited<ReturnType<typeof verifyTotpLoginChallenge>>;
  try {
    result = await verifyTotpLoginChallenge(
      parsed.data.challengeToken,
      parsed.data.code,
      request.headers.get("user-agent") ?? undefined,
    );
  } catch (error) {
    if (error instanceof TotpEncryptionKeyError) {
      return apiError("TWO_FACTOR_NOT_CONFIGURED", error.message, 503);
    }

    throw error;
  }

  if (!result) {
    return apiError(
      "TWO_FACTOR_INVALID",
      "Kode tidak valid atau sesi verifikasi sudah kedaluwarsa.",
      401,
    );
  }

  const response = NextResponse.json({ ok: true, redirectTo: "/dashboard" });
  response.cookies.set(SESSION_COOKIE_NAME, result.token, {
    ...sessionCookieOptions(),
    expires: result.expiresAt,
  });
  return response;
}
