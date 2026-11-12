"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { getApiErrorMessage } from "./api-message";

export function LoginForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [challengeToken, setChallengeToken] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSubmitting(true);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch(
        challengeToken ? "/api/auth/totp/challenge" : "/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            challengeToken
              ? { challengeToken, code: formData.get("code") }
              : { email: formData.get("email"), password: formData.get("password") },
          ),
        },
      );
      const result: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        setMessage(getApiErrorMessage(result, "Login belum dapat dilakukan."));
        return;
      }

      if (
        typeof result === "object" &&
        result !== null &&
        "twoFactorRequired" in result &&
        result.twoFactorRequired === true &&
        "challengeToken" in result &&
        typeof result.challengeToken === "string"
      ) {
        setChallengeToken(result.challengeToken);
        setMessage("");
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
      {challengeToken ? (
        <>
          <p className="auth-card__description">
            Masukkan kode autentikator atau salah satu kode pemulihan. Verifikasi berlaku selama
            lima menit.
          </p>
          <label>
            Kode verifikasi
            <input autoComplete="one-time-code" maxLength={40} name="code" required />
          </label>
          <button
            className="button button--quiet"
            disabled={submitting}
            onClick={() => {
              setChallengeToken("");
              setMessage("");
            }}
            type="button"
          >
            Kembali ke login
          </button>
        </>
      ) : (
        <>
          <label>
            Email
            <input autoComplete="username" maxLength={254} name="email" required type="email" />
          </label>
          <label>
            Kata sandi
            <input
              autoComplete="current-password"
              maxLength={128}
              minLength={12}
              name="password"
              required
              type="password"
            />
          </label>
        </>
      )}
      {message ? (
        <p className="auth-form__message" role="alert">
          {message}
        </p>
      ) : null}
      <button className="button button--primary" disabled={submitting} type="submit">
        {submitting ? "Memeriksa..." : challengeToken ? "Verifikasi dan masuk" : "Masuk"}
      </button>
    </form>
  );
}
