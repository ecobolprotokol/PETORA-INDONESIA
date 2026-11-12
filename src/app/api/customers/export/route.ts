import { NextResponse } from "next/server";
import { authorizeStaff } from "@/server/access/service";
import { getCurrentStaff } from "@/server/auth/cookies";
import { exportCustomers } from "@/server/customers/service";
import { encodeCsv } from "@/server/data/csv";
import { apiError } from "@/server/http";

export const runtime = "nodejs";

export async function GET() {
  const staff = await getCurrentStaff();
  if (!staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }
  const grant = await authorizeStaff(staff, "customers.read");
  if (!grant) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin mengekspor pelanggan.", 403);
  }
  const records = await exportCustomers(staff.id, grant.dataScope);
  const csv = encodeCsv([
    [
      "name",
      "phone",
      "email",
      "address",
      "notes",
      "tags",
      "marketingConsent",
      "notifyAppointments",
      "notifyMarketing",
    ],
    ...records.map((customer) => [
      customer.name,
      customer.phone,
      customer.email ?? "",
      customer.address ?? "",
      customer.notes ?? "",
      customer.tags.join("|"),
      String(customer.marketingConsent),
      String(customer.notificationPreferences.appointments),
      String(customer.notificationPreferences.marketing),
    ]),
  ]);
  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": 'attachment; filename="petora-customers.csv"',
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
