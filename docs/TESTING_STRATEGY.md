# Strategi Testing PETORA INDONESIA

- Status: Baseline siap untuk foundation; versi tool menunggu compatibility check.
- Tool baseline yang dipilih: PHPUnit, Vitest, React Testing Library, dan Playwright untuk browser E2E. Versi final harus lolos compatibility/support check sebelum dikunci pada manifest dan lockfile.

## Tujuan dan Batas
Membuktikan business rules, authorization, data integrity, dan workflow. Belum ada implementasi yang dapat diuji; versi tool menunggu dependency compatibility check.

## Tingkat Pengujian

- **Unit:** perhitungan bisnis, validation, pricing/tax setelah disetujui, inventory rules, permission, dan lifecycle transitions.
- **Feature:** HTTP/Inertia actions, database persistence, authorization, invoice/payment, stock movement, customer/pet flows.
- **Integration:** POS/Clinic/Grooming/Boarding ke Billing; Payment ke Invoice; Procurement ke Inventory; Inventory ke Finance; Notifications/provider adapters.
- **End-to-end:** workflow operasional utama lintas UI dan backend pada environment non-production.
- **Static quality:** lint, typecheck/static analysis, dependency/security checks yang dipilih.

## Scenario Minimum
Setiap workflow relevan menguji success, invalid input, unauthorized, cross-branch, duplicate request, concurrent request, empty/missing related data, database/external failure, cancellation, partial payment, refund, out-of-stock, dan expired batch.

## Prinsip Test Data
Gunakan test database/factory/fixtures yang sintetis. Jangan menggunakan atau mengubah data produksi. Hindari tests yang bergantung pada urutan atau secret nyata. External-provider mocks membuktikan kontrak aplikasi, bukan integrasi provider nyata.

## Kualitas Test Finansial, Inventory, dan Medis

- Uang: presisi decimal, allocation/status, duplicate/refund/reversal.
- Inventory: ledger reconciliation, FEFO jika berlaku, out-of-stock, race/concurrency, batch expiry.
- Medical: draft/finalize/amend, actor/time/reason, authorization, no silent hard delete.
- Branch/portal: akses allowed dan denied dengan manipulasi identifier.

## CI dan Gate
Pipeline baseline belum ada. Setelah bootstrap, gate mencakup formatting/lint, type/static analysis, unit/feature suite, build, dan test relevan; integration/E2E ditambahkan per workflow. Failing test diselidiki, tidak dihapus/di-disable untuk meluluskan pipeline.

## Pelaporan
Setiap perubahan melaporkan command/target yang dijalankan, hasil nyata, test yang gagal/tidak tersedia, serta limitation. Tidak boleh menyebut mock sebagai provider integration test.

## Kriteria Selesai
Test menutup acceptance criteria dan failure/security paths relevan; hasil lulus pada lingkungan non-production; regression tests tersedia; dokumentasi dan requirement konsisten. Framework/coverage thresholds belum disetujui.