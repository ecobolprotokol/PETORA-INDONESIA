# Konfigurasi Environment PETORA INDONESIA

- Status: Environment separation dan secret-handling baseline ditetapkan; `.env.example` dan konfigurasi aplikasi menunggu bootstrap.
- Perhatian: contoh key di bawah bersumber dari `AI_AGENT.md`; nama final harus mengikuti konfigurasi aktual setelah bootstrap.

## Prinsip

- Jangan commit `.env`, credential, private key, production dump, atau secret.
- Sediakan `.env.example` tanpa nilai rahasia setelah dependency/config aktual ditentukan.
- Pisahkan local, test, staging, dan production; jangan memakai data production untuk eksperimen.
- Production debug nonaktif dan database tidak diekspos langsung ke internet.
- Secret dikirim melalui secret manager/protected deployment environment, bukan source control atau chat.

## Variabel Baseline yang Perlu Dipetakan

| Kelompok | Contoh dari baseline | Catatan |
|---|---|---|
| Aplikasi | `APP_NAME`, `APP_ENV`, `APP_DEBUG`, `APP_URL` | Nilai harus mengikuti framework dan deployment; production debug false. |
| Database | `DB_CONNECTION`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME` | PostgreSQL baseline; password tidak dicontohkan dengan secret nyata. |
| Cache/Queue | `REDIS_HOST`, `REDIS_PORT`, `QUEUE_CONNECTION` | Redis hanya dikonfigurasi bila dipakai; final driver TBD. |
| Mail | `MAIL_MAILER`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_ENCRYPTION`, sender fields | Provider, secret, dan channel belum dipilih. |
| Storage | disk/bucket/endpoint/credentials bila diperlukan | Local/object storage abstraction baseline; backend belum dipilih. |
| External providers | payment, WhatsApp, email, integrations | Tidak ada provider dipilih; jangan membuat key sebelum kontrak disetujui. |

Tabel ini adalah inventaris kandidat, bukan `.env` contract final. Tidak ada nilai nyata atau default production yang ditetapkan.

## Pengelolaan Secret
Batasi akses berdasarkan least privilege, rotasi sesuai kebijakan, hindari secret di logs/build artifacts, dan jangan mengekspos key ke frontend. Webhook signing secrets/provider credentials hanya berada di backend. Retention dan rotation schedule perlu diputuskan.

## Validasi Saat Startup/Deployment
Dokumentasikan variabel wajib/opsional, validasi format, perilaku saat hilang, dan redaksi nilai sensitif. Gagal konfigurasi sebaiknya menghentikan deployment dengan pesan aman, bukan fallback insecure.

## Environment Matrix
| Environment | Tujuan | Data | Debug/akses |
|---|---|---|---|
| Local | Pengembangan | Data sintetis | Akses developer; tidak memakai secret production |
| Test | Automated tests | Fixture/factory sintetis | Terisolasi dari data lain |
| Staging | UAT/rehearsal deployment | Data non-production | Konfigurasi mendekati production tanpa credential production |
| Production | Operasi bisnis | Data nyata | Debug nonaktif; perubahan memerlukan review/approval |

## Keputusan Terbuka
Framework-generated variables, queue/cache drivers, mail/storage/provider choices, secret manager, rotation, timezone, locale, upload limits, log destination, dan environment parity perlu ditetapkan setelah runtime/deployment design.