import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { getDatabase } from "@/db";
import { auditEvents, customers, petOwners } from "@/db/schema";
import type { PermissionDataScope } from "@/server/access/permissions";
import type { CustomerInput } from "./validation";

export class CustomerNotFoundError extends Error {}

export class CustomerMergeConflictError extends Error {}

export class CustomerImportConflictError extends Error {
  constructor(public readonly rows: number[]) {
    super("Satu atau lebih nomor telepon sudah terdaftar.");
  }
}

export function normalizeCustomerPhone(phone: string): string {
  const digits = phone.replace(/\D/gu, "");
  return digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
}

export interface CustomerRecord {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  isSample: boolean;
  address: string | null;
  notes: string | null;
  tags: string[];
  marketingConsent: boolean;
  notificationPreferences: { appointments: boolean; marketing: boolean };
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const customerSelection = {
  id: customers.id,
  name: customers.name,
  phone: customers.phone,
  email: customers.email,
  isSample: customers.isSample,
  address: customers.address,
  notes: customers.notes,
  tags: customers.tags,
  marketingConsent: customers.marketingConsent,
  notificationPreferences: customers.notificationPreferences,
  createdBy: customers.createdBy,
  createdAt: customers.createdAt,
  updatedAt: customers.updatedAt,
};

export async function listCustomers(
  staffUserId: string,
  dataScope: PermissionDataScope,
  query?: string,
): Promise<CustomerRecord[]> {
  const normalizedQuery = query?.trim();
  const pattern = normalizedQuery ? `%${normalizedQuery.replace(/[\\%_]/gu, "\\$&")}%` : undefined;
  return getDatabase().transaction(async (tx) => {
    const records = await tx
      .select(customerSelection)
      .from(customers)
      .where(
        and(
          dataScope === "own" ? eq(customers.createdBy, staffUserId) : undefined,
          pattern
            ? or(
                ilike(customers.name, pattern),
                ilike(customers.phone, pattern),
                ilike(customers.email, pattern),
              )
            : undefined,
        ),
      )
      .orderBy(desc(customers.createdAt), desc(customers.id))
      .limit(50);

    await tx.insert(auditEvents).values({
      actorUserId: staffUserId,
      action: normalizedQuery ? "customer.searched" : "customer.listed",
      targetType: "customer_collection",
      metadata: {
        dataScope,
        returned: String(records.length),
        ...(normalizedQuery ? { queryLength: String(normalizedQuery.length) } : {}),
      },
    });

    return records;
  });
}

export async function exportCustomers(
  staffUserId: string,
  dataScope: PermissionDataScope,
): Promise<CustomerRecord[]> {
  return getDatabase().transaction(async (tx) => {
    const records = await tx
      .select(customerSelection)
      .from(customers)
      .where(dataScope === "own" ? eq(customers.createdBy, staffUserId) : undefined)
      .orderBy(desc(customers.createdAt), desc(customers.id))
      .limit(10_000);
    await tx.insert(auditEvents).values({
      actorUserId: staffUserId,
      action: "customer.exported",
      targetType: "customer_collection",
      metadata: { dataScope, returned: String(records.length) },
    });
    return records;
  });
}

export async function importCustomers(inputs: CustomerInput[], actorUserId: string) {
  return getDatabase().transaction(async (tx) => {
    const normalizedPhones = inputs.map(({ phone }) => normalizeCustomerPhone(phone));
    const existing = await tx
      .select({ phoneNormalized: customers.phoneNormalized })
      .from(customers)
      .where(inArray(customers.phoneNormalized, normalizedPhones));
    const existingPhones = new Set(existing.map(({ phoneNormalized }) => phoneNormalized));
    const seen = new Set<string>();
    const duplicateRows = inputs.flatMap((_, index) => {
      const phone = normalizedPhones[index];
      if (existingPhones.has(phone) || seen.has(phone)) {
        return [index + 2];
      }
      seen.add(phone);
      return [];
    });
    if (duplicateRows.length) {
      throw new CustomerImportConflictError(duplicateRows);
    }

    const inserted = await tx
      .insert(customers)
      .values(
        inputs.map((input, index) => ({
          name: input.name,
          phone: input.phone,
          phoneNormalized: normalizedPhones[index],
          email: input.email,
          address: input.address || null,
          notes: input.notes || null,
          tags: input.tags ?? [],
          marketingConsent: input.marketingConsent ?? false,
          notificationPreferences: {
            appointments: input.notificationPreferences?.appointments ?? true,
            marketing: input.notificationPreferences?.marketing ?? false,
          },
          createdBy: actorUserId,
          updatedBy: actorUserId,
        })),
      )
      .returning({ id: customers.id });
    await tx.insert(auditEvents).values({
      actorUserId,
      action: "customer.imported",
      targetType: "customer_collection",
      metadata: {
        imported: String(inserted.length),
        fields: "name,phone,email,address,notes,tags,consent,notificationPreferences",
      },
    });
    return inserted.length;
  });
}

export async function findPotentialCustomerDuplicates(
  name: string,
  phone: string,
  email: string | null,
  staffUserId: string,
  dataScope: PermissionDataScope,
) {
  const normalizedPhone = normalizeCustomerPhone(phone);
  const normalizedEmail = email?.trim().toLowerCase();
  const records = await getDatabase()
    .select(customerSelection)
    .from(customers)
    .where(
      and(
        or(
          eq(customers.phoneNormalized, normalizedPhone),
          normalizedEmail ? sql`lower(${customers.email}) = ${normalizedEmail}` : undefined,
          eq(sql`lower(${customers.name})`, name.trim().toLowerCase()),
        ),
        dataScope === "own" ? eq(customers.createdBy, staffUserId) : undefined,
      ),
    )
    .orderBy(desc(customers.createdAt), desc(customers.id))
    .limit(10);
  await getDatabase()
    .insert(auditEvents)
    .values({
      actorUserId: staffUserId,
      action: "customer.duplicates_checked",
      targetType: "customer_collection",
      metadata: { dataScope, matches: String(records.length) },
    });
  return records;
}

export async function mergeCustomers(
  duplicateCustomerId: string,
  keepCustomerId: string,
  actorUserId: string,
  dataScope: PermissionDataScope,
) {
  if (duplicateCustomerId === keepCustomerId) {
    throw new CustomerMergeConflictError("Pilih dua pelanggan yang berbeda.");
  }
  return getDatabase().transaction(async (tx) => {
    const scope = dataScope === "own" ? eq(customers.createdBy, actorUserId) : undefined;
    const visible = await tx
      .select({ id: customers.id })
      .from(customers)
      .where(and(inArray(customers.id, [duplicateCustomerId, keepCustomerId]), scope))
      .for("update");
    if (visible.length !== 2) {
      throw new CustomerNotFoundError("Pelanggan tidak ditemukan.");
    }
    const [target] = await tx
      .select(customerSelection)
      .from(customers)
      .where(eq(customers.id, keepCustomerId))
      .limit(1);
    const [source] = await tx
      .select(customerSelection)
      .from(customers)
      .where(eq(customers.id, duplicateCustomerId))
      .limit(1);
    if (!target || !source) {
      throw new CustomerNotFoundError("Pelanggan tidak ditemukan.");
    }

    const sourceOwners = await tx
      .select({
        petId: petOwners.petId,
        relationship: petOwners.relationship,
        isPrimary: petOwners.isPrimary,
      })
      .from(petOwners)
      .where(eq(petOwners.customerId, duplicateCustomerId));
    const targetOwners = await tx
      .select({ petId: petOwners.petId, isPrimary: petOwners.isPrimary })
      .from(petOwners)
      .where(eq(petOwners.customerId, keepCustomerId));
    const targetByPet = new Map(targetOwners.map((owner) => [owner.petId, owner]));
    for (const owner of sourceOwners) {
      const existingOwner = targetByPet.get(owner.petId);
      if (!existingOwner) {
        await tx
          .update(petOwners)
          .set({ customerId: keepCustomerId })
          .where(
            and(eq(petOwners.petId, owner.petId), eq(petOwners.customerId, duplicateCustomerId)),
          );
        continue;
      }
      if (owner.isPrimary && !existingOwner.isPrimary) {
        await tx
          .update(petOwners)
          .set({ isPrimary: false })
          .where(
            and(eq(petOwners.petId, owner.petId), eq(petOwners.customerId, duplicateCustomerId)),
          );
        await tx
          .update(petOwners)
          .set({ isPrimary: true })
          .where(and(eq(petOwners.petId, owner.petId), eq(petOwners.customerId, keepCustomerId)));
      }
      await tx
        .delete(petOwners)
        .where(
          and(eq(petOwners.petId, owner.petId), eq(petOwners.customerId, duplicateCustomerId)),
        );
    }

    const changedFields = [
      ...(target.email || !source.email ? [] : ["email"]),
      ...(target.address || !source.address ? [] : ["address"]),
      ...(target.notes || !source.notes ? [] : ["notes"]),
      ...(!source.tags.some((tag) => !target.tags.includes(tag)) ? [] : ["tags"]),
      ...(target.isSample === source.isSample ? [] : ["isSample"]),
    ];
    await tx
      .update(customers)
      .set({
        email: target.email ?? source.email,
        address: target.address ?? source.address,
        notes: target.notes ?? source.notes,
        tags: [...new Set([...target.tags, ...source.tags])],
        isSample: target.isSample && source.isSample,
        updatedBy: actorUserId,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, keepCustomerId));
    await tx.delete(customers).where(eq(customers.id, duplicateCustomerId));
    await tx.insert(auditEvents).values({
      actorUserId,
      action: "customer.merged",
      targetType: "customer",
      targetId: keepCustomerId,
      metadata: {
        duplicateCustomerId,
        petsReassigned: String(sourceOwners.filter(({ petId }) => !targetByPet.has(petId)).length),
        fields: changedFields.join(","),
      },
    });
    return { keptCustomerId: keepCustomerId, removedCustomerId: duplicateCustomerId };
  });
}

export async function createCustomer(input: CustomerInput, actorUserId: string) {
  return getDatabase().transaction(async (tx) => {
    const [customer] = await tx
      .insert(customers)
      .values({
        name: input.name,
        phone: input.phone,
        phoneNormalized: normalizeCustomerPhone(input.phone),
        email: input.email,
        address: input.address || null,
        notes: input.notes || null,
        tags: input.tags ?? [],
        marketingConsent: input.marketingConsent ?? false,
        notificationPreferences: {
          appointments: input.notificationPreferences?.appointments ?? true,
          marketing: input.notificationPreferences?.marketing ?? false,
        },
        createdBy: actorUserId,
        updatedBy: actorUserId,
      })
      .returning(customerSelection);

    if (!customer) {
      throw new Error("Data pelanggan gagal disimpan.");
    }

    await tx.insert(auditEvents).values({
      actorUserId,
      action: "customer.created",
      targetType: "customer",
      targetId: customer.id,
      metadata: {
        fields: [
          "name",
          "phone",
          "email",
          ...(input.address ? ["address"] : []),
          ...(input.notes ? ["notes"] : []),
          ...(input.tags?.length ? ["tags"] : []),
          ...(input.marketingConsent ? ["marketingConsent"] : []),
          ...(input.notificationPreferences ? ["notificationPreferences"] : []),
        ].join(","),
      },
    });

    return customer;
  });
}

export async function deleteSampleCustomers(actorUserId: string): Promise<number> {
  return getDatabase().transaction(async (tx) => {
    const deleted = await tx
      .delete(customers)
      .where(eq(customers.isSample, true))
      .returning({ id: customers.id });

    if (deleted.length > 0) {
      await tx.insert(auditEvents).values({
        actorUserId,
        action: "setup.sample_data_cleared",
        targetType: "customer_sample_set",
        metadata: { customers: String(deleted.length) },
      });
    }

    return deleted.length;
  });
}

export async function updateCustomer(
  customerId: string,
  input: CustomerInput,
  actorUserId: string,
  dataScope: PermissionDataScope,
): Promise<CustomerRecord> {
  return getDatabase().transaction(async (tx) => {
    const ownScope = dataScope === "own" ? eq(customers.createdBy, actorUserId) : undefined;
    const [current] = await tx
      .select({
        id: customers.id,
        name: customers.name,
        phone: customers.phone,
        phoneNormalized: customers.phoneNormalized,
        email: customers.email,
        address: customers.address,
        notes: customers.notes,
        tags: customers.tags,
        marketingConsent: customers.marketingConsent,
        notificationPreferences: customers.notificationPreferences,
        isSample: customers.isSample,
      })
      .from(customers)
      .where(and(eq(customers.id, customerId), ownScope))
      .for("update")
      .limit(1);

    if (!current) {
      throw new CustomerNotFoundError("Pelanggan tidak ditemukan.");
    }

    const email = input.email || null;
    const address = input.address === undefined ? current.address : input.address || null;
    const notes = input.notes === undefined ? current.notes : input.notes || null;
    const tags = input.tags ?? current.tags;
    const marketingConsent = input.marketingConsent ?? current.marketingConsent;
    const notificationPreferences = {
      appointments:
        input.notificationPreferences?.appointments ?? current.notificationPreferences.appointments,
      marketing:
        input.notificationPreferences?.marketing ?? current.notificationPreferences.marketing,
    };
    const changedFields = [
      ...(current.name === input.name ? [] : ["name"]),
      ...(current.phone === input.phone ? [] : ["phone"]),
      ...(current.email === email ? [] : ["email"]),
      ...(current.address === address ? [] : ["address"]),
      ...(current.notes === notes ? [] : ["notes"]),
      ...(JSON.stringify(current.tags) === JSON.stringify(tags) ? [] : ["tags"]),
      ...(current.marketingConsent === marketingConsent ? [] : ["marketingConsent"]),
      ...(current.notificationPreferences.appointments === notificationPreferences.appointments &&
      current.notificationPreferences.marketing === notificationPreferences.marketing
        ? []
        : ["notificationPreferences"]),
      ...(current.isSample ? ["isSample"] : []),
    ];

    if (changedFields.length === 0) {
      const [unchanged] = await tx
        .select(customerSelection)
        .from(customers)
        .where(eq(customers.id, current.id))
        .limit(1);
      if (!unchanged) {
        throw new CustomerNotFoundError("Pelanggan tidak ditemukan.");
      }
      return unchanged;
    }

    const [updated] = await tx
      .update(customers)
      .set({
        name: input.name,
        phone: input.phone,
        phoneNormalized: normalizeCustomerPhone(input.phone),
        email,
        address,
        notes,
        tags,
        marketingConsent,
        notificationPreferences,
        isSample: false,
        updatedBy: actorUserId,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, current.id))
      .returning(customerSelection);

    if (!updated) {
      throw new CustomerNotFoundError("Pelanggan tidak ditemukan.");
    }

    await tx.insert(auditEvents).values({
      actorUserId,
      action: "customer.updated",
      targetType: "customer",
      targetId: customerId,
      metadata: { fields: changedFields.join(",") },
    });

    return updated;
  });
}
