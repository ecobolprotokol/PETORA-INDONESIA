import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase } from "@/db";
import {
  accessRoles,
  branches,
  rolePermissions,
  staffPermissionOverrides,
  staffRoleAssignments,
  staffUsers,
  warehouses,
} from "@/db/schema";
import { listBranchesForStaff } from "./service";

let staffId: string;
let otherStaffId: string;
let roleId: string;
let ownBranchId: string;
let otherBranchId: string;

beforeAll(async () => {
  const database = getDatabase();
  const suffix = randomUUID();
  const [staff] = await database
    .insert(staffUsers)
    .values({
      name: "Own Scope Test",
      email: `own-scope-${suffix}@example.test`,
      passwordHash: "unused-test-hash",
    })
    .returning({ id: staffUsers.id });
  const [otherStaff] = await database
    .insert(staffUsers)
    .values({
      name: "Other Scope Test",
      email: `other-scope-${suffix}@example.test`,
      passwordHash: "unused-test-hash",
    })
    .returning({ id: staffUsers.id });
  staffId = staff.id;
  otherStaffId = otherStaff.id;

  const [role] = await database
    .insert(accessRoles)
    .values({ name: `Own Scope ${suffix}` })
    .returning({ id: accessRoles.id });
  roleId = role.id;

  await database.insert(rolePermissions).values({
    roleId,
    permissionKey: "branches.read",
    dataScope: "own",
  });
  await database.insert(staffRoleAssignments).values({
    staffUserId: staffId,
    roleId,
    assignedBy: staffId,
  });

  const [ownBranch] = await database
    .insert(branches)
    .values({
      code: `OWN-${suffix.slice(0, 6).toUpperCase()}`,
      name: "Own Scope Branch",
      timezone: "Asia/Jakarta",
      createdBy: staffId,
    })
    .returning({ id: branches.id });
  const [otherBranch] = await database
    .insert(branches)
    .values({
      code: `OTH-${suffix.slice(0, 6).toUpperCase()}`,
      name: "Other Scope Branch",
      timezone: "Asia/Jakarta",
      createdBy: otherStaffId,
    })
    .returning({ id: branches.id });
  ownBranchId = ownBranch.id;
  otherBranchId = otherBranch.id;
});

afterAll(async () => {
  const database = getDatabase();
  if (staffId) {
    await database
      .delete(staffPermissionOverrides)
      .where(eq(staffPermissionOverrides.staffUserId, staffId));
  }
  if (ownBranchId) {
    await database.delete(warehouses).where(eq(warehouses.branchId, ownBranchId));
    await database.delete(branches).where(eq(branches.id, ownBranchId));
  }
  if (otherBranchId) {
    await database.delete(warehouses).where(eq(warehouses.branchId, otherBranchId));
    await database.delete(branches).where(eq(branches.id, otherBranchId));
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

describe("branch ownership scope", () => {
  it("limits own-scope reads to active branches created by the requesting staff member", async () => {
    const result = await listBranchesForStaff({
      id: staffId,
      name: "Own Scope Test",
      isOwner: false,
    });

    expect(result?.map(({ id }) => id)).toEqual([ownBranchId]);
    expect(result?.some(({ id }) => id === otherBranchId)).toBe(false);
  });

  it("applies a branch-scoped deny on top of an existing role grant", async () => {
    await getDatabase().insert(staffPermissionOverrides).values({
      staffUserId: staffId,
      permissionKey: "branches.read",
      branchId: ownBranchId,
      effect: "deny",
      reason: "Branch access revoked for verification",
      createdBy: staffId,
      updatedBy: staffId,
    });

    const result = await listBranchesForStaff({
      id: staffId,
      name: "Own Scope Test",
      isOwner: false,
    });

    expect(result).toEqual([]);
  });
});
