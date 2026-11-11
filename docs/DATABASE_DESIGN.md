# Desain Database PETORA INDONESIA

- Status: Aturan storage dan integritas siap menjadi baseline implementasi; schema fisik diblokir keputusan domain pada [IMPLEMENTATION_READINESS.md](IMPLEMENTATION_READINESS.md).
- Database baseline: PostgreSQL menurut `AI_AGENT.md`.
- Sumber domain: [ERD.md](ERD.md) dan spesifikasi modul.

## Batas Dokumen
Belum ada tabel, migration, seed, atau database instance dalam repository. Dokumen ini menetapkan aturan desain; nama tabel/kolom, cardinality, index, partitioning, dan DDL tidak dianggap final.

## Prinsip Schema

- Gunakan UUID untuk entitas yang memerlukan identifier stabil; keputusan per entitas dicatat pada desain rinci.
- Terapkan foreign key, unique constraints dan check constraints untuk invariant yang telah disetujui.
- Gunakan `timestamptz` untuk timestamp; tetapkan timezone bisnis dan penyimpanan UTC sebelum implementasi.
- Gunakan tipe `numeric` untuk nominal uang, jangan floating point; currency policy belum ditetapkan.
- Tambahkan index berdasarkan query, filter branch, join, uniqueness, dan bukti profiling; hindari index spekulatif.
- Gunakan migrations yang dapat direproduksi; perubahan schema tidak dilakukan manual.
- Tidak menambahkan `tenant_id` ke seluruh tabel; baseline satu bisnis per instalasi.
- Terapkan branch scope pada entitas operasional yang relevan, bukan otomatis semua tabel.

## Model Data Konseptual

Master data customer/pet digunakan bersama lintas modul. Branch, user, role/permission, audit, catalog, inventory movement, procurement, POS, invoice/payment, clinical record, appointment, service workflows, finance, dan reporting menjadi domain yang dirinci pada ERD dan spesifikasi. Cardinality, ownership, normalization, dan data retention memerlukan keputusan produk.

## Data Integrity

### Inventory
Stok harus dapat direkonsiliasi dari stock movement ledger. Movement mencatat produk, warehouse, quantity, type, source reference, actor, timestamp, serta batch/expiry bila berlaku. FEFO untuk batch picking bila sesuai; FIFO/weighted-average untuk costing adalah keputusan berbeda. Concurrency dan negative-stock policy harus diputuskan.

### Keuangan dan Billing
Nominal disimpan presisi decimal. Invoice/payment lifecycle dan source references harus dapat ditelusuri; idempotency/unique constraints mencegah duplikasi. Transaksi terposting dikoreksi melalui reversal/adjustment yang tercatat, bukan hard delete.

### Medical Records
Pisahkan draft dan finalized lifecycle. Finalized record tidak dihapus atau diubah tanpa jejak; amendment/correction mempertahankan actor, waktu, dan alasan bila diperlukan.

### Branch Scope dan Audit
Query/action operasional harus menyertakan pemeriksaan scope di backend. Audit records menyimpan siapa, apa, kapan, objek, konteks sesuai klasifikasi/retention yang disetujui.

## Transaksi dan Concurrency
Setiap use case menentukan atomicity boundary: contoh konseptual adalah receiving plus stock movement, POS sale plus invoice source dan stock deduction, payment plus invoice allocation, serta source charge plus invoice linkage. Locking/isolation strategy belum dipilih; uji concurrency harus menguji invariant bisnis, bukan hanya response sukses.

## Retention, Deletion, dan Privacy
Retention, legal hold, export, anonymization, customer/pet merge, serta penghapusan data belum ditetapkan. Financial, audit, dan medical history tidak boleh hard-delete berdasarkan asumsi. Kebijakan dan dampak foreign key harus direview sebelum migration.

## Migration Governance
Sebelum migration: inventarisasi schema aktual, relasi, migration sebelumnya, dampak data, constraints/indexes, rollback/forward strategy, serta backup untuk perubahan berisiko. Tidak ada destructive migration pada production tanpa prosedur backup dan persetujuan eksplisit. Migration pertama belum dibuat.

## Keputusan yang Memblokir Schema Final
Customer-pet cardinality/guardian; user-branch assignment; UUID scope; currency/timezone; invoice/payment states; tax/discount; stock units/batch/negative stock/costing; medical amendments/retention; appointment resource/capacity; employee scope; audit retention; report freshness; serta query/volume target.

## Exit Criteria
Desain rinci siap implementasi ketika conceptual ERD ditinjau, invariants dan cardinality disetujui, query utama diketahui, migration strategy diuji pada non-production, dan data-impact review diselesaikan. Dokumen ini bukan schema atau migration.