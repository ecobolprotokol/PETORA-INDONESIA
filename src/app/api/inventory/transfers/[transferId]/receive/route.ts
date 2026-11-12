import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeStaff } from "@/server/access/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { apiError, hasSameOrigin } from "@/server/http";
import {
  getTransferWarehouses,
  InventoryOperationStatusError,
  InventoryTransferDiscrepancyError,
  InventoryTransferNotFoundError,
  receiveInventoryTransfer,
} from "@/server/inventory/operations";
import { receiveTransferSchema } from "@/server/inventory/validation";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ transferId: string }> },
) {
  if (!hasSameOrigin(request)) {
    return apiError("ORIGIN_INVALID", "Permintaan tidak dapat diverifikasi.", 403);
  }
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;
  if (!staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }
  const { transferId } = await context.params;
  const parsedId = z.string().uuid().safeParse(transferId);
  if (!parsedId.success) {
    return apiError("INPUT_INVALID", "ID transfer tidak valid.", 400);
  }
  const body: unknown = await request.json().catch(() => null);
  const parsed = receiveTransferSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("INPUT_INVALID", "Periksa kembali jumlah setiap batch yang diterima.", 400);
  }
  const transfer = await getTransferWarehouses(parsedId.data);
  if (!transfer) {
    return apiError("TRANSFER_NOT_FOUND", "Transfer stok tidak ditemukan.", 404);
  }
  const [sourceGrant, destinationGrant] = await Promise.all([
    authorizeStaff(staff, "inventory.transfer", transfer.sourceBranchId),
    authorizeStaff(staff, "inventory.transfer", transfer.destinationBranchId),
  ]);
  if (!sourceGrant || !destinationGrant) {
    return apiError(
      "FORBIDDEN",
      "Izin transfer diperlukan pada cabang sumber dan cabang tujuan.",
      403,
    );
  }
  try {
    await receiveInventoryTransfer(transfer.id, parsed.data, staff.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof InventoryTransferNotFoundError) {
      return apiError("TRANSFER_NOT_FOUND", error.message, 404);
    }
    if (
      error instanceof InventoryOperationStatusError ||
      error instanceof InventoryTransferDiscrepancyError
    ) {
      return apiError("TRANSFER_RECEIPT_INVALID", error.message, 409);
    }
    throw error;
  }
}
