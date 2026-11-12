import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeStaff } from "@/server/access/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { apiError, hasSameOrigin } from "@/server/http";
import {
  createInventoryTransfer,
  InventoryTransferNotFoundError,
  listInventoryTransfers,
} from "@/server/inventory/operations";
import { getWarehouseBranchId } from "@/server/inventory/service";
import { inventoryTransferSchema } from "@/server/inventory/validation";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;
  if (!staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }
  const branchId = z.string().uuid().safeParse(request.nextUrl.searchParams.get("branchId"));
  if (!branchId.success) {
    return apiError("INPUT_INVALID", "Cabang transfer tidak valid.", 400);
  }
  const [readGrant, transferGrant] = await Promise.all([
    authorizeStaff(staff, "inventory.read", branchId.data),
    authorizeStaff(staff, "inventory.transfer", branchId.data),
  ]);
  if (!readGrant && !transferGrant) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin melihat transfer cabang ini.", 403);
  }
  return NextResponse.json({ transfers: await listInventoryTransfers(branchId.data) });
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
  const body: unknown = await request.json().catch(() => null);
  const parsed = inventoryTransferSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("INPUT_INVALID", "Periksa kembali gudang, barang, jumlah, dan alasan.", 400);
  }
  const [source, destination] = await Promise.all([
    getWarehouseBranchId(parsed.data.sourceWarehouseId),
    getWarehouseBranchId(parsed.data.destinationWarehouseId),
  ]);
  if (!source || !destination) {
    return apiError("WAREHOUSE_NOT_FOUND", "Gudang sumber atau tujuan tidak ditemukan.", 404);
  }
  const [sourceGrant, destinationGrant] = await Promise.all([
    authorizeStaff(staff, "inventory.transfer", source.branchId),
    authorizeStaff(staff, "inventory.transfer", destination.branchId),
  ]);
  if (!sourceGrant || !destinationGrant) {
    return apiError(
      "FORBIDDEN",
      "Izin transfer diperlukan pada cabang sumber dan cabang tujuan.",
      403,
    );
  }
  try {
    const transfer = await createInventoryTransfer(parsed.data, staff.id);
    return NextResponse.json({ transfer }, { status: 201 });
  } catch (error) {
    if (error instanceof InventoryTransferNotFoundError) {
      return apiError("TRANSFER_WAREHOUSE_INVALID", error.message, 400);
    }
    throw error;
  }
}
