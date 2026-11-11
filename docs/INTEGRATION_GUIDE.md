# Panduan Integrasi PETORA INDONESIA

- Status: Internal contract principles ditetapkan; provider-specific contract dan integrasi belum dipilih/diimplementasikan.
- Rujukan: `ARCHITECTURE.md`, `API_DOCUMENTATION.md`, dan spesifikasi modul.

## Prinsip

- Tetap modular monolith; integrasi internal tidak otomatis memerlukan network service/event bus.
- Gunakan service/action atau shared interface dengan owner dan contract jelas.
- Gunakan domain event/queue hanya jika kebutuhan async atau decoupling nyata.
- Adapter memisahkan domain rules dari provider eksternal.
- Tentukan idempotency, transaction boundary, error/retry, authorization, audit, dan data classification untuk setiap contract.

## Kontrak Domain Konseptual

| Producer | Consumer | Data/hasil yang perlu ditelusuri | Gate |
|---|---|---|---|
| POS | Billing, Inventory | Sale source, invoice item, stock movement | Pricing, checkout, stock policy |
| Clinic/Medication | Billing, Inventory | Service/medication charge, consumption | Clinical workflow dan stock rules |
| Laboratory | Clinic, Billing | Order/result reference, charge source | Lab lifecycle, result sign-off |
| Hospitalization/Surgery | Clinic, Inventory, Billing | Episode/procedure, consumption, charge | Clinical validation, capacity/consent |
| Grooming/Boarding | Scheduling, Billing | Booking/service source, charge | Service, capacity, cancellation policies |
| Procurement | Inventory | Receiving source dan stock movement | Approval, partial receipt, costing |
| Payments | Billing, Finance | Payment allocation, provider status, reversal | Provider, lifecycle, reconciliation |
| Scheduling | Clinic/Grooming/Boarding | Availability, staff/resource/branch reservation | Capacity, timezone, conflict policy |
| Notifications | Domain modules/Customer Portal | Notification intent dan delivery status | Event catalog, consent, channel/provider |
| Reports | Domain/Finance modules | Metrics dan source references | Definisi KPI, time boundaries, access scope |

Tabel ini menyatakan kebutuhan hubungan, bukan payload/API final.

## External Providers
Payment gateway, email, WhatsApp, external lab, object storage, dan provider lain belum dipilih. Sebelum integrasi: bandingkan kebutuhan, availability, security/privacy, cost/operational burden, credentials/webhook, idempotency, rate limits, retries, sandbox, data residency, dan exit strategy. Jangan menyimpan secret di source control.

## Failure and Retry
Retry hanya untuk operasi aman/idempotent. Hindari duplicate billing/payment/stock effect. Simpan status kegagalan dan correlation reference; jangan menyebarkan stack trace ke user. Tentukan timeout/backoff/dead-letter/manual recovery ketika provider dipilih.

## Contract Review Checklist
Owner; consumer; request/response; auth; branch scope; validation; transaction boundary; idempotency; event ordering; retry/reconciliation; audit; privacy; rate limit; test doubles vs real sandbox; monitoring; versioning/deprecation.

## Status dan Exit Criteria
Integrasi baru dinyatakan tersedia setelah contract disetujui, implementation dan automated tests ada, failure/retry diuji, dokumentasi diperbarui, serta provider nyata diverifikasi di sandbox/production sesuai izin.