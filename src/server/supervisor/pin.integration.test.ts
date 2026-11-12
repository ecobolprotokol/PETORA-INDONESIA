import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase } from "@/db";
import { auditEvents, staffUsers } from "@/db/schema";
import { hashPassword } from "@/server/auth/password";
import {
  getSupervisorPinStatus,
  resetSupervisorPin,
  SupervisorPinAlreadySetError,
  SupervisorPinInvalidError,
  SupervisorPinNotSetError,
  setSupervisorPin,
  verifySupervisorPin,
} from "@/server/supervisor/pin";

let actorId: string;
let passwordHash: string;

beforeAll(async () => {
  passwordHash = await hashPassword("supervisor-password-123");
  const [staff] = await getDatabase()
    .insert(staffUsers)
    .values({
      name: "Supervisor Test",
      email: `supervisor-pin-${randomUUID()}@example.test`,
      passwordHash,
    })
    .returning({ id: staffUsers.id });
  actorId = staff.id;
});

afterAll(async () => {
  await getDatabase().delete(staffUsers).where(eq(staffUsers.id, actorId));
});

describe("supervisor pin", () => {
  it("reports no PIN before one is set", async () => {
    const status = await getSupervisorPinStatus(actorId);
    expect(status.isSet).toBe(false);
  });

  it("rejects verification when no PIN is set", async () => {
    await expect(verifySupervisorPin(actorId, "1234")).rejects.toBeInstanceOf(
      SupervisorPinNotSetError,
    );
  });

  it("sets a PIN after password verification", async () => {
    await setSupervisorPin(actorId, "1234", actorId, "supervisor-password-123");
    const status = await getSupervisorPinStatus(actorId);
    expect(status.isSet).toBe(true);
  });

  it("rejects duplicate PIN setup", async () => {
    await expect(
      setSupervisorPin(actorId, "5678", actorId, "supervisor-password-123"),
    ).rejects.toBeInstanceOf(SupervisorPinAlreadySetError);
  });

  it("verifies the correct PIN", async () => {
    await expect(verifySupervisorPin(actorId, "1234")).resolves.toBe(true);
  });

  it("rejects an incorrect PIN", async () => {
    await expect(verifySupervisorPin(actorId, "0000")).rejects.toBeInstanceOf(
      SupervisorPinInvalidError,
    );
    const [event] = await getDatabase()
      .select({ action: auditEvents.action })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.action, "staff.supervisor_pin_verification_failed"),
          eq(auditEvents.targetId, actorId),
        ),
      )
      .limit(1);
    expect(event?.action).toBe("staff.supervisor_pin_verification_failed");
  });

  it("resets the PIN with the current PIN", async () => {
    await resetSupervisorPin(actorId, "4321", actorId, "supervisor-password-123", "1234");
    await expect(verifySupervisorPin(actorId, "4321")).resolves.toBe(true);
  });

  it("rejects reset with wrong current PIN", async () => {
    await expect(
      resetSupervisorPin(actorId, "9999", actorId, "supervisor-password-123", "wrong-pin"),
    ).rejects.toBeInstanceOf(SupervisorPinInvalidError);
  });
});
