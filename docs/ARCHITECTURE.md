# Arsitektur PETORA INDONESIA

- Status: Baseline implementasi fondasi ditetapkan; module-level decisions tetap mengikuti [IMPLEMENTATION_READINESS.md](IMPLEMENTATION_READINESS.md).
- Authority: `AI_AGENT.md` dan kebutuhan pada `MASTER_SPECIFICATION.md`.
- Implementasi aktual: belum ada source code/dependency manifest saat dokumen dibuat.

## Tujuan
Menetapkan batas arsitektur yang cukup untuk tahap desain berikutnya tanpa menyatakan keputusan teknis yang belum didukung bukti.

## Keputusan Baseline

- Gaya: modular monolith; satu aplikasi backend dan satu database utama.
- Backend: PHP/Laravel; frontend: React + TypeScript dengan Inertia.js/Vite sebagai baseline.
- Database: PostgreSQL. Redis, Nginx, Docker/Compose dan Linux menjadi baseline deployment jika relevan.
- Instalasi: satu bisnis per instalasi, multi-cabang; bukan SaaS multi-tenant.
- Deployment: self-hosted.
- Versi runtime/library dan deployment topology final belum dipilih atau diverifikasi.

## Batas Modul

Modul domain mengikuti katalog pada `MASTER_SPECIFICATION.md`: Core, Branches, Customers, Pets, Catalog, Inventory, Procurement, POS, Billing, Payments, Clinic, Laboratory, Hospitalization, Grooming, Boarding, Scheduling, Finance, Employees, Notifications, Customer Portal, Reports.

Setiap modul memiliki tanggung jawab domain sendiri. Modul tidak mengakses detail internal modul lain secara sembarang. Gunakan service/action atau shared interface dengan kontrak jelas; domain events hanya jika kebutuhan asynchronous/decoupling membenarkannya. Foreign key lintas modul digunakan hanya untuk relasi yang memang bagian dari model data bersama.

## Dependensi Konseptual

- Core dan Branches menyediakan identitas, permission, konfigurasi, dan branch scope.
- Customers/Pets menjadi shared profiles.
- Catalog dipakai oleh transaksi dan layanan.
- Procurement memasok Inventory melalui receiving/movement.
- POS, Clinic dan layanan operasional menyediakan source charge ke Billing.
- Payments berhubungan dengan Billing; Finance/Reports membaca transaksi yang dapat ditelusuri.
- Scheduling mendukung appointment Clinic, Grooming, dan Boarding.

Arah call, ownership data, transaction boundary dan kontrak runtime tiap dependensi belum ditetapkan.

## Layer dan Tanggung Jawab

- HTTP/Inertia layer: routing, authentication middleware, request/response, dan pemanggilan use case.
- Application/domain: workflow dan business rules per modul.
- Persistence: migration, query, constraints, dan transaction boundaries.
- Frontend: page/feature components React + TypeScript; bukan satu-satunya validasi business rules.
- Integrations: adapter/provider boundary; business rules tidak digabung dengan detail vendor.
- Shared support: hanya kemampuan lintas modul yang benar-benar disepakati.

## Internal Web dan API Boundary

Staff/customer browser experience menggunakan same-origin Laravel + Inertia flow dan session authentication dengan CSRF protection. Jangan membuat REST endpoint untuk operasi yang hanya digunakan oleh halaman Inertia. External/stateless API dibuat hanya untuk consumer yang disetujui, menggunakan versioned JSON API contract. Provider webhooks memiliki route boundary, signature verification, idempotency, rate/size limits, serta audit/observability yang sesuai.

## Integritas dan Keamanan

- Backend menegakkan validation, authentication, authorization, dan branch scope.
- Uang menggunakan decimal/numeric; stock movement menjadi histori stok.
- Financial posting/reversal dan medical-record amendments mempertahankan histori.
- Operasi multi-domain yang memerlukan atomicity memiliki transaction boundary eksplisit.
- Queue/retry hanya untuk pekerjaan yang aman diulang; operasi source/callback idempotent bila relevan.
- Audit, structured logging, secret handling, dan error redaction menjadi cross-cutting concerns.

## Struktur Repository Usulan

Struktur Laravel dan `resources/js/` mengikuti baseline dalam `AI_AGENT.md`; struktur ini usulan, bukan gambaran file aktual. Jangan memindahkan atau membuat semua folder sebelum modul membutuhkannya. Batas modul/domain diimplementasikan bertahap dan diuji.

## Kualitas dan Dependency

Verifikasi versi PHP, Laravel, Node, React, PostgreSQL, serta kompatibilitas library dari dokumentasi resmi sebelum menambah dependency. Kunci versi dengan lockfiles. Belum ada composer/npm manifests, lockfiles, CI, maupun build untuk diverifikasi.

## Keputusan Terbuka Sebelum Architecture Sign-off

MVP dan urutan release; deployment topology; authentication/session mode; batas module ownership; Inertia/API exposure; database transaction boundaries; queue/cache needs; storage/file strategy; real-time need; observability; target volume/performance; dan dependency versions. Perubahan stack utama memerlukan perbandingan alternatif, dampak, dokumentasi, dan persetujuan.

## Exit Criteria
Arsitektur siap sebagai acuan implementasi setelah boundary/ownership, dependency direction, authentication, transaction boundaries, deployment topology, dan open decisions direview serta disepakati. Dokumen ini tidak mengklaim aplikasi telah dibangun.