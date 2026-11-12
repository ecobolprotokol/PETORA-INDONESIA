import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeStaff } from "@/server/access/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { apiError, hasSameOrigin } from "@/server/http";
import {
  dispatchInventoryTransfer,
  getTransferWarehouses,
  InventoryOperationStatusError,
  InventoryTransferNotFoundError,
} from "@/server/inventory/operations";
import {
  InventoryInsufficientStockError,
  InventoryProductInvalidError,
} from "@/server/inventory/service";
import { SupervisorPinInvalidError, SupervisorPinNotSetError } from "@/server/supervisor/pin";

export const runtime = "nodejs";

const dispatchSchema = z.object({
  supervisorPin: z
    .string()
    .regex(/^\d{4,12}$/u)
    .optional(),
});

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
  const parsed = dispatchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("INPUT_INVALID", "PIN supervisor tidak valid.", 400);
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
  const caps = [sourceGrant.maxTransferCents, destinationGrant.maxTransferCents].filter(
    (value): value is number => value !== null,
  );
  const policy = {
    maxTransferCents: caps.length ? Math.min(...caps) : null,
    requiresSupervisorPin:
      sourceGrant.requiresSupervisorPin || destinationGrant.requiresSupervisorPin,
  };
  try {
    await dispatchInventoryTransfer(transfer.id, staff.id, policy, parsed.data.supervisorPin);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof InventoryTransferNotFoundError) {
      return apiError("TRANSFER_NOT_FOUND", error.message, 404);
    }
    if (error instanceof InventoryOperationStatusError) {
      return apiError("TRANSFER_STATUS_INVALID", error.message, 409);
    }
    if (error instanceof InventoryInsufficientStockError) {
      return apiError("INVENTORY_STOCK_INSUFFICIENT", error.message, 409);
    }
    if (error instanceof InventoryProductInvalidError) {
      return apiError("INVENTORY_BATCH_INVALID", error.message, 409);
    }
    if (error instanceof SupervisorPinNotSetError || error instanceof SupervisorPinInvalidError) {
      return apiError("SUPERVISOR_PIN_INVALID", error.message, 403);
    }
    throw error;
  }
}
