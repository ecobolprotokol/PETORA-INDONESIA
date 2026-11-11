# Keamanan PETORA INDONESIA

- Status: Security requirements siap menjadi implementation baseline; security audit belum dilakukan karena aplikasi belum tersedia.
- Rujukan: bagian Security Requirements pada `AI_AGENT.md` dan [AUTHORIZATION_MATRIX.md](AUTHORIZATION_MATRIX.md).

## Prinsip
Secure by default, least privilege, backend enforcement, branch isolation, data minimization, auditability, dan safe failure. Dokumen ini menetapkan kebutuhan; bukan hasil security audit.

## Authentication dan Session
Gunakan mekanisme hashing password yang aman, session management dan cookie yang dikonfigurasi secure, CSRF protection sesuai arsitektur, rate limit endpoint sensitif, reset password aman, serta logout/session invalidation. Pilihan Sanctum/session mode dan parameter final harus diverifikasi terhadap stack yang dipilih. Tidak ada authentication implementation saat ini.

## Authorization
- Terapkan Policies/Gates di backend untuk setiap resource/action.
- Terapkan branch scope pada query dan operasi; jangan mempercayai filter UI.
- Deny-by-default dan least privilege.
- Customer portal memverifikasi ownership/linkage untuk mencegah IDOR.
- Matriks role/action dan akses pusat/cross-branch harus disetujui sebelum route dibuat.

## Input, Output, dan File
Validasi semua input di server; lindungi mass assignment, SQL injection, XSS, CSRF, dan output context. Upload file (jika diperlukan) harus memvalidasi ukuran/MIME/content, penyimpanan, access control, dan scanning policy. File upload scope belum diputuskan.

## Data Protection
Secret tidak boleh masuk source control. Data sensitif tidak ditulis sembarangan ke log. Gunakan TLS untuk transport production. Retention, encryption-at-rest, backup encryption, customer consent, medical data classification, export, anonymization, dan deletion policy membutuhkan keputusan.

## Data Integrity dan Audit
Audit perubahan permission, transaksi keuangan, stok, refund, record medis, konfigurasi, dan aktivitas administrator. Audit perlu menyimpan actor, tindakan, waktu, objek, konteks tanpa menyimpan secret atau payload sensitif berlebih. Uang memakai decimal; posted financial data dan finalized medical records tidak dihapus tanpa histori/reversal/amendment.

## Integrasi dan Webhook
External adapter memisahkan business logic dari vendor. Payment webhook wajib memverifikasi signature dan status, idempotency, mencegah replay/double processing, serta mencatat payload minimum aman. Provider belum dipilih.

## Dependency dan Runtime
Verifikasi dependency advisories dan dukungan versi sebelum release. Production debug nonaktif, database tidak diekspos langsung ke internet, permission file/container aman, TLS aktif, secrets dikelola di luar repository, dan log memiliki retention policy.

## Threat Cases Minimum
Authentication bypass; authorization bypass; IDOR; cross-branch/customer data leakage; CSRF/XSS/SQL injection; mass assignment; upload abuse; webhook spoof/replay; session misconfiguration; secret/log exposure; dependency vulnerability; unsafe debug config; race condition pada transaksi.

## Security Review Gate
Sebelum release: review routes/policies, branch/customer isolation tests, input/output/file controls, session/CSRF, webhook signatures/idempotency, secret scan, dependency scan, runtime config, audit coverage, backup protection, dan unresolved findings. Tidak ada hasil audit yang diklaim sebelum dijalankan.