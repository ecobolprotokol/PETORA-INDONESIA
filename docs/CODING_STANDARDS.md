# Standar Coding PETORA INDONESIA

- Status: Baseline siap untuk repository foundation; detail yang bergantung versi mengikuti compatibility check dan lockfiles.
- Sumber utama: aturan coding pada `AI_AGENT.md`.

## Bahasa dan Penamaan
Dokumentasi berbahasa Indonesia; code identifiers berbahasa Inggris. PHP class PascalCase; method/variable camelCase; database column snake_case. React components/types mengikuti convention framework dan repository setelah bootstrap.

## Backend

- Laravel sebagai baseline; gunakan request validation terstruktur, Policies/Gates, transactions untuk operasi atomik, queue untuk pekerjaan berat/asynchronous, exceptions yang jelas, explicit response contracts.
- Controller/route handlers tidak menjadi tempat seluruh business logic.
- Gunakan Actions untuk operasi bisnis yang jelas, Services untuk perilaku bersama; hindari wrapper tanpa manfaat.
- Hindari N+1, gunakan eager loading/pagination jika sesuai bukti query.
- Gunakan idempotency pada operasi yang dapat dikirim ulang; jangan return data sensitif.
- Semua input dan authorization diverifikasi backend.

## Frontend

- React + TypeScript; hindari `any` kecuali perlu dan diberi alasan.
- Pisahkan page-level dan feature components; hindari komponen raksasa dan duplikasi server/client state tanpa alasan.
- Gunakan reusable components/hooks mengikuti pola yang terbukti di repository.
- Form menyediakan validation feedback; UI menangani loading/empty/error/success; aksi berisiko meminta confirmation.
- Frontend validation membantu UX tetapi tidak menggantikan validasi business rules di backend.

## Database dan Migrations
Gunakan PostgreSQL; foreign keys dan constraints; `timestamptz`; `numeric` untuk uang; migration untuk setiap schema change. Index mengikuti query nyata. Periksa migration sebelumnya dan dampak data; destructive migration produksi memerlukan backup, rollback/migration plan, dan persetujuan.

## Modul dan Integrasi
Pertahankan modular monolith; modul memiliki domain ownership jelas dan tidak mengakses detail internal modul lain sembarangan. Gunakan service/kontrak/shared interface; event hanya bila bermanfaat. External integrations menggunakan adapter/interface.

## Testing dan Quality
Setiap feature memiliki test proporsional pada unit/feature/integration/E2E. Jangan menghapus test atau assertion agar pipeline hijau. Jalankan lint, static analysis, tests dan typecheck yang tersedia; laporkan hasil nyata.

## Repository Hygiene
Jangan commit `.env`, secrets, dumps produksi, data customer, temporary files, atau build artifacts yang tidak diperlukan. Gunakan lockfiles dan Conventional Commits sebagaimana `AI_AGENT.md`. Hindari perubahan tidak terkait dan jangan melakukan rewrite tanpa alasan.

## Dependency Management
Jangan menebak versi. Verifikasi compatibility, support status, dan dokumentasi resmi; pin versi dan update lockfile melalui package manager yang sesuai. Tidak ada dependency manifest/lockfile saat ini.

## Review Checklist
Business rule/requirement; authorization/branch scope; validation; transaction/idempotency; errors; audit/privacy; test; docs; migration impact; dependency changes; known limitations.