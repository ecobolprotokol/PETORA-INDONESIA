import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { getDatabase } from "@/db";
import {
  accessRoles,
  auditEvents,
  authSessions,
  branches,
  staffRoleAssignments,
  staffUsers,
} from "@/db/schema";
import { hashPassword } from "@/server/auth/password";
import type { CreateStaffInput, UpdateStaffInput } from "./validation";

export interface StaffUserSummary {
  id: string;
  name: string;
  email: string;
  isOwner: boolean;
  isActive: boolean;
  hasTwoFactor: boolean;
  createdAt: Date;
  assignments: {
    roleId: string;
    roleName: string;
    branchId: string | null;
    branchName: string | null;
  }[];
}

export class StaffEmailConflictError extends Error {}

export class StaffAccountNotFoundError extends Error {}

export class OwnerAccountProtectedError extends Error {}

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

function hasOwnerProtectionError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("cause" in error)) {
    return false;
  }

  const cause = error.cause;
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    cause.code === "23514" &&
    "constraint" in cause &&
    cause.constraint === "staff_users_owner_protected"
  );
}

export async function listStaffUsers() {
  const database = getDatabase();
  const staff = await database
    .select({
      id: staffUsers.id,
      name: staffUsers.name,
      email: staffUsers.email,
      isOwner: staffUsers.isOwner,
      isActive: staffUsers.isActive,
      hasTwoFactor: sql<boolean>`${staffUsers.totpEnabledAt} IS NOT NULL`,
      createdAt: staffUsers.createdAt,
    })
    .from(staffUsers)
    .orderBy(asc(staffUsers.name));
  const assignments = await database
    .select({
      staffUserId: staffRoleAssignments.staffUserId,
      roleId: accessRoles.id,
      roleName: accessRoles.name,
      branchId: branches.id,
      branchName: branches.name,
    })
    .from(staffRoleAssignments)
    .innerJoin(accessRoles, eq(staffRoleAssignments.roleId, accessRoles.id))
    .leftJoin(branches, eq(staffRoleAssignments.branchId, branches.id))
    .orderBy(asc(accessRoles.name), asc(branches.name));

  return staff.map(
    (staffUser): StaffUserSummary => ({
      ...staffUser,
      assignments: assignments
        .filter(({ staffUserId }) => staffUserId === staffUser.id)
        .map(({ staffUserId: _staffUserId, ...assignment }) => assignment),
    }),
  );
}

export async function createStaffAccount(input: CreateStaffInput, actorUserId: string) {
  const passwordHash = await hashPassword(input.password);

  try {
    return await getDatabase().transaction(async (tx) => {
      const [staff] = await tx
        .insert(staffUsers)
        .values({
          name: input.name,
          email: input.email,
          passwordHash,
        })
        .returning({
          id: staffUsers.id,
          name: staffUsers.name,
          email: staffUsers.email,
          isOwner: staffUsers.isOwner,
          isActive: staffUsers.isActive,
          createdAt: staffUsers.createdAt,
        });

      if (!staff) {
        throw new Error("Akun staf gagal dibuat.");
      }

      await tx.insert(auditEvents).values({
        actorUserId,
        action: "staff.created",
        targetType: "staff_user",
        targetId: staff.id,
      });

      return staff;
    });
  } catch (error) {
    if (hasConstraint(error, "staff_users_email_lower_unique")) {
      throw new StaffEmailConflictError("Email sudah digunakan.");
    }

    throw error;
  }
}

export async function updateStaffAccount(
  staffUserId: string,
  input: UpdateStaffInput,
  actorUserId: string,
) {
  const passwordHash = input.password ? await hashPassword(input.password) : undefined;

  try {
    return await getDatabase().transaction(async (tx) => {
      const [current] = await tx
        .select({ id: staffUsers.id, isOwner: staffUsers.isOwner })
        .from(staffUsers)
        .where(eq(staffUsers.id, staffUserId))
        .for("update")
        .limit(1);

      if (!current) {
        throw new StaffAccountNotFoundError("Akun staf tidak ditemukan.");
      }

      if (current.isOwner && input.isActive === false) {
        throw new OwnerAccountProtectedError("Akun Owner tidak dapat dinonaktifkan.");
      }

      const updateValues = {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.email === undefined ? {} : { email: input.email }),
        ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
        ...(passwordHash === undefined ? {} : { passwordHash }),
        updatedAt: new Date(),
      };

      const [updated] = await tx
        .update(staffUsers)
        .set(updateValues)
        .where(eq(staffUsers.id, current.id))
        .returning({
          id: staffUsers.id,
          name: staffUsers.name,
          email: staffUsers.email,
          isOwner: staffUsers.isOwner,
          isActive: staffUsers.isActive,
          createdAt: staffUsers.createdAt,
        });

      if (!updated) {
        throw new Error("Akun staf gagal diperbarui.");
      }

      if (passwordHash !== undefined || input.isActive === false) {
        await tx
          .update(authSessions)
          .set({ revokedAt: new Date() })
          .where(and(eq(authSessions.userId, current.id), isNull(authSessions.revokedAt)));
      }

      if (input.name !== undefined || input.email !== undefined || input.isActive !== undefined) {
        await tx.insert(auditEvents).values({
          actorUserId,
          action: input.isActive === false ? "staff.deactivated" : "staff.updated",
          targetType: "staff_user",
          targetId: current.id,
        });
      }

      if (passwordHash !== undefined) {
        await tx.insert(auditEvents).values({
          actorUserId,
          action: "staff.password_changed",
          targetType: "staff_user",
          targetId: current.id,
        });
      }

      return updated;
    });
  } catch (error) {
    if (hasConstraint(error, "staff_users_email_lower_unique")) {
      throw new StaffEmailConflictError("Email sudah digunakan.");
    }

    if (hasOwnerProtectionError(error)) {
      throw new OwnerAccountProtectedError(
        "Akun Owner tidak dapat diturunkan peran atau dinonaktifkan.",
      );
    }

    throw error;
  }
}
