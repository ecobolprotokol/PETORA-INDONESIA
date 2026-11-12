import { eq, sql } from "drizzle-orm";
import { fromDrizzle, PgBoss } from "pg-boss";
import { getDatabase } from "@/db";
import {
  auditEvents,
  businessSettings,
  notificationTemplates,
  staffNotifications,
} from "@/db/schema";
import { quietHoursStartAfter } from "./quiet-hours";
import { renderNotificationTemplate } from "./template";

const QUEUE_NAME = "petora.staff-notifications";
const RETRY_LIMIT = 4;

type DatabaseTransaction = Parameters<
  Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]
>[0];

interface NotificationJob {
  notificationId: string;
}

interface NotificationTemplate {
  key: string;
  description: string;
  titleTemplate: string;
  bodyTemplate: string;
  isEnabled: boolean;
  honorsQuietHours: boolean;
}

const globalForNotifications = globalThis as typeof globalThis & {
  petoraNotificationBoss?: PgBoss;
  petoraNotificationBossStart?: Promise<PgBoss>;
  petoraNotificationWorkerStart?: Promise<void>;
};

async function getBoss(): Promise<PgBoss> {
  if (!globalForNotifications.petoraNotificationBossStart) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL belum diatur untuk antrean notifikasi.");
    }

    globalForNotifications.petoraNotificationBossStart = (async () => {
      const boss = new PgBoss({ connectionString });
      boss.on("error", (error) => {
        console.error("Kesalahan antrean notifikasi:", error.name);
      });
      await boss.start();
      await boss.createQueue(QUEUE_NAME, {
        retryLimit: RETRY_LIMIT,
        retryDelay: 30,
        retryBackoff: true,
      });
      globalForNotifications.petoraNotificationBoss = boss;
      return boss;
    })();
  }

  return globalForNotifications.petoraNotificationBossStart;
}

export async function listNotificationTemplates(): Promise<NotificationTemplate[]> {
  return getDatabase()
    .select({
      key: notificationTemplates.key,
      description: notificationTemplates.description,
      titleTemplate: notificationTemplates.titleTemplate,
      bodyTemplate: notificationTemplates.bodyTemplate,
      isEnabled: notificationTemplates.isEnabled,
      honorsQuietHours: notificationTemplates.honorsQuietHours,
    })
    .from(notificationTemplates)
    .orderBy(notificationTemplates.key);
}

export async function updateNotificationTemplate(
  key: string,
  input: Pick<
    NotificationTemplate,
    "titleTemplate" | "bodyTemplate" | "isEnabled" | "honorsQuietHours"
  >,
  actorUserId: string,
): Promise<void> {
  await getDatabase().transaction(async (tx) => {
    const [updated] = await tx
      .update(notificationTemplates)
      .set({ ...input, updatedBy: actorUserId, updatedAt: new Date() })
      .where(eq(notificationTemplates.key, key))
      .returning({ key: notificationTemplates.key });
    if (!updated) {
      throw new Error("Template notifikasi tidak ditemukan.");
    }

    await tx.insert(auditEvents).values({
      actorUserId,
      action: "notification.template_updated",
      targetType: "notification_template",
      targetId: key,
    });
  });
}

export async function listStaffNotifications(recipientUserId: string) {
  return getDatabase()
    .select({
      id: staffNotifications.id,
      title: staffNotifications.title,
      body: staffNotifications.body,
      status: staffNotifications.status,
      createdAt: staffNotifications.createdAt,
      deliveredAt: staffNotifications.deliveredAt,
      readAt: staffNotifications.readAt,
    })
    .from(staffNotifications)
    .where(eq(staffNotifications.recipientUserId, recipientUserId))
    .orderBy(sql`${staffNotifications.createdAt} DESC`)
    .limit(50);
}

export async function markStaffNotificationRead(
  notificationId: string,
  recipientUserId: string,
): Promise<boolean> {
  const [updated] = await getDatabase()
    .update(staffNotifications)
    .set({ readAt: new Date() })
    .where(
      sql`${staffNotifications.id} = ${notificationId}
        AND ${staffNotifications.recipientUserId} = ${recipientUserId}
        AND ${staffNotifications.status} = 'delivered'
        AND ${staffNotifications.readAt} IS NULL`,
    )
    .returning({ id: staffNotifications.id });
  return Boolean(updated);
}

export async function enqueueStaffNotification(
  tx: DatabaseTransaction,
  recipientUserId: string,
  templateKey: string,
  variables: Record<string, string>,
): Promise<void> {
  const [template] = await tx
    .select({
      key: notificationTemplates.key,
      titleTemplate: notificationTemplates.titleTemplate,
      bodyTemplate: notificationTemplates.bodyTemplate,
      isEnabled: notificationTemplates.isEnabled,
      honorsQuietHours: notificationTemplates.honorsQuietHours,
    })
    .from(notificationTemplates)
    .where(sql`${notificationTemplates.key} = ${templateKey}`)
    .limit(1);

  if (!template?.isEnabled) {
    return;
  }

  const [notification] = await tx
    .insert(staffNotifications)
    .values({
      recipientUserId,
      templateKey: template.key,
      title: renderNotificationTemplate(template.titleTemplate, variables),
      body: renderNotificationTemplate(template.bodyTemplate, variables),
    })
    .returning({ id: staffNotifications.id });

  if (!notification) {
    throw new Error("Notifikasi staf gagal disimpan.");
  }

  const [settings] = await tx
    .select({
      defaultTimezone: businessSettings.defaultTimezone,
      quietHoursEnabled: businessSettings.quietHoursEnabled,
      quietHoursStart: businessSettings.quietHoursStart,
      quietHoursEnd: businessSettings.quietHoursEnd,
    })
    .from(businessSettings)
    .where(sql`${businessSettings.id} = 1`)
    .limit(1);

  if (!settings) {
    throw new Error("Pengaturan bisnis belum tersedia untuk antrean notifikasi.");
  }

  const startAfter = template.honorsQuietHours
    ? quietHoursStartAfter(new Date(), {
        enabled: settings.quietHoursEnabled,
        start: settings.quietHoursStart,
        end: settings.quietHoursEnd,
        timeZone: settings.defaultTimezone,
      })
    : undefined;
  const boss = await getBoss();
  const jobId = await boss.send(
    QUEUE_NAME,
    { notificationId: notification.id } satisfies NotificationJob,
    {
      retryLimit: RETRY_LIMIT,
      retryDelay: 30,
      retryBackoff: true,
      ...(startAfter ? { startAfter } : {}),
      db: fromDrizzle(tx, sql),
    },
  );

  if (!jobId) {
    throw new Error("Notifikasi tidak dapat ditambahkan ke antrean.");
  }
}

export async function deliverNotification(notificationId: string): Promise<void> {
  await getDatabase().transaction(async (tx) => {
    const [notification] = await tx
      .select({
        id: staffNotifications.id,
        status: staffNotifications.status,
      })
      .from(staffNotifications)
      .where(sql`${staffNotifications.id} = ${notificationId}`)
      .for("update")
      .limit(1);

    if (notification?.status !== "queued") {
      return;
    }

    await tx
      .update(staffNotifications)
      .set({
        status: "delivered",
        deliveredAt: new Date(),
        attempts: sql`${staffNotifications.attempts} + 1`,
        lastErrorCode: null,
      })
      .where(sql`${staffNotifications.id} = ${notificationId}`);
  });
}

export async function handleNotificationDeliveryFailure(
  notificationId: string,
  finalAttempt: boolean,
  errorCode = "delivery_error",
): Promise<void> {
  const [notification] = await getDatabase()
    .update(staffNotifications)
    .set({
      status: finalAttempt ? "failed" : "queued",
      attempts: sql`${staffNotifications.attempts} + 1`,
      lastErrorCode: errorCode,
    })
    .where(
      sql`${staffNotifications.id} = ${notificationId} AND ${staffNotifications.status} = 'queued'`,
    )
    .returning({
      id: staffNotifications.id,
      status: staffNotifications.status,
      attempts: staffNotifications.attempts,
      lastErrorCode: staffNotifications.lastErrorCode,
    });

  if (!notification) {
    return;
  }

  await getDatabase()
    .insert(auditEvents)
    .values({
      action: "notification.delivery_failed",
      targetType: "staff_notification",
      targetId: notificationId,
      metadata: {
        outcome: finalAttempt ? "failed" : "queued",
        errorCode,
        attempts: String(notification.attempts),
      },
    });
}

export async function startNotificationWorker(): Promise<void> {
  if (!globalForNotifications.petoraNotificationWorkerStart) {
    globalForNotifications.petoraNotificationWorkerStart = (async () => {
      const boss = await getBoss();
      await boss.work<NotificationJob, void, { batchSize: 10; includeMetadata: true }>(
        QUEUE_NAME,
        { batchSize: 10, includeMetadata: true },
        async (jobs) => {
          for (const job of jobs) {
            try {
              await deliverNotification(job.data.notificationId);
            } catch (error) {
              await handleNotificationDeliveryFailure(
                job.data.notificationId,
                job.retryCount >= job.retryLimit,
                error instanceof Error ? error.name : "delivery_error",
              );
              throw error;
            }
          }
        },
      );
    })();
  }

  await globalForNotifications.petoraNotificationWorkerStart;
}

export async function stopNotificationQueue(): Promise<void> {
  const boss = globalForNotifications.petoraNotificationBoss;
  if (boss) {
    await boss.stop({ graceful: true, timeout: 5_000 });
    delete globalForNotifications.petoraNotificationBoss;
    delete globalForNotifications.petoraNotificationBossStart;
    delete globalForNotifications.petoraNotificationWorkerStart;
  }
}
