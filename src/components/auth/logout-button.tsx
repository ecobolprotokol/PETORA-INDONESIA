"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getApiErrorMessage } from "./api-message";

export function LogoutButton() {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function logout() {
    setMessage("");

    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      const result: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        setMessage(getApiErrorMessage(result, "Logout belum dapat dilakukan."));
        return;
      }

      router.replace("/login");
      router.refresh();
    } catch {
      setMessage("Tidak dapat menghubungi server. Coba logout kembali.");
    }
  }

  return (
    <div className="logout-control">
      {message ? (
        <p className="auth-form__message" role="alert">
          {message}
        </p>
      ) : null}
      <button className="button button--quiet" onClick={logout} type="button">
        Keluar
      </button>
    </div>
  );
}
