import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "@/server/auth/cookies";
import {
  bootstrapOwner,
  OwnerAlreadyCreatedError,
  OwnerBranchCodeConflictError,
  OwnerEmailConflictError,
} from "@/server/auth/service";
import { setupSchema } from "@/server/auth/validation";
import { apiError, hasSameOrigin } from "@/server/http";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) {
    return apiError("ORIGIN_INVALID", "Permintaan tidak dapat diverifikasi.", 403);
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = setupSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(
      "INPUT_INVALID",
      "Periksa kembali profil bisnis, cabang pertama, pajak, nama, email, dan kata sandi.",
      400,
    );
  }

  try {
    const result = await bootstrapOwner(
      parsed.data,
      request.headers.get("user-agent") ?? undefined,
    );
    const response = NextResponse.json({ ok: true, redirectTo: "/dashboard" });
    response.cookies.set(SESSION_COOKIE_NAME, result.token, {
      ...sessionCookieOptions(),
      expires: result.expiresAt,
    });
    return response;
  } catch (error) {
    if (error instanceof OwnerAlreadyCreatedError) {
      return apiError("OWNER_ALREADY_CREATED", "Akun Owner sudah dibuat.", 409);
    }

    if (error instanceof OwnerEmailConflictError) {
      return apiError("EMAIL_EXISTS", "Email tersebut sudah digunakan.", 409);
    }

    if (error instanceof OwnerBranchCodeConflictError) {
      return apiError("BRANCH_CODE_EXISTS", error.message, 409);
    }

    throw error;
  }
}
