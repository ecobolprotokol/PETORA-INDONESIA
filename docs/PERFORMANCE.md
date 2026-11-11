# Performa PETORA INDONESIA

- Status: Measurement strategy ditetapkan; belum ada build, dataset, profiling, load test, atau target SLO.

## Prinsip
Hindari premature optimization. Ukur sebelum optimasi kompleks. Kebenaran transaksi, branch isolation, dan integritas medis/keuangan tidak boleh dikorbankan demi throughput.

## Area Pemeriksaan

- Database indexes berdasarkan query/filter/join yang benar-benar dipakai.
- N+1, eager loading, pagination, sorting/filter bounds.
- Query transaction dan contention pada stock/payment/booking.
- Queue untuk pekerjaan berat/asynchronous bila diperlukan.
- Asset/image size, lazy loading, build output.
- Report/export yang besar dan penggunaan memory.
- Database connection/resource limits serta cache invalidation jika cache dipilih.

## Metode Validasi

1. Definisikan workload representatif, volume data, concurrency, dan target bersama pemilik produk.
2. Ukur baseline pada environment non-production yang mewakili target.
3. Profiling query, application path, asset, dan background jobs.
4. Prioritaskan bottleneck yang terukur dan risiko data correctness.
5. Tambahkan regression/load test untuk workflow yang ditargetkan.
6. Dokumentasikan tool, environment, dataset sintetis, hasil, dan keterbatasan.

## Keamanan Pengujian
Gunakan data sintetis; jangan memuat dump customer/medical/production ke test tanpa prosedur dan persetujuan. Load tests tidak dijalankan terhadap production.

## Acceptance Criteria
Target latency/throughput/resources disetujui per workload; hasil ukur dapat direproduksi; tidak ada regression integritas/authorization; optimasi memiliki bukti sebelum/sesudah.

## Keputusan Terbuka
Expected users/branches, transaksi per waktu, dataset sizes, report workload, concurrency, latency/SLO, hardware class, performance budget, dan toolchain belum ditetapkan.