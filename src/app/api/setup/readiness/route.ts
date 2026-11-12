import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDatabase } from "@/db";
import { systemState } from "@/db/schema";
import { getSetupStatus } from "@/server/auth/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await getSetupStatus();

  let databaseOk = false;
  try {
    const database = getDatabase();
    await database
      .select({ id: systemState.id })
      .from(systemState)
      .where(eq(systemState.id, 1))
      .limit(1);
    databaseOk = true;
  } catch {
    databaseOk = false;
  }

  return NextResponse.json({
    ready: databaseOk,
    database: databaseOk,
    checkedAt: new Date().toISOString(),
  });
}
