import { and, asc, eq, ilike, inArray, sql } from "drizzle-orm";
import { getDatabase } from "@/db";
import {
  auditEvents,
  branches,
  priceTiers,
  productBarcodes,
  productCategories,
  productPrices,
  products,
  productUnitConversions,
  productVariants,
  units,
} from "@/db/schema";
import type { PermissionDataScope } from "@/server/access/permissions";
import type { ProductInput } from "./validation";

export class ProductNotFoundError extends Error {}

export class ProductReferenceInvalidError extends Error {}

export class ProductUnitConflictError extends Error {}

export class ProductCostAccessError extends Error {}

export interface ProductRecord {
  id: string;
  name: string;
  sku: string;
  productType: "general" | "medicine" | "feed" | "accessory";
  categoryId: string | null;
  categoryName: string | null;
  brand: string | null;
  photoUrl: string | null;
  description: string | null;
  baseUnitId: string | null;
  baseUnitName: string | null;
  medicineClass: string | null;
  prescriptionRequired: boolean;
  isActive: boolean;
  createdBy: string | null;
  barcodes: Array<{ id: string; barcode: string; variantId: string | null }>;
  conversions: Array<{ unitId: string; unitName: string; factor: string }>;
  prices: Array<{
    id: string;
    variantId: string | null;
    branchId: string | null;
    priceTierId: string | null;
    purchasePriceCents?: number | null;
    sellingPriceCents: number;
  }>;
  variants: Array<{ id: string; name: string; sku: string; isActive: boolean }>;
}

const productSelection = {
  id: products.id,
  name: products.name,
  sku: products.sku,
  productType: products.productType,
  categoryId: products.categoryId,
  categoryName: productCategories.name,
  brand: products.brand,
  photoUrl: products.photoUrl,
  description: products.description,
  baseUnitId: products.baseUnitId,
  baseUnitName: units.name,
  medicineClass: products.medicineClass,
  prescriptionRequired: products.prescriptionRequired,
  isActive: products.isActive,
  createdBy: products.createdBy,
};

function ownProductCondition(staffUserId: string) {
  return eq(products.createdBy, staffUserId);
}

async function loadProductDetails(productIds: string[], costReadableProductIds: Set<string>) {
  if (productIds.length === 0) {
    return {
      barcodes: new Map<string, ProductRecord["barcodes"]>(),
      conversions: new Map<string, ProductRecord["conversions"]>(),
      prices: new Map<string, ProductRecord["prices"]>(),
      variants: new Map<string, ProductRecord["variants"]>(),
    };
  }

  const [barcodeRows, conversionRows, priceRows, variantRows] = await Promise.all([
    getDatabase()
      .select({
        productId: productBarcodes.productId,
        id: productBarcodes.id,
        barcode: productBarcodes.barcode,
        variantId: productBarcodes.variantId,
      })
      .from(productBarcodes)
      .where(inArray(productBarcodes.productId, productIds)),
    getDatabase()
      .select({
        productId: productUnitConversions.productId,
        unitId: productUnitConversions.unitId,
        unitName: units.name,
        factor: productUnitConversions.conversionFactor,
      })
      .from(productUnitConversions)
      .innerJoin(units, eq(productUnitConversions.unitId, units.id))
      .where(inArray(productUnitConversions.productId, productIds)),
    getDatabase()
      .select({
        productId: productPrices.productId,
        id: productPrices.id,
        variantId: productPrices.variantId,
        branchId: productPrices.branchId,
        priceTierId: productPrices.priceTierId,
        purchasePriceCents: productPrices.purchasePriceCents,
        sellingPriceCents: productPrices.sellingPriceCents,
      })
      .from(productPrices)
      .where(inArray(productPrices.productId, productIds)),
    getDatabase()
      .select({
        productId: productVariants.productId,
        id: productVariants.id,
        name: productVariants.name,
        sku: productVariants.sku,
        isActive: productVariants.isActive,
      })
      .from(productVariants)
      .where(inArray(productVariants.productId, productIds)),
  ]);

  function group<T extends { productId: string }>(rows: T[], transform: (row: T) => unknown) {
    const result = new Map<string, unknown[]>();
    for (const row of rows) {
      const current = result.get(row.productId) ?? [];
      current.push(transform(row));
      result.set(row.productId, current);
    }
    return result;
  }

  return {
    barcodes: group(barcodeRows, ({ id, barcode, variantId }) => ({ id, barcode, variantId })),
    conversions: group(conversionRows, ({ unitId, unitName, factor }) => ({
      unitId,
      unitName,
      factor,
    })),
    prices: group(
      priceRows,
      ({
        productId,
        id,
        variantId,
        branchId,
        priceTierId,
        purchasePriceCents,
        sellingPriceCents,
      }) => ({
        id,
        variantId,
        branchId,
        priceTierId,
        ...(costReadableProductIds.has(productId) ? { purchasePriceCents } : {}),
        sellingPriceCents,
      }),
    ),
    variants: group(variantRows, ({ id, name, sku, isActive }) => ({
      id,
      name,
      sku,
      isActive,
    })),
  } as {
    barcodes: Map<string, ProductRecord["barcodes"]>;
    conversions: Map<string, ProductRecord["conversions"]>;
    prices: Map<string, ProductRecord["prices"]>;
    variants: Map<string, ProductRecord["variants"]>;
  };
}

export async function listProducts(
  staffUserId: string,
  dataScope: PermissionDataScope,
  costDataScope: PermissionDataScope | null,
  query?: string,
): Promise<ProductRecord[]> {
  const normalizedQuery = query?.trim();
  const records = await getDatabase()
    .select(productSelection)
    .from(products)
    .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
    .leftJoin(units, eq(products.baseUnitId, units.id))
    .where(
      and(
        dataScope === "own" ? ownProductCondition(staffUserId) : undefined,
        normalizedQuery
          ? sql`(
              ${ilike(products.name, `%${normalizedQuery}%`)}
              OR ${ilike(products.sku, `%${normalizedQuery}%`)}
              OR EXISTS (
                SELECT 1 FROM product_barcodes
                WHERE product_barcodes.product_id = ${products.id}
                  AND product_barcodes.barcode ILIKE ${`%${normalizedQuery}%`}
              )
            )`
          : undefined,
      ),
    )
    .orderBy(asc(products.name), asc(products.id))
    .limit(100);
  const details = await loadProductDetails(
    records.map(({ id }) => id),
    new Set(
      records
        .filter(
          ({ createdBy }) =>
            costDataScope === "all" || (costDataScope === "own" && createdBy === staffUserId),
        )
        .map(({ id }) => id),
    ),
  );

  const result = records.map((record) => ({
    ...record,
    barcodes: details.barcodes.get(record.id) ?? [],
    conversions: details.conversions.get(record.id) ?? [],
    prices: details.prices.get(record.id) ?? [],
    variants: details.variants.get(record.id) ?? [],
  }));
  await getDatabase()
    .insert(auditEvents)
    .values({
      actorUserId: staffUserId,
      action: costDataScope ? "product.cost_listed" : "product.listed",
      targetType: "product_collection",
      metadata: {
        dataScope,
        returned: String(result.length),
        ...(normalizedQuery ? { queryLength: String(normalizedQuery.length) } : {}),
      },
    });
  return result;
}

async function validateProductReferences(
  tx: Parameters<Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]>[0],
  input: ProductInput,
) {
  if (input.categoryId) {
    const [category] = await tx
      .select({ id: productCategories.id })
      .from(productCategories)
      .where(eq(productCategories.id, input.categoryId))
      .limit(1);
    if (!category) {
      throw new ProductReferenceInvalidError("Kategori produk tidak ditemukan.");
    }
  }
  if (input.baseUnitId) {
    const [baseUnit] = await tx
      .select({
        id: units.id,
        dimension: units.dimension,
        baseUnitId: units.baseUnitId,
      })
      .from(units)
      .where(eq(units.id, input.baseUnitId))
      .limit(1);
    if (!baseUnit || baseUnit.baseUnitId) {
      throw new ProductReferenceInvalidError("Pilih satuan dasar yang valid.");
    }
    if (input.unitConversions.length > 0) {
      const referencedUnits = await tx
        .select({ id: units.id, dimension: units.dimension })
        .from(units)
        .where(
          and(
            inArray(
              units.id,
              input.unitConversions.map(({ unitId }) => unitId),
            ),
            eq(units.dimension, baseUnit.dimension),
            sql`${units.id} <> ${baseUnit.id}`,
          ),
        );
      if (referencedUnits.length !== input.unitConversions.length) {
        throw new ProductReferenceInvalidError(
          "Satuan konversi harus memiliki dimensi yang sama dengan satuan dasar.",
        );
      }
    }
  } else if (input.unitConversions.length > 0) {
    throw new ProductReferenceInvalidError("Satuan dasar harus dipilih sebelum menambah konversi.");
  }

  const priceRows = [...input.prices, ...input.variants.flatMap(({ prices }) => prices)];
  const branchIds = [...new Set(priceRows.flatMap(({ branchId }) => (branchId ? [branchId] : [])))];
  if (branchIds.length) {
    const validBranches = await tx
      .select({ id: branches.id })
      .from(branches)
      .where(and(inArray(branches.id, branchIds), eq(branches.isActive, true)));
    if (validBranches.length !== branchIds.length) {
      throw new ProductReferenceInvalidError("Satu atau lebih cabang harga tidak ditemukan.");
    }
  }
  const tierIds = [
    ...new Set(priceRows.flatMap(({ priceTierId }) => (priceTierId ? [priceTierId] : []))),
  ];
  if (tierIds.length) {
    const validTiers = await tx
      .select({ id: priceTiers.id })
      .from(priceTiers)
      .where(and(inArray(priceTiers.id, tierIds), eq(priceTiers.isActive, true)));
    if (validTiers.length !== tierIds.length) {
      throw new ProductReferenceInvalidError("Satu atau lebih tingkat harga tidak ditemukan.");
    }
  }
}

async function replaceProductDetails(
  tx: Parameters<Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]>[0],
  productId: string,
  input: ProductInput,
  actorUserId: string,
  canManageCost: boolean,
  preservedCosts: Map<string, number | null>,
) {
  const variants = input.variants.length
    ? await tx
        .insert(productVariants)
        .values(
          input.variants.map(({ name, sku }) => ({
            productId,
            name,
            sku,
          })),
        )
        .returning({ id: productVariants.id, sku: productVariants.sku })
    : [];
  const variantIdBySku = new Map(variants.map(({ id, sku }) => [sku.toLowerCase(), id]));

  const barcodeRows = [
    ...input.barcodes.map((barcode) => ({ productId, barcode, variantId: null })),
    ...input.variants.flatMap((variant) =>
      variant.barcodes.map((barcode) => ({
        productId,
        barcode,
        variantId: variantIdBySku.get(variant.sku.toLowerCase()) ?? null,
      })),
    ),
  ];
  if (barcodeRows.length) {
    await tx.insert(productBarcodes).values(barcodeRows);
  }

  if (input.unitConversions.length) {
    await tx.insert(productUnitConversions).values(
      input.unitConversions.map(({ unitId, conversionFactor }) => ({
        productId,
        unitId,
        conversionFactor: String(conversionFactor),
      })),
    );
  }

  const priceRows = [
    ...input.prices.map((price) => ({ ...price, variantId: null, variantSku: "" })),
    ...input.variants.flatMap((variant) => {
      const variantId = variantIdBySku.get(variant.sku.toLowerCase());
      if (!variantId) {
        return [];
      }
      return variant.prices.map((price) => ({
        ...price,
        variantId,
        variantSku: variant.sku.toLowerCase(),
      }));
    }),
  ];
  if (priceRows.length) {
    await tx.insert(productPrices).values(
      priceRows.map(
        ({
          branchId,
          priceTierId,
          purchasePriceCents,
          sellingPriceCents,
          variantId,
          variantSku,
        }) => ({
          productId,
          variantId,
          branchId,
          priceTierId,
          purchasePriceCents: canManageCost
            ? (purchasePriceCents ?? null)
            : (preservedCosts.get(`${variantSku}:${branchId ?? "*"}:${priceTierId ?? "*"}`) ??
              null),
          sellingPriceCents,
          updatedBy: actorUserId,
        }),
      ),
    );
  }
}

export async function createProduct(
  input: ProductInput,
  actorUserId: string,
  canManageCost: boolean,
): Promise<string> {
  return getDatabase().transaction(async (tx) => {
    await validateProductReferences(tx, input);
    const [product] = await tx
      .insert(products)
      .values({
        name: input.name,
        sku: input.sku,
        productType: input.productType,
        categoryId: input.categoryId,
        brand: input.brand,
        photoUrl: input.photoUrl,
        description: input.description,
        baseUnitId: input.baseUnitId,
        medicineClass: input.medicineClass,
        prescriptionRequired: input.prescriptionRequired,
        isActive: input.isActive,
        createdBy: actorUserId,
        updatedBy: actorUserId,
      })
      .returning({ id: products.id });
    if (!product) {
      throw new Error("Produk gagal disimpan.");
    }
    await replaceProductDetails(tx, product.id, input, actorUserId, canManageCost, new Map());
    await tx.insert(auditEvents).values({
      actorUserId,
      action: "product.created",
      targetType: "product",
      targetId: product.id,
      metadata: {
        productType: input.productType,
        barcodeCount: String(input.barcodes.length),
        variantCount: String(input.variants.length),
        priceCount: String(input.prices.length),
      },
    });
    return product.id;
  });
}

export async function updateProduct(
  productId: string,
  input: ProductInput,
  actorUserId: string,
  dataScope: PermissionDataScope,
  costDataScope: PermissionDataScope | null,
): Promise<void> {
  await getDatabase().transaction(async (tx) => {
    const [current] = await tx
      .select({ id: products.id, createdBy: products.createdBy })
      .from(products)
      .where(
        and(
          eq(products.id, productId),
          dataScope === "own" ? ownProductCondition(actorUserId) : undefined,
        ),
      )
      .for("update")
      .limit(1);
    if (!current) {
      throw new ProductNotFoundError("Produk tidak ditemukan.");
    }
    const canManageCost =
      costDataScope === "all" || (costDataScope === "own" && current.createdBy === actorUserId);
    const oldPrices = await tx
      .select({
        variantSku: productVariants.sku,
        branchId: productPrices.branchId,
        priceTierId: productPrices.priceTierId,
        purchasePriceCents: productPrices.purchasePriceCents,
      })
      .from(productPrices)
      .leftJoin(productVariants, eq(productPrices.variantId, productVariants.id))
      .where(eq(productPrices.productId, productId));
    const preservedCosts = new Map(
      oldPrices.map(({ variantSku, branchId, priceTierId, purchasePriceCents }) => [
        `${variantSku?.toLowerCase() ?? ""}:${branchId ?? "*"}:${priceTierId ?? "*"}`,
        purchasePriceCents,
      ]),
    );
    if (!canManageCost) {
      const newPriceKeys = new Set([
        ...input.prices.map(
          ({ branchId, priceTierId }) => `:${branchId ?? "*"}:${priceTierId ?? "*"}`,
        ),
        ...input.variants.flatMap((variant) =>
          variant.prices.map(
            ({ branchId, priceTierId }) =>
              `${variant.sku.toLowerCase()}:${branchId ?? "*"}:${priceTierId ?? "*"}`,
          ),
        ),
      ]);
      if (
        oldPrices.some(
          ({ variantSku, branchId, priceTierId, purchasePriceCents }) =>
            purchasePriceCents !== null &&
            !newPriceKeys.has(
              `${variantSku?.toLowerCase() ?? ""}:${branchId ?? "*"}:${priceTierId ?? "*"}`,
            ),
        )
      ) {
        throw new ProductCostAccessError(
          "Perubahan harga beli atau cakupan harganya memerlukan izin akses harga beli.",
        );
      }
    }
    await validateProductReferences(tx, input);
    await tx
      .update(products)
      .set({
        name: input.name,
        sku: input.sku,
        productType: input.productType,
        categoryId: input.categoryId,
        brand: input.brand,
        photoUrl: input.photoUrl,
        description: input.description,
        baseUnitId: input.baseUnitId,
        medicineClass: input.medicineClass,
        prescriptionRequired: input.prescriptionRequired,
        isActive: input.isActive,
        updatedBy: actorUserId,
        updatedAt: new Date(),
      })
      .where(eq(products.id, productId));

    await tx.delete(productPrices).where(eq(productPrices.productId, productId));
    await tx.delete(productBarcodes).where(eq(productBarcodes.productId, productId));
    await tx.delete(productUnitConversions).where(eq(productUnitConversions.productId, productId));
    await tx.delete(productVariants).where(eq(productVariants.productId, productId));
    await replaceProductDetails(tx, productId, input, actorUserId, canManageCost, preservedCosts);
    await tx.insert(auditEvents).values({
      actorUserId,
      action: "product.updated",
      targetType: "product",
      targetId: productId,
      metadata: {
        productType: input.productType,
        barcodeCount: String(input.barcodes.length),
        variantCount: String(input.variants.length),
        priceCount: String(input.prices.length),
      },
    });
  });
}

export async function createProductCategory(
  name: string,
  parentId: string | null,
  actorUserId: string,
) {
  return getDatabase().transaction(async (tx) => {
    if (parentId) {
      const [parent] = await tx
        .select({ id: productCategories.id })
        .from(productCategories)
        .where(eq(productCategories.id, parentId))
        .limit(1);
      if (!parent) {
        throw new ProductReferenceInvalidError("Kategori induk tidak ditemukan.");
      }
    }
    const [category] = await tx
      .insert(productCategories)
      .values({ name, parentId, createdBy: actorUserId })
      .returning({
        id: productCategories.id,
        name: productCategories.name,
        parentId: productCategories.parentId,
      });
    await tx.insert(auditEvents).values({
      actorUserId,
      action: "product.category_created",
      targetType: "product_category",
      targetId: category.id,
      metadata: { hasParent: String(parentId !== null) },
    });
    return category;
  });
}

export async function createUnit(
  input: {
    name: string;
    abbreviation: string;
    dimension: "count" | "mass" | "volume" | "length";
    baseUnitId: string | null;
    toBaseFactor: number;
  },
  actorUserId: string,
) {
  return getDatabase().transaction(async (tx) => {
    if (input.baseUnitId) {
      const [base] = await tx
        .select({ dimension: units.dimension, baseUnitId: units.baseUnitId })
        .from(units)
        .where(eq(units.id, input.baseUnitId))
        .limit(1);
      if (!base || base.dimension !== input.dimension || base.baseUnitId !== null) {
        throw new ProductReferenceInvalidError("Satuan dasar tidak valid untuk dimensi ini.");
      }
    }
    const [unit] = await tx
      .insert(units)
      .values({
        name: input.name,
        abbreviation: input.abbreviation,
        dimension: input.dimension,
        baseUnitId: input.baseUnitId,
        toBaseFactor: String(input.toBaseFactor),
        createdBy: actorUserId,
      })
      .returning({
        id: units.id,
        name: units.name,
        abbreviation: units.abbreviation,
        dimension: units.dimension,
        baseUnitId: units.baseUnitId,
        toBaseFactor: units.toBaseFactor,
      });
    await tx.insert(auditEvents).values({
      actorUserId,
      action: "product.unit_created",
      targetType: "unit",
      targetId: unit.id,
      metadata: { dimension: input.dimension },
    });
    return unit;
  });
}

export async function createPriceTier(name: string, description: string, actorUserId: string) {
  return getDatabase().transaction(async (tx) => {
    const [tier] = await tx
      .insert(priceTiers)
      .values({ name, description, createdBy: actorUserId })
      .returning({
        id: priceTiers.id,
        name: priceTiers.name,
        description: priceTiers.description,
      });
    await tx.insert(auditEvents).values({
      actorUserId,
      action: "product.price_tier_created",
      targetType: "price_tier",
      targetId: tier.id,
      metadata: {},
    });
    return tier;
  });
}

export async function listProductCatalogOptions() {
  const [categories, unitRows, tiers] = await Promise.all([
    getDatabase()
      .select({
        id: productCategories.id,
        name: productCategories.name,
        parentId: productCategories.parentId,
      })
      .from(productCategories)
      .orderBy(asc(productCategories.name)),
    getDatabase()
      .select({
        id: units.id,
        name: units.name,
        abbreviation: units.abbreviation,
        dimension: units.dimension,
        baseUnitId: units.baseUnitId,
        toBaseFactor: units.toBaseFactor,
      })
      .from(units)
      .orderBy(asc(units.name)),
    getDatabase()
      .select({ id: priceTiers.id, name: priceTiers.name, description: priceTiers.description })
      .from(priceTiers)
      .where(eq(priceTiers.isActive, true))
      .orderBy(asc(priceTiers.name)),
  ]);
  return { categories, units: unitRows, priceTiers: tiers };
}
