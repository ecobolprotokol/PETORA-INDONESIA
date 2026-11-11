# Spesifikasi Induk PETORA INDONESIA

- Status: Draft untuk tinjauan produk
- Sumber kebutuhan: `AI_AGENT.md`
- Terkait: [PRODUCT_VISION.md](PRODUCT_VISION.md), [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md), dan spesifikasi modul di `docs/modules/`

## 1. Tujuan dan Status Kebenaran

Dokumen ini mengonsolidasikan kebutuhan produk yang telah ditetapkan. Requirement berstatus baseline berasal dari `AI_AGENT.md`; rincian yang belum tersedia dinyatakan sebagai TBD (belum diputuskan). TBD bukan izin untuk memilih perilaku secara sepihak. Dokumen ini tidak menetapkan schema fisik, endpoint final, vendor, atau permission per-record.

## 2. Identitas dan Model Produk

PETORA adalah sistem terintegrasi untuk petshop dan klinik hewan, mencakup POS, billing, payments, inventory, procurement, veterinary clinic, laboratory, surgery/hospitalization, grooming, boarding, scheduling, finance, reporting, employee management, notifications, customer portal, integrations, audit trail, dan konfigurasi sistem.

Baseline deployment adalah satu instalasi untuk satu bisnis yang dapat mengoperasikan banyak cabang. SaaS multi-tenant tidak termasuk baseline. Arsitektur adalah modular monolith, dengan Laravel backend, React + TypeScript frontend, PostgreSQL, serta self-hosted deployment; versi dependency belum ditentukan dan harus diverifikasi sebelum dikunci.

## 3. Sasaran Produk

- Menyatukan data customer dan pet lintas workflow.
- Menautkan layanan dan penjualan ke unified billing dengan pencegahan double billing.
- Menjaga transaksi keuangan dan pergerakan stok agar atomik/terlacak sesuai konteks.
- Menjaga histori medical record, khususnya catatan finalized.
- Memberlakukan branch scope dan authorization di backend.
- Menyediakan operasi yang dapat diuji, diaudit, dan dipasang ulang secara konsisten.

## 4. Aktor

| Aktor | Tanggung jawab umum yang diketahui | Batas keputusan |
|---|---|---|
| Pemilik bisnis | Mengelola/mengawasi bisnis dan laporan | Hak akses final TBD |
| System administrator | Konfigurasi dan administrasi sistem | Hak istimewa dan prosedur break-glass TBD |
| Branch manager | Pengawasan operasi cabang | Cakupan cabang dan lintas cabang TBD |
| Dokter hewan | Layanan dan informasi klinis | Scope rekam medis dan sign-off TBD |
| Admin klinik | Operasi administrasi klinik | Permission TBD |
| Kasir | POS dan proses pembayaran | Void/refund/discount approval TBD |
| Groomer | Workflow grooming | Permission dan assignment TBD |
| Boarding staff | Workflow boarding | Permission dan custody/incident rules TBD |
| Inventory staff | Operasi warehouse dan stok | Approval adjustment TBD |
| Procurement staff | Proses pengadaan | Approval dan batas nilai TBD |
| Finance staff | Catatan dan workflow finance | Posting/reconciliation rules TBD |
| Customer | Mengakses customer portal | Verifikasi identitas dan sharing data TBD |

Aktor di atas berasal dari daftar target pengguna; bukan role teknis atau matriks permission yang sudah disetujui.

## 5. Katalog Modul

Requirement ID pada kolom pertama ditelusuri di `PRODUCT_REQUIREMENTS.md`. Setiap modul memiliki spesifikasi dengan struktur governance lengkap.

| Requirement | Modul | Spesifikasi |
|---|---|---|
| CORE | Core, user, role, settings, audit | [Core](modules/core/SPECIFICATION.md) |
| BRN | Branches | [Branches](modules/branches/SPECIFICATION.md) |
| CUS | Customers | [Customers](modules/customers/SPECIFICATION.md) |
| PET | Pets | [Pets](modules/pets/SPECIFICATION.md) |
| CAT | Catalog | [Catalog](modules/catalog/SPECIFICATION.md) |
| INV | Inventory | [Inventory](modules/inventory/SPECIFICATION.md) |
| PROC | Procurement | [Procurement](modules/procurement/SPECIFICATION.md) |
| POS | Point of Sale | [POS](modules/pos/SPECIFICATION.md) |
| BILL | Billing | [Billing](modules/billing/SPECIFICATION.md) |
| PAY | Payments | [Payments](modules/payments/SPECIFICATION.md) |
| CLI | Clinic | [Clinic](modules/clinic/SPECIFICATION.md) |
| LAB | Laboratory | [Laboratory](modules/laboratory/SPECIFICATION.md) |
| HOSP | Hospitalization and surgery | [Hospitalization](modules/hospitalization/SPECIFICATION.md) |
| GROOM | Grooming | [Grooming](modules/grooming/SPECIFICATION.md) |
| BOARD | Boarding | [Boarding](modules/boarding/SPECIFICATION.md) |
| SCH | Scheduling | [Scheduling](modules/scheduling/SPECIFICATION.md) |
| FIN | Finance | [Finance](modules/finance/SPECIFICATION.md) |
| EMP | Employees | [Employees](modules/employees/SPECIFICATION.md) |
| NOTIF | Notifications | [Notifications](modules/notifications/SPECIFICATION.md) |
| PORTAL | Customer portal | [Customer portal](modules/customer-portal/SPECIFICATION.md) |
| RPT | Reports and analytics | [Reports](modules/reports/SPECIFICATION.md) |

## 6. Cross-Module Workflows

Workflow berikut adalah kontrak konseptual minimum. Langkah rinci, status, dan exception path harus dikonfirmasi sebelum desain database/API final.

### 6.1 Customer, Pet, dan Layanan

Customer dan pet merupakan shared data. Workflow klinik dan layanan harus merujuk profil yang sama; modul tidak boleh membuat duplikasi hanya karena sumber transaksi berbeda. Identifikasi, matching, merge, serta penanganan customer tanpa profil masih TBD.

### 6.2 Penjualan hingga Pembayaran

POS atau sumber layanan membuat referensi transaksi yang dapat ditelusuri ke invoice/item. Pembayaran tercatat terhadap invoice dan perubahan status invoice mengikuti lifecycle yang disepakati. Pemrosesan yang memengaruhi invoice, payment, dan stok harus menjaga konsistensi transaksi serta idempotency sesuai operasi. Rincian void, tax, pricing, dan settlement TBD.

### 6.3 Procurement hingga Stok

Receiving procurement memperbarui stok melalui stock movement yang tercatat, bukan edit angka tanpa ledger. Supplier, approval, partial receiving, dan return rules belum ditentukan.

### 6.4 Layanan Klinis

Appointment/consultation dapat melibatkan pet, rekam medis, prescription/treatment, laboratory, hospitalization/surgery, inventory consumption, dan billing. Data medis finalized harus memiliki histori perubahan; urutan klinis dan aturan finalisasi memerlukan validasi klinis.

### 6.5 Layanan Terjadwal

Appointment untuk clinic, grooming, atau boarding harus memperhatikan availability, resource, staff, branch, durasi, dan konflik. Definisi kapasitas dan prioritas konflik TBD.

## 7. Aturan Lintas Modul

1. **Shared identity:** customer dan pet adalah data bersama.
2. **Billing:** sumber biaya dapat mencakup POS, konsultasi, medication, laboratory, grooming, boarding, hospitalization, surgery, dan additional services. Source harus dapat ditelusuri; double billing dicegah; source reference idempotent.
3. **Payment:** metode yang disebut baseline mencakup cash, bank transfer, QRIS/payment gateway jika integrasi tersedia, card jika tersedia, split/partial jika diizinkan, serta refund/reversal. Kebijakan ketersediaan dan approval belum ditetapkan.
4. **Inventory:** transaksi stok menghasilkan movement ledger; movement menyimpan konteks minimum yang relevan (produk, warehouse, kuantitas, tipe, referensi sumber, batch/lot bila perlu, expiry bila berlaku, user, timestamp). FEFO untuk pemilihan batch bila sesuai; FIFO/weighted average untuk biaya adalah keputusan terpisah.
5. **Medical record:** draft dan finalized dibedakan. Koreksi finalized menggunakan amendment/correction dengan actor, waktu, dan alasan bila diperlukan; hard delete permanen dihindari.
6. **Branch scope:** query dan action backend memverifikasi cabang yang diizinkan. Filter UI bukan kontrol keamanan. Operasi lintas cabang harus eksplisit.
7. **Audit:** aktivitas penting mencatat siapa, apa, kapan, objek, dan konteks; daftar rinci mengikuti security requirements.
8. **Financial data:** nominal uang menggunakan representasi presisi decimal, bukan floating point; transaksi terposting tidak dihapus tanpa histori/reversal yang sesuai.
9. **External callback:** webhook payment wajib signature verification, status verification, idempotency, serta pencatatan payload relevan secara aman; provider belum dipilih.

## 8. Batas Domain dan Integrasi

Modul berjalan dalam satu aplikasi/backend dan satu database utama, dengan tanggung jawab domain terpisah. Interaksi menggunakan service/kontrak yang jelas, shared interface, foreign key yang memang dibutuhkan, dan domain event hanya bila bermanfaat. Detail kontrak teknis ditunda ke tahap architecture/API.

Dependensi konseptual: Core dan Branches mendukung seluruh modul; Customers/Pets digunakan oleh POS dan layanan; Catalog memasok produk/layanan ke transaksi; POS/Clinic/Laboratory/Hospitalization/Grooming/Boarding menjadi sumber billing; Procurement memasok Inventory; Payments terkait Billing; Scheduling melayani workflow appointment; Finance dan Reports mengonsumsi transaksi yang dapat ditelusuri. Arah data dan transaction boundary final harus ditetapkan di desain arsitektur.

## 9. Validasi, Authorization, dan Error Handling

Setiap input divalidasi di backend. Authorization harus ditegakkan dengan policy/gate dan branch scope, bukan hanya menyembunyikan UI. Validasi domain, status lifecycle, API contract, error code, rate limit, dan matriks permission per aksi belum ditentukan dan menjadi prasyarat desain teknis.

Error eksternal harus dapat ditelusuri, aman untuk retry hanya jika operasi idempotent, tidak membocorkan detail internal kepada user, dan tidak menghasilkan transaksi ganda.

## 10. Kriteria Penerimaan Produk

- Operasi multi-cabang hanya menampilkan/mengubah data cabang yang diizinkan, dibuktikan dengan pengujian backend lintas cabang.
- Customer/pet yang sama dapat dirujuk lintas modul tanpa duplikasi otomatis.
- Setiap sumber tagihan dapat ditelusuri ke invoice/item dan tidak dapat ditagih ganda dari source reference yang sama.
- Perubahan stok menghasilkan movement yang dapat ditelusuri; concurrent consumption tidak mengurangi stok melampaui aturan ketersediaan yang disetujui.
- Payment, refund/reversal, invoice status dan operasi keuangan mempunyai lifecycle serta histori yang dapat diuji.
- Perubahan rekam medis finalized mempunyai histori amendment/correction dan actor/time context.
- Workflow appointment menguji availability dan konflik resource/staff/cabang.
- Setiap aksi sensitif memiliki authorization, validasi, error path, audit sesuai kebijakan, dan test.
- Kontrak integrasi dan dokumentasi mengikuti implementasi terverifikasi; fitur belum dinyatakan selesai sebelum quality gates relevan lulus.

Kriteria bisnis yang memerlukan angka atau kebijakan (mis. tax rate, batas stok, durasi, retention, SLA) menunggu persetujuan; tidak dapat disimpulkan dari kriteria ini.

## 11. Non-Functional Requirements

Security by default, backend authorization, branch isolation, auditability, data integrity, self-hosted deployability, maintainability untuk solo developer, pagination dan perlindungan N+1, serta structured logging/health checks menjadi baseline. Nilai target performa, availability, volume, recovery, dan retention belum ditentukan.

## 12. Roadmap Produk dan Exit Criteria

Urutan berikut mengikuti fase pada `AI_AGENT.md`. Kelulusan fase memerlukan acceptance criteria modul, test relevan, dan dokumentasi yang diperbarui; roadmap bukan klaim bahwa fitur sudah tersedia.

| Fase | Cakupan | Exit criteria |
|---|---|---|
| 0. Repository foundation | Konvensi, README, environment example, dependency baseline, setup lokal, CI, arsitektur awal | Aplikasi dapat dijalankan lokal, setup dapat diikuti, baseline test dapat dijalankan. |
| 1. Core foundation | Authentication, users, roles/permissions, branches, business settings, audit, shared master data | Authentication, permission, branch scope, dan audit tercatat serta diuji. |
| 2. Customer, pet, catalog | Customer, pet, product/service catalog, categories, pricing | Customer/pet dapat dikelola dan catalog dapat digunakan transaksi dengan relasi/validasi konsisten. |
| 3. POS, billing, payment | POS, invoice/items, payment, refund, receipt | POS menghasilkan invoice; status pembayaran benar; split/partial mengikuti policy; duplicate transaction dicegah. |
| 4. Inventory and procurement | Warehouse, stock ledger, batches, purchase order, receiving, supplier, transfer | Stok memiliki ledger; receiving/sales/transfer tercatat; concurrency diperhitungkan. |
| 5. Clinic | Appointment, consultation, medical records, diagnosis, treatment, prescription, laboratory, hospitalization, surgery | Workflow medis teruji; histori rekam medis terjaga; billing dan permission klinis berjalan. |
| 6. Grooming, boarding, scheduling | Booking, staff/resource assignment, conflict checking, billing linkage | Booking terkelola; konflik jadwal dicegah; layanan ditautkan ke billing. |
| 7. Finance, reporting, HR | Financial records, reports, analytics, employee-related workflows | Financial records dapat ditelusuri; laporan memakai data konsisten; workflow karyawan mengikuti aturan bisnis. |
| 8. Customer portal and integrations | Customer PWA/portal, appointment booking, pet information, notifications, WhatsApp/email/payment integrations bila dipilih | Customer hanya mengakses datanya; integrasi memiliki error handling dan notifikasi dapat ditelusuri. |
| 9. Production readiness | Security/performance review, backup/restore, deployment, monitoring/logging, health checks, CI/CD, UAT | Release checklist, smoke test, restore test, rollback, dan dokumentasi deployment lulus; developer menyetujui release. |

Fase 0 implementasi fondasi baru dimulai setelah dokumen produk ditinjau dan keputusan yang memblokir fondasi disepakati. Provider integrations, payment methods, dan batas HR/finance yang belum dipilih tidak otomatis masuk release.

## 13. Keputusan Terbuka dan Gate

Sebelum database/API design disetujui: tetapkan MVP; role/permission dan cabang pusat; identitas customer/pet; seluruh status/lifecycle; uang, pajak, timezone, pricing dan refund; stok costing/negative stock/lot; workflow klinis dan tanda tangan; aturan jadwal/kapasitas; provider/integration; retensi/privacy; reporting definitions; serta target nonfunctional. Lihat daftar keputusan pada setiap spesifikasi modul.

## 14. Traceability dan Perubahan

Requirement IDs didefinisikan di `PRODUCT_REQUIREMENTS.md` dan dirujuk spesifikasi modul. Perubahan workflow, business rule, data contract, permission, atau integrasi memerlukan pembaruan dokumen terkait. Tinjauan developer/pemilik produk dibutuhkan untuk menutup keputusan berdampak tinggi.
