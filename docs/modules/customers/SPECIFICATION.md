# Spesifikasi Modul Customers

- Requirement: REQ-CUS-01, REQ-CUS-02, REQ-X-05
- Status: Draft baseline; field, privasi, dan deduplikasi perlu keputusan.

## 1. Purpose
Mengelola profil customer sebagai identitas bersama untuk operasi petshop, klinik, dan layanan terkait.

## 2. Business Objectives
Menghindari duplikasi customer antar modul dan menautkan transaksi/layanan ke profil yang dapat ditelusuri.

## 3. Actors and User Roles
Pemilik bisnis, admin klinik, kasir, staf operasional, dan customer pada portal bila diaktifkan. Akses per field/aksi TBD.

## 4. Scope
Pembuatan dan pengelolaan profil customer serta penggunaan referensinya oleh modul lain.

## 5. Out of Scope
Marketing automation, loyalty, CRM segmentation, consent platform, dan external identity matching belum ditetapkan.

## 6. Functional Requirements
REQ-CUS-01: profil customer tersedia lintas modul. REQ-CUS-02: aturan duplikasi, merge, field wajib, consent, retensi, dan penghapusan harus disepakati.

## 7. Business Rules
Modul berbeda tidak membuat customer duplikat hanya karena transaksi berbeda. Identifikasi unik, pencocokan, merge, dan siapa yang boleh menggabungkan profil TBD.

## 8. User Workflows
Staf menemukan atau membuat profil customer, mengaitkannya dengan pet/transaksi, lalu memperbarui informasi sesuai izin. Workflow portal dan koreksi data menunggu kebijakan persetujuan.

## 9. UI Screens
Pencarian, daftar/detail, dan form customer merupakan kebutuhan UX yang harus divalidasi; field dan interaksi belum disetujui.

## 10. Data Entities
Konsep: customer profile, contact methods, pet relationship, consent/preferences bila disetujui. Data pribadi minimum TBD.

## 11. Database Relationships
Customer dapat dikaitkan dengan pet dan source transaksi. Relasi guardian/shared-owner serta merge history belum ditentukan.

## 12. API Endpoints or Server Actions
Belum ditetapkan. Kontrak search, profile management, duplicate handling, dan portal access dirancang setelah aturan identitas disetujui.

## 13. Authorization Rules
Staf hanya mengakses fungsi sesuai permission dan branch/business context. Customer portal hanya mengakses data yang menjadi haknya; verifikasi hubungan customer-pet TBD.

## 14. Validation Rules
Validasi format kontak dan field wajib menunggu definisi bisnis. Semua input divalidasi backend; data sensitif tidak dikembalikan tanpa kebutuhan/izin.

## 15. Transaction Rules
Pembuatan customer bersamaan dengan transaksi harus mencegah duplikasi akibat pengiriman ulang; strategi idempotency dan matching perlu dipilih.

## 16. Notifications
Persetujuan komunikasi dan preferensi notifikasi belum ditentukan; tidak ada marketing opt-in yang diasumsikan.

## 17. Audit Requirements
Perubahan data customer sensitif, merge, dan penghapusan/anonimisasi dicatat sesuai kebijakan audit dan privasi yang disetujui.

## 18. Error Handling
Duplikasi ambigu harus meminta resolusi manusia atau mengikuti aturan yang disetujui, bukan menggabungkan record secara spekulatif.

## 19. Integration Dependencies
Pets, POS, Billing, Clinic, Scheduling, Customer Portal, Notifications, dan Reports menggunakan referensi customer sesuai kontrak.

## 20. Acceptance Criteria
- Modul yang berbeda dapat merujuk profil customer yang sama.
- Aturan pencarian/duplikasi/merge disetujui dan diuji sebelum pengaktifan otomatis.
- Akses staff dan portal dibatasi backend.
- Perubahan data sensitif dan tindakan merge dapat ditelusuri.

## 21. Test Scenarios
Buat/cari customer, duplicate submission, data ambigu, akses tanpa izin, akses portal ke customer lain, merge jika disetujui, penghapusan/retensi, dan pemakaian referensi lintas modul.

## 22. Known Limitations
Skema identitas, field, consent, privacy/retention, merge, household/shared owner, dan portal verification belum ditentukan.
