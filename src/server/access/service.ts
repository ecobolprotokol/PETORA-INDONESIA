import { and, asc, eq, isNull, notInArray, or } from "drizzle-orm";
import { getDatabase } from "@/db";
import {
  accessPermissions,
  accessRoles,
  auditEvents,
  branches,
  rolePermissions,
  staffPermissionOverrides,
  staffRoleAssignments,
  staffUsers,
} from "@/db/schema";
import type { AuthenticatedStaff } from "@/server/auth/service";
import { enqueueStaffNotification } from "@/server/notifications/queue";
import type { PermissionDataScope, PermissionKey } from "./permissions";
import type {
  AssignRoleInput,
  CreateRoleInput,
  PermissionOverrideInput,
  UpdateRoleInput,
} from "./validation";

export class RoleNameConflictError extends Error {}

export class RoleAssignmentConflictError extends Error {}

export class StaffNotFoundError extends Error {}

export class StaffNotAssignableError extends Error {}

export class AccessRoleNotFoundError extends Error {}

export class AccessBranchNotFoundError extends Error {}

export class TwoFactorEnrollmentRequiredError extends Error {}

export class PermissionOverrideConflictError extends Error {}

export class PermissionOverrideNotFoundError extends Error {}

export class RoleTwoFactorConflictError extends Error {}

function hasConstraint(error: unknown, constraint: string): boolean {
  if (typeof error !== "object" || error === null || !("cause" in error)) {
    return false;
  }

  const cause = error.cause;
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    cause.code === "23505" &&
    "constraint" in cause &&
    cause.constraint === constraint
  );
}

export async function listAccessRoles() {
  const database = getDatabase();
  const roles = await database
    .select({
      id: accessRoles.id,
      name: accessRoles.name,
      description: accessRoles.description,
      isActive: accessRoles.isActive,
      requiresTwoFactor: accessRoles.requiresTwoFactor,
    })
    .from(accessRoles)
    .orderBy(asc(accessRoles.name));
  const permissions = await database
    .select({
      roleId: rolePermissions.roleId,
      key: rolePermissions.permissionKey,
      description: accessPermissions.description,
      dataScope: rolePermissions.dataScope,
      maxDiscountBps: rolePermissions.maxDiscountBps,
      maxRefundCents: rolePermissions.maxRefundCents,
      maxVoidCents: rolePermissions.maxVoidCents,
      maxTransferCents: rolePermissions.maxTransferCents,
      requiresSupervisorPin: rolePermissions.requiresSupervisorPin,
    })
    .from(rolePermissions)
    .innerJoin(accessPermissions, eq(rolePermissions.permissionKey, accessPermissions.key))
    .orderBy(asc(rolePermissions.permissionKey));

  return roles.map((role) => ({
    ...role,
    permissions: permissions
      .filter(({ roleId }) => roleId === role.id)
      .map(({ roleId: _roleId, ...permission }) => permission),
  }));
}

export async function listPermissionCatalog() {
  return getDatabase()
    .select({
      key: accessPermissions.key,
      description: accessPermissions.description,
      branchScoped: accessPermissions.branchScoped,
      supportsOwnScope: accessPermissions.supportsOwnScope,
      highRisk: accessPermissions.highRisk,
    })
    .from(accessPermissions)
    .orderBy(asc(accessPermissions.key));
}

export async function listPermissionOverrides() {
  return getDatabase()
    .select({
      id: staffPermissionOverrides.id,
      staffUserId: staffPermissionOverrides.staffUserId,
      staffName: staffUsers.name,
      staffEmail: staffUsers.email,
      permissionKey: staffPermissionOverrides.permissionKey,
      branchId: staffPermissionOverrides.branchId,
      branchName: branches.name,
      effect: staffPermissionOverrides.effect,
      dataScope: staffPermissionOverrides.dataScope,
      reason: staffPermissionOverrides.reason,
      maxDiscountBps: staffPermissionOverrides.maxDiscountBps,
      maxRefundCents: staffPermissionOverrides.maxRefundCents,
      maxVoidCents: staffPermissionOverrides.maxVoidCents,
      maxTransferCents: staffPermissionOverrides.maxTransferCents,
      requiresSupervisorPin: staffPermissionOverrides.requiresSupervisorPin,
      updatedAt: staffPermissionOverrides.updatedAt,
    })
    .from(staffPermissionOverrides)
    .innerJoin(staffUsers, eq(staffPermissionOverrides.staffUserId, staffUsers.id))
    .leftJoin(branches, eq(staffPermissionOverrides.branchId, branches.id))
    .orderBy(asc(staffUsers.name), asc(staffPermissionOverrides.permissionKey));
}

export async function setPermissionOverride(input: PermissionOverrideInput, actorUserId: string) {
  try {
    return await getDatabase().transaction(async (tx) => {
      const [staff] = await tx
        .select({ id: staffUsers.id, isActive: staffUsers.isActive, isOwner: staffUsers.isOwner })
        .from(staffUsers)
        .where(eq(staffUsers.id, input.staffUserId))
        .for("update")
        .limit(1);
      if (!staff?.isActive || staff.isOwner) {
        throw new StaffNotAssignableError("Pengecualian tidak dapat diberikan kepada akun ini.");
      }

      if (input.branchId) {
        const [branch] = await tx
          .select({ id: branches.id })
          .from(branches)
          .where(and(eq(branches.id, input.branchId), eq(branches.isActive, true)))
          .limit(1);
        if (!branch) {
          throw new AccessBranchNotFoundError("Cabang tidak ditemukan atau tidak aktif.");
        }
      }

      const scope = input.branchId
        ? eq(staffPermissionOverrides.branchId, input.branchId)
        : isNull(staffPermissionOverrides.branchId);
      const [existing] = await tx
        .select({ id: staffPermissionOverrides.id })
        .from(staffPermissionOverrides)
        .where(
          and(
            eq(staffPermissionOverrides.staffUserId, staff.id),
            eq(staffPermissionOverrides.permissionKey, input.permissionKey),
            scope,
          ),
        )
        .for("update")
        .limit(1);
      const values = {
        effect: input.effect,
        dataScope: input.dataScope,
        reason: input.reason,
        maxDiscountBps: input.maxDiscountBps ?? null,
        maxRefundCents: input.maxRefundCents ?? null,
        maxVoidCents: input.maxVoidCents ?? null,
        maxTransferCents: input.maxTransferCents ?? null,
        requiresSupervisorPin: input.requiresSupervisorPin ?? false,
        updatedBy: actorUserId,
        updatedAt: new Date(),
      };
      const [override] = existing
        ? await tx
            .update(staffPermissionOverrides)
            .set(values)
            .where(eq(staffPermissionOverrides.id, existing.id))
            .returning()
        : await tx
            .insert(staffPermissionOverrides)
            .values({
              ...values,
              staffUserId: staff.id,
              permissionKey: input.permissionKey,
              branchId: input.branchId,
              createdBy: actorUserId,
            })
            .returning();

      if (!override) {
        throw new Error("Pengecualian izin gagal disimpan.");
      }

      await tx.insert(auditEvents).values({
        actorUserId,
        action: "access.permission_override_set",
        targetType: "staff_permission_override",
        targetId: override.id,
        metadata: {
          permissionKey: input.permissionKey,
          effect: input.effect,
          branchScope: input.branchId ? "branch" : "global",
        },
      });

      return override;
    });
  } catch (error) {
    if (
      hasConstraint(error, "staff_permission_overrides_global_unique") ||
      hasConstraint(error, "staff_permission_overrides_branch_unique")
    ) {
      throw new PermissionOverrideConflictError("Pengecualian izin baru saja diubah.");
    }

    throw error;
  }
}

export async function removePermissionOverride(overrideId: string, actorUserId: string) {
  return getDatabase().transaction(async (tx) => {
    const [existing] = await tx
      .select({
        id: staffPermissionOverrides.id,
        permissionKey: staffPermissionOverrides.permissionKey,
        branchId: staffPermissionOverrides.branchId,
      })
      .from(staffPermissionOverrides)
      .where(eq(staffPermissionOverrides.id, overrideId))
      .for("update")
      .limit(1);
    if (!existing) {
      throw new PermissionOverrideNotFoundError("Pengecualian izin tidak ditemukan.");
    }

    await tx.delete(staffPermissionOverrides).where(eq(staffPermissionOverrides.id, existing.id));
    await tx.insert(auditEvents).values({
      actorUserId,
      action: "access.permission_override_removed",
      targetType: "staff_permission_override",
      targetId: existing.id,
      metadata: {
        permissionKey: existing.permissionKey,
        branchScope: existing.branchId ? "branch" : "global",
      },
    });
  });
}

export async function createAccessRole(input: CreateRoleInput, actorUserId: string) {
  try {
    return await getDatabase().transaction(async (tx) => {
      const [role] = await tx
        .insert(accessRoles)
        .values({
          name: input.name,
          description: input.description,
          requiresTwoFactor: input.requiresTwoFactor,
        })
        .returning({
          id: accessRoles.id,
          name: accessRoles.name,
          description: accessRoles.description,
          requiresTwoFactor: accessRoles.requiresTwoFactor,
        });

      if (!role) {
        throw new Error("Peran gagal dibuat.");
      }

      if (input.permissions.length > 0) {
        await tx.insert(rolePermissions).values(
          input.permissions.map((permission) => ({
            roleId: role.id,
            permissionKey: permission.key,
            dataScope: permission.dataScope,
            maxDiscountBps: permission.maxDiscountBps ?? null,
            maxRefundCents: permission.maxRefundCents ?? null,
            maxVoidCents: permission.maxVoidCents ?? null,
            maxTransferCents: permission.maxTransferCents ?? null,
            requiresSupervisorPin: permission.requiresSupervisorPin ?? false,
          })),
        );
      }

      await tx.insert(auditEvents).values({
        actorUserId,
        action: "access.role_created",
        targetType: "access_role",
        targetId: role.id,
        metadata: {
          requiresTwoFactor: String(input.requiresTwoFactor),
          permissionCount: String(input.permissions.length),
        },
      });

      return role;
    });
  } catch (error) {
    if (hasConstraint(error, "access_roles_name_lower_unique")) {
      throw new RoleNameConflictError("Nama peran sudah digunakan.");
    }

    throw error;
  }
}

export async function updateAccessRole(
  roleId: string,
  input: UpdateRoleInput,
  actorUserId: string,
) {
  try {
    return await getDatabase().transaction(async (tx) => {
      const [existingRole] = await tx
        .select({ id: accessRoles.id })
        .from(accessRoles)
        .where(eq(accessRoles.id, roleId))
        .for("update")
        .limit(1);
      if (!existingRole) {
        throw new AccessRoleNotFoundError("Peran tidak ditemukan.");
      }

      if (input.requiresTwoFactor) {
        const assignedStaff = await tx
          .select({
            totpEnabledAt: staffUsers.totpEnabledAt,
            totpSecretCiphertext: staffUsers.totpSecretCiphertext,
          })
          .from(staffRoleAssignments)
          .innerJoin(staffUsers, eq(staffRoleAssignments.staffUserId, staffUsers.id))
          .where(and(eq(staffRoleAssignments.roleId, roleId), eq(staffUsers.isActive, true)))
          .for("update");
        const hasUnenrolledStaff = assignedStaff.some(
          ({ totpEnabledAt, totpSecretCiphertext }) => !totpEnabledAt || !totpSecretCiphertext,
        );
        if (hasUnenrolledStaff) {
          throw new RoleTwoFactorConflictError(
            "Aktifkan 2FA untuk semua staf bertugas sebelum mewajibkan 2FA pada peran ini.",
          );
        }
      }

      const [role] = await tx
        .update(accessRoles)
        .set({
          name: input.name,
          description: input.description,
          isActive: input.isActive,
          requiresTwoFactor: input.requiresTwoFactor,
        })
        .where(eq(accessRoles.id, existingRole.id))
        .returning({
          id: accessRoles.id,
          name: accessRoles.name,
          description: accessRoles.description,
          isActive: accessRoles.isActive,
          requiresTwoFactor: accessRoles.requiresTwoFactor,
        });
      if (!role) {
        throw new Error("Perubahan peran gagal disimpan.");
      }

      await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id));
      if (input.permissions.length > 0) {
        await tx.insert(rolePermissions).values(
          input.permissions.map((permission) => ({
            roleId: role.id,
            permissionKey: permission.key,
            dataScope: permission.dataScope,
            maxDiscountBps: permission.maxDiscountBps ?? null,
            maxRefundCents: permission.maxRefundCents ?? null,
            maxVoidCents: permission.maxVoidCents ?? null,
            maxTransferCents: permission.maxTransferCents ?? null,
            requiresSupervisorPin: permission.requiresSupervisorPin ?? false,
          })),
        );
      }

      await tx.insert(auditEvents).values({
        actorUserId,
        action: "access.role_updated",
        targetType: "access_role",
        targetId: role.id,
        metadata: {
          isActive: String(role.isActive),
          requiresTwoFactor: String(role.requiresTwoFactor),
          permissionCount: String(input.permissions.length),
        },
      });

      return role;
    });
  } catch (error) {
    if (hasConstraint(error, "access_roles_name_lower_unique")) {
      throw new RoleNameConflictError("Nama peran sudah digunakan.");
    }

    throw error;
  }
}

export async function assignAccessRole(input: AssignRoleInput, actorUserId: string) {
  try {
    return await getDatabase().transaction(async (tx) => {
      const [role] = await tx
        .select({
          id: accessRoles.id,
          name: accessRoles.name,
          isActive: accessRoles.isActive,
          requiresTwoFactor: accessRoles.requiresTwoFactor,
        })
        .from(accessRoles)
        .where(eq(accessRoles.id, input.roleId))
        .for("update")
        .limit(1);

      if (!role?.isActive) {
        throw new AccessRoleNotFoundError("Peran tidak ditemukan atau tidak aktif.");
      }

      const [staff] = await tx
        .select({
          id: staffUsers.id,
          isOwner: staffUsers.isOwner,
          isActive: staffUsers.isActive,
          totpEnabledAt: staffUsers.totpEnabledAt,
          totpSecretCiphertext: staffUsers.totpSecretCiphertext,
        })
        .from(staffUsers)
        .where(eq(staffUsers.id, input.staffUserId))
        .for("update")
        .limit(1);

      if (!staff) {
        throw new StaffNotFoundError("Akun staf tidak ditemukan.");
      }

      if (staff.isOwner || !staff.isActive) {
        throw new StaffNotAssignableError("Peran tidak dapat ditugaskan ke akun ini.");
      }

      if (role.requiresTwoFactor && (!staff.totpEnabledAt || !staff.totpSecretCiphertext)) {
        throw new TwoFactorEnrollmentRequiredError(
          "Staf harus mengaktifkan autentikasi dua langkah sebelum menerima peran ini.",
        );
      }

      if (input.branchId) {
        const [branch] = await tx
          .select({ id: branches.id })
          .from(branches)
          .where(and(eq(branches.id, input.branchId), eq(branches.isActive, true)))
          .limit(1);

        if (!branch) {
          throw new AccessBranchNotFoundError("Cabang tidak ditemukan atau tidak aktif.");
        }
      }

      const [assignment] = await tx
        .insert(staffRoleAssignments)
        .values({
          staffUserId: staff.id,
          roleId: role.id,
          branchId: input.branchId,
          assignedBy: actorUserId,
        })
        .returning({
          id: staffRoleAssignments.id,
          staffUserId: staffRoleAssignments.staffUserId,
          roleId: staffRoleAssignments.roleId,
          branchId: staffRoleAssignments.branchId,
        });

      if (!assignment) {
        throw new Error("Penugasan peran gagal dibuat.");
      }

      await tx.insert(auditEvents).values({
        actorUserId,
        action: "access.role_assigned",
        targetType: "staff_role_assignment",
        targetId: assignment.id,
      });

      await enqueueStaffNotification(tx, staff.id, "access.role_assigned", {
        roleName: role.name,
      });

      return assignment;
    });
  } catch (error) {
    if (
      hasConstraint(error, "staff_role_assignment_global_unique") ||
      hasConstraint(error, "staff_role_assignment_branch_unique")
    ) {
      throw new RoleAssignmentConflictError("Peran sudah ditugaskan dalam cakupan tersebut.");
    }

    throw error;
  }
}

export interface StaffAuthorization {
  dataScope: PermissionDataScope;
  branchScope: "all" | "assigned";
  maxDiscountBps: number | null;
  maxRefundCents: number | null;
  maxVoidCents: number | null;
  maxTransferCents: number | null;
  requiresSupervisorPin: boolean;
}

export async function authorizeStaff(
  staff: AuthenticatedStaff,
  permissionKey: PermissionKey,
  branchId?: string,
): Promise<StaffAuthorization | null> {
  if (staff.isOwner) {
    return {
      dataScope: "all",
      branchScope: "all",
      maxDiscountBps: null,
      maxRefundCents: null,
      maxVoidCents: null,
      maxTransferCents: null,
      requiresSupervisorPin: false,
    };
  }

  const database = getDatabase();
  const [permission] = await database
    .select({
      branchScoped: accessPermissions.branchScoped,
      supportsOwnScope: accessPermissions.supportsOwnScope,
    })
    .from(accessPermissions)
    .where(eq(accessPermissions.key, permissionKey))
    .limit(1);

  if (!permission) {
    throw new Error(`Permission "${permissionKey}" belum terdaftar di basis data.`);
  }

  if (permission.branchScoped && !branchId) {
    return null;
  }

  if (branchId) {
    const [branch] = await database
      .select({ id: branches.id })
      .from(branches)
      .where(and(eq(branches.id, branchId), eq(branches.isActive, true)))
      .limit(1);

    if (!branch) {
      return null;
    }
  }

  const branchAssignmentFilter = branchId
    ? or(isNull(staffRoleAssignments.branchId), eq(staffRoleAssignments.branchId, branchId))
    : isNull(staffRoleAssignments.branchId);
  const grants = await database
    .select({
      dataScope: rolePermissions.dataScope,
      assignmentBranchId: staffRoleAssignments.branchId,
      maxDiscountBps: rolePermissions.maxDiscountBps,
      maxRefundCents: rolePermissions.maxRefundCents,
      maxVoidCents: rolePermissions.maxVoidCents,
      maxTransferCents: rolePermissions.maxTransferCents,
      requiresSupervisorPin: rolePermissions.requiresSupervisorPin,
    })
    .from(staffRoleAssignments)
    .innerJoin(accessRoles, eq(staffRoleAssignments.roleId, accessRoles.id))
    .innerJoin(rolePermissions, eq(accessRoles.id, rolePermissions.roleId))
    .where(
      and(
        eq(staffRoleAssignments.staffUserId, staff.id),
        eq(accessRoles.isActive, true),
        eq(rolePermissions.permissionKey, permissionKey),
        branchAssignmentFilter,
      ),
    );

  if (!permission.supportsOwnScope && grants.some(({ dataScope }) => dataScope === "own")) {
    throw new Error(`Permission "${permissionKey}" has an unsupported own-data scope.`);
  }

  const overrideBranchFilter = branchId
    ? or(isNull(staffPermissionOverrides.branchId), eq(staffPermissionOverrides.branchId, branchId))
    : isNull(staffPermissionOverrides.branchId);
  const overrides = await database
    .select({
      effect: staffPermissionOverrides.effect,
      dataScope: staffPermissionOverrides.dataScope,
      assignmentBranchId: staffPermissionOverrides.branchId,
      maxDiscountBps: staffPermissionOverrides.maxDiscountBps,
      maxRefundCents: staffPermissionOverrides.maxRefundCents,
      maxVoidCents: staffPermissionOverrides.maxVoidCents,
      maxTransferCents: staffPermissionOverrides.maxTransferCents,
      requiresSupervisorPin: staffPermissionOverrides.requiresSupervisorPin,
    })
    .from(staffPermissionOverrides)
    .where(
      and(
        eq(staffPermissionOverrides.staffUserId, staff.id),
        eq(staffPermissionOverrides.permissionKey, permissionKey),
        overrideBranchFilter,
      ),
    );

  if (overrides.some(({ effect }) => effect === "deny")) {
    return null;
  }

  const allowedGrants = [
    ...grants,
    ...overrides
      .filter(({ effect }) => effect === "allow")
      .map(
        ({
          dataScope,
          assignmentBranchId,
          maxDiscountBps,
          maxRefundCents,
          maxVoidCents,
          maxTransferCents,
          requiresSupervisorPin,
        }) => ({
          dataScope,
          assignmentBranchId,
          maxDiscountBps,
          maxRefundCents,
          maxVoidCents,
          maxTransferCents,
          requiresSupervisorPin,
        }),
      ),
  ];
  if (allowedGrants.length === 0) {
    return null;
  }

  const mostRestrictive = <T extends number>(values: Array<T | null>): T | null => {
    const present = values.filter((value): value is T => value !== null);
    if (present.length === 0) {
      return null;
    }
    return Math.min(...present) as T;
  };

  return {
    dataScope: allowedGrants.some(({ dataScope }) => dataScope === "all") ? "all" : "own",
    branchScope: allowedGrants.some(({ assignmentBranchId }) => assignmentBranchId === null)
      ? "all"
      : "assigned",
    maxDiscountBps: mostRestrictive(allowedGrants.map(({ maxDiscountBps }) => maxDiscountBps)),
    maxRefundCents: mostRestrictive(allowedGrants.map(({ maxRefundCents }) => maxRefundCents)),
    maxVoidCents: mostRestrictive(allowedGrants.map(({ maxVoidCents }) => maxVoidCents)),
    maxTransferCents: mostRestrictive(
      allowedGrants.map(({ maxTransferCents }) => maxTransferCents),
    ),
    requiresSupervisorPin: allowedGrants.some(({ requiresSupervisorPin }) => requiresSupervisorPin),
  };
}

export async function listBranchesForStaff(staff: AuthenticatedStaff) {
  const database = getDatabase();

  if (staff.isOwner) {
    return database
      .select({
        id: branches.id,
        code: branches.code,
        name: branches.name,
        timezone: branches.timezone,
        isActive: branches.isActive,
      })
      .from(branches)
      .orderBy(asc(branches.name));
  }

  const [grants, overrides] = await Promise.all([
    database
      .select({
        branchId: staffRoleAssignments.branchId,
        dataScope: rolePermissions.dataScope,
      })
      .from(staffRoleAssignments)
      .innerJoin(accessRoles, eq(staffRoleAssignments.roleId, accessRoles.id))
      .innerJoin(rolePermissions, eq(accessRoles.id, rolePermissions.roleId))
      .where(
        and(
          eq(staffRoleAssignments.staffUserId, staff.id),
          eq(accessRoles.isActive, true),
          eq(rolePermissions.permissionKey, "branches.read"),
        ),
      ),
    database
      .select({
        branchId: staffPermissionOverrides.branchId,
        effect: staffPermissionOverrides.effect,
        dataScope: staffPermissionOverrides.dataScope,
      })
      .from(staffPermissionOverrides)
      .where(
        and(
          eq(staffPermissionOverrides.staffUserId, staff.id),
          eq(staffPermissionOverrides.permissionKey, "branches.read"),
        ),
      ),
  ]);
  const allowOverrides = overrides.flatMap(({ effect, branchId, dataScope }) =>
    effect === "allow" && branchId ? [{ branchId, dataScope }] : [],
  );
  const scopes = [
    ...grants.map(({ branchId, dataScope }) =>
      and(
        ...(branchId ? [eq(branches.id, branchId)] : []),
        ...(dataScope === "own" ? [eq(branches.createdBy, staff.id)] : []),
      ),
    ),
    ...allowOverrides.map(({ branchId, dataScope }) =>
      and(
        eq(branches.id, branchId),
        ...(dataScope === "own" ? [eq(branches.createdBy, staff.id)] : []),
      ),
    ),
  ];
  if (scopes.length === 0) {
    return null;
  }

  const includesAllBranches = scopes.some((filter) => filter === undefined);
  const branchFilter = includesAllBranches
    ? undefined
    : or(...scopes.filter((filter): filter is NonNullable<typeof filter> => Boolean(filter)));
  const deniedBranchIds = overrides.flatMap(({ branchId, effect }) =>
    effect === "deny" && branchId ? [branchId] : [],
  );

  return database
    .select({
      id: branches.id,
      code: branches.code,
      name: branches.name,
      timezone: branches.timezone,
      isActive: branches.isActive,
    })
    .from(branches)
    .where(
      and(
        eq(branches.isActive, true),
        ...(branchFilter ? [branchFilter] : []),
        ...(deniedBranchIds.length ? [notInArray(branches.id, deniedBranchIds)] : []),
      ),
    )
    .orderBy(asc(branches.name));
}
