# Design System PETORA INDONESIA

- Status: Komponen dan accessibility requirements menjadi baseline; visual tokens perlu review sebelum UI feature implementation.
- Rujukan: [UI_UX_GUIDELINES.md](UI_UX_GUIDELINES.md).

## Tujuan
Menjaga konsistensi komponen operasional pada seluruh modul dan mendukung pemeliharaan oleh solo developer.

## Baseline Teknologi
Tailwind CSS dan shadcn/ui tercantum sebagai baseline pada `AI_AGENT.md`; React + TypeScript digunakan untuk frontend. Versi, konfigurasi, font, icon set, chart, dan theme tokens belum diverifikasi karena manifest/aplikasi tidak tersedia.

## Prinsip Visual dan Interaksi

- Prioritaskan keterbacaan, hierarki informasi, scanning cepat, dan penggunaan berulang.
- Gunakan pola familiar dan komponen bersama; hindari custom control tanpa kebutuhan.
- Sediakan state disabled/loading/error/focus dan feedback setelah aksi.
- Jangan mengandalkan warna saja untuk status; sediakan label/icon yang bermakna.
- Tabel, form, dialog, dan navigasi harus mendukung responsive serta keyboard use.
- Variasi brand palette, typography, spacing, radius, elevation, dan motion ditentukan melalui design review; belum ada keputusan token.

## Komponen yang Perlu Distandardisasi
Button; input; select; date picker; dialog/drawer; dropdown; data table; pagination; tabs; badge/status; alert/toast; form field; search/filter; empty state; loading skeleton; confirmation dialog. Tidak ada komponen yang diasumsikan sudah tersedia.

## States dan Accessibility
Setiap komponen mendefinisikan semantic role, label, focus behavior, keyboard interaction, validation/error state, disabled state, dan contrast. Status transaksi/rekam medis harus dapat dipahami tanpa bergantung pada warna.

## Data Visualization
Apache ECharts tercantum sebagai opsi baseline; visualisasi hanya dibuat setelah definisi metrik, skala, periode, dan akses laporan disepakati. Chart tidak menjadi sumber kebenaran data.

## Governance
Komponen/token baru dicatat dengan tujuan, variants, states, accessibility, dan test. Perubahan design system harus memperbarui guideline dan diuji di halaman yang menggunakan komponen. Visual tokens dan inventory final menunggu tahap UX.