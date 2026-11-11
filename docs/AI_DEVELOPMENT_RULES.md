# Aturan Pengembangan AI PETORA INDONESIA

- Status: Aturan kerja dirangkum; `AI_AGENT.md` tetap menjadi authority utama.
- Pedoman utama yang mengikat: [AI_AGENT.md](../AI_AGENT.md).

## Urutan Sumber Kebenaran
Ikuti hierarki dan aturan konflik yang tercantum di `AI_AGENT.md`. Dokumen ini hanya merangkum cara menerapkannya; tidak menggantikan atau menurunkan prioritas pedoman utama.

## Cara Kerja

1. Tentukan mode pekerjaan (analysis, documentation, architecture, database, backend, frontend, integration, testing, security, devops, maintenance).
2. Baca requirement dan dokumentasi terkait; periksa implementasi/dependency yang ada.
3. Identifikasi asumsi, dependency, risiko, dan permission/data impact.
4. Untuk task besar, pecah menjadi tahap dengan acceptance criteria.
5. Buat perubahan terkecil yang memenuhi kebutuhan.
6. Tambahkan/update tests dan dokumentasi, jalankan verifikasi relevan, laporkan hasil nyata.
7. Catat hal belum selesai dan jangan klaim DONE/production-ready tanpa quality gates.

## Aturan Pengaman

- Jangan mengarang business rules, dependency versions, API, schema, atau test results.
- Jangan menghapus data, menjalankan destructive migration, atau mengubah production config tanpa persetujuan.
- Jangan menyimpan secret/data sensitif ke source control/log.
- Jangan membuat endpoint tanpa authorization.
- Jangan menonaktifkan validasi atau menghapus test untuk mengatasi kegagalan.
- Jangan mengganti stack utama tanpa analisis alternatif, dampak, dokumentasi, dan persetujuan.

## Pelaporan Task
Task kompleks melaporkan objective, current findings, plan, changes, database/security impact, tests, documentation, remaining work, dan status. Status hanya DONE setelah acceptance dan quality gates terkait diverifikasi.

## Sinkronisasi
Jika ringkasan ini berkonflik dengan [AI_AGENT.md](../AI_AGENT.md), pedoman utama dan instruksi developer terbaru berlaku. Perubahan aturan harus diperbarui secara eksplisit, tidak diam-diam.