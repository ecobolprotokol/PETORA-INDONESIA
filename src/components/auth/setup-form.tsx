"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { getApiErrorMessage } from "./api-message";

export function SetupForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(0);
  const [readiness, setReadiness] = useState<"idle" | "checking" | "ready" | "failed">("idle");
  const [publicOrigin, setPublicOrigin] = useState("");

  async function checkReadiness() {
    setReadiness("checking");
    try {
      const response = await fetch("/api/setup/readiness", { cache: "no-store" });
      if (!response.ok) {
        setReadiness("failed");
        return;
      }

      setPublicOrigin(window.location.origin);
      setReadiness("ready");
    } catch {
      setReadiness("failed");
    }
  }

  function continueToNextStep(form: HTMLFormElement) {
    const currentStep = form.querySelector<HTMLElement>(`[data-setup-step="${step}"]`);
    const controls = currentStep?.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
      "input, select",
    );
    if (!controls || Array.from(controls).every((control) => control.reportValidity())) {
      setStep((current) => current + 1);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const payload = {
      businessName: formData.get("businessName"),
      branchName: formData.get("branchName"),
      branchCode: formData.get("branchCode"),
      timezone: formData.get("timezone"),
      locale: formData.get("locale"),
      taxEnabled: formData.get("taxEnabled") === "on",
      taxRateBps: Math.round(Number(formData.get("taxRatePercent")) * 100),
      taxIncluded: formData.get("taxIncluded") === "on",
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
    };

    try {
      const response = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        setMessage(getApiErrorMessage(result, "Setup belum dapat diselesaikan."));
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setMessage("Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <div>
        <button
          className="button button--quiet"
          disabled={readiness === "checking"}
          onClick={() => void checkReadiness()}
          type="button"
        >
          {readiness === "checking" ? "Memeriksa server..." : "Periksa kesiapan server"}
        </button>
        {readiness === "ready" ? (
          <p className="auth-form__hint" role="status">
            Server dan basis data merespons dari alamat yang dibuka: {publicOrigin}. Pemeriksaan ini
            memastikan akses dari jaringan Anda, bukan dari jaringan penyedia webhook.
          </p>
        ) : null}
        {readiness === "failed" ? (
          <p className="auth-form__message" role="alert">
            Server belum siap atau tidak dapat dijangkau. Periksa koneksi dan migrasi basis data.
          </p>
        ) : null}
      </div>
      <p className="auth-form__hint" aria-live="polite">
        Langkah {step + 1} dari 3
      </p>
      <fieldset className="permission-options" data-setup-step="0" hidden={step !== 0}>
        <legend>Bisnis dan cabang pertama</legend>
        <label>
          Nama bisnis
          <input
            autoComplete="organization"
            maxLength={120}
            minLength={2}
            name="businessName"
            required
          />
        </label>
        <label>
          Nama cabang pertama
          <input
            autoComplete="organization"
            maxLength={120}
            minLength={2}
            name="branchName"
            required
          />
        </label>
        <label>
          Kode cabang
          <input
            autoCapitalize="characters"
            maxLength={12}
            minLength={2}
            name="branchCode"
            pattern="[A-Za-z0-9][A-Za-z0-9_-]{1,11}"
            placeholder="JKT-01"
            required
          />
        </label>
        <label>
          Zona waktu cabang
          <select defaultValue="Asia/Jakarta" name="timezone" required>
            <option value="Asia/Jakarta">WIB — Asia/Jakarta</option>
            <option value="Asia/Makassar">WITA — Asia/Makassar</option>
            <option value="Asia/Jayapura">WIT — Asia/Jayapura</option>
          </select>
        </label>
      </fieldset>
      <fieldset className="permission-options" data-setup-step="1" hidden={step !== 1}>
        <legend>Bahasa dan pajak</legend>
        <label>
          Bahasa dan format
          <select defaultValue="id-ID" name="locale" required>
            <option value="id-ID">Indonesia</option>
            <option value="en-US">English</option>
          </select>
        </label>
        <fieldset className="permission-options">
          <legend>Pajak</legend>
          <label className="permission-option">
            <input name="taxEnabled" type="checkbox" />
            <span>Bisnis mengenakan pajak</span>
          </label>
          <label>
            Tarif pajak (%)
            <input
              defaultValue="11"
              max="100"
              min="0"
              name="taxRatePercent"
              required
              step="0.01"
              type="number"
            />
          </label>
          <label className="permission-option">
            <input name="taxIncluded" type="checkbox" />
            <span>Harga yang dimasukkan sudah termasuk pajak</span>
          </label>
        </fieldset>
      </fieldset>
      <fieldset className="permission-options" data-setup-step="2" hidden={step !== 2}>
        <legend>Akun Owner</legend>
        <label>
          Nama pemilik
          <input autoComplete="name" maxLength={80} minLength={2} name="name" required />
        </label>
        <label>
          Email untuk masuk
          <input autoComplete="email" maxLength={254} name="email" required type="email" />
        </label>
        <label>
          Kata sandi
          <input
            autoComplete="new-password"
            maxLength={128}
            minLength={12}
            name="password"
            required
            type="password"
          />
          <span className="auth-form__hint">Gunakan sedikitnya 12 karakter.</span>
        </label>
      </fieldset>
      {message ? (
        <p className="auth-form__message" role="alert">
          {message}
        </p>
      ) : null}
      <div className="staff-list__actions">
        {step > 0 ? (
          <button
            className="button button--quiet"
            onClick={() => setStep((current) => current - 1)}
            type="button"
          >
            Kembali
          </button>
        ) : null}
        {step < 2 ? (
          <button
            className="button button--primary"
            onClick={(event) => {
              const form = event.currentTarget.form;
              if (form) {
                continueToNextStep(form);
              }
            }}
            type="button"
          >
            Lanjut
          </button>
        ) : (
          <button className="button button--primary" disabled={submitting} type="submit">
            {submitting ? "Menyiapkan akun..." : "Buat akun Owner"}
          </button>
        )}
      </div>
    </form>
  );
}
