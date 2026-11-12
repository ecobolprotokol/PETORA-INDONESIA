import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { getDatabase } from "../../db";
import { auditEvents, staffNotifications, staffUsers } from "../../db/schema";
import { handleNotificationDeliveryFailure } from "./queue";

describe("notification delivery failure handling", () => {
  it("requeues a notification until the last retry and records the failure audit event", async () => {
    const database = getDatabase();
    const email = `retry-notification-${randomUUID().slice(0, 8)}@example.test`;
    const [staff] = await database
      .insert(staffUsers)
      .values({
        name: "Retry Notifier",
        email,
        passwordHash: "hash",
      })
      .returning({ id: staffUsers.id });

    if (!staff) {
      throw new Error("Akun staf tes gagal dibuat.");
    }

    const [notification] = await database
      .insert(staffNotifications)
      .values({
        recipientUserId: staff.id,
        templateKey: "access.role_assigned",
        title: "Uji ulang",
        body: "Percobaan pengiriman ulang",
        status: "queued",
      })
      .returning({
        id: staffNotifications.id,
        status: staffNotifications.status,
        attempts: staffNotifications.attempts,
      });

    if (!notification) {
      throw new Error("Notifikasi tes gagal dibuat.");
    }

    await handleNotificationDeliveryFailure(notification.id, false, "delivery_error");
    const firstRetry = await database
      .select({
        status: staffNotifications.status,
        attempts: staffNotifications.attempts,
        lastErrorCode: staffNotifications.lastErrorCode,
      })
      .from(staffNotifications)
      .where(eq(staffNotifications.id, notification.id))
      .limit(1);

    expect(firstRetry[0]).toMatchObject({
      status: "queued",
      attempts: 1,
      lastErrorCode: "delivery_error",
    });

    await handleNotificationDeliveryFailure(notification.id, true, "delivery_error");
    const finalFailure = await database
      .select({
        status: staffNotifications.status,
        attempts: staffNotifications.attempts,
        lastErrorCode: staffNotifications.lastErrorCode,
      })
      .from(staffNotifications)
      .where(eq(staffNotifications.id, notification.id))
      .limit(1);

    expect(finalFailure[0]).toMatchObject({
      status: "failed",
      attempts: 2,
      lastErrorCode: "delivery_error",
    });

    const audit = await database
      .select({ action: auditEvents.action, metadata: auditEvents.metadata })
      .from(auditEvents)
      .where(eq(auditEvents.targetId, notification.id))
      .orderBy(sql`${auditEvents.createdAt} DESC`)
      .limit(1);

    expect(audit[0]).toMatchObject({
      action: "notification.delivery_failed",
      metadata: {
        outcome: "failed",
        errorCode: "delivery_error",
        attempts: "2",
      },
    });

    await database.delete(staffNotifications).where(eq(staffNotifications.id, notification.id));
    await database.delete(staffUsers).where(eq(staffUsers.id, staff.id));
  });
});
