import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeStaff } from "@/server/access/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { apiError, hasSameOrigin } from "@/server/http";
import {
  listBundleComponents,
  ProductBundleInvalidError,
  replaceBundleComponents,
} from "@/server/inventory/bundles";
import { InventoryProductInvalidError } from "@/server/inventory/service";

export const runtime = "nodejs";

const bundleSchema = z.object({
  components: z
    .array(
      z.object({
        productId: z.string().uuid(),
        variantId: z.string().uuid().optional().nullable(),
        quantity: z
          .string()
          .regex(/^(0|[1-9]\d{0,10})(?:\.\d{1,3})?$/u)
          .refine((quantity) => Number(quantity) > 0),
      }),
    )
    .max(100),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ productId: string }> },
) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;
  if (!staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }
  const [readGrant, manageGrant] = await Promise.all([
    authorizeStaff(staff, "products.read"),
    authorizeStaff(staff, "products.manage"),
  ]);
  const grant = readGrant ?? manageGrant;
  if (!grant) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin melihat komposisi produk.", 403);
  }
  const { productId } = await context.params;
  const parsedId = z.string().uuid().safeParse(productId);
  if (!parsedId.success) {
    return apiError("INPUT_INVALID", "ID produk tidak valid.", 400);
  }
  const components = await listBundleComponents(parsedId.data, staff.id, grant.dataScope);
  if (components === null) {
    return apiError("PRODUCT_NOT_FOUND", "Produk tidak ditemukan.", 404);
  }
  return NextResponse.json({ components });
}

export async function PUT(
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
    return apiError("FORBIDDEN", "Anda tidak memiliki izin mengelola komposisi produk.", 403);
  }
  const { productId } = await context.params;
  const parsedId = z.string().uuid().safeParse(productId);
  if (!parsedId.success) {
    return apiError("INPUT_INVALID", "ID produk tidak valid.", 400);
  }
  const body: unknown = await request.json().catch(() => null);
  const parsed = bundleSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("INPUT_INVALID", "Periksa kembali komponen dan jumlah bundel.", 400);
  }
  try {
    await replaceBundleComponents(parsedId.data, parsed.data.components, staff.id, grant.dataScope);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ProductBundleInvalidError) {
      return apiError("PRODUCT_BUNDLE_INVALID", error.message, 400);
    }
    if (error instanceof InventoryProductInvalidError) {
      return apiError("PRODUCT_NOT_FOUND", error.message, 404);
    }
    throw error;
  }
}
