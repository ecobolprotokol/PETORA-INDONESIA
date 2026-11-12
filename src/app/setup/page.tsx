import Link from "next/link";
import { SetupForm } from "@/components/auth/setup-form";
import { getSetupStatus } from "@/server/auth/service";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const setup = await getSetupStatus();

  return (
    <main className="auth-shell">
      <section aria-labelledby="setup-title" className="auth-card">
        <Link className="brand-link" href="/">
          PETORA<span> INDONESIA</span>
        </Link>
        <p className="welcome__eyebrow">OWNER AWAL</p>
        {setup.ownerCreated ? (
          <>
            <h1 id="setup-title">Akun Owner sudah dibuat</h1>
            <p className="auth-card__description">
              Akun Owner untuk {setup.businessName} sudah aktif. Pembuatan Owner awal sudah ditutup;
              masuk dengan akun yang dibuat.
            </p>
            <Link className="button button--primary button--link" href="/login">
              Ke halaman login
            </Link>
          </>
        ) : (
          <>
            <h1 id="setup-title">Mulai dengan akun Owner</h1>
            <p className="auth-card__description">
              Buat akun pemilik utama. Akun Owner hanya dapat dibuat satu kali.
            </p>
            <SetupForm />
          </>
        )}
        <footer>Powered by PETORA INDONESIA</footer>
      </section>
    </main>
  );
}
