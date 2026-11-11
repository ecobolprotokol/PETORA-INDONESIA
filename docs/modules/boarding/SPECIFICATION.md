# Spesifikasi Modul Boarding

- Requirement: REQ-BOARD-01, REQ-BOARD-02
- Status: Draft roadmap; operasional boarding perlu validasi pengguna dan klinisi.

## 1. Purpose
Mengelola layanan boarding/pet hotel dan menautkan biaya ke sistem billing.

## 2. Business Objectives
Menjaga booking, pet, periode layanan, dan charge dapat ditelusuri pada cabang/resource yang tepat.

## 3. Actors and User Roles
Boarding staff, branch manager, customer, dokter hewan bila ada kebutuhan medis. Hak akses dan interaksi klinis TBD.

## 4. Scope
Boarding booking/stay, scheduling/capacity, staff/resource assignment, status, dan billing linkage sesuai workflow yang disetujui.

## 5. Out of Scope
Smart kennel devices, live camera, automated feeding, transport, dan pet insurance belum ditetapkan.

## 6. Functional Requirements
REQ-BOARD-01: booking/layanan boarding dan biaya terhubung ke billing. REQ-BOARD-02: capacity, check-in/out, tarif, deposit, feeding/medication, incident, cancellation perlu diputuskan.

## 7. Business Rules
Boarding charge dapat ditelusuri ke invoice tanpa duplikasi. Availability dan konflik resource mengikuti scheduling/capacity policy. Medication yang diberikan harus mengikuti alur klinis dan inventory yang disetujui.

## 8. User Workflows
Booking dibuat untuk pet dan periode; kapasitas/resource diperiksa; staf memproses check-in/stay/check-out sesuai status yang ditetapkan; biaya tertaut billing. Prosedur feeding, medication, incident, dan custody memerlukan validasi.

## 9. UI Screens
Booking/stay board, detail pet/stay, resource assignment, check-in/out, charge, dan incident views adalah kandidat UX; cakupan bergantung validasi operasi.

## 10. Data Entities
Konsep: boarding booking/stay, pet, customer, branch, resource, staff, period, charge, care instructions/incident bila disetujui.

## 11. Database Relationships
Stay terkait pet/customer, branch, resource, staff assignments, scheduling, billing, dan clinical/inventory records bila ada medication.

## 12. API Endpoints or Server Actions
Belum ditetapkan. Booking, capacity, lifecycle, charge, dan clinical handoff contract ditentukan kemudian.

## 13. Authorization Rules
Boarding record dibatasi backend berdasarkan role dan cabang. Customer portal hanya melihat stay miliknya setelah hubungan diverifikasi.

## 14. Validation Rules
Availability, dates/timezone, capacity, pet/customer, assignment, check-in/out status, dan charge dihitung menurut policy yang disetujui.

## 15. Transaction Rules
Capacity check dan booking harus menangani concurrency. Charge/extension tidak boleh diduplikasi; inventory medication (jika berlaku) mencatat movement.

## 16. Notifications
Booking/reminder/check-in/out updates belum memiliki channel atau consent policy.

## 17. Audit Requirements
Booking changes, custody/status, incident, medication handoff, cancellation, dan charge adjustments diaudit sesuai keputusan.

## 18. Error Handling
Capacity conflict, invalid dates/status, missing pet relationship, duplicate extension/charge, dan billing/notification failure tidak boleh merusak stay state.

## 19. Integration Dependencies
Scheduling, Pets, Customers, Branches, Catalog, Billing, Payments, Clinic, Inventory, Notifications, Reports.

## 20. Acceptance Criteria
- Booking hanya diterima ketika kapasitas/resource memenuhi aturan yang disetujui.
- Stay dapat ditelusuri ke pet/customer/branch.
- Charges terhubung ke invoice tanpa duplikasi.
- Portal dan staf hanya mengakses data sesuai authorization.
- Medication/incident workflow tidak diaktifkan sebelum policy disetujui.

## 21. Test Scenarios
Capacity boundary/concurrency, booking/reschedule/cancel, check-in/out lifecycle, invalid pet, extension charges, medication handoff, branch/customer isolation, and partial failures.

## 22. Known Limitations
Capacity model, kennel/resource, duration/rates, deposit, check-in/out policy, feeding/medication, incident, consent, cancellation, and customer notifications belum ditentukan.
