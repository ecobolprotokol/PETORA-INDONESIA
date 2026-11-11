# Keputusan Teknis dan Kesiapan Implementasi

- Status: Baseline teknis ditetapkan untuk fondasi; keputusan bisnis berdampak tinggi tetap memerlukan persetujuan.
- Authority: Instruksi eksplisit dan `AI_AGENT.md`; tidak ada keputusan yang menggantikan kebutuhan persetujuan di atas data, uang, keamanan, atau workflow klinis.
- Kondisi repository: belum ada source code, dependency manifest/lockfile, migration, route, atau test suite.

## 1. Keputusan yang Dikunci oleh Baseline

| Area | Keputusan | Dasar |
|---|---|---|
| Arsitektur | Modular monolith, satu aplikasi backend dan satu database PostgreSQL per instalasi bisnis; tidak menggunakan microservices atau SaaS tenant model. | `AI_AGENT.md` sections 3, 4, 9, 10.2 |
| Backend | PHP + Laravel. Controllers/routes menangani HTTP; business use cases berada pada Action/Service sesuai kebutuhan; validation dan authorization di backend. | `AI_AGENT.md` sections 4, 9.4, 12 |
| Frontend | React + TypeScript + Inertia.js + Vite; gunakan Tailwind CSS/shadcn/ui sebagai baseline UI. Internal staff workflow memakai pola same-app Inertia; API eksternal dibuat hanya jika ada consumer/use case disetujui. | `AI_AGENT.md` sections 4, 13 |
| Database | PostgreSQL; foreign keys dan constraints untuk invariant yang ditetapkan; UUID untuk entitas yang memerlukan identifier stabil; `timestamptz` untuk waktu; `numeric` untuk uang. | `AI_AGENT.md` sections 4, 10.1 |
| Domain boundary | Modul memiliki ownership jelas. Pemanggilan langsung melalui service/contract adalah default untuk operasi sinkron; domain event/queue hanya untuk kebutuhan asynchronous/decoupling yang teridentifikasi. | `AI_AGENT.md` section 9 |
| Branch security | Backend memeriksa branch scope pada query dan command operasional; UI filter tidak memberi izin. | `AI_AGENT.md` sections 10.3, 15 |
| Data integrity | Stock movements adalah ledger; transaksi finansial memakai DB transaction, idempotency, reversal/adjustment; finalized medical records memakai amendment/correction dengan histori. | `AI_AGENT.md` sections 10, 11 |
| Schema changes | Seluruh perubahan melalui migration yang dapat direproduksi; destructive production migration tidak dilakukan tanpa backup, impact/rollback plan, dan persetujuan. | `AI_AGENT.md` sections 10.7, 28 |
| Deployment target | Self-hosted Linux; Docker/Compose dan Nginx sebagai baseline; TLS, persistent storage, backup/restore, health checks, logging, rollback dibutuhkan untuk release. | `AI_AGENT.md` sections 22, 23, 29 |
| Test layers | Backend memakai PHPUnit; frontend memakai Vitest + React Testing Library; browser E2E memakai Playwright. Versi diverifikasi kompatibilitas sebelum dikunci. | `AI_AGENT.md` sections 4.4, 16 |

Keputusan ini cukup untuk memulai repository foundation dan scaffolding setelah dependency versions diverifikasi. Keputusan ini tidak mengisi business rules yang belum disetujui.

## 2. Konvensi Implementasi yang Berlaku

- Server menjadi otoritas tunggal untuk validation, authorization, branch scope, status transition, dan financial/stock invariants.
- Operasi critical yang mengubah invoice/payment/stock harus memiliki transaction boundary eksplisit, idempotency contract, dan failure behavior sebelum code dibuat.
- Retry hanya untuk operasi aman diulang; asynchronous work menggunakan queue setelah kebutuhan async teridentifikasi.
- Tidak ada hard-delete generik untuk financial, audit, atau finalized medical records. Lifecycle spesifik tetap ditetapkan domain owner.
- Integration adapter memisahkan provider details dari domain rules.
- Dependency version tidak dikunci dalam dokumen ini: saat bootstrap, kompatibilitas PHP/Laravel/Node/React/database dan lifecycle support diverifikasi dari sumber resmi lalu lockfiles dibuat. Jangan menebak versi.
- Struktur folder baseline `AI_AGENT.md` adalah panduan, bukan alasan membuat file/folder kosong atau memindahkan seluruh aplikasi.

## 3. Dapat Diimplementasikan Setelah Review Dokumen Ini

### Repository Foundation

- Validasi compatibility/support versions dan pilih versi dependency yang saling kompatibel.
- Bootstrap Laravel + React/TypeScript/Inertia/Vite dan PostgreSQL.
- Buat environment example tanpa secret, local/test setup, lockfiles, lint/type/static analysis, test baseline, serta CI baseline.
- Terapkan modular monolith structure secara bertahap.
- Siapkan local/staging Docker/Compose/Nginx bila sesuai; jangan sentuh production configuration.

Exit: setup lokal dapat diikuti; aplikasi berjalan; baseline test/lint/typecheck/build dapat dijalankan; documentation dan lockfiles cocok.

### Core Technical Skeleton

- Internal browser application memakai Laravel session authentication dengan CSRF protection untuk same-origin Inertia requests. Jangan memakai bearer token untuk staff UI tanpa use case yang disetujui.
- Sanctum hanya ditambahkan jika ada consumer stateless/mobile/API yang disetujui; webhook authentication mengikuti signature contract provider.
- Terapkan server-side policy/gate hooks, branch context enforcement points, audit interface, serta business settings boundary.
- Jangan mengaktifkan role grants atau central-admin bypass sebelum authorization matrix disetujui.

Exit: authentication/session/security baseline diuji; unauthenticated/denied access ditolak; audit dapat merekam event sintetis; belum ada akses bisnis yang diasumsikan.

## 4. Gate Bisnis yang Memblokir Modul Terkait

| Keputusan owner yang dibutuhkan | Dampak jika belum disetujui | Modul/gate |
|---|---|---|
| Role grants, central admin, cross-branch, clinical access, approval/segregation | Tidak dapat memberi izin untuk aksi sensitif; deny-by-default tetap berlaku. | Core, Branches, seluruh modul |
| Customer/pet cardinality, ownership/guardian, dedup/merge, privacy/retention | Tidak dapat menetapkan relasi final, customer portal, atau deletion policy. | Customers, Pets, Portal, database schema |
| Currency/timezone, price/tax/discount/rounding, invoice/payment lifecycle, refunds/partial/split | Tidak dapat memfinalkan invoice schema, posting, checkout, atau acceptance finansial. | Catalog, POS, Billing, Payments, Finance |
| Unit, batch/expiry applicability, negative stock, costing, adjustment approval | Tidak dapat memfinalkan stock balance, valuation, receiving/issue rules. | Inventory, Procurement, Clinic |
| Clinical lifecycle, required record, sign-off/amendment, consent/retention | Tidak dapat memfinalkan schema/workflow medis atau grants klinis. | Clinic, Laboratory, Hospitalization |
| Availability, capacity, timezone, cancellation/reschedule rules | Tidak dapat memfinalkan slot/resource model dan booking acceptance. | Scheduling, Grooming, Boarding, Clinic |
| External providers, notification consent/channels, webhook/reconciliation terms | Provider adapters, secrets, callback contracts, dan retry semantics provider-specific belum dapat dibuat. | Payments, Notifications, Integrations |
| MVP, expected load, RPO/RTO, retention, recovery owner | Tidak dapat menetapkan kapasitas, SLO, backup schedule, dan alert threshold. | Deployment, Backup, Monitoring, Performance |
| Batas employee/HR, commission/payroll, accounting/report definitions | Tidak dapat memfinalkan model HR/finance dan KPI. | Employees, Finance, Reports |

Gate ini adalah kebutuhan keputusan, bukan default yang boleh dipilih AI.

## 5. Status Dokumen Turunan

- `ARCHITECTURE.md`, `CODING_STANDARDS.md`, `SECURITY.md`, dan `TESTING_STRATEGY.md`: baseline siap untuk repository foundation setelah review dan dependency verification.
- `DATABASE_DESIGN.md` dan `ERD.md`: prinsip siap; physical schema/DDL belum siap sampai relasi dan lifecycle pada tabel gate disetujui.
- `API_DOCUMENTATION.md` dan `INTEGRATION_GUIDE.md`: contract governance siap; endpoint/provider-specific contracts dibuat saat use case/provider disetujui.
- `AUTHORIZATION_MATRIX.md`: deny-by-default siap; permission grants belum disetujui.
- `UI_UX_GUIDELINES.md` dan `DESIGN_SYSTEM.md`: prinsip siap; screen inventory/workflow dan visual tokens perlu review pengguna sebelum UI feature work.
- `DEPLOYMENT.md`, `ENVIRONMENT_CONFIGURATION.md`, `BACKUP_RESTORE.md`, `MONITORING.md`, `PERFORMANCE.md`: target/control baseline siap; nilai environment, capacity, SLO, RPO/RTO, dan production procedure perlu konfigurasi dan persetujuan.
- `RELEASE_CHECKLIST.md`: template; item belum dinyatakan lulus.

## 6. Batas Klaim

Dokumen teknis ini tidak membuktikan aplikasi siap production. Tidak ada source, dependency, schema, API, security audit, backup/restore test, performance test, atau deployment yang telah diimplementasikan. Status siap implementasi pada dokumen berarti fondasi dan kontrak teknis baseline dapat mulai setelah review; modul yang terhalang business decisions harus menunggu keputusan tersebut.