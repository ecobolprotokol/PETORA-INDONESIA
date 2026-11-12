import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <section aria-labelledby="login-title" className="auth-card">
        <Link className="brand-link" href="/">
          PETORA<span> INDONESIA</span>
        </Link>
        <p className="welcome__eyebrow">AKSES STAF</p>
        <h1 id="login-title">Selamat datang kembali</h1>
        <p className="auth-card__description">Masuk dengan akun staf PETORA Anda.</p>
        <LoginForm />
        <p className="auth-card__footnote">
          Belum menyiapkan bisnis? <Link href="/setup">Mulai setup awal</Link>
        </p>
        <footer>Powered by PETORA INDONESIA</footer>
      </section>
    </main>
  );
}
