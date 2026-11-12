"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ActiveStaffSession } from "@/server/auth/service";
import { getApiErrorMessage } from "./api-message";

interface SessionManagementProps {
  sessions: ActiveStaffSession[];
  locale: "id-ID" | "en-US";
  timeZone: string;
}

export function SessionManagement({ sessions, locale, timeZone }: SessionManagementProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  });

  async function revokeSession(session: ActiveStaffSession) {
    setMessage("");
    setRevokingId(session.id);

    try {
      const response = await fetch("/api/auth/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id }),
      });
      const result: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        setMessage(getApiErrorMessage(result, "Sesi belum dapat dicabut."));
        return;
      }

      if (session.isCurrent) {
        router.replace("/login");
      } else {
        router.refresh();
      }
    } catch {
      setMessage("Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.");
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <section aria-labelledby="sessions-title" className="staff-management">
      <div>
        <p className="welcome__eyebrow">KEAMANAN AKUN</p>
        <h2 id="sessions-title">Perangkat aktif</h2>
        {sessions.length ? (
          <ul className="staff-list">
            {sessions.map((session) => (
              <li key={session.id}>
                <div>
                  <strong>{session.isCurrent ? "Perangkat ini" : session.userAgent}</strong>
                  {session.isCurrent ? <span>{session.userAgent}</span> : null}
                  <span>Aktif terakhir {dateFormatter.format(session.lastSeenAt)}</span>
                  <span>Kedaluwarsa {dateFormatter.format(session.expiresAt)}</span>
                </div>
                <button
                  className="button button--quiet"
                  disabled={revokingId !== null}
                  onClick={() => void revokeSession(session)}
                  type="button"
                >
                  {revokingId === session.id ? "Mencabut..." : "Cabut sesi"}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="auth-card__description">Tidak ada perangkat aktif.</p>
        )}
      </div>
      {message ? (
        <p className="auth-form__message" role="alert">
          {message}
        </p>
      ) : null}
    </section>
  );
}
