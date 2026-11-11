# Dokumentasi API PETORA INDONESIA

- Status: Konvensi kontrak ditetapkan; spesifikasi endpoint dibuat saat use case disetujui. Endpoint aktual belum tersedia.
- Backend baseline: Laravel; UI baseline React + TypeScript + Inertia.js.

## Kondisi Saat Ini
Repository belum memiliki route, controller, server action, API schema, atau backend source. Karena itu tidak ada endpoint yang diklaim tersedia. Inertia page actions dan API publik/integrasi harus dibedakan saat architecture review.

## Kontrak Wajib per Operasi
Sebelum endpoint/action diimplementasikan, dokumentasikan:

- Domain owner dan tujuan operasi.
- HTTP method/path atau Inertia action, authentication, permission, dan branch scope.
- Request/response schema, validation, status transition, error codes.
- Pagination/filtering/sorting untuk collection.
- Idempotency untuk operasi yang dapat dikirim ulang.
- Transaction boundary dan consistency behavior.
- Rate limit dan data classification jika relevan.
- Audit, notification, retry, dan external dependency behavior.

## Baseline Keamanan
Semua input divalidasi di backend. Policy/Gate dan branch scope wajib ditegakkan server-side. Hindari pengembalian data sensitif. Error response tidak membocorkan stack trace/internal detail. Endpoint customer portal harus mencegah IDOR. Webhook payment wajib verifikasi signature dan status provider serta idempotent.

## Integrasi Domain Konseptual
Modul sumber charge mengirim referensi yang dapat ditelusuri ke Billing; Payments mengalokasikan payment ke invoice; Procurement receiving mengalir ke Inventory ledger; Scheduling memberi kontrak availability/booking untuk Clinic/Grooming/Boarding. Payload dan interface belum ditentukan.

## Konvensi Response dan Errors
Staff web workflow menggunakan Inertia requests, bukan endpoint REST paralel. External/public JSON APIs hanya dibuat untuk consumer dan use case yang disetujui; versi pertama menggunakan prefix `/api/v1`. Endpoint harus mempunyai HTTP status semantics yang konsisten, explicit request/response schema, stable machine-readable error code, dan pesan aman untuk user. Timestamp/currency representation serta validation error shape mengikuti contract yang disetujui pada endpoint pertama; correlation/request ID digunakan untuk diagnosis tanpa membocorkan data.

## Webhooks
Jika payment provider dipilih: verifikasi signature pada raw request sesuai spesifikasi provider, validasi status/amount/reference, deduplikasi event, tangani replay/out-of-order, simpan hanya payload yang relevan secara aman, dan observasi kegagalan. Provider tidak dipilih dan tidak ada webhook terpasang saat ini.

## Versioning dan Dokumentasi
Untuk external JSON API, gunakan path versioning `/api/v1`; dokumentasikan contract dengan OpenAPI saat endpoint external pertama disetujui. Jangan menambah versi untuk internal Inertia actions. Jangan mendokumentasikan endpoint sebagai tersedia sebelum implementasi dan test diverifikasi. Perubahan contract harus memperbarui dokumen ini dan integration guide.

## Exit Criteria
API contract siap implementasi setelah owner, authorization, schema, error behavior, idempotency, transaction boundary, dan tests per operasi disetujui.