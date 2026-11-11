# Spesifikasi Modul Inventory

- Requirement: REQ-INV-01 sampai REQ-INV-04
- Status: Draft baseline; costing, stock policy, dan warehouse workflow perlu tinjauan.

## 1. Purpose
Mengelola persediaan, warehouse, batch/lot yang relevan, dan ledger pergerakan stok.

## 2. Business Objectives
Menjaga saldo stok dapat ditelusuri, mencegah perubahan tanpa histori, dan mendukung operasi multi-cabang.

## 3. Actors and User Roles
Inventory staff, procurement staff, branch manager, kasir, klinisi, dan administrator sesuai aksi. Approval/permission TBD.

## 4. Scope
Warehouse, stock movements, batches, receiving, transfer, adjustment, expiry, damage, return, POS sales, clinic consumption, dan internal usage sebagai tipe sumber/perubahan yang dinyatakan di AI_AGENT.

## 5. Out of Scope
Formula costing final, replenishment optimization, barcode hardware, serial tracking, manufacturing, dan valuation accounting belum ditetapkan.

## 6. Functional Requirements
REQ-INV-01: seluruh perubahan menghasilkan ledger. REQ-INV-02: movement menyimpan konteks produk/warehouse/quantity/type/source/user/time dan batch/expiry bila berlaku. REQ-INV-03: FEFO untuk batch selection bila sesuai; FIFO/weighted-average terpisah. REQ-INV-04: tangani concurrency.

## 7. Business Rules
Stok bukan angka yang diedit langsung tanpa movement. Contoh movement: receiving, sales, return, transfer, adjustment, expiry, damage, clinic consumption, internal usage. FEFO untuk picking batch jika berlaku; bukan metode valuasi biaya.

## 8. User Workflows
Staf berwenang mencatat movement melalui source operasional; sistem memvalidasi ketersediaan dan menyimpan ledger. Transfer memiliki jejak; koreksi stok harus berupa adjustment tercatat. Urutan approval dan negative-stock policy TBD.

## 9. UI Screens
Warehouse, saldo/ledger, batch, transfer, adjustment, dan expiry merupakan kandidat layar; prioritas dan layout ditetapkan di UX.

## 10. Data Entities
Konsep: product, warehouse, stock balance/projection, stock movement, batch/lot, source reference. Saldo perlu konsisten dengan movement ledger.

## 11. Database Relationships
Movement merujuk product, warehouse, actor, source, dan batch bila berlaku. Transfer dapat memiliki asal/tujuan; struktur historis ditetapkan di ERD.

## 12. API Endpoints or Server Actions
Belum ditetapkan. Operasi yang mengubah stok perlu kontrak atomicity, idempotency, concurrency, dan error.

## 13. Authorization Rules
Branch/warehouse scope diverifikasi backend. Adjustment, transfer, dan approval dibatasi permission; batas user/role TBD.

## 14. Validation Rules
Quantity decimal/precision, unit, warehouse/product availability, batch expiry, source reference, dan aturan stok minimum harus ditetapkan. Validasi backend wajib.

## 15. Transaction Rules
Movement dan pembaruan saldo/projection berjalan konsisten; operasi bersaing tidak boleh oversell menurut negative-stock policy. Tidak ada hard delete movement terposting; koreksi memakai movement reversal/adjustment yang tercatat.

## 16. Notifications
Peringatan stok rendah/expiry belum memiliki threshold atau channel yang disetujui.

## 17. Audit Requirements
Setiap movement mencatat actor dan waktu; adjustment, reversal, dan transfer menyimpan alasan/referensi sesuai policy.

## 18. Error Handling
Out-of-stock, expired batch, invalid warehouse, duplicate source, dan concurrency conflict menghasilkan kegagalan terkontrol tanpa perubahan parsial.

## 19. Integration Dependencies
Procurement receiving, POS sales/returns, Clinic medication/consumption, Billing/Finance costing, Branches, dan Reports. Kontrak tiap source ditetapkan pada tahap integrasi.

## 20. Acceptance Criteria
- Saldo dapat direkonsiliasi ke movement ledger.
- Receiving, sales, transfer, adjustment, expiry/damage, dan consumption yang disetujui menghasilkan histori.
- Duplicate source tidak menggandakan stok.
- Concurrent issue tidak menurunkan stok melampaui policy.
- Pemilihan batch menggunakan FEFO bila relevan dan aturan sudah disetujui.

## 21. Test Scenarios
Receiving, sale, return, transfer, adjustment, expiry, damage, clinic consumption, internal use, expired batch, out-of-stock, duplicate request, concurrent issue, branch isolation, dan reconciliation.

## 22. Known Limitations
Negative stock, unit conversion, costing, valuation, batch applicability, expiry policy, approval, adjustment reason, warehouse transfers, dan retention belum ditentukan.
