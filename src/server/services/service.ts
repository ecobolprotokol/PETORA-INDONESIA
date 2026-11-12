import { and, asc, eq, ilike, inArray, sql } from "drizzle-orm";
import { getDatabase } from "@/db";
import {
  auditEvents,
  branches,
  priceTiers,
  serviceCategories,
  servicePrices,
  services,
} from "@/db/schema";
import type { PermissionDataScope } from "@/server/access/permissions";
import type { ServiceInput } from "./validation";

export class ServiceNotFoundError extends Error {}

export class ServiceReferenceInvalidError extends Error {}

export interface ServiceRecord {
  id: string;
  name: string;
  code: string;
  categoryId: string | null;
  categoryName: string | null;
  description: string | null;
  durationMinutes: number;
  isActive: boolean;
  createdBy: string | null;
  prices: Array<{
    id: string;
    branchId: string | null;
    priceTierId: string | null;
    priceCents: number;
  }>;
}

const serviceSelection = {
  id: services.id,
  name: services.name,
  code: services.code,
  categoryId: services.categoryId,
  categoryName: serviceCategories.name,
  description: services.description,
  durationMinutes: services.durationMinutes,
  isActive: services.isActive,
  createdBy: services.createdBy,
};

async function loadPrices(serviceIds: string[]) {
  if (serviceIds.length === 0) {
    return new Map<string, ServiceRecord["prices"]>();
  }
  const rows = await getDatabase()
    .select({
      serviceId: servicePrices.serviceId,
      id: servicePrices.id,
      branchId: servicePrices.branchId,
      priceTierId: servicePrices.priceTierId,
      priceCents: servicePrices.priceCents,
    })
    .from(servicePrices)
    .where(inArray(servicePrices.serviceId, serviceIds));
  const grouped = new Map<string, ServiceRecord["prices"]>();
  for (const { serviceId, ...price } of rows) {
    const prices = grouped.get(serviceId) ?? [];
    prices.push(price);
    grouped.set(serviceId, prices);
  }
  return grouped;
}

export async function listServices(
  staffUserId: string,
  dataScope: PermissionDataScope,
  query?: string,
): Promise<ServiceRecord[]> {
  const normalizedQuery = query?.trim();
  const records = await getDatabase()
    .select(serviceSelection)
    .from(services)
    .leftJoin(serviceCategories, eq(services.categoryId, serviceCategories.id))
    .where(
      and(
        dataScope === "own" ? eq(services.createdBy, staffUserId) : undefined,
        normalizedQuery
          ? sql`(${ilike(services.name, `%${normalizedQuery}%`)} OR ${ilike(services.code, `%${normalizedQuery}%`)})`
          : undefined,
      ),
    )
    .orderBy(asc(services.name), asc(services.id))
    .limit(100);
  const prices = await loadPrices(records.map(({ id }) => id));
  const result = records.map((service) => ({
    ...service,
    prices: prices.get(service.id) ?? [],
  }));
  await getDatabase()
    .insert(auditEvents)
    .values({
      actorUserId: staffUserId,
      action: normalizedQuery ? "service.searched" : "service.listed",
      targetType: "service_collection",
      metadata: {
        dataScope,
        returned: String(result.length),
        ...(normalizedQuery ? { queryLength: String(normalizedQuery.length) } : {}),
      },
    });
  return result;
}

async function validateServiceReferences(
  tx: Parameters<Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]>[0],
  input: ServiceInput,
) {
  if (input.categoryId) {
    const [category] = await tx
      .select({ id: serviceCategories.id })
      .from(serviceCategories)
      .where(eq(serviceCategories.id, input.categoryId))
      .limit(1);
    if (!category) {
      throw new ServiceReferenceInvalidError("Kategori layanan tidak ditemukan.");
    }
  }
  const branchIds = [
    ...new Set(input.prices.flatMap(({ branchId }) => (branchId ? [branchId] : []))),
  ];
  if (branchIds.length) {
    const validBranches = await tx
      .select({ id: branches.id })
      .from(branches)
      .where(and(inArray(branches.id, branchIds), eq(branches.isActive, true)));
    if (validBranches.length !== branchIds.length) {
      throw new ServiceReferenceInvalidError("Satu atau lebih cabang harga tidak ditemukan.");
    }
  }
  const tierIds = [
    ...new Set(input.prices.flatMap(({ priceTierId }) => (priceTierId ? [priceTierId] : []))),
  ];
  if (tierIds.length) {
    const validTiers = await tx
      .select({ id: priceTiers.id })
      .from(priceTiers)
      .where(and(inArray(priceTiers.id, tierIds), eq(priceTiers.isActive, true)));
    if (validTiers.length !== tierIds.length) {
      throw new ServiceReferenceInvalidError("Satu atau lebih tingkat harga tidak ditemukan.");
    }
  }
}

export async function createService(input: ServiceInput, actorUserId: string): Promise<string> {
  return getDatabase().transaction(async (tx) => {
    await validateServiceReferences(tx, input);
    const [service] = await tx
      .insert(services)
      .values({
        name: input.name,
        code: input.code,
        categoryId: input.categoryId,
        description: input.description || null,
        durationMinutes: input.durationMinutes,
        isActive: input.isActive,
        createdBy: actorUserId,
        updatedBy: actorUserId,
      })
      .returning({ id: services.id });
    if (!service) {
      throw new Error("Layanan gagal disimpan.");
    }
    await tx.insert(servicePrices).values(
      input.prices.map((price) => ({
        ...price,
        serviceId: service.id,
        updatedBy: actorUserId,
      })),
    );
    await tx.insert(auditEvents).values({
      actorUserId,
      action: "service.created",
      targetType: "service",
      targetId: service.id,
      metadata: {
        durationMinutes: String(input.durationMinutes),
        priceCount: String(input.prices.length),
      },
    });
    return service.id;
  });
}

export async function updateService(
  serviceId: string,
  input: ServiceInput,
  actorUserId: string,
  dataScope: PermissionDataScope,
) {
  await getDatabase().transaction(async (tx) => {
    const [current] = await tx
      .select({ id: services.id })
      .from(services)
      .where(
        and(
          eq(services.id, serviceId),
          dataScope === "own" ? eq(services.createdBy, actorUserId) : undefined,
        ),
      )
      .for("update")
      .limit(1);
    if (!current) {
      throw new ServiceNotFoundError("Layanan tidak ditemukan.");
    }
    await validateServiceReferences(tx, input);
    await tx
      .update(services)
      .set({
        name: input.name,
        code: input.code,
        categoryId: input.categoryId,
        description: input.description || null,
        durationMinutes: input.durationMinutes,
        isActive: input.isActive,
        updatedBy: actorUserId,
        updatedAt: new Date(),
      })
      .where(eq(services.id, serviceId));
    await tx.delete(servicePrices).where(eq(servicePrices.serviceId, serviceId));
    await tx.insert(servicePrices).values(
      input.prices.map((price) => ({
        ...price,
        serviceId,
        updatedBy: actorUserId,
      })),
    );
    await tx.insert(auditEvents).values({
      actorUserId,
      action: "service.updated",
      targetType: "service",
      targetId: serviceId,
      metadata: {
        durationMinutes: String(input.durationMinutes),
        priceCount: String(input.prices.length),
      },
    });
  });
}

export async function createServiceCategory(name: string, actorUserId: string) {
  return getDatabase().transaction(async (tx) => {
    const [category] = await tx
      .insert(serviceCategories)
      .values({ name, createdBy: actorUserId })
      .returning({ id: serviceCategories.id, name: serviceCategories.name });
    await tx.insert(auditEvents).values({
      actorUserId,
      action: "service.category_created",
      targetType: "service_category",
      targetId: category.id,
      metadata: {},
    });
    return category;
  });
}

export async function listServiceCategories() {
  return getDatabase()
    .select({ id: serviceCategories.id, name: serviceCategories.name })
    .from(serviceCategories)
    .orderBy(asc(serviceCategories.name));
}

export async function listServicePriceTiers() {
  return getDatabase()
    .select({ id: priceTiers.id, name: priceTiers.name })
    .from(priceTiers)
    .where(eq(priceTiers.isActive, true))
    .orderBy(asc(priceTiers.name));
}
