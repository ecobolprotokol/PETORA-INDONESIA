# Catatan Keputusan Teknis

## ADR-001: Stack aplikasi PETORA

- **Status:** Diterima
- **Tanggal:** 2026-11-12

### Konteks

PETORA harus mudah dipasang di satu VPS, menjaga integritas transaksi lintas modul dan cabang, serta berbagi tipe dan validasi antara bagian aplikasi sejauh mungkin. Sistem juga membutuhkan antrean dan penjadwal yang tidak menambah layanan infrastruktur bila PostgreSQL dapat memenuhinya.

### Keputusan

- TypeScript dengan Next.js App Router untuk aplikasi web full-stack dan PWA.
- PostgreSQL sebagai basis data relasional.
- Drizzle ORM dan migrasi SQL bertipe untuk akses data.
- `pg-boss` untuk antrean dan pekerjaan terjadwal berbasis PostgreSQL.
- Docker Compose untuk pemasangan; Caddy sebagai reverse proxy HTTPS otomatis pada konfigurasi produksi.
- Biome untuk lint dan format; Vitest untuk tes unit dan integrasi.
- CSS dengan token desain terpusat; dependensi styling tambahan ditunda sampai kebutuhan nyata muncul.

### Alasan

Pilihan ini mempertahankan satu ekosistem utama, memakai basis data dengan transaksi kuat, dan menghindari Redis sebagai layanan tambahan. Docker Compose sesuai sasaran pemasangan mandiri, sementara Caddy menyediakan HTTPS tanpa layanan reverse proxy terpisah yang harus dikonfigurasi manual.

### Konsekuensi

- Worker dan scheduler memakai PostgreSQL yang sama; kapasitas antrean harus dipantau saat beban produksi bertambah.
- Fitur domain harus menggunakan service dan batas transaksi yang jelas; route handler tidak boleh menjadi tempat aturan bisnis.
- Pemasangan produksi wajib menghasilkan rahasia unik dan tidak menggunakan nilai pengembangan.
- Stack dikunci. Perubahan berikutnya memerlukan alasan teknis kuat dan ADR baru.

## ADR-002: Bootstrap Owner dan sesi staf awal

- **Status:** Diterima
- **Tanggal:** 2026-11-12

### Konteks

Instalasi baru membutuhkan jalur aman untuk membuat akun Owner pertama dan menjaga sesi staf tanpa menyimpan kredensial sesi mentah di basis data.

### Keputusan

- Email yang dinormalisasi menjadi identitas login awal.
- Kata sandi di-hash memakai scrypt dengan salt acak dan parameter yang tersimpan di format hash.
- Token sesi acak disimpan sebagai hash SHA-256, dikirim hanya dalam cookie HttpOnly, SameSite Strict, dan berlaku 12 jam.
- Pembuatan Owner, penandaan bootstrap, sesi awal, dan audit dilakukan dalam satu transaksi PostgreSQL.
- Percobaan login dibatasi lima kali per email dalam jendela 15 menit; email pada tabel pembatasan disimpan dalam bentuk hash.

### Konsekuensi

- Setup ini hanya membuat Owner dan profil bisnis awal; cabang, 2FA, konfigurasi, serta wizard penuh masih harus diselesaikan.
- 2FA dan pencabutan sesi perangkat lain tetap menjadi prasyarat sebelum autentikasi staf dinyatakan selesai.
- Masa berlaku dan ambang pembatasan adalah asumsi awal di [ASSUMPTIONS.md](./ASSUMPTIONS.md) dan perlu ditinjau sebelum rilis produksi.

## ADR-003: Autentikasi dua langkah TOTP staf

- **Status:** Diterima
- **Tanggal:** 2026-11-12

### Keputusan

- Secret TOTP disimpan terenkripsi AES-256-GCM; `TOTP_ENCRYPTION_KEY` 32-byte/64-hex hanya berasal dari environment atau secret manager.
- Challenge dan kode pemulihan berumur/sekali pakai disimpan hanya dalam bentuk hash di PostgreSQL.
- Peran dapat mewajibkan 2FA. Penugasan peran wajib mensyaratkan TOTP aktif, dan akun tidak dapat menonaktifkannya selama masih memiliki peran wajib aktif.

### Konsekuensi

- Operasi 2FA gagal tertutup jika kunci tidak tersedia atau secret tidak dapat didekripsi. Kunci harus dicadangkan dan dipertahankan stabil.
- Detail protokol dan masa berlaku ada di [ASSUMPTIONS.md](./ASSUMPTIONS.md).
