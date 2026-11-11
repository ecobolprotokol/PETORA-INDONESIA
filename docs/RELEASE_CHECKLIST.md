# Checklist Release PETORA INDONESIA

- Status: Checklist release siap digunakan saat persiapan release; belum ada release atau production deployment.
- Release owner dan approval authority: TBD.

## Product dan Dokumen
- [ ] Scope release, requirements, acceptance criteria, dan known limitations disetujui.
- [ ] Workflow operasional dan UAT selesai.
- [ ] Module/API/database/security/deployment docs sinkron dengan implementation aktual.
- [ ] Version dan changelog dirilis; migration/upgrade notes tersedia.

## Engineering dan Data
- [ ] Production build berhasil dari lockfiles.
- [ ] Unit, feature, integration, E2E, regression, lint, type/static analysis lulus.
- [ ] Migration direview, diuji pada non-production, dan impact/rollback didokumentasikan.
- [ ] Tidak ada destructive data change tanpa approval eksplisit.
- [ ] Smoke test workflow utama berhasil.

## Security
- [ ] Authentication, authorization, branch isolation, dan customer isolation diuji.
- [ ] Webhook signature/idempotency diuji jika provider aktif.
- [ ] Dependency/security review dan secret scan selesai.
- [ ] Production debug nonaktif; TLS aktif; database tidak terbuka langsung ke internet.
- [ ] Logging tidak membocorkan credential atau data sensitif.

## Operations
- [ ] Environment, secret handling, deployment topology, queue/scheduler dan storage diverifikasi.
- [ ] Backup database/file tersedia dan terenkripsi bila diputuskan.
- [ ] Restore test non-production berhasil; target RPO/RTO disetujui.
- [ ] Monitoring, health checks, alerts, log retention, dan operational ownership siap.
- [ ] Rollback/recovery procedure diuji/review.

## Release Authorization
- [ ] Change summary, release notes, known issues, support/troubleshooting, dan owner tersedia.
- [ ] UAT dan smoke test disetujui.
- [ ] Developer menyetujui release production.

Tidak ada checkbox yang dianggap selesai sampai ada bukti verifikasi. Production readiness tidak dapat diklaim hanya dari checklist template.