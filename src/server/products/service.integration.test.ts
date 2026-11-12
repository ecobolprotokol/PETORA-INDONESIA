import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase } from "@/db";
import {
  auditEvents,
  productCategories,
  products,
  serviceCategories,
  services,
  staffUsers,
} from "@/db/schema";
import { hashPassword } from "@/server/auth/password";
import {
  createService,
  createServiceCategory,
  listServices,
  updateService,
} from "@/server/services/service";
import { serviceSchema } from "@/server/services/validation";
import {
  createProduct,
  createProductCategory,
  listProducts,
  ProductCostAccessError,
  updateProduct,
} from "./service";
import { productSchema } from "./validation";

let staffId: string;
let otherStaffId: string;
let productId: string;
let otherProductId: string;
let serviceId: string;
let productCategoryId: string;
let serviceCategoryId: string;
const suffix = randomUUID();

function makeProductInput(sku: string, purchasePriceCents: number, sellingPriceCents = 2500) {
  return productSchema.parse({
    name: `Produk ${sku}`,
    sku,
    productType: "general",
    categoryId: null,
    baseUnitId: null,
    prices: [{ branchId: null, priceTierId: null, purchasePriceCents, sellingPriceCents }],
  });
}

function makeServiceInput(code: string, priceCents = 5000) {
  return serviceSchema.parse({
    name: `Layanan ${code}`,
    code,
    categoryId: serviceCategoryId,
    durationMinutes: 45,
    prices: [{ branchId: null, priceTierId: null, priceCents }],
  });
}

beforeAll(async () => {
  const database = getDatabase();
  const passwordHash = await hashPassword("phase-two-test-password");
  const [staff, otherStaff] = await Promise.all([
    database
      .insert(staffUsers)
      .values({ name: "Product Test", email: `product-${suffix}@example.test`, passwordHash })
      .returning({ id: staffUsers.id }),
    database
      .insert(staffUsers)
      .values({
        name: "Other Product Test",
        email: `other-product-${suffix}@example.test`,
        passwordHash,
      })
      .returning({ id: staffUsers.id }),
  ]);
  staffId = staff[0].id;
  otherStaffId = otherStaff[0].id;

  const productCategory = await createProductCategory(`Kategori ${suffix}`, null, staffId);
  productCategoryId = productCategory.id;
  const serviceCategory = await createServiceCategory(`Kategori layanan ${suffix}`, staffId);
  serviceCategoryId = serviceCategory.id;

  productId = await createProduct(makeProductInput(`P2-${suffix}-A`, 1234), staffId, true);
  otherProductId = await createProduct(
    makeProductInput(`P2-${suffix}-B`, 5678),
    otherStaffId,
    true,
  );
  serviceId = await createService(makeServiceInput(`S2-${suffix}`), staffId);
});

afterAll(async () => {
  const database = getDatabase();
  const ids = [staffId, otherStaffId].filter(Boolean);
  if (ids.length) {
    await database.delete(auditEvents).where(inArray(auditEvents.actorUserId, ids));
  }
  const productIds = [productId, otherProductId].filter(Boolean);
  if (productIds.length) {
    await database.delete(products).where(inArray(products.id, productIds));
  }
  if (serviceId) {
    await database.delete(services).where(eq(services.id, serviceId));
  }
  if (productCategoryId) {
    await database.delete(productCategories).where(eq(productCategories.id, productCategoryId));
  }
  if (serviceCategoryId) {
    await database.delete(serviceCategories).where(eq(serviceCategories.id, serviceCategoryId));
  }
  if (staffId) {
    await database.delete(staffUsers).where(eq(staffUsers.id, staffId));
  }
  if (otherStaffId) {
    await database.delete(staffUsers).where(eq(staffUsers.id, otherStaffId));
  }
});

describe("Phase 2 product and service catalogs", () => {
  it("limits purchase-cost visibility by permission scope and preserves hidden costs on edits", async () => {
    const records = await listProducts(staffId, "all", "own", suffix);
    const ownProduct = records.find(({ id }) => id === productId);
    const otherProduct = records.find(({ id }) => id === otherProductId);
    expect(ownProduct?.prices[0]?.purchasePriceCents).toBe(1234);
    expect(otherProduct?.prices[0]).not.toHaveProperty("purchasePriceCents");

    await updateProduct(
      productId,
      makeProductInput(`P2-${suffix}-A`, 9999, 3000),
      staffId,
      "all",
      null,
    );
    const visibleAfterEdit = await listProducts(staffId, "all", "all", suffix);
    expect(visibleAfterEdit.find(({ id }) => id === productId)?.prices[0]?.purchasePriceCents).toBe(
      1234,
    );

    await expect(
      updateProduct(
        productId,
        productSchema.parse({
          ...makeProductInput(`P2-${suffix}-A`, 0),
          prices: [{ branchId: randomUUID(), priceTierId: null, sellingPriceCents: 5000 }],
        }),
        staffId,
        "all",
        null,
      ),
    ).rejects.toBeInstanceOf(ProductCostAccessError);
  });

  it("audits product creation without including purchase prices", async () => {
    const rows = await getDatabase()
      .select({ action: auditEvents.action, metadata: auditEvents.metadata })
      .from(auditEvents)
      .where(and(eq(auditEvents.actorUserId, staffId), eq(auditEvents.targetId, productId)));
    expect(rows.some(({ action }) => action === "product.created")).toBe(true);
    expect(JSON.stringify(rows)).not.toContain("1234");
  });

  it("applies own scope to service records and replaces branch/tier price rows atomically", async () => {
    const ownRecords = await listServices(staffId, "own", suffix);
    expect(ownRecords.map(({ id }) => id)).toContain(serviceId);

    await updateService(serviceId, makeServiceInput(`S2-${suffix}`, 6500), staffId, "own");
    const updated = await listServices(staffId, "own", suffix);
    expect(updated.find(({ id }) => id === serviceId)?.prices[0]?.priceCents).toBe(6500);
    expect(updated.find(({ id }) => id === serviceId)?.categoryId).toBe(serviceCategoryId);
  });

  it("creates catalog categories with auditable records", async () => {
    const categories = await getDatabase()
      .select({ id: productCategories.id })
      .from(productCategories)
      .where(eq(productCategories.id, productCategoryId));
    expect(categories).toHaveLength(1);
    expect(
      await getDatabase()
        .select({ id: serviceCategories.id })
        .from(serviceCategories)
        .where(eq(serviceCategories.id, serviceCategoryId)),
    ).toHaveLength(1);
  });
});
