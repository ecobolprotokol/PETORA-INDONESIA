import { describe, expect, it } from "vitest";
import {
  assignRoleSchema,
  createRoleSchema,
  permissionOverrideSchema,
  updateRoleSchema,
} from "./validation";

describe("access validation", () => {
  it("accepts custom roles with registered permissions", () => {
    expect(
      createRoleSchema.parse({
        name: "Manajer Cabang",
        permissions: [{ key: "branches.read" }],
      }),
    ).toMatchObject({
      name: "Manajer Cabang",
      description: "",
      requiresTwoFactor: false,
      permissions: [{ key: "branches.read", dataScope: "all" }],
    });
  });

  it("allows roles to require two-factor authentication", () => {
    expect(createRoleSchema.parse({ name: "Supervisor", requiresTwoFactor: true })).toMatchObject({
      requiresTwoFactor: true,
    });
  });

  it("validates role updates and defaults them to active", () => {
    expect(updateRoleSchema.parse({ name: "Supervisor" })).toMatchObject({
      name: "Supervisor",
      isActive: true,
      requiresTwoFactor: false,
      permissions: [],
    });
    expect(updateRoleSchema.safeParse({ name: "Owner" }).success).toBe(false);
  });

  it("accepts own-record scope only for permissions that support it", () => {
    expect(
      createRoleSchema.safeParse({
        name: "Pemilik Cabang",
        permissions: [{ key: "branches.read", dataScope: "own" }],
      }).success,
    ).toBe(true);
    expect(
      createRoleSchema.safeParse({
        name: "Pengelola Cabang",
        permissions: [{ key: "branches.manage", dataScope: "own" }],
      }).success,
    ).toBe(false);
  });

  it("rejects Owner as a custom role and unsupported permission scopes", () => {
    expect(createRoleSchema.safeParse({ name: "Owner" }).success).toBe(false);
    expect(
      createRoleSchema.safeParse({
        name: "Kasir",
        permissions: [{ key: "branches.manage", dataScope: "own" }],
      }).success,
    ).toBe(false);
  });

  it("allows assignments to one branch or all branches", () => {
    expect(
      assignRoleSchema.safeParse({
        staffUserId: "4e81e0d9-d69b-4383-8885-c1f28032995b",
        roleId: "20a2c8a9-9b82-43a8-9981-13a897fc63b2",
        branchId: null,
      }).success,
    ).toBe(true);
  });

  it("requires a branch for branch permissions and a reason for overrides", () => {
    const base = {
      staffUserId: "4e81e0d9-d69b-4383-8885-c1f28032995b",
      permissionKey: "branches.read",
      effect: "allow",
      reason: "Tugas lintas cabang",
    };
    expect(permissionOverrideSchema.safeParse({ ...base, branchId: null }).success).toBe(false);
    expect(
      permissionOverrideSchema.safeParse({
        ...base,
        branchId: "20a2c8a9-9b82-43a8-9981-13a897fc63b2",
      }).success,
    ).toBe(true);
    expect(
      permissionOverrideSchema.safeParse({
        ...base,
        branchId: "20a2c8a9-9b82-43a8-9981-13a897fc63b2",
        reason: "ok",
      }).success,
    ).toBe(false);
  });
});
