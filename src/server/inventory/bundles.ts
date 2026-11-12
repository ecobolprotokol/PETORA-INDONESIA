import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/db";
import { auditEvents, productBundleComponents, products, productVariants } from "@/db/schema";
import type { PermissionDataScope } from "@/server/access/permissions";
import { parseQuantity } from "./quantity";
import { consumeFromBatches, InventoryProductInvalidError, lockWarehouse } from "./service";

export class ProductBundleInvalidError extends Error {}

interface BundleComponentInput {
  productId: string;
  variantId?: string | null;
  quantity: string;
}

async function validateComponent(
  productId: string,
  component: BundleComponentInput,
  tx: Parameters<Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]>[0],
) {
  if (component.productId === productId) {
    throw new ProductBundleInvalidError("Produk tidak dapat menjadi komponennya sendiri.");
  }
  const [product] = await tx
    .select({ id: products.id, isActive: products.isActive })
    .from(products)
    .where(eq(products.id, component.productId))
    .limit(1);
  if (!product?.isActive) {
    throw new InventoryProductInvalidError("Produk komponen tidak ditemukan atau tidak aktif.");
  }
  if (component.variantId) {
    const [variant] = await tx
      .select({ id: productVariants.id })
      .from(productVariants)
      .where(
        and(
          eq(productVariants.id, component.variantId),
          eq(productVariants.productId, component.productId),
          eq(productVariants.isActive, true),
        ),
      )
      .limit(1);
    if (!variant) {
      throw new ProductBundleInvalidError("Varian komponen tidak valid.");
    }
  }
}

async function hasBundleCycle(
  tx: Parameters<Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]>[0],
  parentProductId: string,
  candidateComponentId: string,
) {
  const visited = new Set<string>();
  const pending = [candidateComponentId];
  while (pending.length) {
    const current = pending.pop();
    if (!current) {
      continue;
    }
    if (current === parentProductId) {
      return true;
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);
    if (visited.size > 500) {
      throw new ProductBundleInvalidError("Komposisi produk terlalu kompleks.");
    }
    const children = await tx
      .select({ componentProductId: productBundleComponents.componentProductId })
      .from(productBundleComponents)
      .where(eq(productBundleComponents.bundleProductId, current));
    pending.push(...children.map(({ componentProductId }) => componentProductId));
  }
  return false;
}

export async function listBundleComponents(
  productId: string,
  staffUserId: string,
  scope: PermissionDataScope,
) {
  const [product] = await getDatabase()
    .select({ createdBy: products.createdBy })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!product || (scope === "own" && product.createdBy !== staffUserId)) {
    return null;
  }
  return getDatabase()
    .select({
      productId: productBundleComponents.bundleProductId,
      componentProductId: productBundleComponents.componentProductId,
      componentName: products.name,
      componentSku: products.sku,
      componentVariantId: productBundleComponents.componentVariantId,
      quantity: productBundleComponents.quantity,
    })
    .from(productBundleComponents)
    .innerJoin(products, eq(productBundleComponents.componentProductId, products.id))
    .where(eq(productBundleComponents.bundleProductId, productId));
}

export async function replaceBundleComponents(
  productId: string,
  components: BundleComponentInput[],
  actorUserId: string,
  scope: PermissionDataScope,
) {
  return getDatabase().transaction(async (tx) => {
    const [bundle] = await tx
      .select({ id: products.id, isActive: products.isActive, createdBy: products.createdBy })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    if (!bundle?.isActive) {
      throw new InventoryProductInvalidError("Produk bundel tidak ditemukan atau tidak aktif.");
    }
    if (scope === "own" && bundle.createdBy !== actorUserId) {
      throw new InventoryProductInvalidError("Produk tidak ditemukan atau tidak dapat diubah.");
    }
    if (components.length > 100) {
      throw new ProductBundleInvalidError("Komposisi tidak boleh lebih dari 100 baris.");
    }
    const uniqueKeys = new Set<string>();
    for (const component of components) {
      const key = `${component.productId}:${component.variantId ?? ""}`;
      if (uniqueKeys.has(key)) {
        throw new ProductBundleInvalidError("Komponen yang sama tidak boleh diulang.");
      }
      uniqueKeys.add(key);
      parseQuantity(component.quantity);
      await validateComponent(productId, component, tx);
      if (await hasBundleCycle(tx, productId, component.productId)) {
        throw new ProductBundleInvalidError("Komposisi produk tidak boleh membentuk siklus.");
      }
    }
    await tx
      .delete(productBundleComponents)
      .where(eq(productBundleComponents.bundleProductId, productId));
    if (components.length) {
      await tx.insert(productBundleComponents).values(
        components.map((component) => ({
          bundleProductId: productId,
          componentProductId: component.productId,
          componentVariantId: component.variantId ?? null,
          quantity: component.quantity,
        })),
      );
    }
    await tx.insert(auditEvents).values({
      actorUserId,
      action: "inventory.bundle_composition_updated",
      targetType: "product",
      targetId: productId,
      metadata: { componentCount: String(components.length) },
    });
    return productId;
  });
}

function multiplyQuantity(left: bigint, right: bigint): bigint {
  const product = left * right;
  if (product % 1000n !== 0n) {
    throw new ProductBundleInvalidError(
      "Komposisi menghasilkan jumlah dengan presisi lebih dari tiga desimal.",
    );
  }
  return product / 1000n;
}

export async function consumeBundleInventory(input: {
  warehouseId: string;
  bundleProductId: string;
  variantId?: string | null;
  quantity: string;
  sourceId: string;
  actorUserId: string;
}) {
  return getDatabase().transaction(async (tx) => {
    const warehouse = await lockWarehouse(tx, input.warehouseId);
    const requestedQuantity = parseQuantity(input.quantity);
    const required = new Map<
      string,
      { productId: string; variantId: string | null; quantity: bigint }
    >();
    const visiting = new Set<string>();

    async function expand(productId: string, multiplier: bigint, depth: number) {
      if (depth > 8 || visiting.has(productId)) {
        throw new ProductBundleInvalidError("Komposisi bundel bersiklus atau terlalu dalam.");
      }
      const rows = await tx
        .select({
          componentProductId: productBundleComponents.componentProductId,
          componentVariantId: productBundleComponents.componentVariantId,
          quantity: productBundleComponents.quantity,
        })
        .from(productBundleComponents)
        .where(eq(productBundleComponents.bundleProductId, productId));
      if (rows.length === 0) {
        throw new ProductBundleInvalidError("Produk tidak memiliki komposisi stok.");
      }
      visiting.add(productId);
      for (const row of rows) {
        const quantity = multiplyQuantity(multiplier, parseQuantity(row.quantity));
        const children = await tx
          .select({ id: productBundleComponents.bundleProductId })
          .from(productBundleComponents)
          .where(eq(productBundleComponents.bundleProductId, row.componentProductId))
          .limit(1);
        if (children.length) {
          await expand(row.componentProductId, quantity, depth + 1);
        } else {
          const key = `${row.componentProductId}:${row.componentVariantId ?? ""}`;
          const existing = required.get(key);
          required.set(key, {
            productId: row.componentProductId,
            variantId: row.componentVariantId,
            quantity: (existing?.quantity ?? 0n) + quantity,
          });
        }
      }
      visiting.delete(productId);
    }

    await expand(input.bundleProductId, requestedQuantity, 0);
    const results = [];
    for (const component of required.values()) {
      results.push(
        await consumeFromBatches(tx, {
          warehouseId: warehouse.id,
          productId: component.productId,
          variantId: component.variantId,
          timezone: warehouse.timezone,
          quantityMilli: component.quantity,
          sourceType: "bundle",
          sourceId: input.sourceId,
          actorUserId: input.actorUserId,
          movementType: "bundle_component_out",
          reason: `Komposisi produk ${input.bundleProductId}`,
        }),
      );
    }
    return {
      totalCostCents: results.reduce((total, result) => total + result.totalCostCents, 0),
      componentCount: required.size,
    };
  });
}
