# Progres PETORA INDONESIA

## Fase saat ini

Fase 1 — Inti platform.

## Selesai

- Fase 0 selesai: spesifikasi disalin, stack/ADR, fondasi aplikasi, token tema, CI, Docker, dan matriks dibuat.
- Fase 0 terverifikasi dengan `npm run verify`, build Docker Compose, image produksi, dan smoke test HTTP.
- Audit semua dependensi Fase 0: `npm audit` bersih.

## Fase 1 yang sudah selesai

- Bootstrap akun Owner satu kali dan nama bisnis; pembuatan Owner dan sesi awal atomik.
- Login email/kata sandi dengan scrypt, cookie sesi HttpOnly dan SameSite Strict, sesi DB 12 jam, logout/revoke, serta pembatasan lima percobaan per email per 15 menit.
- Audit pembuatan Owner, login, dan logout.
- Perlindungan Owner ditegakkan oleh trigger PostgreSQL: akun Owner tidak bisa dihapus, diturunkan peran, atau dinonaktifkan.
- Model cabang, zona waktu, daftar cabang, dan API tambah cabang dengan izin `branches.manage` serta bypass Owner; penciptaan cabang dicatat di audit dan tersedia dari dashboard.
- Katalog izin awal `branches.read` dan `branches.manage`, service otorisasi backend, daftar cabang sesuai penugasan, dan pembuatan cabang sesuai izin.
- API dan dashboard Owner untuk membuat/melihat/menonaktifkan staf, membuat/mengubah/mengklon peran, serta menetapkan beberapa peran secara global atau pada cabang tertentu; perubahan dicatat di audit. Perubahan peran mengunci baris peran dan staf untuk menjaga kewajiban 2FA terhadap penugasan aktif.
- Katalog izin global untuk mengelola staf/peran, mengubah pengaturan, dan membaca audit; endpoint serta dashboard terkait menegakkan izin tersebut. Izin administratif ditandai berisiko tinggi dan pengelolaannya tetap Owner-only kecuali didelegasikan eksplisit.
- Setup awal tersedia sebagai wizard tiga langkah dan endpoint readiness memeriksa koneksi aplikasi/basis data dari browser pengguna; hasilnya secara eksplisit tidak mengklaim koneksi webhook pihak ketiga.
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
- API setup/login/logout memeriksa Origin; halaman setup, login, dan dashboard terlindungi tersedia.
- Migrasi SQL berurutan berjalan otomatis saat aplikasi start; migrasi tes dibatasi pada database berakhiran `_test`.
- Verifikasi terbaru lulus: lint, cek tipe, 26 tes unit, migrasi tes, 9 tes integrasi PostgreSQL termasuk worker notifikasi, dan production build.
- Image produksi terbaru menjalankan seluruh migrasi dan halaman login merespons HTTP 200.

## Fase 1 yang belum selesai

- Cakupan record "milik sendiri" untuk modul selain cabang, katalog izin domain, batas angka dan PIN supervisor yang diterapkan pada transaksi bisnis, serta audit aksi sensitif domain.
- Pengaturan Super Admin lanjutan (logo dan template dokumen yang dipakai generator), pengujian eksplisit atas kegagalan/retry notifikasi, dan wizard setup lengkap termasuk pemeriksaan keterjangkauan server dari luar.
- Daftar rinci dan status tes: [TRACEABILITY.md](docs/TRACEABILITY.md).

## Berikutnya

- Lanjutkan Fase 1 dengan cakupan akses operasional, katalog izin/batas/PIN supervisor, audit lengkap, pengaturan Super Admin, verifikasi kebijakan retry notifikasi, serta wizard setup.
- Fase 1 tetap berjalan; autentikasi dua langkah dan kebijakan wajib per peran sudah tersedia, tetapi belum seluruh persyaratan inti platform terpenuhi.

## Gerbang Fase 2

- **Belum siap dimulai.** Matriks Fase 1 masih memiliki kebutuhan berstatus `berjalan` atau `belum`.
- Penghalang utama: cakupan izin untuk data operasional, batas angka dan PIN supervisor pada operasi transaksi, audit menyeluruh, mesin notifikasi/queue, penyelesaian pengaturan Super Admin, serta wizard dengan pemeriksaan keterjangkauan eksternal.
- Fase 2 baru boleh dimulai setelah semua baris Fase 1 di [TRACEABILITY.md](docs/TRACEABILITY.md) berstatus `selesai` dan `npm run verify` lulus.

## Keputusan penting

- Stack terkunci di [ADR-001](docs/DECISIONS.md#adr-001-stack-aplikasi-petora).
- Keputusan autentikasi awal ada di [ADR-002](docs/DECISIONS.md#adr-002-bootstrap-owner-dan-sesi-staf-awal).
- Compose saat ini khusus pengembangan; kredensialnya tidak boleh digunakan di produksi.
- Irisan autentikasi awal selesai; Fase 1 masih berjalan dan belum siap produksi.
- `TOTP_ENCRYPTION_KEY` harus berupa 32 byte/64 karakter hex dari secret eksternal, dicadangkan, dan dipertahankan stabil; detail ada di [README](README.md#kunci-autentikasi-dua-langkah) dan [ADR-003](docs/DECISIONS.md#adr-003-autentikasi-dua-langkah-totp-staf).
