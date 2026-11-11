# Spesifikasi Modul Procurement

- Requirement: REQ-PROC-01, REQ-PROC-02
- Status: Draft roadmap; approval dan receiving policy belum diputuskan.

## 1. Purpose
Mengelola proses pengadaan yang terhubung ke supplier dan penerimaan stok.

## 2. Business Objectives
Membuat barang yang diterima dapat ditelusuri dari proses procurement hingga inventory movement.

## 3. Actors and User Roles
Procurement staff, inventory staff, branch manager, pemilik bisnis. Batas approval dan pemisahan tugas TBD.

## 4. Scope
Supplier, purchase orders, receiving, dan stock transfer terkait procurement sebagaimana roadmap. Detail workflow menunggu validasi.

## 5. Out of Scope
E-procurement, supplier portal, tendering, payment-to-supplier, contract management, dan automated replenishment belum ditetapkan.

## 6. Functional Requirements
REQ-PROC-01: supplier, purchase order, receiving, transfer terkait. REQ-PROC-02: approval, partial receipt, cancellation, return, dan cost valuation harus disepakati.

## 7. Business Rules
Receiving yang berhasil harus menghasilkan stock movement dengan referensi sumber. Stok tidak boleh diubah langsung. Duplicate receiving tidak boleh menggandakan stok.

## 8. User Workflows
Staf mengelola supplier dan purchase order; barang diterima melalui proses receiving yang tervalidasi; penerimaan mengalir ke inventory ledger. Approval, partial receipt, discrepancy, dan closing sequence TBD.

## 9. UI Screens
Supplier, purchase order, receiving, dan status views merupakan kandidat UX; field dan approval UI belum ditetapkan.

## 10. Data Entities
Konsep: supplier, purchase order, purchase line, receipt, received item/batch, source reference. Field dan status TBD.

## 11. Database Relationships
Purchase order terkait supplier dan items; receipt menautkan order serta movement inventory. Cardinality, partial receipt, dan return model ditetapkan di ERD.

## 12. API Endpoints or Server Actions
Belum ditetapkan. Kontrak order/receipt memerlukan idempotency, authorization, dan transaction boundary.

## 13. Authorization Rules
Procurement action dan approval dibatasi backend dan branch scope. Approval threshold dan self-approval policy TBD.

## 14. Validation Rules
Supplier/item aktif, kuantitas, unit, harga, cabang/warehouse, dan receipt discrepancy divalidasi setelah kebijakan dipilih.

## 15. Transaction Rules
Receipt dan stock movement dibuat atomik; pengiriman ulang source idempotent. Pembatalan setelah posting memakai reversal/adjustment yang tercatat, bukan hard delete.

## 16. Notifications
Notifikasi approval atau kedatangan barang belum ditetapkan.

## 17. Audit Requirements
Perubahan order, approval, receiving, adjustment/discrepancy, dan pembatalan dapat diaudit sesuai aturan final.

## 18. Error Handling
Supplier/item invalid, duplicate receipt, order status tidak sesuai, dan kegagalan inventory tidak boleh meninggalkan receipt tanpa movement atau sebaliknya.

## 19. Integration Dependencies
Catalog, Inventory, Branches, Finance, dan Notifications bila disetujui. Integrasi finance supplier belum termasuk kontrak terkonfirmasi.

## 20. Acceptance Criteria
- Supplier dan purchase order dapat ditautkan pada alur yang disetujui.
- Receiving memperbarui stok melalui movement ledger.
- Duplicate receiving tidak menggandakan stok.
- Kegagalan pada receiving/inventory tidak menghasilkan data parsial.
- Approval, cancellation, partial receipt, dan return bekerja sesuai keputusan terdokumentasi.

## 21. Test Scenarios
Order normal/invalid, approval, partial/over receipt, duplicate request, concurrent receive, supplier/item inactive, cancellation, discrepancy, return, branch isolation, dan transaction rollback.

## 22. Known Limitations
Supplier fields, approval matrix, currency/tax, partial fulfillment, return, costing, purchase payment, receiving variance, and procurement status lifecycle belum ditentukan.
