import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeStaff } from "@/server/access/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { apiError, hasSameOrigin } from "@/server/http";
import {
  getStocktakeWarehouse,
  InventoryOperationStatusError,
  reviewStocktake,
  StocktakeNotFoundError,
  StocktakeStaleError,
} from "@/server/inventory/operations";

export const runtime = "nodejs";

const reviewSchema = z.object({ decision: z.enum(["approved", "rejected"]) });

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ stocktakeId: string }> },
) {
  if (!hasSameOrigin(request)) {
    return apiError("ORIGIN_INVALID", "Permintaan tidak dapat diverifikasi.", 403);
  }
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;
  if (!staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }
  const { stocktakeId } = await context.params;
  const parsedId = z.string().uuid().safeParse(stocktakeId);
  if (!parsedId.success) {
    return apiError("INPUT_INVALID", "ID opname tidak valid.", 400);
  }
  const body: unknown = await request.json().catch(() => null);
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("INPUT_INVALID", "Keputusan opname tidak valid.", 400);
  }
  const stocktake = await getStocktakeWarehouse(parsedId.data);
  if (!stocktake) {
    return apiError("STOCKTAKE_NOT_FOUND", "Sesi opname tidak ditemukan.", 404);
  }
  if (!(await authorizeStaff(staff, "inventory.approve", stocktake.branchId))) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin menyetujui opname cabang ini.", 403);
  }
  try {
    await reviewStocktake(stocktake.id, staff.id, parsed.data.decision);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof StocktakeNotFoundError) {
      return apiError("STOCKTAKE_NOT_FOUND", error.message, 404);
    }
    if (error instanceof StocktakeStaleError) {
      return apiError("STOCKTAKE_STALE", error.message, 409);
    }
    if (error instanceof InventoryOperationStatusError) {
      return apiError("STOCKTAKE_REVIEW_INVALID", error.message, 409);
    }
    throw error;
  }
}
