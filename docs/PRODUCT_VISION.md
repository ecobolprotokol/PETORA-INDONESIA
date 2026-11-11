# Visi Produk PETORA INDONESIA

- Status: Draft untuk tinjauan produk
- Sumber kebutuhan: `AI_AGENT.md`
- Bahasa: Bahasa Indonesia

## Ringkasan

PETORA INDONESIA adalah sistem operasional terintegrasi untuk satu bisnis petshop dan klinik hewan yang dapat memiliki banyak cabang. Produk mencakup penjualan, billing, pembayaran, persediaan, procurement, layanan veteriner, grooming, boarding, penjadwalan, finance, pelaporan, karyawan, notifikasi, dan portal customer. Sistem dirancang sebagai modular monolith dan self-hosted.

Dokumen ini menyatakan arah produk yang telah ditetapkan. Rincian bisnis yang tidak tersedia dalam sumber ditandai sebagai keputusan terbuka dan bukan dianggap sebagai perilaku yang sudah disetujui.

## Visi

Menyediakan satu sistem yang dapat diandalkan untuk mengelola operasi petshop dan klinik hewan secara terpadu, menjaga keterlacakan transaksi dan data medis, serta memberi staf akses sesuai peran dan cabangnya.

## Pengguna Sasaran

- Pemilik petshop atau klinik hewan.
- Dokter hewan dan admin klinik.
- Kasir.
- Groomer dan pet hotel/boarding staff.
- Inventory dan procurement staff.
- Finance staff.
- Branch manager.
- System administrator.
- Customer melalui customer portal.

Daftar ini menetapkan kelompok pengguna, bukan definisi permission. Hak akses final harus ditetapkan dalam authorization matrix sebelum implementasi.

## Nilai Produk

1. Operasi lintas modul menggunakan data customer dan pet yang konsisten.
2. Penjualan produk dan layanan dapat ditautkan ke billing tanpa double billing.
3. Perubahan stok mempunyai ledger yang dapat ditelusuri.
4. Transaksi uang dan perubahan rekam medis menjaga histori serta integritas.
5. Akses operasional memperhatikan cabang.
6. Instalasi dapat dijalankan pada infrastruktur milik pengguna.
7. Sistem bertumbuh bertahap dalam modular monolith yang dapat dipelihara solo developer.

## Prinsip Produk

- Integrated by Design.
- Simple to Operate.
- Reliable Transactions.
- Medical Data Integrity.
- Branch Aware.
- Self-Hosted First.
- Maintainable.
- Secure by Default.
- Documentation Driven.
- Production Ready hanya setelah acceptance criteria dan quality gates dipenuhi.

## Cakupan Produk

Cakupan modul ditetapkan dalam [MASTER_SPECIFICATION.md](MASTER_SPECIFICATION.md) dan kebutuhan teridentifikasi pada [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md). Spesifikasi per modul berada di `docs/modules/`.

## Batas Produk yang Sudah Ditetapkan

- Baseline adalah satu instalasi untuk satu bisnis, bukan SaaS multi-tenant.
- Sistem mendukung operasi multi-cabang dengan pembatasan akses cabang di backend.
- Arsitektur aplikasi adalah modular monolith.
- Frontend baseline adalah React + TypeScript; backend Laravel; database PostgreSQL.
- Deployment ditujukan untuk server milik pengguna.
- Integrasi eksternal tidak ditentukan berdasarkan provider tertentu.

## Indikator Keberhasilan

Keberhasilan akan dinilai melalui acceptance criteria modul dan release quality gates, termasuk integritas transaksi, pencegahan akses lintas cabang tanpa izin, keterlacakan audit, workflow operasional yang dapat diuji, serta deployment dan restore yang dapat direproduksi. Nilai target kuantitatif belum ditetapkan.

## Keputusan Produk Terbuka

Keputusan berikut harus disepakati sebelum desain yang bergantung padanya dianggap final:

- Segmen bisnis awal, profil cabang, dan batas MVP.
- Alur operasional aktual per peran dan kebutuhan offline/perangkat.
- Mata uang, timezone bisnis, pajak, diskon, pembulatan, dan format dokumen transaksi.
- Aturan harga, refund, partial/split payment, dan metode pembayaran yang benar-benar akan dirilis.
- Definisi lifecycle appointment, medical record, procurement, invoice, dan boarding.
- Retensi, persetujuan, ekspor, dan penghapusan data customer serta medis.
- Provider payment, email, WhatsApp, atau integrasi lain beserta kebutuhan kontraknya.
- Bahasa tambahan, target aksesibilitas, target performa, RPO/RTO, dan target layanan.
- Peran internal yang dapat dikustomisasi dan proses provisioning administrator awal.

Keputusan berdampak pada uang, data medis, keamanan, atau data produksi tidak boleh diisi dengan asumsi tanpa persetujuan pemilik produk.

## Status Dokumen

Visi dan batas baseline bersumber dari `AI_AGENT.md`. Dokumen ini siap ditinjau sebagai arah produk; detail keputusan terbuka harus diselesaikan sebelum menjadi requirement final.