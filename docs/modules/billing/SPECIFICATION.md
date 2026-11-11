# Spesifikasi Modul Billing

- Requirement: REQ-BILL-01 sampai REQ-BILL-03
- Status: Draft baseline; kebijakan invoice dan siklus status perlu persetujuan.

## 1. Purpose
Menyediakan unified billing untuk biaya yang berasal dari modul operasional PETORA.

## 2. Business Objectives
Menggabungkan/menautkan tagihan lintas layanan tanpa double billing dan mempertahankan keterlacakan source.

## 3. Actors and User Roles
Kasir, finance staff, branch manager, staf layanan yang membuat charge, serta customer sebagai penerima invoice. Akses dan approval TBD.

## 4. Scope
Invoice, invoice items, status lifecycle, source references, dan integrasi pembayaran sebagaimana roadmap.

## 5. Out of Scope
General ledger lengkap, e-invoicing pemerintah, recurring billing, dunning, dan tax filing belum ditetapkan.

## 6. Functional Requirements
REQ-BILL-01: sumber POS, consultation, medication, laboratory, grooming, boarding, hospitalization, surgery, dan additional service terhubung ke invoice/item. REQ-BILL-02: idempotency dan lifecycle/histori. REQ-BILL-03: numbering, tax, discount, void, credit note, rounding TBD.

## 7. Business Rules
Setiap source dapat ditelusuri ke invoice/item. Source reference idempotent; double billing dicegah. Operasi terkait diproses atomik bila diperlukan. Perubahan status tidak merusak histori. Transaksi terposting tidak dihapus permanen.

## 8. User Workflows
Modul sumber mengirim charge; billing memvalidasi source/idempotency dan membuat atau menautkan invoice item; invoice bergerak ke status yang disepakati saat pembayaran/reversal. Merge invoice, split, dan finalization policy TBD.

## 9. UI Screens
Invoice list/detail, review/issue, status/payment history, dan receipt merupakan kebutuhan yang perlu dikonfirmasi pada tahap UX.

## 10. Data Entities
Konsep: invoice, invoice item, source reference, tax/discount component bila disetujui, payment allocation, reversal/credit reference.

## 11. Database Relationships
Invoice terkait branch, customer, items, source domain, payment allocations, dan audit. Source uniqueness/idempotency key serta invoice numbering perlu desain.

## 12. API Endpoints or Server Actions
Belum ditetapkan. Setiap modul sumber memerlukan explicit charge contract; endpoint, schema, error codes, dan idempotency ditentukan pada tahap API.

## 13. Authorization Rules
Invoice read/write, discount, issue, void, refund, dan cross-branch access dibatasi backend. Matriks izin/approval TBD.

## 14. Validation Rules
Source uniqueness, status transition, currency precision, item amount, and customer/branch consistency divalidasi. Tax/discount arithmetic belum final.

## 15. Transaction Rules
Pembuatan invoice/source linkage dan alokasi pembayaran harus konsisten. Status transition tidak menghapus jejak; correction/reversal menggunakan mekanisme tercatat.

## 16. Notifications
Invoice/receipt delivery channel, timing, dan resend policy TBD.

## 17. Audit Requirements
Pembuatan, perubahan status, adjustment, void, dan relasi source tercatat dengan actor/time/context.

## 18. Error Handling
Duplicate source mengembalikan hasil idempotent atau konflik yang terdefinisi; tidak membuat invoice kedua. Kegagalan source/invoice tidak boleh meninggalkan partial charge.

## 19. Integration Dependencies
POS, Clinic, Laboratory, Hospitalization, Grooming, Boarding, Payments, Finance, Customer, Notifications, dan Reports.

## 20. Acceptance Criteria
- Semua sumber dalam requirement dapat ditautkan ke invoice/item.
- Source reference yang dikirim ulang tidak menggandakan charge.
- Payment mengubah status sesuai lifecycle yang disetujui dan dapat ditelusuri.
- Pembatalan/koreksi transaksi terposting mempertahankan histori.
- Penghitungan uang memakai numeric/decimal, bukan floating-point.

## 21. Test Scenarios
Setiap source type, duplicate source, partial payment, split payment bila dipilih, invalid status transition, tax/discount setelah disetujui, refund/reversal, branch isolation, concurrent issue, dan rollback.

## 22. Known Limitations
Invoice lifecycle/numbering, tax, currency, rounding, discounts, merging, deposits, credit note, ownership, retention, dan output document belum diputuskan.
