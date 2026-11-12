import { eq, sql } from "drizzle-orm";
import { getDatabase } from "@/db";
import { auditEvents, staffUsers } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/server/auth/password";

export class SupervisorPinNotSetError extends Error {}
export class SupervisorPinInvalidError extends Error {}
export class SupervisorPinAlreadySetError extends Error {}

export interface SupervisorPinStatus {
  isSet: boolean;
  updatedAt: Date | null;
}

export async function getSupervisorPinStatus(staffUserId: string): Promise<SupervisorPinStatus> {
  const [staff] = await getDatabase()
    .select({
      pinHash: staffUsers.supervisorPinHash,
      updatedAt: staffUsers.updatedAt,
    })
    .from(staffUsers)
    .where(eq(staffUsers.id, staffUserId))
    .limit(1);

  if (!staff) {
    throw new Error("Akun staf tidak ditemukan.");
  }

  return {
    isSet: Boolean(staff.pinHash),
    updatedAt: staff.updatedAt,
  };
}

export async function verifySupervisorPin(staffUserId: string, pin: string): Promise<boolean> {
  const [staff] = await getDatabase()
    .select({
      id: staffUsers.id,
      pinHash: staffUsers.supervisorPinHash,
    })
    .from(staffUsers)
    .where(eq(staffUsers.id, staffUserId))
    .limit(1);

  if (!staff?.pinHash) {
    throw new SupervisorPinNotSetError("PIN supervisor belum diatur.");
  }

  const isValid = await verifyPassword(pin, staff.pinHash);
  if (!isValid) {
    await getDatabase().insert(auditEvents).values({
      actorUserId: staffUserId,
      action: "staff.supervisor_pin_verification_failed",
      targetType: "staff_user",
      targetId: staffUserId,
    });
    throw new SupervisorPinInvalidError("PIN supervisor tidak valid.");
  }

  return true;
}

export async function setSupervisorPin(
  staffUserId: string,
  pin: string,
  actorUserId: string,
  currentPassword: string,
): Promise<void> {
  const database = getDatabase();

  await database.transaction(async (tx) => {
    const [staff] = await tx
      .select({
        id: staffUsers.id,
        name: staffUsers.name,
        passwordHash: staffUsers.passwordHash,
        pinHash: staffUsers.supervisorPinHash,
      })
      .from(staffUsers)
      .where(eq(staffUsers.id, staffUserId))
      .for("update")
      .limit(1);

    if (!staff) {
      throw new Error("Akun staf tidak ditemukan.");
    }

    if (!(await verifyPassword(currentPassword, staff.passwordHash))) {
      throw new SupervisorPinInvalidError("Kata sandi tidak valid.");
    }

    if (staff.pinHash) {
      throw new SupervisorPinAlreadySetError("PIN supervisor sudah diatur.");
    }

    const pinHash = await hashPassword(pin);

    await tx
      .update(staffUsers)
      .set({ supervisorPinHash: pinHash, updatedAt: new Date() })
      .where(eq(staffUsers.id, staff.id));

    await tx.insert(auditEvents).values({
      actorUserId,
      action: "staff.supervisor_pin_set",
      targetType: "staff_user",
      targetId: staff.id,
    });
  });
}

export async function resetSupervisorPin(
  staffUserId: string,
  newPin: string,
  actorUserId: string,
  currentPassword: string,
  currentPin?: string,
): Promise<void> {
  const database = getDatabase();

  await database.transaction(async (tx) => {
    const [staff] = await tx
      .select({
        id: staffUsers.id,
        name: staffUsers.name,
        passwordHash: staffUsers.passwordHash,
        pinHash: staffUsers.supervisorPinHash,
      })
      .from(staffUsers)
      .where(eq(staffUsers.id, staffUserId))
      .for("update")
      .limit(1);

    if (!staff) {
      throw new Error("Akun staf tidak ditemukan.");
    }

    if (!(await verifyPassword(currentPassword, staff.passwordHash))) {
      throw new SupervisorPinInvalidError("Kata sandi tidak valid.");
    }

    if (!staff.pinHash) {
      throw new SupervisorPinNotSetError("PIN supervisor belum diatur.");
    }

    if (!currentPin || !(await verifyPassword(currentPin, staff.pinHash))) {
      throw new SupervisorPinInvalidError("PIN supervisor saat ini tidak valid.");
    }

    const newPinHash = await hashPassword(newPin);

    await tx
      .update(staffUsers)
      .set({ supervisorPinHash: newPinHash, updatedAt: new Date() })
      .where(eq(staffUsers.id, staff.id));

    await tx.insert(auditEvents).values({
      actorUserId,
      action: "staff.supervisor_pin_reset",
      targetType: "staff_user",
      targetId: staff.id,
    });
  });
}

export async function listSupervisorsWithPin(): Promise<
  { id: string; name: string; email: string }[]
> {
  return getDatabase()
    .select({
      id: staffUsers.id,
      name: staffUsers.name,
      email: staffUsers.email,
    })
    .from(staffUsers)
    .where(sql`${staffUsers.supervisorPinHash} IS NOT NULL`)
    .orderBy(staffUsers.name);
}
