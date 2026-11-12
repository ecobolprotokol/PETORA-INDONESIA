"use client";

import { type FormEvent, useState } from "react";
import { getApiErrorMessage } from "@/components/auth/api-message";

interface SupervisorPinManagementProps {
  pinSet: boolean;
}

export function SupervisorPinManagement({ pinSet }: SupervisorPinManagementProps) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  async function save(path: string, payload: unknown): Promise<boolean> {
    setMessage("");
    setSubmitting(true);

    try {
      const response = await fetch(path, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(getApiErrorMessage(result, "PIN supervisor belum dapat diatur."));
        return false;
      }

      setMessage(pinSet ? "PIN supervisor diperbarui." : "PIN supervisor diatur.");
      setShowForm(false);
      return true;
    } catch {
      setMessage("Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.");
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const currentPin = values.get("currentPin");
    void save("/api/supervisor/pin", {
      pin: values.get("pin"),
      currentPassword: values.get("currentPassword"),
      reset: pinSet,
      currentPin: typeof currentPin === "string" && currentPin ? currentPin : undefined,
    });
  }

  return (
    <section aria-labelledby="supervisor-pin-title" className="security-settings">
      <div>
        <p className="welcome__eyebrow">KEAMANAN</p>
        <h2 id="supervisor-pin-title">PIN supervisor</h2>
        <p className="auth-card__description">
          {pinSet
            ? "PIN supervisor sudah diatur. Gunakan untuk persetujuan aksi sensitif."
            : "Atur PIN supervisor untuk memverifikasi aksi seperti void, refund, atau diskon besar."}
        </p>
      </div>

      {pinSet ? (
        <button
          className="button button--quiet"
          disabled={submitting}
          onClick={() => setShowForm((prev) => !prev)}
          type="button"
        >
          Ubah PIN supervisor
        </button>
      ) : (
        <button
          className="button button--primary"
          disabled={submitting}
          onClick={() => setShowForm((prev) => !prev)}
          type="button"
        >
          Atur PIN supervisor
        </button>
      )}

      {showForm ? (
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Kata sandi saat ini
            <input
              autoComplete="current-password"
              maxLength={128}
              name="currentPassword"
              required
              type="password"
            />
          </label>
          {pinSet ? (
            <label>
              PIN supervisor saat ini
              <input
                inputMode="numeric"
                maxLength={8}
                minLength={4}
                name="currentPin"
                pattern="\d{4,8}"
                required
              />
            </label>
          ) : null}
          <label>
            PIN supervisor baru (4-8 angka)
            <input
              inputMode="numeric"
              maxLength={8}
              minLength={4}
              name="pin"
              pattern="\d{4,8}"
              required
            />
          </label>
          <button className="button button--primary" disabled={submitting} type="submit">
            Simpan PIN
          </button>
          <button
            className="button button--quiet"
            disabled={submitting}
            onClick={() => setShowForm(false)}
            type="button"
          >
            Batal
          </button>
        </form>
      ) : null}

      {message ? (
        <p className="auth-form__message" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
