"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { getApiErrorMessage } from "@/components/auth/api-message";

const timeZones = ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"];

export function CreateBranchForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSubmitting(true);

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch("/api/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: formData.get("code"),
          name: formData.get("name"),
          timezone: formData.get("timezone"),
        }),
      });
      const result: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        setMessage(getApiErrorMessage(result, "Cabang belum dapat dibuat."));
        return;
      }

      form.reset();
      router.refresh();
    } catch {
      setMessage("Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="auth-form branch-form" onSubmit={submit}>
      <label>
        Kode cabang
        <input
          autoComplete="off"
          maxLength={12}
          minLength={2}
          name="code"
          pattern="[A-Za-z0-9][A-Za-z0-9_-]{1,11}"
          required
        />
      </label>
      <label>
        Nama cabang
        <input autoComplete="organization" maxLength={120} minLength={2} name="name" required />
      </label>
      <label>
        Zona waktu
        <select defaultValue="Asia/Jakarta" name="timezone">
          {timeZones.map((timezone) => (
            <option key={timezone} value={timezone}>
              {timezone}
            </option>
          ))}
        </select>
      </label>
      {message ? (
        <p className="auth-form__message" role="alert">
          {message}
        </p>
      ) : null}
      <button className="button button--primary" disabled={submitting} type="submit">
        {submitting ? "Menyimpan..." : "Tambah cabang"}
      </button>
    </form>
  );
}
