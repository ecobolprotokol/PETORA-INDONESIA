# Progres PETORA INDONESIA

## Fase saat ini

Fase 2 — Data induk (Fase 1 selesai; pekerjaan irisan pelanggan sudah dimulai).

## Selesai

- Fase 0 selesai: spesifikasi disalin, stack/ADR, fondasi aplikasi, token tema, CI, Docker, dan matriks dibuat.
- Fase 0 terverifikasi dengan `npm run verify`, build Docker Compose, image produksi, dan smoke test HTTP.
- Audit semua dependensi Fase 0: `npm audit` bersih.

## Fase 1 yang sudah selesai

- Bootstrap akun Owner satu kali dan nama bisnis; pembuatan Owner dan sesi awal atomik.
- Login email/kata sandi dengan scrypt, cookie sesi HttpOnly dan SameSite Strict, sesi DB 12 jam, logout/revoke, serta pembatasan lima percobaan per email per 15 menit.
- Audit pembuatan Owner, login, dan logout.
- Perlindungan Owner ditegakkan oleh trigger PostgreSQL: akun Owner tidak bisa diubah, diturunkan peran, atau dinonaktifkan.
- Model cabang, zona waktu, daftar cabang, dan API tambah cabang dengan izin `branches.manage` serta bypass Owner; penciptaan cabang dicatat di audit dan tersedia dari dashboard.
- Katalog izin awal `branches.read` dan `branches.manage`, service otorisasi backend, daftar cabang sesuai penugasan, dan pembuatan cabang sesuai izin.
- API dan dashboard Owner untuk membuat/melihat/menonaktifkan staf, membuat/mengubah/mengklon peran, serta menetapkan beberapa peran secara global atau pada cabang tertentu; perubahan dicatat di audit. Perubahan peran mengunci baris peran dan staf untuk menjaga kewajiban 2FA terhadap penugasan aktif.
- Katalog izin global untuk mengelola staf/peran, mengubah pengaturan, dan membaca audit; endpoint dan dashboard terkait menegakkan izin tersebut. Izin administratif ditandai berisiko tinggi dan pengelolaannya tetap Owner-only kecuali didelegasikan eksplisit.
- Setup awal tersedia sebagai wizard tiga langkah; readiness memeriksa aplikasi/basis data, probe `PUBLIC_APP_URL` dari server, dan endpoint publik dari jaringan browser dengan timeout/status yang terpisah. Hasilnya tidak mengklaim koneksi webhook pihak ketiga.
- Wizard dapat memuat dua record contoh pelanggan secara opsional; record ditandai, perubahan record contoh menjadikannya data biasa, dan Owner dapat menghapus seluruh record contoh tanpa menghapus data pelanggan biasa. Aksi muat/hapus dicatat di audit tanpa nilai kontak.
- Perubahan kata sandi atau penonaktifan staf mencabut semua sesi aktif; Owner tetap terlindungi.
- Daftar sesi/perangkat aktif menampilkan label peramban dan waktu, tidak membocorkan token, serta memungkinkan pencabutan hanya sesi milik akun sendiri.
- TOTP RFC 6238 tersedia untuk Owner dan staf: secret dienkripsi AES-256-GCM dengan kunci eksternal, enrollment memerlukan konfirmasi, login memakai challenge berumur pendek, dan replay kode ditolak.
- Sepuluh kode pemulihan dibuat saat enrollment, hanya hash tersimpan, setiap kode hanya dapat digunakan sekali; verifikasi enrollment dan challenge dibatasi percobaan.
- Peran dapat mewajibkan 2FA; penugasan peran wajib ditolak untuk staf tanpa 2FA, 2FA wajib tidak dapat dimatikan selama penugasan aktif, dan perubahan 2FA dicatat serta mencabut seluruh sesi ketika dimatikan.
- Setup awal membuat Owner, cabang pertama, profil bisnis, zona waktu, bahasa, dan pajak secara atomik.
- Pengaturan Owner dasar tersedia untuk profil bisnis, pajak, warna/tema, lokalisasi, feature flags, dan konfigurasi penomoran global/per cabang.
- Generator nomor invoice/PO/kuitansi memakai penguncian baris dalam transaksi, fallback sequence cabang ke global, dan format tetap; alokasi dapat ikut rollback bersama transaksi dokumen.
- Izin `branches.read` mendukung cakupan `own`; API daftar cabang hanya mengembalikan cabang aktif yang dibuat staf untuk scope ini.
- Pengecualian izin per staf mendukung grant/deny pada izin yang tersedia, wajib beralasan, dibatasi cabang sesuai katalog, diaudit, dan deny eksplisit mengalahkan grant peran.
- Owner atau staf yang diberi izin `audit.read` dapat meninjau log audit melalui API dan dashboard dengan pagination cursor; akses tanpa izin ditolak.
- Template notifikasi in-app untuk akun baru dan penugasan peran dapat dikelola Owner; pesan dan job `pg-boss` dibuat dalam transaksi domain, worker mengirimkannya ke inbox staf, job menggunakan retry/backoff, dan jam tenang mengikuti zona waktu bisnis. Kanal WhatsApp/email tetap berada pada fase integrasi.
- Uji eksplisit atas gagal/retry notifikasi sudah selesai: notifikasi direqueue sampai retry terakhir, status berubah ke `failed`, dan event audit `notification.delivery_failed` tercatat dengan metadata kesalahan dan jumlah percobaan.
- Readiness setup membedakan status aplikasi/basis data dari pemeriksaan alamat publik; `PUBLIC_APP_URL` HTTPS opsional diuji melalui endpoint `/.well-known/petora-health` dari server dan browser, dengan batas waktu dan status konfigurasi/kegagalan yang eksplisit.
- Cakupan `branches.read` dengan scope `own` memiliki tes integrasi isolasi berdasarkan `created_by`; penolakan per cabang juga diuji terhadap grant peran yang ada.
- Kegagalan verifikasi PIN supervisor kini membuat event audit tanpa menyimpan nilai PIN, dan memiliki tes integrasi.
- API setup/login/logout memeriksa Origin; halaman setup, login, dan dashboard terlindungi tersedia.
- Migrasi SQL berurutan berjalan otomatis saat aplikasi start; migrasi tes dibatasi pada database berakhiran `_test`.
- Logo, template dokumen (invoice, kuitansi, sertifikat), dan PIN supervisor sudah tersedia melalui pengaturan bisnis dan dashboard masing-masing; PIN supervisor di-hash scrypt, diatur dengan verifikasi kata sandi, dan dicatat di audit.
- Katalog izin, batas angka finansial, wajib PIN supervisor, dan pengecualian per staf sudah dimodelkan; `authorizeStaff` mengembalikan nilai paling ketat dari grant peran dan pengecualian. Penegakan batas/PIN pada tindakan finansial belum tersedia karena modul transaksi belum dibangun, sehingga fondasi konfigurasi tidak diklaim sebagai kontrol transaksi yang aktif.
- Verifikasi terbaru lulus: `npm run verify` (lint, cek tipe, 34 tes unit, migrasi tes, 25 tes integrasi PostgreSQL, dan production build).
- Image produksi terbaru menjalankan seluruh migrasi dan halaman login merespons HTTP 200.

## Pekerjaan lintas fase (bukan penghalang penutupan Fase 1)

- Irisan awal pelanggan menerapkan izin `customers.read` / `customers.manage`, filter `own` berdasarkan `created_by`, serta audit daftar, pembuatan, perubahan, dan pengelolaan record contoh. Isolasi data dan audit modul domain lain (hewan, transaksi, rekam medis, ekspor) masih belum ada.
- Penegakan batas finansial dan persetujuan PIN akan diterapkan bersama alur diskon/refund/void pada Fase 4; saat ini kebijakan akses sudah tersimpan, dihitung paling ketat, dan teruji, tetapi belum ada operasi transaksi untuk mengonsumsinya.
- Provider webhook belum dapat diuji langsung karena integrasi dan kredensial provider termasuk Fase 8. Pemeriksaan readiness membuktikan endpoint publik melalui server dan jaringan browser, bukan provider.
- Daftar rinci dan status tes: [TRACEABILITY.md](docs/TRACEABILITY.md).

## Berikutnya

- Lanjutkan Fase 2: lengkapi modul pelanggan dan bangun domain data master berikutnya; setiap domain wajib menambahkan scope izin dan auditnya sendiri.
- Terapkan batas finansial, persetujuan PIN, dan audit keputusan pada alur transaksi Fase 4.
- Uji konektivitas provider saat integrasi Fase 8 tersedia; pemeriksaan publik dari browser/server tidak mewakili uji provider.
- Mesin notifikasi/retry sudah terverifikasi pada jalur utama; scope cabang/pelanggan, audit PIN gagal, audit pelanggan, dan readiness alamat publik memiliki cakupan tes terarah.

## Status Fase 2

- **Siap dilanjutkan.** Seluruh kebutuhan Fase 1 yang menjadi fondasi platform dan modul aktif berstatus `selesai`, serta `npm run verify` lulus.
- Setiap modul baru tetap wajib menegakkan scope dan audit domainnya; penegakan kebijakan transaksi dan tes provider dijadwalkan pada fase yang membangun alur/integrasi terkait.

## Keputusan penting

- Stack terkunci di [ADR-001](docs/DECISIONS.md#adr-001-stack-aplikasi-petora).
- Keputusan autentikasi awal ada di [ADR-002](docs/DECISIONS.md#adr-002-bootstrap-owner-dan-sesi-staf-awal).
- Compose saat ini khusus pengembangan; kredensialnya tidak boleh digunakan di produksi.
- Fase 1 inti platform selesai; produk belum siap produksi sampai modul dan gerbang rilis pada fase berikutnya selesai.
- `TOTP_ENCRYPTION_KEY` harus berupa 32 byte/64 karakter hex dari secret eksternal, dicadangkan, dan dipertahankan stabil; detail ada di [README](README.md#kunci-autentikasi-dua-langkah) dan [ADR-003](docs/DECISIONS.md#adr-003-autentikasi-dua-langkah-totp-staf).
