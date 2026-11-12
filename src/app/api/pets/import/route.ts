import { type NextRequest, NextResponse } from "next/server";
import { authorizeStaff } from "@/server/access/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { CsvFormatError, parseCsv } from "@/server/data/csv";
import { apiError, hasSameOrigin } from "@/server/http";
import { importPets, PetOwnersInvalidError } from "@/server/pets/service";
import { petSchema } from "@/server/pets/validation";

export const runtime = "nodejs";

const headers = [
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
];

function parseBoolean(value: string) {
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "ya", "yes"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "tidak", "no"].includes(normalized)) {
    return false;
  }
  return null;
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
    return apiError("FORBIDDEN", "Anda tidak memiliki izin mengimpor hewan.", 403);
  }
  const body: unknown = await request.json().catch(() => null);
  if (
    typeof body !== "object" ||
    body === null ||
    !("csv" in body) ||
    typeof body.csv !== "string" ||
    body.csv.length > 1_000_000
  ) {
    return apiError("INPUT_INVALID", "Berkas CSV tidak valid atau terlalu besar.", 400);
  }
  let rows: string[][];
  try {
    rows = parseCsv(body.csv, { maxRows: 500, maxColumns: 14, maxCellLength: 5000 });
  } catch (error) {
    if (error instanceof CsvFormatError) {
      return apiError("CSV_INVALID", error.message, 400);
    }
    throw error;
  }
  if (
    rows.length < 2 ||
    rows[0]?.map((header) => header.trim())?.join(",") !== headers.join(",") ||
    rows.some((row) => row.length !== headers.length)
  ) {
    return apiError("CSV_COLUMNS_INVALID", `CSV harus memiliki kolom: ${headers.join(", ")}.`, 400);
  }
  const inputs = [];
  for (const [index, row] of rows.slice(1).entries()) {
    const isSterilized = parseBoolean(row[9]);
    if (isSterilized === null) {
      return apiError(
        "CSV_ROW_INVALID",
        `Status sterilisasi pada baris ${index + 2} tidak valid.`,
        400,
      );
    }
    let owners: unknown;
    try {
      owners = JSON.parse(row[13]);
    } catch {
      return apiError("CSV_ROW_INVALID", `Data pemilik pada baris ${index + 2} tidak valid.`, 400);
    }
    const estimatedAgeMonths = row[5].trim() ? Number(row[5]) : null;
    const parsed = petSchema.safeParse({
      name: row[0],
      species: row[1],
      breed: row[2],
      sex: row[3],
      birthDate: row[4] || null,
      estimatedAgeMonths,
      color: row[6],
      microchipNumber: row[7],
      photoUrl: row[8],
      isSterilized,
      allergies: row[10] ? row[10].split("|").filter(Boolean) : [],
      behaviorNotes: row[11],
      status: row[12],
      owners,
    });
    if (!parsed.success) {
      return apiError("CSV_ROW_INVALID", `Data hewan pada baris ${index + 2} tidak valid.`, 400);
    }
    inputs.push(parsed.data);
  }
  try {
    const imported = await importPets(inputs, staff.id, grant.dataScope);
    return NextResponse.json({ imported }, { status: 201 });
  } catch (error) {
    if (error instanceof PetOwnersInvalidError) {
      return apiError("PET_OWNER_INVALID", error.message, 400);
    }
    throw error;
  }
}
