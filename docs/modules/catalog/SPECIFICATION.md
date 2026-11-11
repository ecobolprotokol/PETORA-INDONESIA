# Spesifikasi Modul Catalog

- Requirement: REQ-CAT-01, REQ-CAT-02
- Status: Draft roadmap; definisi item dan harga perlu persetujuan.

## 1. Purpose
Menyediakan katalog bersama untuk produk dan layanan yang digunakan transaksi dan workflow operasional.

## 2. Business Objectives
Menjaga referensi item konsisten antara POS, inventory, klinik, grooming, boarding, billing, dan laporan.

## 3. Actors and User Roles
Pemilik bisnis, system administrator, branch manager, inventory staff, procurement staff, dan staf yang menggunakan katalog. Hak mengelola harga TBD.

## 4. Scope
Produk, service catalog, categories, dan pricing sebagaimana tercantum pada roadmap.

## 5. Out of Scope
Promosi/loyalty, paket kompleks, bundling, subscription, multi-currency pricing, dan supplier-specific catalog belum ditetapkan.

## 6. Functional Requirements
REQ-CAT-01: catalog produk/layanan, kategori, harga digunakan modul transaksi. REQ-CAT-02: aturan effective date, tax, discount, variant, dan price snapshot menunggu keputusan.

## 7. Business Rules
Transaksi harus dapat menelusuri item yang dijual. Perubahan harga tidak boleh secara diam-diam mengubah histori transaksi; mekanisme snapshot dan price lifecycle harus ditetapkan.

## 8. User Workflows
Pengguna berwenang mengelola item/kategori/harga; POS dan modul layanan memilih item aktif. Approval, tanggal efektif, dan cabang-specific pricing TBD.

## 9. UI Screens
Daftar/pencarian item, detail, kategori, dan editor harga adalah kandidat kebutuhan UX; scope layar dan field menunggu validasi.

## 10. Data Entities
Konsep: product, service, category, price. SKU, variant, unit, tax class, status, dan branch applicability TBD.

## 11. Database Relationships
Kategori, harga, inventory item, service source, dan transaksi terkait secara konseptual. Relasi dan histori harga diputuskan pada ERD.

## 12. API Endpoints or Server Actions
Belum ditetapkan. Kontrak catalog lookup dan administration harus mencakup filtering/status dan authorization yang relevan.

## 13. Authorization Rules
Read/write catalog dan pricing menggunakan permission backend; perubahan harga dapat memerlukan approval, tetapi policy belum ditetapkan.

## 14. Validation Rules
Validasi nama/kode, jenis item, harga decimal, status, dan relasi kategori mengikuti keputusan produk. Harga tidak memakai floating point.

## 15. Transaction Rules
Transaksi menyimpan referensi item dan nilai yang berlaku menurut policy saat transaksi dibuat; detail snapshot dan tax calculation TBD.

## 16. Notifications
Notifikasi perubahan katalog/harga belum ditetapkan.

## 17. Audit Requirements
Perubahan harga dan item yang berdampak pada transaksi perlu audit sesuai matriks yang akan disetujui.

## 18. Error Handling
Item tidak aktif atau tidak tersedia dalam scope tidak dapat dipakai untuk transaksi baru; perilaku terhadap transaksi draft perlu ditetapkan.

## 19. Integration Dependencies
POS, Billing, Inventory, Procurement, Clinic, Laboratory, Grooming, Boarding, Finance, dan Reports menggunakan kontrak catalog yang sesuai.

## 20. Acceptance Criteria
- Modul transaksi dapat merujuk item catalog yang konsisten.
- Harga transaksi mempertahankan histori sesuai policy yang disetujui.
- Item tidak tersedia/invalid ditolak di backend.
- Perubahan harga memiliki audit dan tidak mengubah transaksi terposting.

## 21. Test Scenarios
Valid/invalid item, inactive item, duplicate code bila unique disetujui, price update, concurrent price change, tax/discount setelah ditetapkan, branch availability, dan historical transaction.

## 22. Known Limitations
Item schema, SKU/variant, units, tax, price history/effective date, discounts, branch pricing, dan approval belum ditentukan.
