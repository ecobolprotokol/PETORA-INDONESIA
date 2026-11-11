# Matriks Authorization PETORA INDONESIA

- Status: Deny-by-default dan enforcement baseline siap; seluruh role grants menunggu persetujuan owner.
- Rujukan: `MASTER_SPECIFICATION.md`, `SECURITY.md`, dan spesifikasi modul.

## Aturan Dasar

1. Deny by default dan least privilege.
2. Authentication bukan pengganti authorization.
3. Setiap action diperiksa di backend melalui policy/gate.
4. Branch scope diterapkan pada query dan command operasional; filter frontend tidak memberi otorisasi.
5. Akses customer portal harus memverifikasi customer-to-record relationship di server.
6. Akses administratif pusat dan operasi lintas cabang eksplisit, dapat diaudit, dan tidak diasumsikan.
7. Hak approve, void, refund, adjustment, finalisasi medis, konfigurasi permission, dan ekspor laporan harus ditetapkan terpisah.

## Aktor Sasaran dan Kandidat Domain

Tabel ini memetakan area kerja yang relevan, bukan grant permission. Seluruh sel masih memerlukan review pemilik produk.

| Aktor sasaran | Kandidat domain untuk validasi | Grant permission |
|---|---|---|
| Pemilik bisnis | Business settings, branches, reports, finance | Belum disetujui |
| System administrator | User/role, configuration, audit operations | Belum disetujui; privilege boundary TBD |
| Branch manager | Branch operations, staff, reports | Belum disetujui; cross-branch scope TBD |
| Dokter hewan | Clinic, medical records, prescription, laboratory, hospitalization | Belum disetujui; clinical privileges TBD |
| Admin klinik | Customers/pets, clinic/scheduling workflows | Belum disetujui |
| Kasir | POS, billing, payment | Belum disetujui; discount/void/refund TBD |
| Groomer | Grooming, assigned schedule | Belum disetujui |
| Boarding staff | Boarding, assigned schedule | Belum disetujui |
| Inventory staff | Inventory, warehouse movements | Belum disetujui; adjustment approval TBD |
| Procurement staff | Supplier, procurement/receiving | Belum disetujui; purchase approval TBD |
| Finance staff | Finance, payment/reconciliation reports | Belum disetujui |
| Customer | Own portal profile/pets/appointments | Belum disetujui; identity/guardian relation TBD |

## Matriks Aksi Minimal untuk Diselesaikan

Untuk setiap modul, pemilik produk harus menetapkan aktor yang boleh: view, create, update, finalize/post, cancel/void, approve, refund/reverse, export, administer, serta scope cabang. Matriks rinci harus membedakan record draft/finalized dan akses data medis/keuangan.

## Keputusan Terbuka

Role model (fixed/custom), permission granularity, central admin, branch assignment, emergency/break-glass access, shared pet guardianship, refund/approval thresholds, segregation of duties, customer identity verification, audit visibility, dan akses support belum ditetapkan.

## Acceptance Criteria untuk Matriks Final

- Setiap aksi sensitif memiliki role/grant, scope, dan approval rule yang eksplisit.
- Default tanpa grant adalah ditolak.
- Test mencakup authenticated/unauthenticated, denied action, cross-branch, cross-customer, escalation, dan privilege revocation.
- Tidak ada grant yang hanya diterapkan di UI.
- Perubahan matriks permission diaudit.
