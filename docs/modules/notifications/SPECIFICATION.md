# Spesifikasi Modul Notifications

- Requirement: REQ-NOTIF-01, REQ-NOTIF-02
- Status: Draft roadmap; channel, provider, consent, dan event belum dipilih.

## 1. Purpose
Menyediakan pengiriman dan keterlacakan notifikasi terkait workflow PETORA.

## 2. Business Objectives
Memberikan status komunikasi yang dapat didiagnosis tanpa menciptakan ulang efek transaksi.

## 3. Actors and User Roles
Staf operasional, administrator, customer penerima, dan channel/provider eksternal bila dipilih.

## 4. Scope
Notification events, delivery attempts/status, queue/retry, dan integrasi channel setelah ditetapkan.

## 5. Out of Scope
Marketing campaign, mass messaging, CRM automation, dan channel tertentu tanpa keputusan belum termasuk.

## 6. Functional Requirements
REQ-NOTIF-01: notifikasi dapat ditelusuri dan retry aman. REQ-NOTIF-02: channel, consent, template, opt-out, provider, delivery state, dan retention harus disetujui.

## 7. Business Rules
Retry hanya untuk operasi aman; notifikasi tidak boleh menghasilkan transaksi ganda. Consent/opt-out dan data minimum mengikuti kebijakan yang disetujui.

## 8. User Workflows
Domain event/aksi yang disetujui menghasilkan delivery request; queue menjalankan pengiriman; status/failure dapat ditelusuri; retry mengikuti policy. Event list dan user preference TBD.

## 9. UI Screens
Notification preference, delivery status, template administration, dan operational failure views adalah kandidat UX menunggu keputusan channel/role.

## 10. Data Entities
Konsep: notification intent, recipient, template/version, provider, delivery attempt, status, consent reference. Payload minimization diwajibkan.

## 11. Database Relationships
Notifikasi dapat merujuk source event/record dan recipient tanpa menyimpan data sensitif berlebih. Retention dan provider event identity TBD.

## 12. API Endpoints or Server Actions
Belum ditetapkan. Adapter/provider interface harus memisahkan business rules dari provider-specific contract.

## 13. Authorization Rules
Hanya role berwenang yang mengelola template/preferences atau mengakses delivery logs; customer hanya mengelola preference/data sendiri sesuai desain.

## 14. Validation Rules
Recipient, consent, channel, template variables, rate/size limits, dan opt-out divalidasi sebelum dispatch.

## 15. Transaction Rules
Notification intent dapat di-queue setelah business transaction commit; delivery retry idempotent dan tidak memutar ulang efek bisnis.

## 16. Notifications
Bagian ini adalah modul pengiriman notifikasi; channel/event/output yang didukung TBD. Baseline mentions email/WhatsApp sebagai kemungkinan integrasi, bukan provider terpilih.

## 17. Audit Requirements
Perubahan template/consent dan status delivery penting dicatat; payload dan credential provider tidak masuk log.

## 18. Error Handling
Provider failure, timeout, invalid recipient, throttling, and permanent failure dibedakan; retry/backoff dan dead-letter handling mengikuti deployment design.

## 19. Integration Dependencies
Laravel Notifications/Queues sebagai stack baseline, serta Booking, Billing, Payments, Clinic, Boarding, Customer Portal, Core, dan provider terpilih.

## 20. Acceptance Criteria
- Event yang disetujui menghasilkan delivery yang dapat ditelusuri.
- Retry tidak menghasilkan efek bisnis ganda.
- Consent/opt-out ditegakkan sesuai policy.
- Provider failure dapat didiagnosis tanpa credential atau data sensitif terekspos.

## 21. Test Scenarios
Successful delivery, provider timeout/failure, retry idempotency, invalid recipient, opt-out, template variable validation, queue failure, duplicate event, and sensitive log redaction.

## 22. Known Limitations
Channel/provider, event catalog, consent, opt-out, language, template approval, delivery SLA, retention, rate limits, and retry policy belum ditentukan.
