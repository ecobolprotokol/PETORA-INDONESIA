import { and, desc, eq } from "drizzle-orm";
import { getDatabase } from "@/db";
import { auditEvents, customers } from "@/db/schema";
import type { PermissionDataScope } from "@/server/access/permissions";
import type { CustomerInput } from "./validation";

export class CustomerNotFoundError extends Error {}

export interface CustomerRecord {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  isSample: boolean;
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
  createdBy: customers.createdBy,
  createdAt: customers.createdAt,
  updatedAt: customers.updatedAt,
};

export async function listCustomers(
  staffUserId: string,
  dataScope: PermissionDataScope,
): Promise<CustomerRecord[]> {
  return getDatabase().transaction(async (tx) => {
    const records = await tx
      .select(customerSelection)
      .from(customers)
      .where(dataScope === "own" ? eq(customers.createdBy, staffUserId) : undefined)
      .orderBy(desc(customers.createdAt), desc(customers.id))
      .limit(50);

    await tx.insert(auditEvents).values({
      actorUserId: staffUserId,
      action: "customer.listed",
      targetType: "customer_collection",
      metadata: {
        dataScope,
        returned: String(records.length),
      },
    });

    return records;
  });
}

export async function createCustomer(input: CustomerInput, actorUserId: string) {
  return getDatabase().transaction(async (tx) => {
    const [customer] = await tx
      .insert(customers)
      .values({
        name: input.name,
        phone: input.phone,
        email: input.email,
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
      metadata: { fields: "name,phone,email" },
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
        email: customers.email,
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
    const changedFields = [
      ...(current.name === input.name ? [] : ["name"]),
      ...(current.phone === input.phone ? [] : ["phone"]),
      ...(current.email === email ? [] : ["email"]),
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
        email,
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
