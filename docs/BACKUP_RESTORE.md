# Backup dan Restore PETORA INDONESIA

- Status: Backup/restore controls ditetapkan; belum ada job, target RPO/RTO, atau restore test.

## Cakupan Backup

- Database PostgreSQL.
- File/object storage yang digunakan aplikasi.
- Konfigurasi non-secret dan release metadata yang diperlukan untuk recovery.
- Secret dikelola terpisah melalui mekanisme aman; jangan memasukkannya ke backup biasa tanpa proteksi khusus.

## Persyaratan

- Jadwal, retention, encryption, off-site copy, dan akses backup ditetapkan sesuai risiko bisnis.
- Backup database dan file storage harus konsisten pada level workflow/maintenance yang didesain.
- Simpan backup di lokasi terpisah dari server utama; akses least privilege.
- RPO dan RTO ditentukan oleh pemilik bisnis, bukan diasumsikan.
- Pantau keberhasilan job dan kapasitas storage; kegagalan harus menghasilkan alert.

## Restore Test Non-Production

1. Pilih backup dengan metadata waktu, release/schema version, dan checksums bila tersedia.
2. Validasi integritas/akses backup tanpa memindahkan data ke production.
3. Restore ke environment non-production terisolasi.
4. Restore file storage yang terkait dan validasi referensi.
5. Jalankan migration/compatibility checks yang relevan dan smoke tests read-only.
6. Catat durasi, gap, error, serta hasil verifikasi; hapus test data sesuai policy.

Jangan melakukan restore ke production sebagai eksperimen. Restore production memerlukan incident procedure dan persetujuan eksplisit.

## Disaster Recovery
Runbook final harus menetapkan incident owner, komunikasi, containment, recovery point yang dipilih, urutan database/storage/app restore, credential rotation bila relevan, validation, dan re-entry ke operasi. Rincian komunikasi dan target waktu belum ditetapkan.

## Acceptance Criteria
- Backup database dan file yang diperlukan berhasil dibuat dan terproteksi.
- Restore non-production berhasil dengan bukti integritas dan smoke test.
- Retention, encryption, off-site location, RPO/RTO, dan pemilik operasi disetujui.
- Recovery dan rollback runbook direview serta diuji berkala.

## Status Saat Ini
Belum ada bukti backup atau restore. Produk tidak dapat dinyatakan siap production sebelum restore benar-benar diuji.