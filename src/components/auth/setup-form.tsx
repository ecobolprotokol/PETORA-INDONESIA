"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { getApiErrorMessage } from "./api-message";

type PublicReachabilityStatus =
  | "verified"
  | "not_configured"
  | "invalid_configuration"
  | "unreachable";

type BrowserReachabilityStatus = "checking" | "verified" | "unreachable" | "unknown";

export function SetupForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(0);
  const [readiness, setReadiness] = useState<"idle" | "checking" | "ready" | "failed">("idle");
  const [publicOrigin, setPublicOrigin] = useState("");
  const [configuredPublicOrigin, setConfiguredPublicOrigin] = useState<string | null>(null);
  const [publicReachability, setPublicReachability] = useState<
    PublicReachabilityStatus | "unknown"
  >("unknown");
  const [browserReachability, setBrowserReachability] =
    useState<BrowserReachabilityStatus>("unknown");

  async function checkFromBrowser(publicAppOrigin: string | null) {
    if (!publicAppOrigin) {
      setBrowserReachability("unknown");
      return;
    }

    setBrowserReachability("checking");
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 5_000);
    try {
      const response = await fetch(new URL("/.well-known/petora-health", publicAppOrigin), {
        cache: "no-store",
        signal: controller.signal,
      });
      const result: unknown = await response.json();
      if (
        response.ok &&
        typeof result === "object" &&
        result !== null &&
        "service" in result &&
        result.service === "petora" &&
        "status" in result &&
        result.status === "ok"
      ) {
        setBrowserReachability("verified");
      } else {
        setBrowserReachability("unreachable");
      }
    } catch {
      setBrowserReachability("unreachable");
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  async function checkReadiness() {
    setReadiness("checking");
    setConfiguredPublicOrigin(null);
    setBrowserReachability("unknown");
    try {
      const response = await fetch("/api/setup/readiness", { cache: "no-store" });
      const result: {
        ready?: boolean;
        database?: boolean;
        publicReachability?: PublicReachabilityStatus;
        publicAppOrigin?: string | null;
      } = await response.json().catch(() => ({}));
      setPublicReachability(result.publicReachability ?? "unknown");
      const configuredOrigin = result.publicAppOrigin ?? null;
      setConfiguredPublicOrigin(configuredOrigin);
      await checkFromBrowser(configuredOrigin);

      if (!response.ok || result.ready !== true || result.database !== true) {
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
      includeSampleData: formData.get("includeSampleData") === "on",
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
            Aplikasi dan basis data merespons dari alamat yang dibuka: {publicOrigin}.
          </p>
        ) : null}
        {readiness === "ready" && publicReachability === "verified" ? (
          <p className="auth-form__hint" role="status">
            Alamat publik yang dikonfigurasi dapat dijangkau dari server aplikasi. Ini menguji rute
            publik, bukan koneksi langsung dari penyedia webhook.
          </p>
        ) : null}
        {readiness === "ready" && publicReachability === "not_configured" ? (
          <p className="auth-form__hint" role="status">
            Keterjangkauan dari luar belum diverifikasi. Atur PUBLIC_APP_URL ke alamat HTTPS publik
            lalu jalankan pemeriksaan kembali.
          </p>
        ) : null}
        {readiness === "ready" && publicReachability === "invalid_configuration" ? (
          <p className="auth-form__message" role="alert">
            PUBLIC_APP_URL harus berupa origin HTTPS publik tanpa path, kredensial, atau parameter.
          </p>
        ) : null}
        {readiness === "ready" && publicReachability === "unreachable" ? (
          <p className="auth-form__message" role="alert">
            Server aplikasi tidak dapat menjangkau alamat publik yang dikonfigurasi. Periksa DNS,
            TLS, firewall, dan routing reverse proxy.
          </p>
        ) : null}
        {readiness === "ready" &&
        configuredPublicOrigin !== null &&
        browserReachability !== "unknown" ? (
          <p className="auth-form__hint" role="status">
            {browserReachability === "checking"
              ? `Memeriksa ${configuredPublicOrigin} dari jaringan peramban...`
              : browserReachability === "verified"
                ? `${configuredPublicOrigin} merespons dari jaringan peramban ini. Koneksi dari penyedia webhook tetap belum diuji.`
                : `${configuredPublicOrigin} tidak merespons dari jaringan peramban ini. Periksa CORS dan akses jaringan; koneksi penyedia webhook tetap belum diuji.`}
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
        <label className="permission-option">
          <input name="includeSampleData" type="checkbox" />
          <span>
            Muat data contoh pelanggan agar modul pelanggan dapat dicoba. Data contoh dapat
            dibersihkan nanti dari dashboard.
          </span>
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
