# Matriks Keterlacakan

Status `belum` berarti belum diimplementasikan. Status `berjalan` berarti pengerjaan belum memenuhi definisi selesai. Fitur hanya ditandai `selesai` setelah implementasi dan verifikasinya terbukti.

## Checklist fase

| Fase                           | Cakupan                                                                | Status   |
| ------------------------------ | ---------------------------------------------------------------------- | -------- |
| [x] 0 — Fondasi                | Stack, dokumentasi spesifikasi, aplikasi awal, lint/tes/CI, Docker     | selesai  |
| [x] 1 — Inti platform          | Autentikasi, cabang, peran/izin, audit, konfigurasi, notifikasi, setup | selesai  |
| [x] 2 — Data induk             | Pelanggan, hewan, produk, layanan                                      | selesai  |
| [ ] 3 — Stok dan pengadaan     | Ledger, batch/FEFO, transfer, pengadaan                                | berjalan |
| [ ] 4 — Kasir dan tagihan      | Shift, invoice, pembayaran, void/refund                                | belum    |
| [ ] 5 — Klinik                 | Antrian, rekam medis, resep, vaksin, rawat inap, bedah                 | belum    |
| [ ] 6 — Layanan dan jadwal     | Grooming, penitipan, booking, anti-bentrok                             | belum    |
| [ ] 7 — Keuangan dan SDM       | Jurnal, laporan keuangan, komisi, staf                                 | belum    |
| [ ] 8 — Integrasi              | Payment gateway, WhatsApp, email, webhook                              | belum    |
| [ ] 9 — Portal pelanggan       | PWA, OTP, profil, riwayat, booking, pembayaran                         | belum    |
| [ ] 10 — Dashboard dan laporan | Dashboard per peran/cabang dan ekspor                                  | belum    |
| [ ] 11 — Pengerasan dan rilis  | Keamanan, E2E, instalasi, backup/restore, rilis                        | belum    |

## Fase 0 — Fondasi

| Sumber             | Kebutuhan                                          | Modul/artefak                                           | Verifikasi                                    | Status  |
| ------------------ | -------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------- | ------- |
| AGENT.md §5        | Stack dipilih dan dikunci                          | [ADR-001](./DECISIONS.md#adr-001-stack-aplikasi-petora) | Peninjauan keputusan                          | selesai |
| AGENT.md §6 Fase 0 | Salinan spesifikasi produk tersedia                | [SPEC.md](./SPEC.md)                                    | Bandingkan dengan README produk               | selesai |
| AGENT.md §6 Fase 0 | Struktur aplikasi, lint, tes, dan verifikasi lokal | `src/`, `package.json`, `Makefile`                      | `npm run verify`                              | selesai |
| AGENT.md §6 Fase 0 | Token tema dasar tersedia                          | `src/app/globals.css`                                   | Build aplikasi                                | selesai |
| AGENT.md §6 Fase 0 | Kerangka layanan kontainer tersedia                | `Dockerfile`, `compose.yaml`                            | Compose config/build dan build image produksi | selesai |
| AGENT.md §6 Fase 0 | Catatan progres dan matriks dibuat                 | [PROGRESS.md](../PROGRESS.md), dokumen ini              | Tinjau berkas                                 | selesai |

## Fase 1 — Inti platform

| Kebutuhan                                                                                    | Modul/artefak                                                                                                              | Verifikasi                                                                                                                                                    | Status   |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Bootstrap Owner satu kali dan profil bisnis awal                                             | Setup Owner + status sistem                                                                                                | Tes status dan integrasi API                                                                                                                                  | selesai  |
| Hash kata sandi, login, sesi 12 jam, logout/revoke, pembatasan percobaan                     | Service autentikasi + sesi DB                                                                                              | Tes unit dan integrasi PostgreSQL                                                                                                                             | selesai  |
| Audit pembuatan Owner, login, dan logout                                                     | Tabel audit                                                                                                                | Tes aksi, idempotensi logout, tanpa token/kata sandi                                                                                                          | selesai  |
| Layar bootstrap/login dan dashboard terlindungi                                              | Halaman dan form staf                                                                                                      | Build dan tes API alur                                                                                                                                        | selesai  |
| Owner tidak dapat diubah, diturunkan peran, atau dinonaktifkan                              | Trigger basis data                                                                                                         | Tes integrasi PostgreSQL untuk operasi terlarang                                                                                                              | selesai  |
| Model, daftar, dan tambah cabang dengan bypass Owner                                         | Tabel cabang, API, dan dashboard                                                                                           | Tes validasi, duplikasi kode, audit, serta akses                                                                                                              | selesai  |
| Katalog izin untuk fitur aktif dan pemeriksaan backend                                       | Izin cabang, `access.manage`, `settings.manage`, `audit.read`, penanda risiko tinggi, service otorisasi                     | Tes delegasi admin, penolakan tanpa izin, bypass Owner, scope cabang dan pembatasan API                                                                       | selesai  |
| Manajemen dasar staf: buat, lihat, aktif/nonaktif, dan cabut sesi saat perubahan sensitif    | API staf berizin `access.manage`, dashboard, service, Owner bypass                                                        | Tes API, audit, Owner protection, delegasi berizin, dan pencabutan sesi                                                                                      | selesai  |
| Membuat, mengubah, dan mengklon peran kustom serta menetapkan beberapa peran/cakupan kepada staf | Tabel peran, izin, penugasan, API `access.manage`, dashboard                                                            | Tes izin terdaftar, audit perubahan, konflik nama, penolakan kewajiban 2FA untuk staf tanpa TOTP, dan lintas cabang                                           | selesai  |
| Ubah profil/password staf dari antarmuka Owner                                               | Form manajemen staf                                                                                                        | Tes alur UI, pencabutan sesi, dan API                                                                                                                         | selesai  |
| Daftar perangkat/sesi aktif, label peramban, pencabutan sesi sendiri                         | API sesi dan dashboard                                                                                                     | Tes sesi aktif, pencabutan, isolasi pengguna, tanpa token                                                                                                     | selesai  |
| TOTP terenkripsi, challenge login, kode recovery sekali pakai, dan kebijakan wajib per peran | Migrasi `0008`, service/API autentikasi, UI dashboard/login, kebijakan penugasan peran                                     | Tes RFC 6238, enkripsi, enrollment, login, replay, recovery, batas percobaan, kebijakan peran, audit, dan pencabutan sesi; `npm run verify`                   | selesai  |
| Cakupan record pada modul aktif                                                             | `branches.read` dan `customers.read/manage` menerapkan scope; pelanggan difilter berdasarkan `customers.created_by` | Tes isolasi `own`, deny per cabang, dan penolakan edit lintas owner. Modul domain baru wajib menambahkan scope saat dibangun                              | selesai  |
| Fondasi katalog izin, batas finansial, PIN supervisor, dan pengecualian individu               | Izin aktif terdaftar; pengecualian per staf berlaku pada izin terdaftar; PIN supervisor di-hash scrypt, diatur melalui API `/api/supervisor/pin`, dan dicatat di audit; `authorizeStaff` mengembalikan batas paling ketat dari grant peran/pengecualian | Tes delegasi, scope `own`, allow/deny, prioritas deny, serta siklus PIN (atur, verifikasi, reset, kegagalan) | selesai  |
| Penegakan batas finansial dan persetujuan PIN pada aksi transaksi                             | Belum ada modul kasir/refund/void/transfer yang memakai batas dari `authorizeStaff` atau meminta persetujuan supervisor | Dijadwalkan dan diuji bersama alur transaksi Fase 4; konfigurasi saja tidak dianggap penegakan | Fase 4 |
| Audit aksi sensitif pada modul aktif                                                         | Service audit, API `audit.read` berpaginasi, panel dashboard, audit PIN gagal, pelanggan, dan data contoh                 | Tes log login, staf, peran, pengecualian, pengaturan, 2FA, PIN gagal, akses/buat/ubah pelanggan, serta muat/hapus data contoh tanpa nilai kontak            | selesai  |
| Pengaturan Super Admin, penomoran, lokalisasi, fitur                                         | Pengaturan bisnis dengan izin `settings.manage`: profil, pajak, warna/tema, bahasa/zona waktu, feature flags, penomoran, logo, dan template dokumen (invoice, kuitansi, sertifikat) | Tes API, validasi, izin Owner/delegasi, sequence global/cabang, konkurensi, rollback tanpa celah, audit; logo/template sudah tersedia dan dipakai pada halaman pengaturan | selesai  |
| Mesin template, notifikasi, retry, jam tenang                                                | Template in-app yang dapat dikelola Owner, pengiriman transaksional `pg-boss`, worker aplikasi, retry/backoff, dan jam tenang berdasarkan zona waktu bisnis | Tes render placeholder, perhitungan jam tenang, pembuatan job atomik, pengiriman worker, dan uji kegagalan/retry eksplisit; adapter kanal eksternal masih terbuka      | selesai |
| Wizard setup awal (cabang, zona waktu, bahasa, pajak, readiness publik, data contoh pelanggan) | Wizard tiga langkah, bootstrap atomik, probe `PUBLIC_APP_URL` dari server dan browser, data contoh opsional yang dapat dihapus Owner | Tes bootstrap, konfigurasi/response URL, data contoh, audit muat/hapus, dan retensi data pelanggan biasa | selesai |

## Fase 2 — Data induk

Fase 2 menyediakan master pelanggan/hewan dan katalog produk/layanan. Riwayat transaksi, saldo/piutang, keanggotaan, stok, dan jadwal tetap berada pada fase yang membangun domain terkait.

| Kebutuhan | Modul/artefak | Verifikasi | Status |
| --------- | ------------- | ---------- | ------ |
| Data pelanggan | Tabel pelanggan, catatan internal, alamat, tag, consent/preferensi, nomor ternormalisasi, CRUD dan pencarian nama/telepon/email | Scope `own`/`all`; audit hanya nama field/count tanpa nilai kontak; impor CSV atomik, ekspor ter-scope, deteksi/gabung data ganda; consent dan preferensi tetap mengikuti record utama | selesai |
| Data hewan dan pemilik | Tabel hewan, pemilik jamak, pemilik utama, riwayat berat, pencarian nama/microchip | Scope pemilik, validasi semua pemilik, deteksi/gabung duplikasi beserta riwayat/pemilik, impor CSV atomik dengan validasi pemilik, ekspor ter-scope, audit | selesai |
| Katalog produk | Kategori bertingkat, satuan/konversi, SKU, barcode, varian, jenis obat/pakan/aksesori, harga beli/jual berdasarkan cabang dan tier | Validasi referensi/keunikan; scope record `own`; izin harga beli terpisah untuk baca dan ubah; audit transaksi atomik; tes integrasi privasi harga beli dan preservasi nilai tersembunyi | selesai |
| Katalog layanan | Kategori, kode, deskripsi, durasi, harga berdasarkan cabang dan tier | Scope record `own`; validasi cabang/tier aktif; pembuatan/perubahan harga dan audit dalam transaksi; tes integrasi CRUD/scope | selesai |
| API dan antarmuka data induk | Dashboard pelanggan, hewan, produk, layanan serta endpoint permissioned | `npm run verify`: lint, typecheck, 38 tes unit, migrasi tes, 34 tes integrasi PostgreSQL, dan production build | selesai |

Verifikasi koneksi langsung dari provider webhook bukan bagian wizard Fase 1: adapter, kredensial, dan uji koneksi provider berada pada Fase 8. Pemeriksaan readiness hanya membuktikan endpoint publik dari server aplikasi dan jaringan browser yang sedang digunakan.

Fase 1 menutup fondasi kebijakan, bukan aksi domain yang belum ada. Penegakan limit finansial/PIN pada diskon, refund, atau void menjadi kriteria Fase 4 dan harus dibuktikan oleh tes transaksi. Modul baru juga wajib menyertakan scope dan audit domain sebelum dinyatakan selesai.

## Fase 3 — Stok dan pengadaan

| Kebutuhan | Modul/artefak | Verifikasi | Status |
| --------- | ------------- | ---------- | ------ |
| Gudang, batch, ledger mutasi append-only, saldo stok dan kartu stok | Migrasi `0022`–`0025`, service inventori, API stok/kartu/gudang | FEFO, stok tidak cukup, dan mutasi ledger diuji dengan PostgreSQL | selesai |
| FEFO, HPP FIFO/rata-rata, penyesuaian, serta kebijakan limit/PIN | Service inventori dan pengaturan metode HPP | Aritmetika kuantitas/biaya, batch kedaluwarsa, PIN wajib, dan rollback diuji | selesai |
| Transfer dan opname | Service operasi, endpoint, dashboard | Dispatch/receive dengan selisih, approval oleh staf lain, dan koreksi stok diuji | selesai |
| Supplier, permintaan/persetujuan, pesanan, penerimaan, retur, dan hutang | Service pengadaan, API, dashboard | Permintaan ditinjau staf berbeda; penerimaan idempoten; kuantitas berlebih ditolak; retur mengurangi saldo hutang dan stok | selesai |
| Bundel dan komposisi | API bundel, editor dashboard, service komposisi | Siklus ditolak; konsumsi komponen atomik; kegagalan komponen kedua me-rollback seluruh konsumsi | selesai |
| Akses domain dan privasi biaya | Katalog izin, route branch-scoped, API biaya persediaan/hutang | Kode route menegakkan scope cabang dan izin biaya; verifikasi integrasi PostgreSQL dan production build | selesai |
| Tampilan kartu stok, laporan kedaluwarsa/lambat laku, dan label/barcode | Belum tersedia atau belum ditautkan pada dashboard | Tambahkan tes API/UI dan verifikasi saat dibangun | berjalan |
| Pengurangan otomatis dari kasir, resep, atau pemakaian layanan | Integrasi ke domain transaksi, klinik, dan layanan | Diuji bersama fase pemakai; tidak diklaim oleh service stok fase ini | Fase 4/5/6 |
| Gerbang verifikasi fase 3 | Lint, typecheck, unit, PostgreSQL, migrasi, build | `npm run verify`: 40 tes unit dan 40 tes integrasi lulus | selesai |

Fase 3 masih berstatus berjalan karena kartu stok belum menjadi tampilan riwayat pada dashboard, laporan kedaluwarsa/barang lambat dan pencetakan label/barcode belum dibangun. Konsumsi bundel sudah tersedia secara atomik di service; pengaitan ke transaksi kasir/resep/pemakaian bahan menjadi pekerjaan fase domain terkait.

## Fitur produk lainnya

Fitur pada [SPEC.md](./SPEC.md) di luar Fase 1 dan Fase 2 di atas belum diimplementasikan. Tambahkan baris modul dan tes saat tiap irisan vertikal dimulai; jangan mengklaim fitur setengah jadi sebagai selesai.
