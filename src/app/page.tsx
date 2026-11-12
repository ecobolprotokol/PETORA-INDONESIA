import Link from "next/link";

export default function Home() {
  return (
    <main className="welcome">
      <div className="welcome__eyebrow">SISTEM OPERASIONAL HEWAN</div>
      <h1>
        PETORA<span> INDONESIA</span>
      </h1>
      <p className="welcome__lead">
        Satu tempat untuk merawat operasional petshop dan klinik hewan Anda.
      </p>
      <div className="welcome__actions">
        <Link className="button button--primary button--link" href="/setup">
          Buat akun Owner
        </Link>
        <Link className="button button--quiet button--link" href="/login">
          Login staf
        </Link>
      </div>
      <footer>Powered by PETORA INDONESIA</footer>
    </main>
  );
}
