"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { getApiErrorMessage } from "@/components/auth/api-message";
import type {
  listNotificationTemplates,
  listStaffNotifications,
} from "@/server/notifications/queue";

type NotificationTemplate = Awaited<ReturnType<typeof listNotificationTemplates>>[number];
type StaffNotification = Awaited<ReturnType<typeof listStaffNotifications>>[number];

interface NotificationCenterProps {
  notifications: StaffNotification[];
  locale: string;
  timeZone: string;
}

export function NotificationInbox({ notifications, locale, timeZone }: NotificationCenterProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function markAsRead(notificationId: string) {
    setMessage("");
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId }),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(getApiErrorMessage(result, "Notifikasi belum dapat diperbarui."));
        return;
      }
      router.refresh();
    } catch {
      setMessage("Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.");
    }
  }

  return (
    <section aria-labelledby="notifications-title" className="staff-management">
      <div>
        <p className="welcome__eyebrow">PESAN SISTEM</p>
        <h2 id="notifications-title">Notifikasi</h2>
      </div>
      {message ? <p role="status">{message}</p> : null}
      {notifications.length ? (
        <ul className="staff-list">
          {notifications.map((notification) => (
            <li key={notification.id}>
              <div>
                <strong>{notification.title}</strong>
                <span>{notification.body}</span>
                <span>
                  {notification.status === "queued"
                    ? "Dalam antrean"
                    : notification.status === "failed"
                      ? "Gagal dikirim"
                      : new Intl.DateTimeFormat(locale, {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone,
                        }).format(notification.deliveredAt ?? notification.createdAt)}
                </span>
              </div>
              {notification.status === "delivered" && !notification.readAt ? (
                <button
                  className="button button--secondary"
                  onClick={() => void markAsRead(notification.id)}
                  type="button"
                >
                  Tandai dibaca
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="auth-card__description">Belum ada notifikasi.</p>
      )}
    </section>
  );
}

interface NotificationTemplateManagementProps {
  templates: NotificationTemplate[];
}

export function NotificationTemplateManagement({ templates }: NotificationTemplateManagementProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [savingKey, setSavingKey] = useState<string | null>(null);

  async function saveTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const key = String(values.get("key"));
    setSavingKey(key);
    setMessage("");

    try {
      const response = await fetch("/api/notifications/templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          titleTemplate: values.get("titleTemplate"),
          bodyTemplate: values.get("bodyTemplate"),
          isEnabled: values.get("isEnabled") === "on",
          honorsQuietHours: values.get("honorsQuietHours") === "on",
        }),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(getApiErrorMessage(result, "Template belum dapat disimpan."));
        return;
      }
      setMessage("Template notifikasi berhasil disimpan.");
      router.refresh();
    } catch {
      setMessage("Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.");
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <section aria-labelledby="notification-template-title" className="staff-management">
      <div>
        <p className="welcome__eyebrow">OTOMASI</p>
        <h2 id="notification-template-title">Template notifikasi staf</h2>
        <p className="auth-card__description">
          Placeholder yang tersedia: {"{{name}}"} untuk akun baru dan {"{{roleName}}"} untuk
          penugasan peran.
        </p>
      </div>
      {message ? <p role="status">{message}</p> : null}
      <div className="staff-management__forms">
        {templates.map((template) => (
          <form className="auth-form" key={template.key} onSubmit={saveTemplate}>
            <h3>{template.description}</h3>
            <input name="key" type="hidden" value={template.key} />
            <label>
              Judul
              <input
                defaultValue={template.titleTemplate}
                maxLength={160}
                name="titleTemplate"
                required
              />
            </label>
            <label>
              Isi pesan
              <textarea
                defaultValue={template.bodyTemplate}
                maxLength={2_000}
                name="bodyTemplate"
                required
                rows={3}
              />
            </label>
            <label className="permission-option">
              <input defaultChecked={template.isEnabled} name="isEnabled" type="checkbox" />
              <span>Template aktif</span>
            </label>
            <label className="permission-option">
              <input
                defaultChecked={template.honorsQuietHours}
                name="honorsQuietHours"
                type="checkbox"
              />
              <span>Tunda selama jam tenang</span>
            </label>
            <button className="button button--primary" disabled={savingKey !== null} type="submit">
              {savingKey === template.key ? "Menyimpan..." : "Simpan template"}
            </button>
          </form>
        ))}
      </div>
    </section>
  );
}
