import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase } from "@/db";
import {
  accessRoles,
  auditEvents,
  customers,
  rolePermissions,
  staffRoleAssignments,
  staffUsers,
} from "@/db/schema";
import { authorizeStaff } from "@/server/access/service";
import { hashPassword } from "@/server/auth/password";
import { CustomerNotFoundError, createCustomer, listCustomers, updateCustomer } from "./service";

let staffId: string;
let otherStaffId: string;
let roleId: string;
let ownCustomerId: string;
let otherCustomerId: string;

beforeAll(async () => {
  const database = getDatabase();
  const suffix = randomUUID();
  const passwordHash = await hashPassword("customer-test-password");
  const [staff] = await database
    .insert(staffUsers)
    .values({
      name: "Customer Scope Test",
      email: `customer-scope-${suffix}@example.test`,
      passwordHash,
    })
    .returning({ id: staffUsers.id });
  const [otherStaff] = await database
    .insert(staffUsers)
    .values({
      name: "Other Customer Test",
      email: `other-customer-${suffix}@example.test`,
      passwordHash,
    })
    .returning({ id: staffUsers.id });
  staffId = staff.id;
  otherStaffId = otherStaff.id;

  const [role] = await database
    .insert(accessRoles)
    .values({ name: `Customer Scope ${suffix}` })
    .returning({ id: accessRoles.id });
  roleId = role.id;

  await database.insert(rolePermissions).values([
    { roleId, permissionKey: "customers.read", dataScope: "own" },
    { roleId, permissionKey: "customers.manage", dataScope: "own" },
  ]);
  await database.insert(staffRoleAssignments).values({
    staffUserId: staffId,
    roleId,
    assignedBy: staffId,
  });

  const ownCustomer = await createCustomer(
    { name: "Customer Own", phone: "+6281234567801", email: "own@example.test" },
    staffId,
  );
  const otherCustomer = await createCustomer(
    { name: "Customer Other", phone: "+6281234567802", email: "other@example.test" },
    otherStaffId,
  );
  ownCustomerId = ownCustomer.id;
  otherCustomerId = otherCustomer.id;
});

afterAll(async () => {
  const database = getDatabase();
  const staffIds = [staffId, otherStaffId].filter(Boolean);
  if (staffIds.length) {
    await database
      .delete(auditEvents)
      .where(
        and(
          inArray(auditEvents.actorUserId, staffIds),
          inArray(auditEvents.action, ["customer.created", "customer.listed", "customer.updated"]),
        ),
      );
  }
  const customerIds = [ownCustomerId, otherCustomerId].filter(Boolean);
  if (customerIds.length) {
    await database.delete(customers).where(inArray(customers.id, customerIds));
  }
  if (staffId) {
    await database.delete(staffUsers).where(eq(staffUsers.id, staffId));
  }
  if (otherStaffId) {
    await database.delete(staffUsers).where(eq(staffUsers.id, otherStaffId));
  }
  if (roleId) {
    await database.delete(accessRoles).where(eq(accessRoles.id, roleId));
  }
});

describe("customer scope and audit", () => {
  it("limits own-scope reads to customers created by the requesting staff member", async () => {
    const grant = await authorizeStaff(
      { id: staffId, name: "Customer Scope Test", isOwner: false },
      "customers.read",
    );
    const manageGrant = await authorizeStaff(
      { id: staffId, name: "Customer Scope Test", isOwner: false },
      "customers.manage",
    );
    const noGrant = await authorizeStaff(
      { id: otherStaffId, name: "Other Customer Test", isOwner: false },
      "customers.read",
    );

    expect(grant?.dataScope).toBe("own");
    expect(manageGrant?.dataScope).toBe("own");
    expect(noGrant).toBeNull();
    const result = await listCustomers(staffId, grant?.dataScope ?? "all");

    expect(result.map(({ id }) => id)).toEqual([ownCustomerId]);
    await expect(listCustomers(staffId, "all")).resolves.toHaveLength(2);
  });

  it("prevents own-scope edits to another staff member's customer", async () => {
    await expect(
      updateCustomer(
        otherCustomerId,
        { name: "Tampered Customer", phone: "+6281234567899", email: null },
        staffId,
        "own",
      ),
    ).rejects.toBeInstanceOf(CustomerNotFoundError);

    const [unchanged] = await getDatabase()
      .select({ name: customers.name, phone: customers.phone })
      .from(customers)
      .where(eq(customers.id, otherCustomerId))
      .limit(1);
    expect(unchanged).toEqual({ name: "Customer Other", phone: "+6281234567802" });
  });

  it("audits customer changes using field names only and no contact values", async () => {
    await updateCustomer(
      ownCustomerId,
      { name: "Customer Own", phone: "+6281234567811", email: "own@example.test" },
      staffId,
      "own",
    );

    const events = await getDatabase()
      .select({ action: auditEvents.action, metadata: auditEvents.metadata })
      .from(auditEvents)
      .where(inArray(auditEvents.targetId, [ownCustomerId, otherCustomerId]));
    const createdEvent = events.find(({ action }) => action === "customer.created");
    const updatedEvent = events.find(({ action }) => action === "customer.updated");

    expect(createdEvent?.metadata).toEqual({ fields: "name,phone,email" });
    expect(updatedEvent?.metadata).toEqual({ fields: "phone" });
    expect(JSON.stringify(events)).not.toContain("+628123456");
    expect(JSON.stringify(events)).not.toContain("example.test");
  });

  it("audits scoped customer-list access without putting contact data in the event", async () => {
    await listCustomers(staffId, "own");
    const [event] = await getDatabase()
      .select({ metadata: auditEvents.metadata })
      .from(auditEvents)
      .where(and(eq(auditEvents.actorUserId, staffId), eq(auditEvents.action, "customer.listed")))
      .limit(1);

    expect(event?.metadata).toEqual({ dataScope: "own", returned: "1" });
    expect(JSON.stringify(event?.metadata)).not.toContain("Customer Own");
  });
});
