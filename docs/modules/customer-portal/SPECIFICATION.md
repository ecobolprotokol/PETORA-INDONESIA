# Spesifikasi Modul Customer Portal

- Requirement: REQ-PORTAL-01 sampai REQ-PORTAL-03
- Status: Draft roadmap; identity, ownership, dan workflow harus disepakati sebelum implementasi.

## 1. Purpose
Menyediakan akses customer ke kemampuan self-service PETORA yang disetujui.

## 2. Business Objectives
Memungkinkan customer mengakses data dan layanan miliknya dengan kontrol privasi dan authorization yang kuat.

## 3. Actors and User Roles
Customer, customer support/admin terbatas, dan system administrator untuk konfigurasi. Hubungan customer dengan pet/guardian TBD.

## 4. Scope
Roadmap menyebut customer PWA, appointment booking, pet information, notifications. Bentuk aplikasi dan detail akses belum diputuskan.

## 5. Out of Scope
Online store, telemedicine, payment portal, social features, dan native app belum dinyatakan dalam baseline.

## 6. Functional Requirements
REQ-PORTAL-01: appointment booking, pet information, notifications sesuai scope. REQ-PORTAL-02: customer hanya mengakses data miliknya. REQ-PORTAL-03: authentication, ownership, data editing, dan booking workflow harus disepakati.

## 7. Business Rules
Portal tidak menjadi satu-satunya kontrol keamanan; backend memverifikasi relasi customer ke record/pet. Tidak boleh mengungkap data customer lain atau clinical records tanpa policy eksplisit.

## 8. User Workflows
Customer terautentikasi melihat informasi pet yang authorized, mengelola appointment bila fitur disetujui, dan menerima notifikasi sesuai consent. Identity proofing, booking confirmation, cancellation, dan perubahan data TBD.

## 9. UI Screens
Portal home, pet information, appointment, dan notification preferences merupakan kandidat; mobile/responsive/PWA requirement harus dikonfirmasi.

## 10. Data Entities
Konsep: portal identity/account, customer linkage, pet access/guardian relationship, appointment request, consent/preferences. Tidak ada schema final.

## 11. Database Relationships
Portal identity terkait customer record dan authorized pets/appointments. Shared guardianship dan account merge rules TBD.

## 12. API Endpoints or Server Actions
Belum ditetapkan. Public-facing contract perlu auth, rate limits, idempotency, privacy, validation, dan explicit error behavior.

## 13. Authorization Rules
Setiap request memeriksa ownership/linkage di backend (perlindungan IDOR). Support/admin access diaudit dan dibatasi. Branch scope ikut diterapkan pada appointment.

## 14. Validation Rules
Identity verification, booking data, pet/customer linkage, allowed updates, consent, and rate limits divalidasi server-side.

## 15. Transaction Rules
Booking request idempotent; booking slot conflict ditangani scheduling secara atomik. Pembayaran portal tidak termasuk tanpa keputusan.

## 16. Notifications
Portal dapat menampilkan/mengelola notifikasi sesuai kanal yang disetujui; consent dan opt-out tunduk pada modul Notifications.

## 17. Audit Requirements
Login sensitif, perubahan profil/ownership, booking, data access, dan admin support access diaudit sesuai privacy policy.

## 18. Error Handling
Jawaban untuk record yang tidak accessible tidak boleh mengungkap keberadaannya; booking conflict dan identity failure memberi pesan aman yang dapat ditindaklanjuti.

## 19. Integration Dependencies
Customers, Pets, Scheduling, Notifications, Branches, Clinic, dan Core authentication; Billing/Payments hanya jika kelak disetujui.

## 20. Acceptance Criteria
- Customer tidak dapat melihat/mengubah record customer lain dengan mengganti identifier.
- Relasi pet/customer diverifikasi backend.
- Booking hanya dikonfirmasi jika slot tersedia dan aturan scheduling terpenuhi.
- Hak customer atas data klinis dan update profile eksplisit serta diuji.

## 21. Test Scenarios
Unauthenticated, valid owner, other customer, shared guardian jika disetujui, IDOR, booking conflict/replay, rate limiting, consent/opt-out, and support access audit.

## 22. Known Limitations
Portal form factor, authentication, account recovery, pet ownership/shared guardian, clinical visibility, booking approval, notification, payment, and privacy policy belum ditentukan.
