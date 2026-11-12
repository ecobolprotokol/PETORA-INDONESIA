import { type NextRequest, NextResponse } from "next/server";
import { authorizeStaff } from "@/server/access/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { apiError, hasSameOrigin } from "@/server/http";
import { createPet, listPets, PetOwnersInvalidError } from "@/server/pets/service";
import { petSchema } from "@/server/pets/validation";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;
  if (!staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }

  const grant = await authorizeStaff(staff, "pets.read");
  if (!grant) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin melihat data hewan.", 403);
  }

  const query = request.nextUrl.searchParams.get("q")?.trim();
  if (query && query.length > 120) {
    return apiError("INPUT_INVALID", "Kata pencarian terlalu panjang.", 400);
  }
  return NextResponse.json({ pets: await listPets(staff.id, grant.dataScope, query) });
}

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) {
    return apiError("ORIGIN_INVALID", "Permintaan tidak dapat diverifikasi.", 403);
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;
  if (!staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }

  const grant = await authorizeStaff(staff, "pets.manage");
  if (!grant) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin mengelola data hewan.", 403);
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = petSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("INPUT_INVALID", "Periksa kembali profil hewan dan daftar pemiliknya.", 400);
  }

  try {
    const pet = await createPet(parsed.data, staff.id, grant.dataScope);
    return NextResponse.json({ pet }, { status: 201 });
  } catch (error) {
    if (error instanceof PetOwnersInvalidError) {
      return apiError("PET_OWNERS_INVALID", error.message, 404);
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505" &&
      "constraint" in error &&
      error.constraint === "pets_microchip_lower_unique"
    ) {
      return apiError("MICROCHIP_EXISTS", "Nomor microchip sudah terdaftar.", 409);
    }
    throw error;
  }
}
