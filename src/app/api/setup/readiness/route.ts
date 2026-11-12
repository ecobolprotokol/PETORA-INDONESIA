import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db";
import { systemState } from "@/db/schema";
import { checkPublicReachability, getPublicAppOrigin } from "@/server/setup/readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let databaseOk = false;
  try {
    const database = getDatabase();
    await database
      .select({ id: systemState.id })
      .from(systemState)
      .where(eq(systemState.id, 1))
      .limit(1);
    databaseOk = true;
  } catch (error) {
    console.error(
      "Pemeriksaan kesiapan basis data gagal:",
      error instanceof Error ? error.name : "UnknownError",
    );
    databaseOk = false;
  }

  return NextResponse.json({
    ready: databaseOk,
    application: true,
    database: databaseOk,
    publicReachability: await checkPublicReachability(process.env.PUBLIC_APP_URL),
    publicAppOrigin: getPublicAppOrigin(process.env.PUBLIC_APP_URL),
    checkedAt: new Date().toISOString(),
  });
}
