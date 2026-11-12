import { type NextRequest, NextResponse } from "next/server";
import { authorizeStaff } from "@/server/access/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { CustomerImportConflictError, importCustomers } from "@/server/customers/service";
import { customerSchema } from "@/server/customers/validation";
import { CsvFormatError, parseCsv } from "@/server/data/csv";
import { apiError, hasSameOrigin } from "@/server/http";

export const runtime = "nodejs";

const headers = [
  "name",
  "phone",
  "email",
  "address",
  "notes",
  "tags",
  "marketingConsent",
  "notifyAppointments",
  "notifyMarketing",
];

function parseBoolean(value: string, defaultValue: boolean) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return defaultValue;
  }
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
  if (!(await authorizeStaff(staff, "customers.manage"))) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin mengimpor pelanggan.", 403);
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
    rows = parseCsv(body.csv, { maxRows: 500, maxColumns: 9, maxCellLength: 4000 });
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
    const marketingConsent = parseBoolean(row[6], false);
    const appointments = parseBoolean(row[7], true);
    const marketing = parseBoolean(row[8], false);
    if (marketingConsent === null || appointments === null || marketing === null) {
      return apiError(
        "CSV_ROW_INVALID",
        `Nilai persetujuan pada baris ${index + 2} tidak valid.`,
        400,
      );
    }
    const parsed = customerSchema.safeParse({
      name: row[0],
      phone: row[1],
      email: row[2],
      address: row[3],
      notes: row[4],
      tags: row[5] ? row[5].split("|").filter(Boolean) : [],
      marketingConsent,
      notificationPreferences: { appointments, marketing },
    });
    if (!parsed.success) {
      return apiError(
        "CSV_ROW_INVALID",
        `Data pelanggan pada baris ${index + 2} tidak valid.`,
        400,
      );
    }
    inputs.push(parsed.data);
  }

  try {
    const imported = await importCustomers(inputs, staff.id);
    return NextResponse.json({ imported }, { status: 201 });
  } catch (error) {
    if (error instanceof CustomerImportConflictError) {
      return NextResponse.json(
        {
          error: {
            code: "CUSTOMER_PHONE_EXISTS",
            message: "Nomor telepon pada baris berikut sudah terdaftar.",
            rows: error.rows,
          },
        },
        { status: 409 },
      );
    }
    throw error;
  }
}
