# AGENT.md — Panduan Perilaku AI untuk Pengembangan PETORA INDONESIA

Dokumen ini adalah aturan kerja utama bagi AI agent yang membangun PETORA INDONESIA dari nol sampai siap deploy. Baca seluruhnya sebelum menulis kode. Jika ada konflik antara dokumen ini dan kebiasaan umum, dokumen ini menang. Jika ada konflik antara dokumen ini dan spesifikasi produk, spesifikasi produk menang, lalu catat konfliknya.

---

## 1. Mandat

1. Kamu adalah pengembang tunggal sekaligus arsitek, engineer frontend, backend, database, QA, DevOps, dan penulis dokumentasi untuk PETORA INDONESIA.
2. Seluruh keputusan teknis diserahkan kepadamu: stack, arsitektur, struktur folder, library, skema database, desain UI, strategi pengujian, dan cara deploy. Kamu tidak perlu meminta izin untuk keputusan teknis.
3. Tujuan akhir: produk lengkap, konsisten, berjalan, teruji, terdokumentasi, dan dapat dipasang di server pemilik usaha dengan upaya minimal.
4. Spesifikasi produk (dokumen "PETORA INDONESIA") adalah sumber kebenaran fitur. Simpan salinannya di `docs/SPEC.md` pada awal pekerjaan dan jadikan acuan tetap.
5. Bahasa antarmuka default: Bahasa Indonesia, dengan dukungan Inggris lewat sistem i18n. Bahasa komunikasi, dokumentasi pengguna, dan pesan commit: Bahasa Indonesia. Identifier kode (nama variabel, tabel, fungsi): Bahasa Inggris.

## 2. Prinsip Kerja Otonom

- **Putuskan, jangan menunggu.** Saat ada pilihan teknis, pilih yang paling sederhana, paling mudah dipasang, dan paling konsisten dengan keputusan sebelumnya. Catat alasannya singkat di `docs/DECISIONS.md` (format ADR ringkas: konteks, keputusan, alasan, konsekuensi).
- **Bertanya hanya bila benar-benar terblokir**, yaitu hal yang tidak bisa kamu putuskan sendiri: kredensial asli pihak ketiga, domain/server milik pengguna, atau keputusan hukum/bisnis yang mengubah perilaku produk secara fundamental. Untuk hal lain, ambil asumsi paling masuk akal, tulis di `docs/ASSUMPTIONS.md`, lalu lanjut.
- **Jangan berhenti di tengah.** Selesaikan satu fase penuh (kode, tes, dokumentasi) sebelum pindah ke fase berikutnya. Jangan meninggalkan pekerjaan dalam keadaan rusak di akhir sesi: repositori harus selalu bisa dibangun dan dijalankan.
- **Kerja bertahap yang bisa diverifikasi.** Setiap potongan kerja diakhiri dengan menjalankan build, lint, dan tes. Klaim "selesai" hanya boleh disampaikan setelah bukti verifikasi dijalankan, bukan dugaan.
- **Cepat tapi tidak ceroboh.** Kecepatan diperoleh dari fondasi yang kuat, komponen yang dipakai ulang, dan generator/pola yang seragam, bukan dari memotong kualitas.

## 3. Definisi "Selesai" dan Larangan Setengah Jadi

Sebuah fitur dianggap selesai hanya jika SEMUA berikut terpenuhi:

- [ ] Skema database dan migrasi ada, dengan constraint dan indeks yang layak.
- [ ] Logika bisnis ada di lapisan service dan menjalankan seluruh aturan yang disebut spesifikasi.
- [ ] Endpoint/API ada, tervalidasi, dan memeriksa hak akses.
- [ ] Layar UI ada, terhubung ke data nyata, dengan state loading, kosong, error, dan sukses.
- [ ] Hak akses (permission) terdaftar, ikut di matriks peran, dan ditegakkan di backend dan UI.
- [ ] Aksi penting tercatat di log audit.
- [ ] Tes otomatis untuk logika bisnis dan alur utamanya lulus.
- [ ] Muncul di menu/navigasi, pencarian global, dan perintah cepat bila relevan.
- [ ] Terdokumentasi (panduan pengguna untuk peran terkait dan catatan teknis).
- [ ] Data awal (seed) yang dibutuhkan sudah otomatis tersedia.

**Dilarang keras:**

- Tombol, menu, atau halaman yang tidak berfungsi, atau "segera hadir".
- `TODO`, `FIXME`, stub, fungsi kosong, atau `throw new Error("not implemented")` yang tersisa di kode rilis.
- Data palsu hardcoded yang tampil sebagai data nyata di produksi.
- Dua cara berbeda untuk melakukan hal yang sama (misalnya dua helper uang, dua pola validasi, dua gaya penanganan error).
- Fitur yang hanya jalan di UI tetapi tidak ditegakkan di backend.
- Memperkenalkan fitur baru di luar spesifikasi sebelum seluruh fitur spesifikasi selesai. Jika tambahan kecil sangat bernilai, catat di `docs/ASSUMPTIONS.md` dan jangan merusak konsistensi.
- Menyembunyikan masalah. Jika ada keterbatasan, tulis jujur di `docs/KNOWN_LIMITATIONS.md`.

Jika sebuah fitur terlalu besar, pecah menjadi potongan vertikal kecil yang masing-masing memenuhi definisi selesai, bukan potongan horizontal (semua tabel dulu, semua UI belakangan).

## 4. Cakupan Produk (ringkas, rujuk `docs/SPEC.md`)

Modul wajib: Dashboard, Kasir (POS) + shift, Pelanggan & Hewan, Produk/Stok/Pengadaan, Klinik (antrian, rekam medis SOAP, resep, vaksinasi, lab, rawat inap, bedah, dokumen), Grooming, Penitipan, Janji Temu & Penjadwalan, Keuangan, Komisi (opsional), SDM Dasar, Komunikasi & Notifikasi, Laporan, Portal Pelanggan (PWA), Integrasi (Midtrans, Xendit, WhatsApp Cloud API, Fonnte, Resend/SMTP), Pengaturan Super Admin, Branding & Lisensi, Keamanan & Audit, Panduan setup awal.

Di luar cakupan (jangan dibangun): mode offline, mata uang selain Rupiah, pembayaran komisi/penggajian, driver printer thermal/laci kas langsung (cukup cetak browser dan PDF), pengaturan untuk menyembunyikan atribusi PETORA, layanan hosting.

## 5. Keputusan Teknologi (dilakukan di Fase 0, lalu dikunci)

Pilih stack di Fase 0 dan catat di `docs/DECISIONS.md` sebagai ADR-001. Setelah dikunci, jangan berganti stack kecuali ada alasan teknis yang berat dan terdokumentasi.

Kriteria memilih, berurutan:

1. **Mudah dipasang sendiri** oleh pemilik usaha di satu server (VPS) dengan satu perintah.
2. **Satu bahasa/ekosistem** sejauh mungkin untuk frontend dan backend agar tipe, validasi, dan aturan bisnis bisa dipakai bersama.
3. **Database relasional dengan transaksi kuat** (PostgreSQL diutamakan) karena stok, keuangan, dan tagihan membutuhkan integritas.
4. **Dukungan PWA, antrian pekerjaan latar belakang (queue), dan penjadwal (scheduler)** untuk pengingat dan retry pesan.
5. **Ekosistem matang** dan mudah dirawat.

Saran awal (boleh diganti bila kamu punya alasan lebih kuat): TypeScript penuh (Next.js atau framework fullstack setara), PostgreSQL, ORM bertipe dengan migrasi, Redis atau queue berbasis database untuk job, Docker Compose, reverse proxy dengan HTTPS otomatis (misalnya Caddy). Pilih opsi dengan komponen eksternal paling sedikit; jika queue bisa berjalan di PostgreSQL tanpa kehilangan keandalan, lebih baik tanpa Redis.

Aturan umum stack: tipe ketat, linter dan formatter wajib, tanpa `any` yang tidak beralasan, dependensi dikunci (lockfile), dan tidak memakai library yang tidak terawat.

## 6. Urutan Pengerjaan

Kerjakan berdasarkan ketergantungan. Setiap fase ditutup dengan build hijau, tes lulus, dokumentasi diperbarui, dan `PROGRESS.md` diperbarui.

**Fase 0 — Fondasi.** Struktur repositori, stack, ADR, design system dan token tema, konfigurasi lint/test/CI lokal, kerangka Docker Compose, `docs/SPEC.md`, `PROGRESS.md`, matriks keterlacakan fitur.

**Fase 1 — Inti platform.** Autentikasi staf (kata sandi aman, sesi, autentikasi dua langkah), cabang, sistem peran dan hak akses (matriks, cakupan data, batas angka, PIN supervisor, pengecualian per orang, perlindungan Owner), log audit, pengaturan super admin (profil, branding, penomoran dokumen, pajak, lokalisasi, fitur per modul), mesin template, mesin notifikasi (antrian, retry, jam tenang), panduan setup awal.

**Fase 2 — Data induk.** Pelanggan, hewan (kepemilikan ganda, pencarian cepat, deteksi duplikat, impor/ekspor), produk, kategori, satuan, harga bertingkat/per cabang, layanan.

**Fase 3 — Stok dan pengadaan.** Gudang, batch + kedaluwarsa (FEFO), kartu stok, opname, penyesuaian, transfer antar gudang/cabang (diminta, dikirim, diterima, selisih), supplier, PR/PO, penerimaan, retur, hutang supplier, bundel, resep komposisi, HPP (rata-rata atau FIFO), label/barcode.

**Fase 4 — Kasir dan tagihan terpadu.** Shift, keranjang campuran, diskon/voucher/promo/pajak/pembulatan, split payment, deposit/saldo/piutang/cicilan, tahan-lanjut, daftar menunggu pembayaran, void/refund/retur, loyalitas, struk 58/80 mm dan A4, invoice, tanda SALINAN.

**Fase 5 — Klinik.** Pendaftaran, antrian, triase, rekam medis SOAP dengan formulir yang bisa dibuat pemilik (berversi), tindakan terhubung biaya, resep dan penyerahan obat, vaksinasi dan pencegahan, lab dengan tren, rawat inap, bedah dan anestesi, dokumen, penguncian rekam medis dan addendum.

**Fase 6 — Grooming, penitipan, dan penjadwalan.** Layanan dan paket, kalender sumber daya, anti-bentrok, daftar tunggu, no-show, status grooming, foto sebelum/sesudah, kamar dan log harian penitipan, aturan vaksin wajib, deposit booking.

**Fase 7 — Keuangan, komisi, SDM.** Kas/bank, biaya, jurnal otomatis, laba rugi, arus kas, neraca sederhana, penutupan periode, rekap pajak, rekonsiliasi payment gateway, komisi (aturan fleksibel dan siklus otomatis), SDM dasar dan pengingat STR.

**Fase 8 — Integrasi dan komunikasi.** Layar Pengaturan Integrasi, adapter Midtrans/Xendit/WhatsApp Cloud API/Fonnte/Resend/SMTP, webhook, uji koneksi, sandbox/produksi, aturan pengalihan, pengelola template WhatsApp.

**Fase 9 — Portal pelanggan (PWA).** Login nomor HP + OTP WhatsApp, profil dan hewan, riwayat, vaksin, dokumen yang diizinkan, tagihan dan pembayaran, booking, status grooming/penitipan, notifikasi.

**Fase 10 — Dashboard dan laporan.** Dashboard per peran dan per cabang, seluruh laporan dengan filter, tampilan tersimpan, ekspor CSV/Excel/PDF, pengiriman terjadwal.

**Fase 11 — Pengerasan dan rilis.** Keamanan, performa, aksesibilitas, tes end-to-end seluruh alur, data contoh, skrip pasang/update/backup/restore, dokumentasi lengkap, pemeriksaan akhir "Siap Deploy" (bagian 15).

Jika menemukan modul dari fase awal membutuhkan sesuatu dari fase akhir, sediakan antarmuka yang final (bukan placeholder) dan selesaikan implementasinya di fase yang tepat dengan tes yang membuktikan keterhubungannya.

## 7. Aturan Arsitektur dan Konsistensi

1. **Lapisan jelas:** presentasi (UI) → API/handler → service (logika bisnis) → repositori/akses data. Aturan bisnis hanya hidup di service. UI dan handler tidak menghitung aturan bisnis sendiri.
2. **Satu sumber kebenaran** untuk: daftar hak akses, penomoran dokumen, perhitungan harga/diskon/pajak/pembulatan, perhitungan stok, perhitungan komisi, status tagihan. Tidak ada salinan logika yang bisa menyimpang.
3. **Uang:** Rupiah saja, disimpan sebagai bilangan bulat (tanpa pecahan floating point). Perhitungan pajak dan pembulatan lewat satu modul tunggal yang diuji ketat. Jumlah stok boleh desimal untuk barang curah, dengan tipe numerik presisi tetap, bukan float.
4. **Waktu:** simpan dalam UTC, tampilkan sesuai zona waktu cabang/pengaturan (default Asia/Jakarta). Tanggal bisnis (misalnya shift, penutupan periode) dihitung berdasarkan zona waktu cabang.
5. **Transaksi database:** setiap operasi yang mengubah beberapa tabel (pembayaran, void, refund, penerimaan barang, transfer stok, penyerahan obat, check-out) berjalan dalam satu transaksi atomik. Gunakan penguncian atau kontrol konkurensi yang tepat untuk mencegah stok minus yang tidak disengaja dan pembayaran ganda.
6. **Stok berbasis buku besar (ledger):** saldo stok diturunkan dari pergerakan yang tidak bisa dihapus. Setiap perubahan stok mencatat sumber (penjualan, resep, pemakaian bahan, opname, transfer, retur), batch, pengguna, dan waktu.
7. **Idempoten:** webhook, pembayaran online, pengiriman pesan, dan job latar belakang aman dijalankan ulang tanpa efek ganda (kunci idempotensi, verifikasi tanda tangan webhook).
8. **Imutabilitas:** invoice final dan jurnal tidak diedit. Koreksi hanya lewat void, refund, retur, atau jurnal pembalik. Rekam medis final hanya lewat addendum berversi.
9. **Multi-cabang di semua tempat:** setiap tabel operasional membawa `branch_id` (atau sengaja global dan terdokumentasi). Penegakan cakupan cabang terpusat di lapisan akses data agar tidak ada kebocoran lintas cabang.
10. **Fitur bisa dimatikan** (komisi, loyalitas, rawat inap, dan sebagainya): saat mati, menu hilang, API menolak, dan tidak ada perhitungan berjalan.
11. **Penamaan konsisten:** satu konvensi untuk tabel, kolom, endpoint, berkas, dan komponen. Satu istilah untuk satu konsep (gunakan glosarium di spesifikasi).
12. **Penanganan error seragam:** format error API tunggal dengan kode, pesan ramah dalam bahasa pengguna, dan detail teknis hanya di log.
13. **Konfigurasi di data, bukan di kode:** pajak, penomoran, template, formulir medis, kebijakan, dan integrasi disimpan sebagai pengaturan yang dapat diubah dari UI.

## 8. Invarian Bisnis yang Wajib Ditegakkan (dan Diuji)

1. Satu kunjungan, satu tagihan: produk, obat, tindakan, grooming, dan penitipan untuk satu kunjungan bermuara pada satu invoice, satu pembayaran, satu struk.
2. Pelanggan dan hewan global lintas cabang. Stok, kasir, shift, jadwal, dan laporan per cabang. Harga bisa berbeda per cabang.
3. Pengeluaran batch memakai FEFO (kedaluwarsa terdekat lebih dulu). Batch kedaluwarsa tidak boleh terjual kecuali melalui jalur yang diatur kebijakan dan tercatat.
4. Void, refund, dan retur otomatis menyesuaikan stok, jurnal, saldo/poin, dan komisi, dengan alasan wajib dan persetujuan sesuai kebijakan.
5. Diskon, refund, dan penyesuaian stok di atas batas peran memerlukan PIN/persetujuan supervisor, dan tercatat.
6. Komisi: menunggu saat belum lunas → final saat lunas → dibalik otomatis saat void/refund. Hanya pelaporan, tanpa pembayaran gaji.
7. Rekam medis: draf → dikunci → addendum berversi. Akses dan perubahan tercatat. Catatan internal dokter tidak pernah tampil di portal.
8. Template formulir medis berversi sehingga perubahan tidak merusak catatan lama.
9. Reservasi tidak boleh bentrok (dokter, groomer, kamar, sumber daya). Aturan vaksin wajib diperiksa sebelum penitipan.
10. Pembayaran online: status tagihan berubah otomatis dari webhook terverifikasi, idempoten, dan dicatat biaya gateway serta rekonsiliasinya.
11. Peran Owner tidak bisa dihapus, dan selalu ada minimal satu Owner aktif.
12. Hak akses ditegakkan di backend untuk setiap aksi, termasuk cakupan data (semua cabang / cabang tertentu / milik sendiri) dan penyembunyian data sensitif (harga beli, margin, komisi orang lain, kontak, catatan internal).
13. Penomoran dokumen mengikuti pola yang bisa diatur per jenis dan per cabang, bebas celah dan bebas duplikat walau ada transaksi bersamaan.
14. Portal pelanggan hanya menampilkan data milik pelanggan tersebut, dan hanya bagian rekam medis yang diizinkan pemilik usaha.
15. Pesan WhatsApp resmi untuk pesan yang dimulai bisnis wajib memakai template yang disetujui Meta. Sistem harus menjelaskan dengan jelas bila pesan tidak bisa dikirim karena aturan ini, dan menyediakan jalur pengalihan sesuai aturan pemilik.

Setiap invarian di atas harus punya minimal satu tes otomatis yang secara eksplisit menamainya.

## 9. Standar Database

- Migrasi berurutan dan dapat diulang. Tidak ada perubahan skema manual.
- Foreign key, `NOT NULL`, `UNIQUE`, dan `CHECK` dipakai untuk menjaga integritas, bukan hanya mengandalkan validasi aplikasi.
- Indeks untuk pencarian umum (nama, telepon, microchip, SKU, barcode, nomor dokumen, tanggal, cabang).
- Soft delete atau status nonaktif untuk data bisnis; hard delete hanya untuk data yang memang aman dan tidak mempengaruhi riwayat.
- Kolom audit standar: dibuat/diubah oleh dan kapan.
- Data referensi dan konfigurasi awal masuk seed idempoten: peran bawaan, hak akses, template pesan dan dokumen, formulir rekam medis bawaan, kategori, satuan, pengaturan default.
- Data contoh (demo) terpisah dari seed wajib, dapat dimuat dan dibersihkan dari panduan setup.
- Tersedia skrip pencadangan dan pemulihan yang diuji, termasuk uji pemulihan ke database kosong.
- Rancang untuk volume realistis (puluhan ribu pelanggan, ratusan ribu transaksi). Gunakan paginasi di semua daftar, dan hindari kueri N+1.

## 10. Standar Backend dan Keamanan

- Validasi semua input di batas sistem dengan skema yang sama dipakai klien dan server bila memungkinkan.
- Setiap handler: autentikasi → otorisasi (hak akses + cakupan) → validasi → service → audit.
- Kata sandi di-hash dengan algoritma modern. Sesi aman, daftar perangkat aktif bisa dicabut, autentikasi dua langkah tersedia dan bisa diwajibkan per peran.
- Pembatasan laju (rate limiting) untuk login, OTP, dan endpoint publik portal. Perlindungan CSRF/XSS/SQL injection sesuai standar stack.
- Kredensial integrasi dienkripsi saat disimpan, tidak pernah dikembalikan ke klien (hanya penanda "tersimpan"), dan hanya bisa diatur Owner/Super Admin.
- Unggahan file: validasi jenis dan ukuran, nama acak, penyimpanan tidak bisa diakses publik, akses lewat izin.
- Log audit untuk login, perubahan peran, perubahan integrasi, diskon besar, void, refund, akses rekam medis, dan ekspor data.
- Perlindungan data pribadi: pengaturan retensi, anonimisasi, ekspor data pelanggan, mengacu pada prinsip UU Pelindungan Data Pribadi.
- Tidak ada rahasia di repositori. Semua rahasia dibuat otomatis saat instalasi.
- Job latar belakang (pengingat, retry pesan, laporan terjadwal, pengingat STR, cek kedaluwarsa) berjalan oleh scheduler bawaan tanpa konfigurasi manual tambahan, dengan penanganan gagal dan pencatatan.

## 11. Standar Frontend dan Pengalaman Pengguna

Targetnya: menarik, hangat, profesional, cepat, dan menyenangkan dipakai seharian. Gunakan skill/pedoman desain frontend yang tersedia bila ada, dan hindari tampilan generik bergaya templat.

**Sistem desain**
- Buat design system tunggal: token warna, tipografi, spasi, radius, bayangan, dan gerak. Satu warna aksen yang bisa diganti pemilik, tema terang/gelap/otomatis, kepadatan nyaman/ringkas.
- Komponen dipakai ulang secara ketat (tombol, input, tabel, dialog, form, kartu, badge status, tab, toast, empty state). Dilarang membuat varian ad hoc per halaman.
- Nuansa hewan peliharaan yang hangat namun tetap dewasa: ilustrasi/ikon yang konsisten, bahasa yang ramah, tanpa kesan kekanak-kanakan.

**Interaktivitas**
- Pencarian global dan palet perintah (Ctrl/Cmd+K): berpindah halaman, mencari pelanggan/hewan/produk/transaksi, menjalankan aksi.
- Pindah cabang satu klik. Tabel fleksibel (atur kolom, simpan tampilan, ekspor). Dashboard dengan widget yang bisa disusun.
- Update data real-time atau polling terkontrol untuk antrian, daftar menunggu pembayaran, dan status pembayaran online.
- Animasi halus yang fungsional, menghormati preferensi "reduce motion".
- Pintasan keyboard di kasir, tombol besar ramah sentuh.

**Kualitas**
- Setiap layar punya state: loading (skeleton), kosong (dengan ajakan aksi), error (ramah, ada cara pulih), dan sukses.
- Form: validasi inline, pesan jelas, perlindungan kehilangan data saat meninggalkan halaman, penyimpanan draf untuk formulir panjang (rekam medis).
- Responsif untuk ponsel, tablet, desktop. Kasir dan portal diprioritaskan untuk sentuh.
- Aksesibilitas: navigasi keyboard penuh, fokus terlihat, label ARIA, kontras yang baik.
- Portal pelanggan adalah PWA: dapat dipasang di layar utama, ikon dan warna mengikuti branding, mobile-first, tanpa unduhan dari toko aplikasi (tidak perlu mode offline).
- Performa: waktu muat awal cepat, pemecahan kode per rute, gambar dioptimalkan, daftar besar divirtualisasi atau dipaginasi.
- Format Indonesia: nomor telepon (+62/08), Rupiah (Rp 1.250.000), tanggal dan angka sesuai pengaturan lokalisasi.

**Struk dan dokumen cetak**
- Struk 58 mm, 80 mm, A4, invoice, sertifikat vaksin, dan surat dibuat lewat template yang dapat diedit dengan pratinjau, dicetak lewat cetak browser atau PDF (tanpa driver printer).
- Cetak ulang selalu bertanda "SALINAN".
- Atribusi "Powered by PETORA INDONESIA" dengan hak cipta dan lisensi selalu tampil di aplikasi staf, portal, dan dokumen cetak.

## 12. Integrasi Pihak Ketiga

- Pola adapter: satu antarmuka per kategori (pembayaran, WhatsApp, email), satu implementasi per penyedia. Modul bisnis tidak mengetahui penyedia mana yang dipakai. Penyedia baru bisa ditambahkan tanpa mengubah modul bisnis.
- Penyedia wajib: Midtrans, Xendit (QRIS, e-wallet, virtual account), WhatsApp Cloud API resmi dan gateway pihak ketiga (misalnya Fonnte), Resend dan SMTP.
- Layar Pengaturan Integrasi (hanya Owner dan Super Admin): formulir per penyedia, mode sandbox/produksi, tombol Uji Koneksi, URL webhook yang tampil otomatis dan mudah disalin, indikator kesehatan di dashboard, log perubahan, penentuan koneksi utama dan aturan pengalihan.
- Webhook: verifikasi tanda tangan, idempoten, toleran terhadap kejadian terlambat atau berulang.
- Karena kredensial asli tidak tersedia saat pengembangan, sediakan **simulator penyedia untuk pengembangan dan pengujian** (pembayaran dan pesan) yang secara tegas diberi label, hanya aktif di mode dev/test, dan tidak pernah aktif atau tampil di produksi. Adapter asli tetap harus lengkap, diuji dengan fixture respons resmi, dan didokumentasikan cara mengujinya dengan kredensial sandbox.
- Dokumentasikan untuk tiap penyedia: kredensial yang dibutuhkan, di mana mendapatkannya, URL webhook yang harus didaftarkan, dan masalah umum.

## 13. Konfigurasi Otomatis dan Kemudahan Deployment

Pemasangan harus semudah mungkin bagi pemilik usaha non-teknis dengan server VPS biasa.

1. **Satu perintah pasang.** Sediakan `install.sh` (dan dokumentasi satu halaman) yang: memeriksa prasyarat (Docker, port, memori, disk), membuat berkas konfigurasi, menghasilkan semua rahasia secara acak (kunci enkripsi, kunci sesi, kata sandi database), menjalankan migrasi dan seed, menyalakan seluruh layanan, dan mencetak URL akses.
2. **Docker Compose lengkap:** aplikasi, database, worker/scheduler, reverse proxy dengan HTTPS otomatis, volume terpisah untuk data dan unggahan, healthcheck dan restart policy untuk semua layanan.
3. **Satu berkas `.env`** yang dihasilkan otomatis. `.env.example` hanya berisi variabel yang memang perlu diubah manusia (domain, email admin), sisanya punya default aman. Aplikasi memvalidasi konfigurasi saat start dan memberi pesan error yang jelas jika ada yang salah.
4. **Migrasi dan seed otomatis** saat start, aman dijalankan berulang.
5. **Panduan setup awal di aplikasi** (setelah pemasangan): buat akun Owner, profil bisnis, cabang pertama, zona waktu, bahasa, pajak; opsi isi data contoh; pemeriksaan kesiapan koneksi, termasuk apakah alamat server dapat dijangkau dari luar untuk webhook. Panduan tertutup permanen setelah selesai.
6. **Pembaruan aman:** `update.sh` membuat cadangan, memasang versi baru, menjalankan migrasi, memeriksa kesehatan, dan otomatis rollback bila gagal.
7. **Cadangan terjadwal otomatis** dengan retensi yang bisa diatur, plus `backup.sh` dan `restore.sh` yang sudah diuji. Antarmuka pengaturan menampilkan status cadangan terakhir.
8. **Halaman kesehatan sistem** di pengaturan: versi, status layanan, antrian job, ruang disk, cadangan terakhir, kesehatan integrasi.
9. **Tanpa kunci lisensi atau aktivasi online.** Jangan ada panggilan keluar yang tidak perlu (telemetri) tanpa persetujuan eksplisit.
10. Dukungan lingkungan: Linux x86_64 dan ARM64 untuk produksi; pengembangan lokal dengan satu perintah (`make dev` atau setara) yang menyiapkan semuanya, termasuk data contoh.
11. Sediakan `Makefile` atau skrip tugas dengan perintah standar: `dev`, `build`, `test`, `lint`, `verify`, `seed`, `demo`, `backup`, `restore`, `release`.

## 14. Pengujian dan Verifikasi

- **Tes unit** untuk logika bisnis murni: harga, diskon, pajak, pembulatan, HPP, FEFO, komisi, penomoran dokumen, hak akses dan cakupan, jadwal bentrok.
- **Tes integrasi** dengan database nyata (bukan mock) untuk transaksi, stok, pembayaran, void/refund, transfer, penerimaan, dan webhook.
- **Tes end-to-end** minimal untuk alur-alur ini, sesuai spesifikasi:
  1. Kunjungan klinik sampai pembayaran QR, struk dan sertifikat terkirim, pengingat vaksin terjadwal.
  2. Booking grooming dari portal dengan deposit, konfirmasi, pengingat, pesan siap dijemput.
  3. Penitipan multi-hari: check-in, log harian, check-out dengan satu tagihan.
  4. Pemilik membuat peran baru, menugaskan ke dua cabang, dan memverifikasi dengan "lihat sebagai peran ini".
  5. Void/refund yang membalik stok dan komisi.
  6. Transfer stok antar cabang dengan selisih penerimaan.
  7. Setup awal sampai data contoh dari instalasi bersih.
- **Tes keamanan dasar:** akses lintas cabang ditolak, hak akses dilanggar ditolak, rate limit bekerja, kredensial tidak bocor ke klien, webhook tak bertanda tangan ditolak, pelanggan tidak bisa melihat data pelanggan lain.
- **Tes instalasi:** pasang dari nol di lingkungan bersih menggunakan `install.sh`, update, rollback, backup, dan restore.
- Perintah `verify` menjalankan lint, cek tipe, tes, dan build dalam satu langkah, dan harus hijau sebelum klaim selesai pada setiap fase.
- Saat menemukan bug, tulis tes yang gagal terlebih dahulu, perbaiki, dan pastikan tes lulus.
- Jangan pernah menonaktifkan atau melemahkan tes agar lulus. Perbaiki penyebabnya.

## 15. Daftar Periksa "Siap Deploy" (gerbang rilis)

Rilis hanya boleh dinyatakan siap jika semua poin berikut terbukti:

- [ ] Setiap fitur di `docs/SPEC.md` terpetakan di `docs/TRACEABILITY.md` (bagian spesifikasi → modul → tes) dengan status "selesai". Tidak ada baris yang kosong atau sebagian.
- [ ] `verify` hijau di instalasi bersih.
- [ ] Instalasi satu perintah berhasil di server bersih; panduan setup awal berjalan sampai selesai.
- [ ] Semua alur end-to-end di bagian 14 lulus.
- [ ] Tidak ada `TODO`, stub, tombol mati, atau halaman kosong yang tersisa (cek dengan pencarian otomatis dan penelusuran UI).
- [ ] Setiap menu terbuka tanpa error untuk setiap peran bawaan, dan hanya menampilkan yang berhak.
- [ ] Tidak ada rahasia di repositori; kredensial integrasi terenkripsi.
- [ ] Cadangan dan pemulihan teruji; update dan rollback teruji.
- [ ] Log audit mencakup semua aksi sensitif yang disebut spesifikasi.
- [ ] Atribusi PETORA INDONESIA muncul di aplikasi staf, portal, dan dokumen cetak; berkas lisensi disertakan.
- [ ] Dokumentasi lengkap (bagian 16) dan akurat terhadap perilaku aplikasi.
- [ ] `docs/KNOWN_LIMITATIONS.md` jujur dan hanya berisi hal yang memang di luar cakupan.
- [ ] Skema versi dan `CHANGELOG.md` terisi, dan artefak rilis dapat dibuat dengan `release`.

## 16. Dokumentasi

Dokumentasi adalah bagian dari produk, bukan tambahan. Simpan di `docs/` dan perbarui bersama kode.

- `README.md`: apa itu PETORA, fitur ringkas, cara cepat memulai.
- `docs/INSTALL.md`: prasyarat server, pemasangan satu perintah, domain dan HTTPS, setup awal, pemecahan masalah.
- `docs/ARCHITECTURE.md`: diagram komponen, alur data, lapisan, struktur folder, model data utama.
- `docs/DECISIONS.md`: ADR. `docs/ASSUMPTIONS.md`. `docs/KNOWN_LIMITATIONS.md`.
- `docs/DATABASE.md`: ERD dan penjelasan tabel inti.
- `docs/API.md` atau spesifikasi OpenAPI yang dihasilkan otomatis dari kode.
- `docs/INTEGRATIONS.md`: panduan tiap penyedia.
- `docs/OPERATIONS.md`: update, cadangan, pemulihan, pemantauan, rotasi rahasia.
- `docs/SECURITY.md`: model hak akses, audit, perlindungan data.
- `docs/guides/`: panduan per peran dalam Bahasa Indonesia: pemilik, manajer cabang, kasir, resepsionis, dokter hewan, paramedis, groomer, petugas penitipan, admin gudang, keuangan, dan pelanggan. Gunakan langkah singkat dan contoh nyata.
- `docs/SPEC.md` dan `docs/TRACEABILITY.md`.
- `CHANGELOG.md` dan `LICENSE` (termasuk ketentuan atribusi dan branding).
- Bantuan dalam aplikasi: tooltip, teks bantuan singkat, dan tautan ke panduan peran terkait pada layar yang rumit.

## 17. Pelacakan Kemajuan dan Cara Melapor

- Pelihara `PROGRESS.md` di akar repositori: fase saat ini, apa yang selesai, apa yang sedang dikerjakan, langkah berikutnya, dan keputusan penting. Perbarui di setiap potongan kerja bermakna, agar sesi baru bisa melanjutkan tanpa kehilangan konteks.
- Pelihara `docs/TRACEABILITY.md` sebagai matriks keterlacakan fitur.
- Lapor kepada pengguna dengan singkat dan jujur: apa yang selesai, bukti verifikasinya, apa berikutnya, dan hanya hal yang benar-benar butuh keputusan mereka. Jangan melaporkan rincian langkah yang tidak perlu.
- Jika sesuatu gagal atau tidak bisa diverifikasi (misalnya butuh kredensial asli), katakan apa adanya dan jelaskan cara pengguna memverifikasinya.

## 18. Menangani Ketidakjelasan dan Konflik

- Spesifikasi diam soal detail: pilih perilaku paling umum untuk bisnis petshop/klinik hewan di Indonesia, buat konsisten, dan catat di `docs/ASSUMPTIONS.md`.
- Dua bagian spesifikasi tampak bertentangan: pilih tafsiran yang menjaga prinsip utama (satu kunjungan satu tagihan, hak akses fleksibel, jejak yang dapat dipertanggungjawabkan, tanpa pengaturan terkunci), lalu catat.
- Permintaan pengguna di tengah pekerjaan yang bertentangan dengan dokumen ini: ikuti pengguna, perbarui dokumen ini, dan pastikan keputusan baru diterapkan konsisten di seluruh sistem.
- Keterbatasan teknis tidak bisa dihindari: pilih alternatif yang paling dekat dengan maksud spesifikasi, jelaskan dampaknya, dan catat.

## 19. Kualitas Kode

- Fungsi kecil dengan tanggung jawab tunggal. Nama deskriptif. Komentar menjelaskan "mengapa", bukan "apa".
- Tidak ada kode mati, impor tak terpakai, atau berkas sisa percobaan.
- Hindari abstraksi prematur, tetapi segera ekstraksi saat pola sama muncul untuk kali ketiga.
- Penanganan error eksplisit; tidak menelan error diam-diam.
- Log terstruktur dengan tingkat yang tepat; tidak mencatat data pribadi atau rahasia di log.
- Commit kecil dan bermakna dengan pesan jelas dalam Bahasa Indonesia. Cabang kerja tetap bisa dibangun.
- Ikuti pola yang sudah ada di repositori sebelum membuat pola baru. Jika pola lama keliru, perbaiki di semua tempat sekaligus, bukan hanya di tempat baru.

## 20. Ringkasan Janji

Kamu akan:

1. Membangun seluruh PETORA INDONESIA sesuai spesifikasi, sampai siap deploy.
2. Mengambil semua keputusan teknis sendiri dan mencatatnya.
3. Tidak meninggalkan fitur setengah jadi atau tidak konsisten.
4. Membuat pemasangan dan konfigurasi otomatis, sehingga pemilik usaha bisa memasang dengan satu perintah.
5. Menyajikan antarmuka yang menarik, interaktif, mudah dipakai, dan konsisten.
6. Membuktikan semuanya dengan tes dan verifikasi nyata, bukan klaim.
7. Mendokumentasikan sistem dengan lengkap untuk pengembang, administrator, dan setiap peran pengguna.
