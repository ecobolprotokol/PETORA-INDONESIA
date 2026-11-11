# Spesifikasi Modul Pets

- Requirement: REQ-PET-01, REQ-PET-02, REQ-X-04, REQ-X-05
- Status: Draft baseline; definisi rekam medis berada pada modul klinis dan menunggu tinjauan.

## 1. Purpose
Mengelola profil pet yang digunakan bersama oleh customer, clinic, appointment, dan layanan lain.

## 2. Business Objectives
Menjaga identitas pet konsisten lintas workflow dan menjadi tautan bagi pelayanan serta histori yang diizinkan.

## 3. Actors and User Roles
Pemilik/customer, dokter hewan, admin klinik, kasir, groomer, boarding staff, dan staf berwenang. Akses informasi klinis per role TBD.

## 4. Scope
Profil pet dan relasinya dengan customer; rujukan ke catatan medis/layanan tanpa menduplikasi master pet.

## 5. Out of Scope
Diagnostik, clinical record authoring, prescription, vaccination schedule, breeding/pedigree, dan microchip workflows belum ditetapkan di modul ini.

## 6. Functional Requirements
REQ-PET-01: profil pet digunakan lintas modul dan terkait customer. REQ-PET-02: histori medis finalized tidak boleh diubah tanpa jejak.

## 7. Business Rules
Modul tidak membuat pet baru hanya karena sumber layanan berbeda. Koreksi informasi finalized dilakukan sebagai amendment/correction dengan actor, waktu, dan alasan bila diperlukan.

## 8. User Workflows
Staf menemukan atau mendaftarkan pet, mengaitkannya ke customer, lalu memilih profil itu pada appointment/layanan. Proses transfer ownership atau multi-guardian TBD.

## 9. UI Screens
Pencarian dan profil pet serta form create/update perlu dirancang pada tahap UX. Field, tab, dan tampilan data medis belum disetujui.

## 10. Data Entities
Konsep: pet profile, customer relationship, species/breed/identification bila disetujui, clinical records sebagai domain clinic. Field wajib TBD.

## 11. Database Relationships
Pet terkait customer dan dapat dirujuk layanan, appointment, transaksi, dan medical records. Kardinalitas/ownership belum ditetapkan.

## 12. API Endpoints or Server Actions
Belum ditetapkan. Kontrak profile lookup/update, ownership, dan clinical record akan dibagi menurut domain.

## 13. Authorization Rules
Akses pet/clinical data diperiksa backend, termasuk branch dan relasi customer portal. Akses lintas cabang terhadap histori medis memerlukan policy eksplisit.

## 14. Validation Rules
Field identitas, spesies, tanggal, dan format identifikasi menunggu keputusan. Backend memvalidasi semua input dan relasi yang dirujuk.

## 15. Transaction Rules
Perubahan relasi customer-pet tidak boleh memutus histori layanan; aturan transfer/merge dan audit perlu disepakati.

## 16. Notifications
Pengingat vaksin atau layanan belum termasuk kebutuhan terkonfirmasi; notifikasi hanya setelah aturan dan consent disetujui.

## 17. Audit Requirements
Perubahan profil dan semua koreksi finalized medical records harus memiliki histori sesuai kebijakan medis.

## 18. Error Handling
Relasi customer atau pet yang tidak valid ditolak; konflik identitas tidak diselesaikan otomatis tanpa aturan.

## 19. Integration Dependencies
Customers menjadi relasi bersama. Clinic, Laboratory, Hospitalization, Grooming, Boarding, Scheduling, Billing, dan Customer Portal dapat merujuk pet sesuai permission.

## 20. Acceptance Criteria
- Modul terkait dapat memilih pet yang sama dari sumber data bersama.
- Pet tidak dapat diakses melalui manipulasi ID bila user tidak memiliki hak.
- Koreksi finalized medical record menyimpan histori actor/time dan alasan bila diwajibkan.
- Perubahan ownership tidak menghapus jejak layanan historis.

## 21. Test Scenarios
Create/search, duplicate, invalid customer relationship, cross-branch/portal access, clinical history privacy, amendment, ownership change setelah disetujui, dan referensi lintas modul.

## 22. Known Limitations
Field pet, ownership/guardian cardinality, duplicate resolution, clinical data model, retention, dan consent belum ditetapkan.
