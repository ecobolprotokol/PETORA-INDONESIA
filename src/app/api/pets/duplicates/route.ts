import { type NextRequest, NextResponse } from "next/server";
import { authorizeStaff } from "@/server/access/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { apiError } from "@/server/http";
import { findPotentialPetDuplicates } from "@/server/pets/service";
import { petSchema } from "@/server/pets/validation";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;
  if (!staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }
  const grant = await authorizeStaff(staff, "pets.manage");
  if (!grant) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin memeriksa duplikasi hewan.", 403);
  }

  const searchParams = request.nextUrl.searchParams;
  const name = searchParams.get("name") ?? "";
  const species = searchParams.get("species");
  const ownerIds = searchParams.getAll("ownerId");
  const parsed = petSchema.shape.species.safeParse(species);
  if (!name.trim() || name.length > 120 || !parsed.success || ownerIds.length > 20) {
    return apiError("INPUT_INVALID", "Nama, jenis hewan, dan pemilik harus valid.", 400);
  }

  const pets = await findPotentialPetDuplicates(
    name,
    parsed.data,
    ownerIds,
    staff.id,
    grant.dataScope,
  );
  return NextResponse.json({ pets });
}
