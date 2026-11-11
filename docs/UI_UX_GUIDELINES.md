# Pedoman UI/UX PETORA INDONESIA

- Status: Prinsip operasional dan accessibility menjadi baseline; workflow per layar perlu review pengguna sebelum UI feature implementation.
- Baseline frontend: React + TypeScript, Inertia.js, Vite, Tailwind CSS, shadcn/ui menurut `AI_AGENT.md`.

## Tujuan UX
Mendukung pekerjaan operasional berulang secara cepat, jelas, konsisten, dan aman. Kecepatan input dan integritas transaksi lebih penting daripada dekorasi.

## Pengguna dan Konteks
Target pengguna meliputi pemilik, admin klinik, dokter hewan, kasir, groomer, boarding staff, inventory/procurement/finance staff, branch manager, administrator, dan customer portal. Kebutuhan perangkat, jam operasi, volume, keterampilan digital, dan aksesibilitas harus divalidasi dengan pengguna.

## Navigasi dan Struktur
Navigasi mengikuti modul dan permission yang sudah disetujui; menyembunyikan menu bukan authorization. Tampilkan konteks cabang yang aktif bila relevan, dan pastikan scope tetap ditegakkan backend. Page inventory dan information architecture belum disetujui.

## Workflow Operasional
- Kurangi langkah dan input ulang pada alur POS, appointment, receiving, dan pelayanan.
- Gunakan pencarian dan pemilihan shared customer/pet; jangan mendorong pembuatan duplikat.
- Tampilkan ringkasan sebelum transaksi financial/stock diposting.
- Cegah double submission dan beri feedback atas status proses.
- Minta konfirmasi untuk aksi berisiko; jelaskan dampak tanpa menyembunyikan opsi koreksi yang sah.
- Clinical workflows harus direview praktisi sebelum desain final.

## Keadaan Halaman
Setiap halaman operasional menyiapkan loading, empty, error, success, unauthorized, dan partial/unavailable states yang relevan. Pesan harus actionable, tidak membocorkan detail internal, dan mempertahankan input aman bila terjadi kegagalan.

## Form dan Data Table
Label dan validasi harus jelas; error dekat dengan field; server tetap memvalidasi. Daftar besar mendukung pagination/filter yang sesuai kebutuhan nyata. Sorting, bulk action, inline edit, density, dan export belum diputuskan.

## Responsive dan Accessibility
Pastikan nyaman pada desktop dan tablet; customer-facing views memerlukan keputusan mobile/PWA. Sediakan keyboard usability, focus visibility, semantic controls, label, contrast, dan status yang tidak hanya dibedakan oleh warna. Target WCAG dan browser support harus disepakati.

## Keamanan Interaksi
Role/permission menentukan interaksi yang tersedia, namun akses selalu diproteksi backend. Sensitif medical/financial data hanya ditampilkan sesuai hak. Confirmation tidak menggantikan authorization atau audit.

## Validasi Sebelum Implementasi UI
Lakukan review workflow dengan peran operasional, petakan task penting, error/exception paths, branch context, data yang diperlukan, keyboard/device needs, serta acceptance test. Belum ada hasil user research yang dapat diklaim.