"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { getApiErrorMessage } from "./api-message";

interface TwoFactorManagementProps {
  enabled: boolean;
}

interface EnrollmentDetails {
  secret: string;
  otpauthUri: string;
}

export function TwoFactorManagement({ enabled }: TwoFactorManagementProps) {
  const router = useRouter();
  const [enrollment, setEnrollment] = useState<EnrollmentDetails | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function send(path: string, payload?: unknown): Promise<{ ok: boolean; result: unknown }> {
    setMessage("");
    setSubmitting(true);

    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
      });
      const result: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        setMessage(getApiErrorMessage(result, "Perubahan autentikasi belum dapat dilakukan."));
        return { ok: false, result };
      }

      return { ok: true, result };
    } catch {
      setMessage("Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.");
      return { ok: false, result: null };
    } finally {
      setSubmitting(false);
    }
  }

  async function beginEnrollment() {
    const { ok, result } = await send("/api/auth/totp");

    if (
      ok &&
      typeof result === "object" &&
      result !== null &&
      "secret" in result &&
      typeof result.secret === "string" &&
      "otpauthUri" in result &&
      typeof result.otpauthUri === "string"
    ) {
      setEnrollment({ secret: result.secret, otpauthUri: result.otpauthUri });
    }
  }

  async function confirmEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const { ok, result } = await send("/api/auth/totp/confirm", {
      code: formData.get("code"),
    });

    if (ok && typeof result === "object" && result !== null && "recoveryCodes" in result) {
      const codes = result.recoveryCodes;
      if (Array.isArray(codes) && codes.every((code) => typeof code === "string")) {
        setRecoveryCodes(codes);
        setEnrollment(null);
        form.reset();
        router.refresh();
      }
    }
  }

  async function disable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const { ok } = await send("/api/auth/totp/disable", {
      password: formData.get("password"),
      code: formData.get("code"),
    });

    if (ok) {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <section aria-labelledby="two-factor-title" className="security-settings">
      <div>
        <p className="welcome__eyebrow">KEAMANAN AKUN</p>
        <h2 id="two-factor-title">Autentikasi dua langkah</h2>
        <p className="auth-card__description">
          {enabled
            ? "Akun ini dilindungi aplikasi autentikator."
            : "Tambahkan kode dari aplikasi autentikator setelah kata sandi saat masuk."}
        </p>
      </div>

      {enabled ? (
        <form className="auth-form" onSubmit={(event) => void disable(event)}>
          <label>
            Kata sandi saat ini
            <input
              autoComplete="current-password"
              maxLength={128}
              name="password"
              required
              type="password"
            />
          </label>
          <label>
            Kode autentikator atau kode pemulihan
            <input
              autoComplete="one-time-code"
              inputMode="text"
              maxLength={40}
              name="code"
              required
            />
          </label>
          <button className="button button--quiet" disabled={submitting} type="submit">
            Nonaktifkan 2FA dan keluar dari semua perangkat
          </button>
        </form>
      ) : enrollment ? (
        <>
          <p>
            Tambahkan kunci ini di aplikasi autentikator. Kunci dan tautan hanya ditampilkan untuk
            menyelesaikan pendaftaran ini.
          </p>
          <details>
            <summary>Lihat kunci dan tautan pengaturan</summary>
            <p className="auth-form__hint">
              Kunci rahasia: <code>{enrollment.secret}</code>
            </p>
            <p className="auth-form__hint">
              Tautan: <code>{enrollment.otpauthUri}</code>
            </p>
          </details>
          <form className="auth-form" onSubmit={(event) => void confirmEnrollment(event)}>
            <label>
              Kode enam angka dari aplikasi
              <input
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={6}
                minLength={6}
                name="code"
                pattern="[0-9]{6}"
                required
              />
            </label>
            <button className="button button--primary" disabled={submitting} type="submit">
              Aktifkan 2FA
            </button>
            <button
              className="button button--quiet"
              disabled={submitting}
              onClick={() => setEnrollment(null)}
              type="button"
            >
              Batalkan
            </button>
          </form>
        </>
      ) : (
        <button
          className="button button--primary"
          disabled={submitting}
          onClick={() => void beginEnrollment()}
          type="button"
        >
          Siapkan aplikasi autentikator
        </button>
      )}

      {recoveryCodes.length > 0 ? (
        <div className="recovery-codes" role="status">
          <h3>Simpan kode pemulihan</h3>
          <p>Setiap kode hanya dapat digunakan sekali. Kode ini tidak akan ditampilkan lagi.</p>
          <ul>
            {recoveryCodes.map((code) => (
              <li key={code}>
                <code>{code}</code>
              </li>
            ))}
          </ul>
          <button
            className="button button--quiet"
            onClick={() => setRecoveryCodes([])}
            type="button"
          >
            Saya sudah menyimpan kode
          </button>
        </div>
      ) : null}
      {message ? (
        <p className="auth-form__message" role="alert">
          {message}
        </p>
      ) : null}
    </section>
  );
}
