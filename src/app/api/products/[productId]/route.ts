import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeStaff } from "@/server/access/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { apiError, hasSameOrigin } from "@/server/http";
import {
  ProductCostAccessError,
  ProductNotFoundError,
  ProductReferenceInvalidError,
  updateProduct,
} from "@/server/products/service";
import { productSchema } from "@/server/products/validation";

export const runtime = "nodejs";

function hasConstraint(error: unknown, constraint: string): boolean {
  const cause =
    typeof error === "object" && error !== null && "cause" in error ? error.cause : error;
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    cause.code === "23505" &&
    "constraint" in cause &&
    cause.constraint === constraint
  );
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ productId: string }> },
) {
  if (!hasSameOrigin(request)) {
    return apiError("ORIGIN_INVALID", "Permintaan tidak dapat diverifikasi.", 403);
  }
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;
  if (!staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }
  const grant = await authorizeStaff(staff, "products.manage");
  if (!grant) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin mengelola produk.", 403);
  }
  const costGrant = await authorizeStaff(staff, "products.cost.manage");
  const { productId } = await context.params;
  const parsedId = z.string().uuid().safeParse(productId);
  if (!parsedId.success) {
    return apiError("INPUT_INVALID", "ID produk tidak valid.", 400);
  }
  const body: unknown = await request.json().catch(() => null);
  const parsed = productSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("INPUT_INVALID", "Periksa kembali produk, satuan, barcode, dan harganya.", 400);
  }
  try {
    await updateProduct(
      parsedId.data,
      parsed.data,
      staff.id,
      grant.dataScope,
      costGrant?.dataScope ?? null,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ProductNotFoundError) {
      return apiError("PRODUCT_NOT_FOUND", "Produk tidak ditemukan.", 404);
    }
    if (error instanceof ProductReferenceInvalidError) {
      return apiError("PRODUCT_REFERENCE_INVALID", error.message, 400);
    }
    if (error instanceof ProductCostAccessError) {
      return apiError("PRODUCT_COST_FORBIDDEN", error.message, 403);
    }
    if (
      hasConstraint(error, "products_sku_lower_unique") ||
      hasConstraint(error, "product_variants_sku_lower_unique") ||
      hasConstraint(error, "product_barcodes_lower_unique")
    ) {
      return apiError("PRODUCT_IDENTIFIER_EXISTS", "SKU atau barcode sudah digunakan.", 409);
    }
    throw error;
  }
}
