# Spesifikasi Modul POS

- Requirement: REQ-POS-01, REQ-POS-02
- Status: Draft roadmap; aturan penjualan dan kasir perlu persetujuan.

## 1. Purpose
Mendukung penjualan produk/layanan dan menghubungkan hasil transaksi ke unified billing.

## 2. Business Objectives
Memungkinkan transaksi operasional terlacak, mencegah double billing, dan menjaga stok saat produk terjual.

## 3. Actors and User Roles
Kasir, branch manager, pemilik bisnis, staf yang dapat menjual layanan. Hak void/discount/refund TBD.

## 4. Scope
Point of Sale, pemilihan item, transaksi penjualan, invoice linkage, dan stock movement untuk item inventory.

## 5. Out of Scope
Hardware register, fiscal device, loyalty, coupon engine, offline mode, dan e-commerce belum ditetapkan.

## 6. Functional Requirements
REQ-POS-01: transaksi menjual item catalog dan menghasilkan/terhubung invoice. REQ-POS-02: stok berkurang melalui movement dengan idempotency dan concurrency.

## 7. Business Rules
Sumber POS menjadi salah satu sumber billing; source reference idempotent dan traceable. Sale stok menghasilkan ledger movement. Harga, pajak, diskon, dan refund mengikuti keputusan produk.

## 8. User Workflows
Kasir memilih item dan customer bila diperlukan, menginisiasi transaksi, sistem memvalidasi ketersediaan/price, transaksi ditautkan ke billing, lalu payment diproses sesuai policy. Langkah checkout dan customer wajib/opsional TBD.

## 9. UI Screens
POS workspace, cart/checkout, customer/item search, receipt, dan transaksi terdahulu adalah kandidat UX; layout dan keyboard flow perlu validasi staf.

## 10. Data Entities
Konsep: sale, sale line, catalog item snapshot, customer reference, invoice source, payment reference, stock movement reference. Field/status TBD.

## 11. Database Relationships
Sale terkait branch, actor, optional/required customer (TBD), catalog items, invoice, payment, dan inventory movement. Kardinalitas ditetapkan pada DB design.

## 12. API Endpoints or Server Actions
Belum ditetapkan. Create/submit operation harus mendefinisikan idempotency, price snapshot, concurrency, dan response contract.

## 13. Authorization Rules
Kasir hanya beroperasi pada cabang/aksi yang diizinkan. Void, discount override, refund, dan akses transaksi historis memerlukan izin eksplisit.

## 14. Validation Rules
Item aktif, kuantitas, harga, stok, cabang, dan tender divalidasi backend. Tax/discount/rounding belum ditetapkan.

## 15. Transaction Rules
Pembuatan sale, invoice/source linkage, dan pengurangan stok yang terkait tidak boleh menghasilkan keadaan parsial. Duplicate submit idempotent; reversal memiliki histori.

## 16. Notifications
Receipt/notifikasi customer dan channel pengirimannya belum ditetapkan.

## 17. Audit Requirements
Sale posting, void/cancel, price override, refund, dan perubahan status sensitif dicatat sesuai authorization/audit policy.

## 18. Error Handling
Out-of-stock, item tidak aktif, duplicate request, payment failure, dan inventory conflict harus dapat ditangani tanpa double charge atau stok parsial.

## 19. Integration Dependencies
Catalog, Customers, Billing, Payments, Inventory, Branches, Finance, dan Notifications bila dipilih.

## 20. Acceptance Criteria
- POS sale dapat ditelusuri ke invoice dan item sumber.
- Pengiriman ulang transaksi tidak membuat sale/invoice ganda.
- Penjualan stok menghasilkan movement tepat satu kali.
- Kegagalan payment tidak menghasilkan status lunas palsu.
- Void/refund hanya dilakukan sesuai permission dan menghasilkan histori.

## 21. Test Scenarios
Sale sukses, invalid item, customer resolution, out-of-stock, concurrent sale, duplicate submission, payment failure/partial, void, refund, branch isolation, dan transaction rollback.

## 22. Known Limitations
Offline POS, receipt format, tax/discount, tender lifecycle, customer requirement, negative stock, cashier session/cash drawer, and hardware integration belum ditentukan.
