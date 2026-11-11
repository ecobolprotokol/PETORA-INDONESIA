# Spesifikasi Modul Scheduling

- Requirement: REQ-SCH-01, REQ-SCH-02
- Status: Draft baseline; calendar policy dan lifecycle memerlukan persetujuan.

## 1. Purpose
Menyediakan aturan availability dan conflict checking untuk appointment dan layanan terjadwal.

## 2. Business Objectives
Mencegah booking yang saling bertabrakan dan menjaga assignment staff/resource sesuai cabang.

## 3. Actors and User Roles
Admin klinik, dokter hewan, groomer, boarding staff, branch manager, customer bila booking portal diaktifkan.

## 4. Scope
Availability, resource/staff assignment, branch, service duration, conflict checking, cancellation, rescheduling, status lifecycle.

## 5. Out of Scope
Workforce optimization, route planning, external calendar sync, automated waitlist, and recurrence rules belum ditetapkan.

## 6. Functional Requirements
REQ-SCH-01: appointment memperhatikan availability, resource, staff, branch, duration, conflict, cancel/reschedule, dan status. REQ-SCH-02: definisi slot, precedence, timezone, dan cancellation policy harus disetujui.

## 7. Business Rules
Tidak boleh mengonfirmasi resource/staff yang bertabrakan menurut conflict rules; branch scope harus konsisten. Status lifecycle dan availability harus eksplisit.

## 8. User Workflows
User mencari slot, memilih service/branch/resource bila relevan, sistem memeriksa availability dan konflik, booking dibuat/dikonfirmasi, lalu dapat di-reschedule/cancel sesuai policy. Approval dan hold/expiry slot TBD.

## 9. UI Screens
Calendar/day/week/list, availability search, appointment detail, create/reschedule/cancel, dan assignment views adalah kandidat UX; FullCalendar hanya baseline teknologi yang disebut, bukan keputusan desain.

## 10. Data Entities
Konsep: appointment, service, time interval, staff/resource, branch, status, cancellation/reschedule history.

## 11. Database Relationships
Appointment terkait customer/pet bila layanan memerlukan, service catalog, branch, staff/resource, dan domain source (clinic/grooming/boarding).

## 12. API Endpoints or Server Actions
Belum ditetapkan. Availability query dan booking command perlu concurrency/idempotency contract.

## 13. Authorization Rules
Create/view/update/cancel dibatasi backend dan branch scope; self-service customer access harus memverifikasi ownership.

## 14. Validation Rules
Time interval/timezone, service duration, availability, resource/staff eligibility, branch, and lifecycle transition divalidasi server-side.

## 15. Transaction Rules
Pengecekan konflik dan reservasi harus menangani dua request bersamaan agar aturan kapasitas tidak terlewati. Reschedule harus atomik terhadap slot lama/baru.

## 16. Notifications
Confirmation/reminder/cancellation/reschedule notifications dan preference belum ditetapkan.

## 17. Audit Requirements
Perubahan assignment, reschedule, cancellation, status override, dan booking manual dicatat sesuai policy.

## 18. Error Handling
Slot sudah diambil, resource conflict, timezone invalid, dan retry duplicate ditangani dengan response jelas tanpa double booking.

## 19. Integration Dependencies
Clinic, Grooming, Boarding, Customers, Pets, Catalog, Branches, Notifications, dan Customer Portal.

## 20. Acceptance Criteria
- Slot hanya tersedia sesuai availability dan kapasitas yang disetujui.
- Concurrent booking yang konflik tidak sama-sama dikonfirmasi.
- Reschedule tidak meninggalkan dua reservasi aktif.
- Cancellation/status sesuai lifecycle dan teraudit.
- Akses cabang/customer ditegakkan backend.

## 21. Test Scenarios
Availability, duration boundaries, staff/resource conflict, concurrent booking, reschedule atomicity, cancellation, timezone, branch isolation, unauthorized customer, and duplicate request.

## 22. Known Limitations
Working hours, holidays, slot granularity, buffer time, resource capacity, conflict priority, timezone, recurring appointments, hold expiration, and cancellation fee belum ditentukan.
