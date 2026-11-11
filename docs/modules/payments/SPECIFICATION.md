# Spesifikasi Modul Payments

- Requirement: REQ-PAY-01 sampai REQ-PAY-03
- Status: Draft baseline; metode aktif dan kebijakan settlement perlu persetujuan.

## 1. Purpose
Mencatat pembayaran, menghubungkannya ke invoice, dan mengelola refund/reversal secara dapat ditelusuri.

## 2. Business Objectives
Menjaga status invoice dan payment konsisten serta mencegah callback atau request berulang menghasilkan transaksi ganda.

## 3. Actors and User Roles
Kasir, finance staff, pemilik bisnis, customer/payer, dan payment provider bila dipilih. Approval/refund permission TBD.

## 4. Scope
Cash, bank transfer, QRIS/payment gateway bila integrasi tersedia, card bila tersedia, partial/split payment jika diizinkan, refund/reversal, serta webhook ketika provider digunakan.

## 5. Out of Scope
Provider tertentu, settlement reconciliation, chargeback, payment token vault, dan financing belum ditetapkan.

## 6. Functional Requirements
REQ-PAY-01: catat metode yang disepakati dan update invoice konsisten. REQ-PAY-02: lifecycle partial/split/refund/reversal. REQ-PAY-03: webhook verify signature/status, idempotent, aman.

## 7. Business Rules
Setiap payment dapat ditelusuri. Callback tidak dipercaya hanya dari body. Duplicate event tidak menghasilkan efek ganda. Refund/reversal memiliki histori. Metode opsional hanya tersedia bila integrasi dan approval bisnis tersedia.

## 8. User Workflows
Kasir/customer memulai tender untuk invoice; hasil diverifikasi dan dicatat; invoice status diperbarui sesuai alokasi dan policy. Jika provider digunakan, callback tervalidasi; refund/reversal dilakukan melalui izin dan proses yang disetujui.

## 9. UI Screens
Payment tender/status/history, reconciliation, refund/reversal, dan receipt perlu didefinisikan melalui UX setelah metode dan lifecycle dipilih.

## 10. Data Entities
Konsep: payment, invoice allocation, method, provider reference, webhook event, refund/reversal, reconciliation result. Payload provider disimpan minimal dan aman.

## 11. Database Relationships
Payment terkait invoice/customer/branch/source dan allocations; refund/reversal merujuk payment asal. Unique idempotency/provider event key dan lifecycle ditentukan pada DB design.

## 12. API Endpoints or Server Actions
Belum ditetapkan. Webhook contract harus mencakup signature, event ID/idempotency, status verification, replay behavior, serta error/response contract.

## 13. Authorization Rules
Penerimaan payment, manual status update, refund, reversal, dan reconciliation memerlukan permission backend; approval threshold TBD.

## 14. Validation Rules
Amount/currency/remaining balance, invoice eligibility, provider signature, event status, duplicate event, dan source consistency divalidasi.

## 15. Transaction Rules
Payment dan alokasi ke invoice dilakukan atomik; webhook diproses idempotent. Retry hanya untuk operasi aman. Refund/reversal tidak menghapus payment asal.

## 16. Notifications
Payment receipt/failure/refund notification dan channel belum ditetapkan.

## 17. Audit Requirements
Manual payment status, refund, reversal, callback handling, dan reconciliation dicatat; sensitive payload tidak ditulis ke log tanpa kontrol.

## 18. Error Handling
Provider timeout/failure, invalid signature, out-of-order callback, duplicate event, amount mismatch, dan partial failure harus aman, terlihat operasional, serta tidak mengubah status secara tidak sah.

## 19. Integration Dependencies
Billing, POS, Finance, Notifications, serta payment gateway/provider yang belum dipilih.

## 20. Acceptance Criteria
- Payment yang valid teralokasi ke invoice dan status terhitung sesuai rule yang disetujui.
- Duplicate webhook/request tidak menggandakan payment atau refund.
- Signature/status mismatch ditolak.
- Refund/reversal dapat ditelusuri ke payment awal.
- Kegagalan provider tidak menandai invoice lunas.

## 21. Test Scenarios
Cash/transfer bila dipilih, provider success/failure, invalid signature, forged status, duplicate/replayed/out-of-order webhook, amount mismatch, partial/split, refund, reversal, concurrent payment, branch authorization, dan retry.

## 22. Known Limitations
Provider, settlement timing, reconciliation, allowed methods, cash handling, partial/split policy, refund window, approval, webhook retention, currency, and chargeback belum ditentukan.
