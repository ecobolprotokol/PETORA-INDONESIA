# PETORA INDONESIA

**Sistem operasional terpadu untuk petshop dan klinik hewan.**

PETORA INDONESIA adalah aplikasi web yang menjalankan seluruh operasional bisnis petshop dan klinik hewan dalam satu sistem: kasir, stok, pelanggan dan hewan, pemeriksaan medis, grooming, penitipan, jadwal, keuangan, komisi, sampai aplikasi untuk pelanggan.

Dokumen ini menjelaskan **apa** yang dibangun, **untuk siapa**, dan **bagaimana seharusnya produk berperilaku**. Dokumen ini sengaja tidak menyebut teknologi. Pilihan teknis sepenuhnya menjadi keputusan pengembang (agent), sesuai aturan di `agent.md`.

---

## Daftar Isi

1. [Gambaran Produk](#1-gambaran-produk)
2. [Masalah yang Diselesaikan](#2-masalah-yang-diselesaikan)
3. [Pengguna](#3-pengguna)
4. [Prinsip Utama](#4-prinsip-utama)
5. [Struktur Bisnis: Pemilik dan Cabang](#5-struktur-bisnis-pemilik-dan-cabang)
6. [Peran dan Hak Akses](#6-peran-dan-hak-akses)
7. [Modul dan Fitur](#7-modul-dan-fitur)
8. [Aplikasi untuk Pelanggan](#8-aplikasi-untuk-pelanggan)
9. [Integrasi Pihak Ketiga](#9-integrasi-pihak-ketiga)
10. [Pengaturan Super Admin](#10-pengaturan-super-admin)
11. [Branding dan Lisensi](#11-branding-dan-lisensi)
12. [Keamanan dan Privasi](#12-keamanan-dan-privasi)
13. [Pengalaman Pengguna](#13-pengalaman-pengguna)
14. [Pemasangan dan Pemeliharaan](#14-pemasangan-dan-pemeliharaan)
15. [Aturan Bisnis Kunci](#15-aturan-bisnis-kunci)
16. [Contoh Alur Sehari-hari](#16-contoh-alur-sehari-hari)
17. [Di Luar Cakupan](#17-di-luar-cakupan)
18. [Kriteria Keberhasilan](#18-kriteria-keberhasilan)
19. [Glosarium](#19-glosarium)
20. [Cara Memakai Dokumen Ini Bersama agent.md](#20-cara-memakai-dokumen-ini-bersama-agentmd)

---

## 1. Gambaran Produk

PETORA dibuat untuk bisnis yang memiliki **satu pemilik dengan banyak cabang**, di mana setiap cabang menjual produk sekaligus melayani pasien hewan. Karena itu seluruh layanan dan penjualan digabung dalam **satu tagihan**.

Contoh: seorang pelanggan membawa kucingnya untuk vaksin, membeli makanan, lalu menitipkannya untuk grooming. Ia cukup membayar satu kali dan menerima satu struk.

Karakteristik utama:

- **Self-hosted.** Dipasang di server milik bisnis sendiri. Data sepenuhnya milik pemilik usaha.
- **Multi-cabang.** Pelanggan dan hewan dikenali di semua cabang. Stok, kasir, jadwal, dan laporan per cabang.
- **Dapat diatur tanpa pengembang.** Peran, pajak, penomoran dokumen, template pesan, formulir rekam medis, dan integrasi diatur dari layar pengaturan.
- **Berorientasi pelanggan.** Pelanggan punya aplikasi sendiri dan menerima pesan otomatis lewat WhatsApp.
- **Branding sendiri.** Nama, logo, dan warna aplikasi dapat diganti. Atribusi PETORA INDONESIA tetap tampil.
- **Kode sumber diserahkan** kepada pelanggan.

## 2. Masalah yang Diselesaikan

Banyak petshop dan klinik hewan menjalankan operasional dengan alat yang terpisah: buku untuk rekam medis, aplikasi kasir umum, spreadsheet untuk stok, dan chat pribadi untuk pengingat vaksin. Akibatnya:

- Data pelanggan dan hewan tercecer, riwayat medis sulit dilacak.
- Stok tidak akurat, obat kedaluwarsa baru ketahuan setelah terlambat.
- Tagihan klinik dan kasir petshop dipisah, sehingga pelanggan bayar dua kali.
- Pemilik sulit memantau banyak cabang secara bersamaan.
- Pengingat vaksin dan jadwal kontrol dikirim manual dan sering terlewat.
- Pelanggan harus datang atau menelepon hanya untuk menanyakan jadwal, tagihan, atau riwayat hewannya.
- Hak akses staf kaku: kasir terlalu bebas atau terlalu terbatas.

PETORA menyatukan semuanya dengan alur kerja yang disesuaikan untuk bisnis hewan di Indonesia.

## 3. Pengguna

| Pengguna | Yang didapat |
|---|---|
| Pemilik usaha | Kendali penuh, laporan semua cabang, pengaturan terpusat, rasa aman atas data |
| Manajer cabang | Pantauan operasional harian, persetujuan, laporan cabang |
| Kasir | Transaksi cepat, shift, berbagai metode bayar |
| Resepsionis | Pendaftaran pasien, antrian, jadwal, komunikasi dengan pelanggan |
| Dokter hewan | Rekam medis lengkap, resep, vaksin, tindakan, rawat inap, bedah |
| Paramedis/perawat | Observasi, pemberian obat, perawatan pasien |
| Groomer | Jadwal, status pekerjaan, foto sebelum dan sesudah |
| Petugas penitipan | Log harian hewan titipan, update ke pemilik |
| Admin gudang | Penerimaan barang, stok, opname, transfer |
| Keuangan | Kas, biaya, hutang-piutang, laporan keuangan |
| Pelanggan (pemilik hewan) | Aplikasi sendiri untuk riwayat hewan, booking, tagihan, dan pembayaran |

## 4. Prinsip Utama

1. **Satu kunjungan, satu tagihan.** Produk, obat, tindakan klinik, grooming, dan penitipan masuk ke tagihan yang sama.
2. **Satu pemilik, banyak cabang.** Setiap cabang punya stok, kasir, jadwal, dan laporan sendiri, tetapi pelanggan dan hewan dikenali di semua cabang.
3. **Hak akses yang tidak kaku.** Pemilik membuat peran sendiri dan menentukan secara rinci apa yang boleh dilakukan setiap peran.
4. **Tidak ada pengaturan yang dikunci mati.** Integrasi, pajak, penomoran, template pesan, dan formulir rekam medis bisa diatur dari layar pengaturan.
5. **Pelanggan dilayani, bukan hanya dicatat.** Pelanggan punya aplikasi sendiri dan menerima pesan otomatis lewat WhatsApp.
6. **Jejak yang bisa dipertanggungjawabkan.** Transaksi final tidak bisa diubah diam-diam, rekam medis terkunci, aksi penting tercatat.
7. **Tampilan yang menyenangkan dipakai.** Modern, cepat, hangat, nyaman dipakai seharian.

## 5. Struktur Bisnis: Pemilik dan Cabang

Satu instalasi PETORA melayani **satu pemilik usaha** dengan **sebanyak apa pun cabang**.

**Milik setiap cabang:**
- Identitas (nama, kode, alamat, kontak, jam buka)
- Gudang dan stok sendiri
- Kasir dan shift sendiri
- Dokter, groomer, dan staf yang ditugaskan
- Ruang rawat inap, kandang, dan kamar penitipan
- Header dan footer struk sendiri

**Dipakai bersama di semua cabang:**
- Pelanggan dan data hewan
- Daftar produk dan layanan (harga boleh berbeda per cabang)
- Template pesan
- Peran dan hak akses
- Integrasi

Pelanggan yang pindah cabang tidak perlu didaftarkan ulang dan riwayat hewannya ikut. Pemilik dapat mengatur apakah rekam medis boleh dilihat lintas cabang.

**Transfer stok antar cabang** mengikuti alur: diminta, dikirim, diterima. Selisih penerimaan tercatat.

## 6. Peran dan Hak Akses

Sistem peran yang fleksibel adalah pembeda utama PETORA.

- **Peran buatan sendiri.** Pemilik membuat peran baru (misalnya "Kasir Senior", "Dokter Tamu", "Supervisor Gudang") dan menentukan hak aksesnya satu per satu.
- **Klon dan sesuaikan.** Peran yang ada dapat digandakan lalu diubah sedikit.
- **Satu orang, banyak peran.** Staf bisa menjadi kasir di cabang A dan manajer di cabang B.
- **Cakupan data.** Semua cabang, cabang tertentu, atau hanya data milik sendiri.
- **Batasan angka.** Misalnya diskon kasir maksimal 10% atau refund sampai nominal tertentu.
- **Persetujuan atasan.** Void, refund, diskon besar, atau penyesuaian stok besar dapat mewajibkan PIN atau persetujuan supervisor.
- **Penyembunyian data sensitif.** Harga beli dan margin, komisi orang lain, catatan internal dokter, dan kontak pelanggan bisa disembunyikan dari peran tertentu.
- **Pengecualian per orang.** Pemilik dapat memberi atau mencabut satu hak khusus untuk seseorang dengan alasan tercatat.
- **Matriks yang mudah dibaca.** Hak akses ditampilkan sebagai tabel modul dan aksi, dengan pencarian, peringatan hak berisiko tinggi, dan fitur "lihat sebagai peran ini".
- **Perlindungan.** Peran Owner tidak bisa dihapus dan selalu ada minimal satu Owner aktif.

**Peran bawaan:** Owner, Super Admin, Manajer Cabang, Kasir, Resepsionis, Dokter Hewan, Paramedis, Groomer, Petugas Penitipan, Admin Gudang, Keuangan.

## 7. Modul dan Fitur

### 7.1 Dashboard
Gambaran hari ini dalam sekali lihat: penjualan, jumlah kunjungan, antrian pasien, janji temu, stok menipis, obat mendekati kedaluwarsa, tagihan jatuh tempo, dan pembayaran online yang menunggu. Dapat dilihat per cabang atau gabungan, widget bisa disusun tiap pengguna, dan isinya menyesuaikan hak akses.

### 7.2 Kasir (POS)
Kasir lengkap dan cepat, nyaman di tablet maupun komputer.

- **Shift:** buka/tutup dengan kas awal, kas masuk/keluar, rekap per metode bayar, hitung selisih, laporan shift.
- **Penjualan:** cari lewat nama/kode/scan barcode; varian, satuan ganda, jumlah desimal untuk barang curah; catatan per item; campuran produk, obat, layanan klinik, grooming, penitipan, dan paket dalam satu keranjang; pilih pelanggan dan hewan lalu kaitkan item dengan hewan tertentu; harga bertingkat, per cabang, member, dan promo berjadwal.
- **Diskon dan pajak:** diskon per item/transaksi, voucher, promo otomatis, diskon member, dibatasi batas peran dengan persetujuan atasan untuk yang melebihi; pajak sesuai pengaturan (sudah termasuk atau belum), biaya layanan opsional, pembulatan yang bisa diatur.
- **Pembayaran:** tunai (dengan kembalian), transfer manual, kartu/EDC, QRIS, e-wallet, virtual account; split payment; uang muka/deposit, saldo pelanggan, piutang, cicilan berjatuh tempo; pembayaran online lewat QR di layar atau link bayar ke WhatsApp pelanggan dengan status berubah otomatis begitu dibayar.
- **Alur tambahan:** tahan dan lanjutkan transaksi; daftar "menunggu pembayaran" dari klinik, grooming, dan penitipan; void, refund, dan retur (sebagian/penuh) dengan alasan wajib, persetujuan sesuai kebijakan, dan penyesuaian otomatis pada stok dan komisi; poin loyalitas dan voucher/kartu hadiah (dapat diaktifkan owner); pintasan keyboard lengkap.
- **Struk dan dokumen:** struk 58 mm, 80 mm, A4 lewat cetak browser atau PDF; invoice dan tanda terima; cetak ulang bertanda "SALINAN"; pengiriman struk dan tagihan otomatis ke WhatsApp (email sebagai tambahan).

### 7.3 Pelanggan dan Hewan
- **Pelanggan:** kontak dengan format nomor Indonesia, alamat, tag, catatan, preferensi notifikasi, persetujuan, riwayat transaksi, saldo atau piutang, status member.
- **Hewan:** jenis, ras, nama, jenis kelamin, tanggal lahir atau perkiraan umur, warna, nomor microchip, foto, status sterilisasi, alergi, riwayat berat badan, catatan perilaku, status (aktif, meninggal, dipindahkan). Satu hewan bisa dimiliki lebih dari satu orang.
- **Pendukung:** pencarian cepat (nama, telepon, microchip), deteksi dan penggabungan data ganda, impor dan ekspor.

### 7.4 Produk, Stok, dan Pengadaan
- **Produk:** SKU, banyak barcode, kategori bertingkat, merek, foto, varian, satuan beserta konversinya, jenis barang (umum, obat, pakan, aksesoris, jasa). Obat dapat ditandai golongan dan aturan resepnya.
- **Harga:** beli, jual, bertingkat, per cabang. HPP bisa dipilih rata-rata atau FIFO.
- **Stok:** banyak gudang per cabang; pencatatan per batch dengan tanggal kedaluwarsa (yang lebih dulu kedaluwarsa dikeluarkan lebih dulu); kartu stok; stok opname dengan sesi hitung, selisih, dan persetujuan; penyesuaian dengan alasan; peringatan stok minimum dan saran pemesanan ulang; laporan kedaluwarsa dan barang lambat laku; nilai persediaan.
- **Pengadaan:** supplier, permintaan pembelian, purchase order, penerimaan barang dengan pengecekan batch dan kedaluwarsa, retur ke supplier, hutang supplier.
- **Lainnya:** transfer antar gudang dan cabang; bundel produk; resep komposisi (obat racikan yang otomatis memakai bahan penyusunnya); cetak label dan barcode.
- Stok berkurang otomatis dari penjualan kasir, resep dokter, dan pemakaian bahan pada layanan seperti tindakan atau grooming.

### 7.5 Klinik Hewan
- **Pendaftaran dan antrian:** pendaftaran kunjungan, nomor antrian, prioritas/triase, status antrian terlihat langsung oleh staf, penugasan dokter dan paramedis.
- **Pemeriksaan (rekam medis):** tanda vital, berat badan, skor kondisi tubuh, suhu; keluhan dan anamnesis; catatan SOAP; diagnosa, diagnosa banding, prognosis; tindakan yang langsung terhubung ke biaya; pemakaian bahan; lampiran foto, dokumen, hasil penunjang; rencana tindak lanjut dan rujukan.
- **Resep dan penyerahan obat:** dosis dan aturan pakai, stok berkurang otomatis, cetak label obat.
- **Formulir yang diatur pemilik:** tanpa pengembang, pemilik membuat bentuk rekam medis sendiri. Bisa menambah bagian dan isian (teks, angka, pilihan, centang, tanggal, tabel, unggah file, tanda tangan), menentukan isian wajib atau bersyarat, dan membuat template berbeda per jenis layanan (pemeriksaan umum, vaksinasi, bedah, dental). Template berversi sehingga perubahan tidak merusak catatan lama. Pemilik juga menentukan isian mana yang terlihat oleh pelanggan.
- **Vaksinasi dan pencegahan:** protokol vaksin, obat cacing, anti kutu sesuai jenis dan umur hewan; nomor batch vaksin; sertifikat vaksin yang bisa dicetak; pengingat jadwal berikutnya otomatis.
- **Laboratorium dan penunjang:** permintaan pemeriksaan, input hasil dengan satuan, rentang normal, dan penanda abnormal; unggah file hasil; grafik tren.
- **Rawat inap:** pengelolaan kandang dan ruang, pendaftaran masuk dan pemulangan, observasi berkala, jadwal obat dan infus dengan daftar centang, pemberian pakan, biaya harian otomatis masuk tagihan.
- **Bedah dan anestesi:** persetujuan tindakan dengan tanda tangan digital, catatan pra-bedah, anestesi, laporan operasi, pemantauan pasca-bedah.
- **Dokumen:** surat sehat, surat keterangan, surat rujukan, ringkasan medis, formulir persetujuan, semuanya dari template yang bisa diedit.
- **Keamanan rekam medis:** berstatus draf sampai dikunci. Setelah final, koreksi hanya lewat addendum berversi. Setiap akses dan perubahan tercatat.

### 7.6 Grooming
Daftar layanan dan paket berdasarkan ukuran, ras, atau berat (lengkap dengan durasi dan bahan yang dipakai); jadwal groomer; status terjadwal → check-in → diproses → selesai → dijemput; foto sebelum dan sesudah; catatan perilaku dan kondisi kulit; layanan tambahan (add-on); pesan WhatsApp otomatis saat hewan siap dijemput.

### 7.7 Penitipan Hewan
Daftar kamar/kandang dengan tipe, kapasitas, dan tarif per hari atau per jam; kalender ketersediaan dan reservasi; check-in dan check-out dengan catatan kondisi hewan; log harian (makan, minum, buang air, aktivitas, obat); kiriman foto dan kabar untuk pemilik; deposit; biaya per malam dan layanan tambahan masuk otomatis ke tagihan; aturan vaksin wajib sebelum menitipkan.

### 7.8 Janji Temu dan Penjadwalan
Kalender per dokter, groomer, kamar, dan sumber daya lain; jam kerja, hari libur, cuti; slot dengan durasi dan jeda antar layanan; booking oleh staf maupun pelanggan lewat aplikasinya; konfirmasi otomatis atau manual (diatur per layanan); deposit booking opsional lewat pembayaran online; aturan jadwal ulang dan pembatalan; pencatatan no-show; daftar tunggu; pengingat otomatis; sistem mencegah jadwal bentrok.

### 7.9 Keuangan
Kas dan rekening bank serta akun penerimaan per metode bayar; biaya operasional dengan kategori dan lampiran bukti; pembelian, hutang supplier, piutang pelanggan, dan pelunasannya; jurnal otomatis dari penjualan, pembelian, biaya, dan refund; laporan laba rugi, arus kas, dan neraca sederhana; penutupan periode; rekap pajak; pencatatan biaya payment gateway dan pencocokan pembayaran online dengan tagihan.

### 7.10 Komisi (opsional)
Bisa dinyalakan atau dimatikan pemilik. Saat mati, tidak ada yang dihitung dan menunya tidak muncul.

- **Aturan fleksibel:** per staf, peran, kategori produk/layanan, atau item; persen atau nominal; berbasis omzet atau laba; target bertingkat; pembagian antar beberapa staf untuk satu item; batas minimum dan maksimum; periode berlaku.
- **Siklus otomatis:** menunggu saat belum lunas → final saat lunas → dibalik otomatis saat void atau refund.
- **Hanya laporan:** dicatat dan dilaporkan per staf, periode, cabang, kategori, lengkap dengan rincian transaksi dan ekspor. PETORA tidak memproses pembayaran komisi atau gaji.
- Staf hanya melihat komisinya sendiri, kecuali diberi hak lebih.

### 7.11 SDM Dasar
Profil staf, penugasan cabang, jadwal shift, absensi sederhana, cuti dasar, pengingat masa berlaku izin praktik dokter (STR) dan sertifikasi.

### 7.12 Komunikasi dan Notifikasi
Pemilik mengatur kapan pesan dikirim, lewat kanal apa, dan dengan isi apa.

**Pesan otomatis:** struk dan tagihan terbit; pembayaran berhasil atau kedaluwarsa; booking dibuat, dikonfirmasi, diingatkan, atau dibatalkan; jadwal vaksin mendekati; hewan siap dijemput; hasil lab tersedia; ulang tahun hewan; tindak lanjut setelah kunjungan; stok menipis (internal); kode OTP untuk login pelanggan.

**Pengaturan:** kanal (WhatsApp, email, notifikasi dalam aplikasi); template dengan variabel seperti nama dan total; pratinjau; jam tenang; penanganan pelanggan yang berhenti berlangganan; log lengkap dengan status terkirim, diterima, dibaca; pesan gagal dicoba ulang otomatis.

### 7.13 Laporan
Penjualan (harian, per kasir, per produk/kategori, per metode bayar, per cabang); laba dan margin; stok (persediaan, nilai, kedaluwarsa, lambat laku); pembelian; klinik (kunjungan, diagnosa, tindakan, kinerja dokter); layanan (grooming, penitipan, vaksinasi); piutang dan hutang; komisi dan keuangan; audit.

Setiap laporan punya filter fleksibel, tampilan yang bisa disimpan, ekspor ke CSV, Excel, dan PDF, serta pengiriman terjadwal otomatis ke email atau WhatsApp. Semua bisa dilihat per cabang atau gabungan.

## 8. Aplikasi untuk Pelanggan

Setiap pelanggan mendapat aplikasi sendiri yang bisa dipasang di layar HP seperti aplikasi biasa, tanpa perlu mengunduh dari toko aplikasi. Mengutamakan tampilan ponsel, warna mengikuti branding bisnis.

**Masuk tanpa kata sandi.** Login memakai nomor HP dan kode OTP lewat WhatsApp. Pemilik bisa mengizinkan atau menutup pendaftaran mandiri. Pelanggan yang sudah didaftarkan staf cukup memverifikasi nomornya.

**Yang bisa dilakukan pelanggan:**
- Melihat dan memperbarui profil serta data hewannya
- Melihat riwayat kunjungan
- Melihat jadwal vaksin dan tanggal berikutnya
- Mengakses dokumen yang diizinkan: sertifikat vaksin, resep, ringkasan kunjungan
- Melihat tagihan dan membayar langsung (QRIS, e-wallet, virtual account, m-banking)
- Melihat riwayat pembayaran dan struk
- Booking klinik, grooming, atau penitipan: pilih cabang, dokter atau groomer, tanggal, jam, dengan deposit bila diwajibkan
- Mengubah jadwal atau membatalkan booking sesuai kebijakan
- Memantau status grooming dan penitipan lengkap dengan foto dan kabar harian
- Menerima notifikasi dan mengatur preferensi

**Satu akun untuk semua cabang.** Cabang dipilih saat booking.

**Privasi terjaga.** Pelanggan hanya melihat data miliknya. Pemilik usaha menentukan bagian rekam medis yang tampil, dan catatan internal dokter tidak pernah ditampilkan.

## 9. Integrasi Pihak Ketiga

Semua koneksi dikelola lewat layar **Pengaturan Integrasi**, hanya dapat dibuka Owner dan Super Admin. Tidak ada kredensial yang tertanam di aplikasi.

| Kategori | Penyedia | Fungsi |
|---|---|---|
| Pembayaran | Midtrans, Xendit | QRIS, e-wallet, virtual account, status otomatis |
| WhatsApp | WhatsApp Cloud API resmi, gateway pihak ketiga (misalnya Fonnte) | Struk, tagihan, pengingat, OTP, update layanan |
| Email | Resend dan SMTP | Struk, laporan terjadwal, pemberitahuan |

**Cara kerjanya:**
- Setiap penyedia punya formulir pengisian yang menyesuaikan kebutuhannya, tanpa menyentuh kode.
- Tersedia mode uji coba (sandbox) dan mode sebenarnya.
- Tombol **Uji Koneksi** memastikan pengaturan benar sebelum dipakai.
- Kredensial disimpan terenkripsi dan tidak pernah ditampilkan ulang, hanya diberi tanda "tersimpan".
- Alamat penerima notifikasi dari penyedia (webhook) ditampilkan otomatis agar mudah disalin.
- Status kesehatan tiap integrasi terlihat di dashboard.
- Setiap perubahan tercatat di log.
- Pemilik dapat menentukan koneksi utama dan aturan pengalihan, misalnya WhatsApp resmi untuk pesan templat dan gateway untuk pesan lain.
- Penyedia baru dapat ditambahkan di masa depan tanpa mengubah modul bisnis.

**Catatan WhatsApp resmi:** pesan yang dimulai oleh bisnis (struk, tagihan, pengingat) wajib memakai template yang disetujui Meta. PETORA menyediakan pengelola template lengkap dan menjelaskan dengan jelas bila pesan tidak dapat dikirim karena aturan ini.

## 10. Pengaturan Super Admin

Pusat kendali bagi pemilik dan Super Admin:

- Profil bisnis dan branding: nama aplikasi, logo, ikon, warna aksen, tema terang atau gelap
- Cabang dan gudang
- Penomoran dokumen: pola nomor invoice, PO, dan lainnya, diatur per jenis dan per cabang, misalnya `INV/JKT/202611/00001`
- Pajak: tarif, cara hitung, objek pajak
- Lokalisasi: bahasa (Indonesia atau Inggris), zona waktu, format tanggal dan angka. Mata uang hanya Rupiah
- Template dokumen: struk, invoice, sertifikat, surat, dengan editor dan pratinjau
- Template pesan dan aturan notifikasi
- Formulir rekam medis
- Kebijakan: persetujuan, batas diskon, refund, retensi data, booking, deposit
- Fitur per modul: nyalakan atau matikan (komisi, loyalitas, rawat inap, dan sebagainya)
- Peran, pengguna, sesi aktif, autentikasi dua langkah
- Log audit
- Kesehatan sistem
- Impor dan ekspor data, serta pengelolaan cadangan

## 11. Branding dan Lisensi

- Pemilik bebas mengganti nama aplikasi, logo, dan warna dengan identitas petshop dan klinik sendiri.
- Atribusi **"Powered by PETORA INDONESIA"** beserta pernyataan hak cipta dan lisensi **selalu tampil** di aplikasi staf, aplikasi pelanggan, dan dokumen cetak. Tidak ada pengaturan untuk menyembunyikannya.
- Tidak ada kunci lisensi atau aktivasi online. Perlindungan branding berbasis perjanjian lisensi yang disertakan bersama sistem.
- Seluruh kode sumber disediakan kepada pelanggan.

## 12. Keamanan dan Privasi

- **Data milik Anda.** Dipasang di server bisnis sendiri, tidak berbagi data dengan pihak lain.
- **Akses terkontrol.** Setiap tindakan diperiksa terhadap hak akses, dan data antar cabang terpisah sesuai cakupan peran.
- Kata sandi dan sesi aman; autentikasi dua langkah tersedia dan dapat diwajibkan untuk peran tertentu; daftar perangkat aktif dapat dicabut.
- PIN supervisor untuk persetujuan aksi sensitif.
- Kredensial terenkripsi, hanya dapat diatur Owner dan Super Admin.
- Pencegahan penyalahgunaan: pembatasan percobaan masuk dan permintaan OTP, perlindungan pada aplikasi pelanggan.
- Dokumen dan transaksi tidak bisa diubah diam-diam. Invoice final hanya dikoreksi lewat void, refund, atau retur dengan jejak lengkap.
- Rekam medis terkunci dan berversi; akses ke rekam medis tercatat.
- Log audit untuk login, perubahan peran, perubahan integrasi, diskon besar, void, refund, akses data medis, dan ekspor data.
- Perlindungan data pribadi: pengaturan retensi, anonimisasi, dan ekspor data pelanggan, mengacu pada prinsip UU Pelindungan Data Pribadi di Indonesia.
- File unggahan diperiksa jenis dan ukurannya, serta hanya dapat diakses pihak yang berhak.

## 13. Pengalaman Pengguna

PETORA dirancang agar tidak terasa kaku atau membosankan:

- Tampilan hangat dan profesional bernuansa hewan peliharaan namun tetap dewasa, dengan satu warna aksen yang bisa disesuaikan
- Mode terang, gelap, atau otomatis, serta kepadatan tampilan (nyaman atau ringkas)
- Pencarian dan perintah cepat (Ctrl/Cmd+K) untuk berpindah halaman atau menjalankan aksi
- Pencarian global untuk pelanggan, hewan, produk, dan transaksi
- Pindah cabang dengan satu klik
- Animasi halus yang membantu, bukan mengganggu
- Tabel fleksibel: kolom dapat diatur, tampilan disimpan, data diekspor
- Dashboard yang bisa disusun sendiri
- Kasir ramah sentuh dengan tombol besar dan pintasan keyboard
- Responsif di ponsel, tablet, dan komputer
- Mudah diakses: navigasi keyboard dan kontras yang baik
- Layar kosong dan pesan kesalahan yang ramah, bukan layar putih yang membingungkan

## 14. Pemasangan dan Pemeliharaan

Sasaran: pemilik usaha non-teknis dapat memasang dan merawat sistem tanpa bantuan pengembang.

- Dipasang di server milik bisnis sendiri dengan proses semudah mungkin.
- **Panduan pengaturan awal** saat pertama dibuka: membuat akun Owner, mengisi profil bisnis, menambah cabang pertama, memilih zona waktu, bahasa, dan pajak. Panduan tertutup permanen setelah selesai.
- Panduan juga memeriksa kesiapan koneksi, termasuk apakah alamat server dapat dijangkau dari luar, yang diperlukan agar notifikasi pembayaran masuk.
- Pemilik dapat mengisi **data contoh** untuk mencoba sistem sebelum memasukkan data asli.
- **Pembaruan aman:** cadangan dibuat dahulu, versi baru dipasang, dan sistem dapat dikembalikan bila ada masalah.
- **Cadangan** dapat dijadwalkan dan dipulihkan. Dokumentasi menjelaskan langkahnya dengan jelas.
- Tersedia **panduan untuk setiap peran:** pemilik, kasir, dokter, groomer, gudang, dan pelanggan.

## 15. Aturan Bisnis Kunci

Aturan berikut berlaku di seluruh sistem dan tidak boleh dilanggar oleh modul mana pun:

1. Satu kunjungan menghasilkan satu tagihan, satu pembayaran, satu struk, dengan seluruh item dari kasir, klinik, grooming, dan penitipan.
2. Pelanggan dan hewan berlaku lintas cabang. Stok, kasir, shift, jadwal, dan laporan terpisah per cabang. Harga boleh berbeda per cabang.
3. Barang dengan kedaluwarsa terdekat dikeluarkan lebih dulu. Stok berkurang otomatis dari penjualan, resep, dan pemakaian bahan.
4. Transaksi final tidak bisa diubah diam-diam. Koreksi hanya lewat void, refund, atau retur dengan alasan wajib dan jejak lengkap.
5. Void, refund, dan retur otomatis menyesuaikan stok, keuangan, poin atau saldo, dan komisi.
6. Diskon, refund, dan penyesuaian stok di atas batas peran memerlukan PIN atau persetujuan atasan.
7. Komisi hanya dicatat dan dilaporkan; berstatus menunggu saat belum lunas, final saat lunas, dan dibalik saat void atau refund.
8. Rekam medis berstatus draf sampai dikunci; setelah itu hanya dikoreksi lewat addendum berversi. Catatan internal dokter tidak pernah tampil bagi pelanggan.
9. Perubahan template formulir medis tidak merusak catatan lama (berversi).
10. Jadwal dokter, groomer, kamar, dan sumber daya lain tidak boleh bentrok. Vaksin wajib diperiksa sebelum penitipan.
11. Status pembayaran online berubah otomatis dan tepat satu kali walaupun pemberitahuan dari penyedia datang berulang.
12. Peran Owner tidak bisa dihapus dan selalu ada minimal satu Owner aktif.
13. Hak akses ditegakkan untuk setiap aksi, termasuk cakupan data dan penyembunyian data sensitif.
14. Nomor dokumen mengikuti pola yang diatur, tidak boleh ganda dan tidak boleh berlubang walau banyak transaksi bersamaan.
15. Pelanggan hanya melihat data miliknya sendiri.
16. Pesan WhatsApp resmi yang dimulai bisnis wajib memakai template yang disetujui, dan sistem menjelaskan bila pesan tidak dapat dikirim karena aturan itu.
17. Fitur yang dimatikan (misalnya komisi) tidak muncul di menu dan tidak menjalankan perhitungan apa pun.
18. Mata uang hanya Rupiah.

## 16. Contoh Alur Sehari-hari

### Kunjungan klinik sampai pembayaran
1. Pelanggan datang. Resepsionis menemukan data pelanggan dan hewannya, mendaftarkan kunjungan, dan memberi nomor antrian.
2. Dokter memanggil pasien dari layar antrian, mencatat pemeriksaan, memberikan vaksin, dan menulis resep.
3. Obat diserahkan dan stok berkurang otomatis dari batch yang paling dekat kedaluwarsa.
4. Seluruh biaya (pemeriksaan, vaksin, obat) otomatis muncul di daftar "menunggu pembayaran" di kasir, bersama makanan yang dibeli pelanggan.
5. Kasir menampilkan QR. Pelanggan membayar lewat e-wallet di ponselnya.
6. Status berubah menjadi lunas otomatis, dan struk serta sertifikat vaksin terkirim ke WhatsApp pelanggan.
7. Sistem menjadwalkan pengingat vaksin berikutnya.

### Booking dari rumah
1. Pelanggan membuka aplikasinya, memilih grooming, cabang terdekat, dan jam yang tersedia.
2. Bila layanan mewajibkan deposit, ia membayar langsung dari aplikasi.
3. Booking terkonfirmasi (otomatis atau setelah dikonfirmasi staf), dan pengingat dikirim sebelum hari H.
4. Saat hewan selesai, pelanggan mendapat pesan "siap dijemput" lengkap dengan foto hasil grooming.

### Penitipan beberapa hari
1. Hewan di-check-in dengan catatan kondisi dan deposit.
2. Petugas mengisi log harian dan mengirim foto kabar ke pemilik.
3. Saat check-out, biaya per malam dan layanan tambahan sudah terkumpul di satu tagihan.

### Pemilik memantau dari jauh
1. Pemilik membuka dashboard gabungan semua cabang.
2. Ia melihat penjualan, stok kritis, dan laporan komisi, lalu membuka laporan laba rugi per cabang.
3. Ia membuat peran baru "Supervisor Gudang" dengan hak akses yang dipilih sendiri, lalu menugaskannya ke dua cabang.

## 17. Di Luar Cakupan

Agar ekspektasi jelas, hal berikut **tidak** termasuk dalam PETORA:

- Penggunaan tanpa internet. Kasir dan seluruh sistem membutuhkan koneksi.
- Mata uang selain Rupiah.
- Pembayaran komisi atau penggajian. Komisi hanya dicatat sebagai laporan.
- Driver atau integrasi langsung ke printer thermal dan laci kas. Pencetakan memakai cetak browser dan PDF.
- Fitur penyembunyian atribusi PETORA INDONESIA.
- Layanan hosting. Pelanggan menyediakan server sendiri.

## 18. Kriteria Keberhasilan

Produk dianggap berhasil bila:

1. **Lengkap.** Seluruh modul dan fitur pada dokumen ini tersedia dan berfungsi, tanpa menu mati atau fitur setengah jadi.
2. **Konsisten.** Aturan bisnis, istilah, tampilan, dan perilaku seragam di semua modul dan semua cabang.
3. **Mudah dipasang.** Pemilik usaha dapat memasang sistem dan menyelesaikan pengaturan awal dengan upaya minimal.
4. **Mudah dipakai.** Staf baru bisa bekerja dengan panduan singkat, dan pelanggan bisa memakai aplikasinya tanpa dilatih.
5. **Menyenangkan dipakai.** Tampilan modern, cepat, hangat, dan interaktif.
6. **Dapat dipercaya.** Data akurat, transaksi dan rekam medis punya jejak yang utuh, dan akses terkontrol.
7. **Dapat dirawat.** Ada cadangan, pembaruan aman, dokumentasi lengkap untuk setiap peran, dan kode sumber yang rapi.
8. **Siap dipakai di bisnis nyata.** Seluruh alur harian pada bagian 16 dapat dijalankan dari awal sampai akhir.

## 19. Glosarium

| Istilah | Arti |
|---|---|
| Owner | Pemilik usaha, memiliki kendali penuh atas seluruh sistem |
| Super Admin | Administrator dengan hak mengatur konfigurasi dan integrasi |
| Cabang | Satu lokasi usaha yang menjalankan petshop dan klinik |
| Peran (role) | Sekumpulan hak akses yang diberikan kepada staf |
| Hak akses (permission) | Izin untuk melakukan satu aksi tertentu, misalnya memberi refund |
| POS | Sistem kasir (point of sale) |
| Batch | Satu kelompok barang dengan nomor dan tanggal kedaluwarsa yang sama |
| SOAP | Format catatan medis: Subjektif, Objektif, Assessment, Plan |
| Opname | Penghitungan fisik stok untuk dicocokkan dengan catatan sistem |
| Void | Pembatalan transaksi |
| Retur | Pengembalian barang |
| Webhook | Pemberitahuan otomatis dari penyedia pembayaran atau WhatsApp ke sistem |
| OTP | Kode sekali pakai untuk verifikasi login |
| Addendum | Catatan tambahan pada rekam medis yang sudah dikunci |
| Portal pelanggan | Aplikasi khusus pemilik hewan untuk booking, tagihan, dan riwayat |
| FEFO | Barang yang lebih dulu kedaluwarsa dikeluarkan lebih dulu |
| HPP | Harga pokok penjualan |
| STR | Surat Tanda Registrasi, izin praktik dokter hewan |
| Triase | Penentuan prioritas penanganan pasien |
| No-show | Pelanggan yang membuat janji tetapi tidak datang |

## 20. Cara Memakai Dokumen Ini Bersama agent.md

Dua dokumen ini saling melengkapi:

| Dokumen | Fungsi |
|---|---|
| `README.md` (dokumen ini) | Menjelaskan **apa** yang dibangun: produk, pengguna, fitur, aturan bisnis, batasan, dan tolok ukur keberhasilan. Tidak menyebut teknologi. |
| `agent.md` | Menjelaskan **bagaimana** agent bekerja: mandat otonom, standar kualitas, urutan fase, aturan arsitektur, pengujian, deployment, dan gerbang rilis. |

**Urutan membaca bagi agent:**

1. Baca `agent.md` untuk memahami cara kerja dan batasan perilaku.
2. Baca `README.md` ini untuk memahami produk secara menyeluruh.
3. Salin spesifikasi lengkap PETORA ke `docs/SPEC.md` sebagai sumber kebenaran fitur, bila belum ada.
4. Mulai dari Fase 0 di `agent.md`, putuskan teknologi sendiri, dan catat di `docs/DECISIONS.md`.

**Aturan kewenangan:**

- Semua keputusan teknis (bahasa pemrograman, kerangka kerja, basis data, arsitektur, struktur folder, cara deploy) adalah wewenang agent.
- Perilaku produk (fitur, aturan bisnis, alur pengguna, cakupan) mengikuti dokumen ini dan spesifikasi. Jika ada celah, agent memilih perilaku paling umum untuk bisnis petshop dan klinik hewan di Indonesia, lalu mencatat asumsinya di `docs/ASSUMPTIONS.md`.
- Jika README ini bertentangan dengan `docs/SPEC.md`, spesifikasi menang dan konfliknya dicatat.
- Jika pengguna memberi instruksi baru di tengah pekerjaan, instruksi itu diikuti, lalu dokumen terkait diperbarui agar tetap konsisten.

**Berkas yang diharapkan ada di repositori saat selesai:**

```
README.md            deskripsi proyek (dokumen ini, diperbarui dengan cara pasang dan teknologi yang dipilih)
agent.md             aturan kerja agent
PROGRESS.md          status kemajuan terkini
CHANGELOG.md         riwayat versi
LICENSE              ketentuan lisensi dan atribusi
docs/                spesifikasi, keputusan, arsitektur, instalasi, operasi, panduan per peran
```

Setelah teknologi dipilih dan produk selesai, agent memperbarui README ini dengan bagian **"Memulai Cepat"** (cara pasang satu perintah) dan **"Teknologi yang Digunakan"**, tanpa menghapus isi produk di atas.

---

**PETORA INDONESIA.** Hak cipta dan lisensi dipegang oleh PETORA INDONESIA.
