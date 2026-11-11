# Deployment PETORA INDONESIA

- Status: Self-hosted target dan release controls ditetapkan; tidak ada Dockerfile/Compose, Nginx config, atau deployment script saat ini.
- Target: self-hosted Linux; komponen baseline mengikuti `AI_AGENT.md` dan harus diverifikasi sebelum dipilih.

## Batas dan Keselamatan
Dokumen ini bukan instruksi untuk mengubah production. Tidak ada server, domain, credential, atau environment produksi yang diverifikasi. Jalankan prosedur pertama kali pada local/staging; deployment production memerlukan persetujuan developer.

## Prasyarat Target
Linux server, Docker Engine/Compose, Nginx, PHP/Laravel application, PostgreSQL, Redis bila digunakan, queue worker, scheduler, persistent storage, dan TLS/HTTPS. Versi OS/runtime/resource sizing belum ditetapkan. PostgreSQL tidak boleh diekspos langsung ke internet.

## Urutan Deployment yang Harus Didokumentasikan dan Diuji

1. Tetapkan supported OS/runtime, domain/DNS, resource, storage, ports, dan firewall.
2. Siapkan host/container runtime dan Nginx melalui konfigurasi yang direview.
3. Siapkan environment/secrets di luar repository; debug nonaktif untuk production.
4. Provision database, user/permissions, Redis bila digunakan, dan persistent file storage.
5. Build artifact dari source/lockfiles yang direview; simpan versi/release identifier.
6. Jalankan migration hanya setelah backup, impact review, dan rencana rollback disetujui.
7. Buat administrator awal melalui prosedur aman, bukan credential hard-coded.
8. Jalankan web app, worker, scheduler, health checks, logging, TLS, dan monitoring.
9. Jalankan smoke test serta cek queue, storage, database, dan external integrations.
10. Catat release, known issues, migration notes, backup, rollback, dan persetujuan.

## Upgrade dan Rollback
Setiap release memerlukan backup sebelum perubahan data, migration notes, compatibility window, smoke test, dan rollback guidance. Destructive migrations tidak dijalankan pada production tanpa prosedur migrasi data dan persetujuan eksplisit. Rollback aplikasi tidak otomatis membalikkan migration yang merusak data.

## Backup dan Operasi
Ikuti [BACKUP_RESTORE.md](BACKUP_RESTORE.md), [MONITORING.md](MONITORING.md), dan [ENVIRONMENT_CONFIGURATION.md](ENVIRONMENT_CONFIGURATION.md). Restore harus diuji di non-production; log retention dan alerting harus disepakati.

## Gate Production
Build production berhasil; security review; environment/secret review; TLS; backup & restore test; migration plan; queue/scheduler; health checks; monitoring/logging; smoke/UAT; rollback; release checklist dan persetujuan developer. Belum ada item yang dinyatakan lulus karena tidak ada deployment implementation.