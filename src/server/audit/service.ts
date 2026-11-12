import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDatabase } from "@/db";
import { auditEvents, staffUsers } from "@/db/schema";

const auditCursorSchema = z.object({
  createdAt: z.string().datetime(),
  id: z.string().uuid(),
});

export type AuditCursor = z.infer<typeof auditCursorSchema>;

export function parseAuditCursor(value: string): AuditCursor | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    const result = auditCursorSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function encodeAuditCursor(event: { id: string; createdAt: string }) {
  return Buffer.from(JSON.stringify({ id: event.id, createdAt: event.createdAt })).toString(
    "base64url",
  );
}

export async function listAuditEvents(limit: number, cursor?: AuditCursor | null) {
  const cursorFilter = cursor
    ? (() => {
        const timestamp = sql`${cursor.createdAt}::timestamptz`;
        return or(
          lt(auditEvents.createdAt, timestamp),
          and(eq(auditEvents.createdAt, timestamp), lt(auditEvents.id, cursor.id)),
        );
      })()
    : undefined;
  const rows = await getDatabase()
    .select({
      id: auditEvents.id,
      actorName: staffUsers.name,
      action: auditEvents.action,
      targetType: auditEvents.targetType,
      targetId: auditEvents.targetId,
      metadata: auditEvents.metadata,
      createdAt: sql<string>`to_char(${auditEvents.createdAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
    })
    .from(auditEvents)
    .leftJoin(staffUsers, eq(auditEvents.actorUserId, staffUsers.id))
    .where(cursorFilter)
    .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  const events = hasMore ? rows.slice(0, limit) : rows;
  const lastEvent = events.at(-1);

  return {
    events,
    nextCursor: hasMore && lastEvent ? encodeAuditCursor(lastEvent) : null,
  };
}
