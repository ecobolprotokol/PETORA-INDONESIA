# Spesifikasi Modul Grooming

- Requirement: REQ-GROOM-01, REQ-GROOM-02
- Status: Draft roadmap; detail service operation perlu validasi dengan pengguna.

## 1. Purpose
Mengelola layanan grooming yang terjadwal dan menghubungkan hasil layanan ke billing.

## 2. Business Objectives
Memungkinkan grooming dikelola sebagai workflow operasional terpadu dengan customer, pet, jadwal, cabang, dan tagihan.

## 3. Actors and User Roles
Groomer, admin klinik/operasional, kasir, branch manager, customer. Assignment dan permission TBD.

## 4. Scope
Grooming service, booking/scheduling, staff/resource assignment, status service, dan billing linkage.

## 5. Out of Scope
Online marketplace, paket loyalty, grooming inventory recipe, photo workflow, dan mobile groomer operations belum ditetapkan.

## 6. Functional Requirements
REQ-GROOM-01: layanan grooming terjadwal dan dapat menghasilkan billing. REQ-GROOM-02: package, duration, resource, deposit, cancellation, dan pet-condition notes perlu disepakati.

## 7. Business Rules
Grooming charge dapat ditelusuri ke invoice dan tidak double billed. Schedule memeriksa staff/resource/branch/duration/conflict sesuai kebijakan bersama.

## 8. User Workflows
Customer/staf memilih pet dan service, booking diperiksa availability, staff/resource dialokasikan, layanan berlangsung dan status diperbarui, lalu charge ditautkan ke billing. Cancellation/deposit/condition capture TBD.

## 9. UI Screens
Service catalog selection, booking calendar/list, appointment detail, assignment, completion, dan charge review merupakan kandidat UX.

## 10. Data Entities
Konsep: grooming booking/service, pet, customer, assigned staff/resource, branch, status, charge source. Paket dan pet-condition notes TBD.

## 11. Database Relationships
Booking terkait pet/customer, service catalog, branch, staff/resource, scheduling entry, dan billing source.

## 12. API Endpoints or Server Actions
Belum ditetapkan. Booking/status/charge contract ditentukan pada tahap API setelah workflow disetujui.

## 13. Authorization Rules
Akses booking sesuai role dan branch scope; perubahan appointment/price/cancellation policy backend-enforced.

## 14. Validation Rules
Pet/customer, service availability, branch, duration, assignment, status transition, dan pricing divalidasi menurut keputusan.

## 15. Transaction Rules
Booking yang menghasilkan charge tidak boleh menimbulkan billing ganda; concurrent booking tidak boleh memesan resource yang sama bila conflict rule melarangnya.

## 16. Notifications
Booking confirmation/reminder/customer updates dan channel belum ditetapkan.

## 17. Audit Requirements
Perubahan booking, assignment, cancellation, price override, dan charge status dicatat sesuai kebijakan.

## 18. Error Handling
Unavailable slot/resource, pet/customer mismatch, duplicate booking request, dan billing failure ditangani tanpa state parsial.

## 19. Integration Dependencies
Scheduling, Customers, Pets, Catalog, Branches, Billing, Payments, Notifications, Reports.

## 20. Acceptance Criteria
- Booking menautkan pet/customer dan layanan yang benar.
- Conflict/resource checks mengikuti aturan yang disetujui.
- Grooming service dapat ditagih tepat satu kali.
- Hanya user berizin dapat mengubah status/assignment.

## 21. Test Scenarios
Booking, unavailable slot, concurrent conflict, reschedule/cancel, invalid pet, duplicate charge, branch isolation, staff reassignment, dan notification failure jika channel dipilih.

## 22. Known Limitations
Service variants, packages, duration, capacity, resource, pricing/deposit, cancellation, pet condition, add-on, and notification policy belum ditentukan.
