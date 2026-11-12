import { NextResponse } from "next/server";
import { getSetupStatus } from "@/server/auth/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await getSetupStatus();
  return NextResponse.json({ ready: true });
}
