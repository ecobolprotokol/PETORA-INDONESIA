import { NextResponse } from "next/server";
import { authorizeStaff } from "@/server/access/service";
import { getCurrentStaff } from "@/server/auth/cookies";
import { encodeCsv } from "@/server/data/csv";
import { apiError } from "@/server/http";
import { exportPets } from "@/server/pets/service";

export const runtime = "nodejs";

export async function GET() {
  const staff = await getCurrentStaff();
  if (!staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }
  const grant = await authorizeStaff(staff, "pets.read");
  if (!grant) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin mengekspor hewan.", 403);
  }
  const records = await exportPets(staff.id, grant.dataScope);
  const csv = encodeCsv([
    [
      "name",
      "species",
      "breed",
      "sex",
      "birthDate",
      "estimatedAgeMonths",
      "color",
      "microchipNumber",
      "photoUrl",
      "isSterilized",
      "allergies",
      "behaviorNotes",
      "status",
      "ownersJson",
    ],
    ...records.map((pet) => [
      pet.name,
      pet.species,
      pet.breed ?? "",
      pet.sex,
      pet.birthDate ?? "",
      pet.estimatedAgeMonths?.toString() ?? "",
      pet.color ?? "",
      pet.microchipNumber ?? "",
      pet.photoUrl ?? "",
      String(pet.isSterilized),
      pet.allergies.join("|"),
      pet.behaviorNotes ?? "",
      pet.status,
      JSON.stringify(
        pet.owners.map(({ customerId, relationship, isPrimary }) => ({
          customerId,
          relationship,
          isPrimary,
        })),
      ),
    ]),
  ]);
  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": 'attachment; filename="petora-pets.csv"',
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
