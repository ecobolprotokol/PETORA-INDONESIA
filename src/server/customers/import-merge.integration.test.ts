import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase } from "@/db";
import { auditEvents, customers, petOwners, pets, staffUsers } from "@/db/schema";
import { hashPassword } from "@/server/auth/password";
import { createCustomer, exportCustomers, importCustomers, mergeCustomers } from "./service";

let staffId: string;
let keepCustomerId: string;
let duplicateCustomerId: string;
let petId: string;
let importedCustomerId: string;
const suffix = randomUUID();

beforeAll(async () => {
  const database = getDatabase();
  const [staff] = await database
    .insert(staffUsers)
    .values({
      name: "Customer Merge Test",
      email: `customer-merge-${suffix}@example.test`,
      passwordHash: await hashPassword("customer-merge-test-password"),
    })
    .returning({ id: staffUsers.id });
  staffId = staff.id;
  const keep = await createCustomer(
    {
      name: "Keep Customer",
      phone: `+628111${suffix.replaceAll("-", "").slice(0, 7)}`,
      email: null,
      tags: ["utama"],
      marketingConsent: false,
    },
    staffId,
  );
  const duplicate = await createCustomer(
    {
      name: "Duplicate Customer",
      phone: `+628222${suffix.replaceAll("-", "").slice(0, 7)}`,
      email: `merged-${suffix}@example.test`,
      address: "Alamat sumber",
      notes: "Catatan sumber",
      tags: ["tambahan"],
      marketingConsent: true,
      notificationPreferences: { appointments: false, marketing: true },
    },
    staffId,
  );
  keepCustomerId = keep.id;
  duplicateCustomerId = duplicate.id;

  const [pet] = await database
    .insert(pets)
    .values({ name: `Pet ${suffix}`, species: "cat", createdBy: staffId, updatedBy: staffId })
    .returning({ id: pets.id });
  petId = pet.id;
  await database.insert(petOwners).values([
    { petId, customerId: duplicateCustomerId, relationship: "Pemilik utama", isPrimary: true },
    { petId, customerId: keepCustomerId, relationship: "Keluarga", isPrimary: false },
  ]);
});

afterAll(async () => {
  const database = getDatabase();
  if (staffId) {
    await database.delete(auditEvents).where(eq(auditEvents.actorUserId, staffId));
  }
  if (petId) {
    await database.delete(pets).where(eq(pets.id, petId));
  }
  const customerIds = [keepCustomerId, duplicateCustomerId, importedCustomerId].filter(Boolean);
  if (customerIds.length) {
    await database.delete(customers).where(inArray(customers.id, customerIds));
  }
  if (staffId) {
    await database.delete(staffUsers).where(eq(staffUsers.id, staffId));
  }
});

describe("customer imports, exports, and merge", () => {
  it("imports batches atomically and reports duplicate CSV row numbers", async () => {
    const duplicateInput = {
      name: "Import Duplicate",
      phone: `+628111${suffix.replaceAll("-", "").slice(0, 7)}`,
      email: null,
    };
    await expect(importCustomers([duplicateInput], staffId)).rejects.toMatchObject({
      rows: [2],
    });

    const imported = await importCustomers(
      [
        {
          name: "Imported Customer",
          phone: `+628333${suffix.replaceAll("-", "").slice(0, 7)}`,
          email: `imported-${suffix}@example.test`,
          notes: "Catatan impor",
          tags: ["csv"],
        },
      ],
      staffId,
    );
    expect(imported).toBe(1);
    const exported = await exportCustomers(staffId, "own");
    const importedRecord = exported.find(
      ({ email }) => email === `imported-${suffix}@example.test`,
    );
    expect(importedRecord?.createdBy).toBe(staffId);
    expect(importedRecord?.notes).toBe("Catatan impor");
    importedCustomerId = importedRecord?.id ?? "";
  });

  it("merges customer data and pet ownership without broadening consent", async () => {
    await mergeCustomers(duplicateCustomerId, keepCustomerId, staffId, "own");
    const [kept] = await getDatabase()
      .select({
        name: customers.name,
        phone: customers.phone,
        email: customers.email,
        address: customers.address,
        notes: customers.notes,
        tags: customers.tags,
        marketingConsent: customers.marketingConsent,
        notificationPreferences: customers.notificationPreferences,
      })
      .from(customers)
      .where(eq(customers.id, keepCustomerId));
    expect(kept).toMatchObject({
      name: "Keep Customer",
      email: `merged-${suffix}@example.test`,
      address: "Alamat sumber",
      notes: "Catatan sumber",
      tags: ["utama", "tambahan"],
      marketingConsent: false,
      notificationPreferences: { appointments: true, marketing: false },
    });
    expect(kept.phone).toMatch(/^\+628111/u);
    expect(
      await getDatabase()
        .select({ customerId: petOwners.customerId, isPrimary: petOwners.isPrimary })
        .from(petOwners)
        .where(eq(petOwners.petId, petId)),
    ).toEqual([{ customerId: keepCustomerId, isPrimary: true }]);
    await expect(
      getDatabase()
        .select({ id: customers.id })
        .from(customers)
        .where(eq(customers.id, duplicateCustomerId)),
    ).resolves.toHaveLength(0);
    const mergeEvents = await getDatabase()
      .select({ action: auditEvents.action, metadata: auditEvents.metadata })
      .from(auditEvents)
      .where(andActorId(staffId, keepCustomerId));
    expect(mergeEvents.some(({ action }) => action === "customer.merged")).toBe(true);
    expect(JSON.stringify(mergeEvents)).not.toContain("Alamat sumber");
  });
});

function andActorId(actorId: string, targetId: string) {
  return and(
    inArray(auditEvents.action, ["customer.merged"]),
    eq(auditEvents.actorUserId, actorId),
    eq(auditEvents.targetId, targetId),
  );
}
