"use client";

import { useState } from "react";
import { z } from "zod";
import type { listAuditEvents } from "@/server/audit/service";

type AuditEntry = Awaited<ReturnType<typeof listAuditEvents>>["events"][number];

interface AuditLogProps {
  initialEvents: AuditEntry[];
  initialCursor: string | null;
  locale: string;
  timeZone: string;
}

const auditPageSchema = z.object({
  events: z.array(
    z.object({
      id: z.string().uuid(),
      actorName: z.string().nullable(),
      action: z.string(),
      targetType: z.string(),
      targetId: z.string().nullable(),
      metadata: z.record(z.string(), z.string()),
      createdAt: z.string().datetime(),
    }),
  ),
  nextCursor: z.string().nullable(),
});

export function AuditLog({ initialEvents, initialCursor, locale, timeZone }: AuditLogProps) {
  const [events, setEvents] = useState(initialEvents);
  const [cursor, setCursor] = useState(initialCursor);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    if (!cursor || loading) {
      return;
    }

    setError("");
    setLoading(true);
    try {
      const query = new URLSearchParams({ limit: "30", cursor });
      const response = await fetch(`/api/audit?${query}`);
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError("Log audit belum dapat dimuat. Coba lagi.");
        return;
      }

      const parsed = auditPageSchema.safeParse(result);
      if (!parsed.success) {
        setError("Respons log audit tidak valid. Muat ulang halaman.");
        return;
      }

      setEvents((current) => [...current, ...parsed.data.events]);
      setCursor(parsed.data.nextCursor);
    } catch {
      setError("Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section aria-labelledby="audit-log-title" className="staff-management">
      <div>
        <p className="welcome__eyebrow">KEAMANAN</p>
        <h2 id="audit-log-title">Log audit</h2>
        {events.length ? (
          <ul className="staff-list">
            {events.map((event) => (
              <li key={event.id}>
                <div>
                  <strong>{event.action}</strong>
                  <span>
                    {event.actorName ?? "Akun tidak tersedia"} · {event.targetType}
                  </span>
                  <span>
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone,
                    }).format(new Date(event.createdAt))}
                  </span>
                  {Object.keys(event.metadata).length ? (
                    <span>{JSON.stringify(event.metadata)}</span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="auth-card__description">Belum ada aktivitas yang tercatat.</p>
        )}
        {error ? (
          <p className="auth-form__message" role="alert">
            {error}
          </p>
        ) : null}
        {cursor ? (
          <button
            className="button button--quiet"
            disabled={loading}
            onClick={() => void loadMore()}
            type="button"
          >
            {loading ? "Memuat..." : "Muat aktivitas sebelumnya"}
          </button>
        ) : null}
      </div>
    </section>
  );
}
