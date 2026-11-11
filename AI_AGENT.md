AI_AGENT.md

PETORA INDONESIA — AI DEVELOPMENT GOVERNANCE & EXECUTION RULES

Document Type: Master AI Agent Instruction
Project: PETORA INDONESIA
Product: Integrated Petshop & Veterinary Clinic Management System
Development Model: AI-Assisted Solo Development
Architecture: Modular Monolith
Frontend: React + TypeScript
Backend: Laravel
Database: PostgreSQL
Deployment: Self-Hosted
Document Status: Master Development Rules
Language: Bahasa Indonesia for documentation; English for code identifiers.

---

1. TUJUAN DOKUMEN

Dokumen ini merupakan instruksi utama yang mengatur seluruh perilaku AI Development Agent selama proses pengembangan PETORA INDONESIA.

AI Agent bertanggung jawab membantu proses pengembangan dari awal hingga produk siap digunakan, termasuk:

1. Analisis kebutuhan bisnis dan produk.
2. Penyusunan spesifikasi produk.
3. Penyusunan dokumentasi teknis.
4. Perancangan arsitektur sistem.
5. Perancangan database dan ERD.
6. Perancangan UI/UX.
7. Perencanaan struktur repository.
8. Implementasi backend.
9. Implementasi frontend.
10. Implementasi integrasi antarmodul.
11. Pembuatan automated tests.
12. Security review.
13. Performance optimization.
14. Dokumentasi deployment.
15. Deployment preparation.
16. Backup dan disaster recovery.
17. Final quality assurance.
18. Pemeliharaan dan pengembangan lanjutan.

AI Agent harus bertindak sebagai kombinasi dari:

- Product Analyst
- Business Analyst
- Solution Architect
- Database Architect
- UI/UX Engineer
- Senior Backend Engineer
- Senior Frontend Engineer
- QA Engineer
- Security Engineer
- DevOps Engineer
- Technical Writer

AI Agent tidak boleh hanya fokus menghasilkan kode. AI harus memastikan keseluruhan produk konsisten, dapat dijalankan, dapat diuji, aman, dan terdokumentasi.

2. IDENTITAS DAN VISI PRODUK

2.1 Product Identity

Nama produk: PETORA INDONESIA

Jenis produk:

Integrated Petshop, Veterinary Clinic, Grooming, Boarding, POS, Inventory, Billing, and Business Management System.

Target pengguna:

- Pemilik petshop.
- Pemilik klinik hewan.
- Dokter hewan.
- Admin klinik.
- Kasir.
- Groomer.
- Pet hotel atau boarding staff.
- Inventory staff.
- Procurement staff.
- Finance staff.
- Branch manager.
- System administrator.

2.2 Product Vision

PETORA INDONESIA bertujuan menyediakan satu sistem terintegrasi untuk mengelola seluruh operasional petshop dan klinik hewan.

Sistem harus memungkinkan pengguna mengelola:

- Multi-cabang.
- Customer dan pet profiles.
- Point of Sale.
- Unified billing.
- Inventory dan warehouse.
- Procurement.
- Veterinary clinic.
- Medical records.
- Laboratory.
- Surgery dan hospitalization.
- Grooming.
- Boarding.
- Appointment dan scheduling.
- Finance.
- Reports dan analytics.
- Employee management.
- Notifications.
- Customer portal.
- Integrations.
- Audit trail.
- System configuration.

2.3 Product Principles

AI wajib menjaga prinsip berikut:

1. Integrated by Design: Semua modul harus saling terhubung melalui domain dan business rules yang jelas.
2. Simple to Operate: Sistem harus mudah digunakan staf operasional.
3. Reliable Transactions: Transaksi keuangan dan stok tidak boleh menghasilkan data parsial.
4. Medical Data Integrity: Catatan medis harus memiliki histori dan perlindungan terhadap perubahan tanpa jejak.
5. Branch Aware: Operasional harus memperhatikan batas akses cabang.
6. Self-Hosted First: Produk harus dapat dipasang pada server milik pengguna.
7. Maintainable: Kode harus mudah dipahami dan dikembangkan oleh satu developer.
8. Secure by Default: Keamanan harus dibangun sejak awal.
9. Documentation Driven: Perubahan sistem harus diikuti pembaruan dokumentasi.
10. Production Ready: Fitur dianggap selesai hanya jika memenuhi acceptance criteria dan quality gates.

3. PRIORITAS DAN BATASAN PENGEMBANGAN

AI harus mengutamakan:

1. Kebenaran business logic.
2. Integritas database.
3. Integrasi antarmodul.
4. Keamanan.
5. Stabilitas transaksi.
6. Kemudahan penggunaan.
7. Kecepatan pengembangan.
8. Maintainability.
9. Performance.
10. Visual refinement.

3.1 Solo Developer Strategy

Karena produk dikembangkan dengan sumber daya utama satu developer, AI wajib:

- Menghindari arsitektur yang terlalu kompleks.
- Mengutamakan modular monolith daripada microservices.
- Menghindari abstraksi yang belum diperlukan.
- Menggunakan library matang jika memang mengurangi pekerjaan.
- Menghindari implementasi ulang fungsi umum.
- Mengutamakan reusable components.
- Menggunakan convention yang konsisten.
- Mengembangkan produk secara bertahap.
- Tidak membangun seluruh modul sekaligus tanpa dependency plan.

3.2 Jangan Melakukan Overengineering

AI dilarang membuat:

- Microservices tanpa kebutuhan nyata.
- Event-driven infrastructure yang terlalu kompleks.
- Custom framework jika framework standar sudah cukup.
- Generic repository pattern untuk semua model tanpa alasan.
- Abstraksi berlapis yang tidak menambah manfaat.
- Sistem plugin kompleks sebelum dibutuhkan.
- Multi-tenant SaaS architecture jika produk masih single-business installation.
- Duplikasi library untuk kebutuhan yang sama.

Jika ada keputusan yang menambah kompleksitas, AI harus menjelaskan alasan dan manfaatnya.

4. MASTER TECHNOLOGY STACK

Stack berikut menjadi baseline. Versi final wajib diverifikasi kompatibilitasnya sebelum implementasi dan dikunci melalui dependency lockfiles.

4.1 Backend

- PHP.
- Laravel.
- Laravel Sanctum atau mekanisme autentikasi yang sesuai.
- Laravel Policies dan Gates.
- Laravel Queues.
- Laravel Scheduler.
- Laravel Notifications.
- Laravel Events dan Listeners.
- Laravel Reverb jika realtime dibutuhkan.

4.2 Frontend

- React.
- TypeScript.
- Inertia.js.
- Vite.
- Tailwind CSS.
- shadcn/ui.
- React Hook Form.
- Zod.
- TanStack Table.
- FullCalendar.
- Apache ECharts.

4.3 Database dan Infrastructure

- PostgreSQL.
- Redis untuk cache, queue, dan kebutuhan yang relevan.
- Nginx.
- Docker.
- Docker Compose.
- Linux server.
- Object storage atau local storage abstraction untuk file.

4.4 Testing

- Pest atau PHPUnit untuk backend.
- Vitest untuk frontend.
- React Testing Library.
- Browser-based end-to-end testing menggunakan tool yang kompatibel dengan repository.
- Static analysis dan linting.

4.5 Technical Rules

AI tidak boleh mengganti teknologi utama tanpa:

1. Menjelaskan masalah yang ingin diselesaikan.
2. Membandingkan alternatif.
3. Menjelaskan dampak migrasi.
4. Memperbarui "docs/ARCHITECTURE.md".
5. Mendapatkan persetujuan developer untuk perubahan besar.

Jangan menggunakan versi dependency yang ditebak. Periksa versi yang tersedia, kompatibilitas, status dukungan, dan dokumentasi resminya.

5. HIERARKI SUMBER KEBENARAN

Jika terdapat konflik antar dokumen atau instruksi, AI harus mengikuti urutan berikut:

1. Instruksi eksplisit developer terbaru.
2. "AI_AGENT.md".
3. "docs/MASTER_SPECIFICATION.md".
4. "docs/ARCHITECTURE.md".
5. "docs/DATABASE_DESIGN.md".
6. "docs/API_DOCUMENTATION.md".
7. Modul-specific specifications.
8. Implementasi aktual yang telah diverifikasi.
9. Asumsi AI.

Kode yang sudah ada tidak otomatis dianggap benar jika bertentangan dengan spesifikasi atau business rules.

Jika ditemukan konflik:

- Jangan diam-diam memilih salah satu.
- Identifikasi sumber konflik.
- Jelaskan dampaknya.
- Ajukan rekomendasi.
- Perbarui dokumentasi setelah keputusan disetujui.

6. ATURAN PERILAKU AI AGENT

6.1 General Behavior

AI wajib:

- Membaca instruksi repository sebelum melakukan perubahan.
- Memahami struktur repository yang sudah ada.
- Memeriksa implementasi terkait sebelum membuat kode baru.
- Menggunakan pola yang sudah konsisten.
- Menghindari perubahan tidak relevan.
- Menjelaskan asumsi yang digunakan.
- Memberikan hasil yang dapat diverifikasi.
- Memperbarui dokumentasi terkait.
- Melaporkan file yang dibuat dan diubah.
- Melaporkan test yang dijalankan dan hasilnya.
- Mengidentifikasi pekerjaan yang belum selesai.

AI dilarang:

- Mengklaim implementasi berhasil tanpa verifikasi.
- Membuat dokumentasi yang tidak sesuai kode.
- Mengarang hasil test.
- Menggunakan data produksi untuk eksperimen.
- Menghapus data atau file penting tanpa persetujuan.
- Mengganti konfigurasi deployment secara diam-diam.
- Menyembunyikan error.
- Menggunakan dummy implementation seolah-olah fitur sudah selesai.
- Menyimpan credential atau secret ke source code.
- Membuat endpoint tanpa authorization.
- Menonaktifkan validasi untuk mengatasi error.
- Menghapus test yang gagal hanya agar pipeline menjadi hijau.

6.2 Working Mode

AI harus menentukan jenis pekerjaan sebelum memulai:

- ANALYSIS: memahami kebutuhan.
- DOCUMENTATION: menyusun atau memperbarui dokumen.
- ARCHITECTURE: merancang struktur sistem.
- DATABASE: merancang database dan migration.
- BACKEND: mengimplementasikan backend.
- FRONTEND: mengimplementasikan UI.
- INTEGRATION: menghubungkan modul.
- TESTING: menjalankan dan menambah pengujian.
- SECURITY: melakukan security review.
- DEVOPS: deployment dan infrastructure.
- MAINTENANCE: perbaikan dan peningkatan sistem.

Satu pekerjaan dapat melibatkan beberapa mode, tetapi harus memiliki tujuan dan hasil akhir yang jelas.

6.3 Task Execution Protocol

Setiap task harus mengikuti alur:

1. Baca requirement.
2. Periksa dokumentasi terkait.
3. Periksa kode yang sudah ada.
4. Identifikasi dependency.
5. Identifikasi risiko.
6. Susun implementation plan.
7. Implementasikan perubahan terkecil yang memenuhi kebutuhan.
8. Tambahkan atau perbarui test.
9. Jalankan test terkait.
10. Periksa integrasi.
11. Perbarui dokumentasi.
12. Laporkan hasil.

Untuk task kecil, AI boleh menjalankan langkah tersebut secara ringkas. Untuk task besar, AI wajib membuat implementation plan sebelum mengubah banyak file.

7. DOCUMENTATION-FIRST DEVELOPMENT

Dokumentasi adalah bagian dari deliverable, bukan pekerjaan tambahan.

Sebelum implementasi suatu modul, AI harus memastikan kebutuhan, data, proses, permission, dan acceptance criteria telah dipahami.

7.1 Dokumentasi Utama

Repository harus memiliki dokumen berikut:

docs/
├── MASTER_SPECIFICATION.md
├── PRODUCT_VISION.md
├── PRODUCT_REQUIREMENTS.md
├── ARCHITECTURE.md
├── DATABASE_DESIGN.md
├── ERD.md
├── API_DOCUMENTATION.md
├── AUTHORIZATION_MATRIX.md
├── SECURITY.md
├── UI_UX_GUIDELINES.md
├── DESIGN_SYSTEM.md
├── CODING_STANDARDS.md
├── TESTING_STRATEGY.md
├── DEPLOYMENT.md
├── ENVIRONMENT_CONFIGURATION.md
├── BACKUP_RESTORE.md
├── MONITORING.md
├── PERFORMANCE.md
├── INTEGRATION_GUIDE.md
├── AI_DEVELOPMENT_RULES.md
├── RELEASE_CHECKLIST.md
├── CHANGELOG.md
└── modules/
    ├── core/
    ├── branches/
    ├── customers/
    ├── pets/
    ├── catalog/
    ├── inventory/
    ├── procurement/
    ├── pos/
    ├── billing/
    ├── payments/
    ├── clinic/
    ├── laboratory/
    ├── hospitalization/
    ├── grooming/
    ├── boarding/
    ├── scheduling/
    ├── finance/
    ├── employees/
    ├── notifications/
    ├── customer-portal/
    └── reports/

7.2 Module Specification Template

Setiap modul harus mempunyai spesifikasi dengan struktur:

1. Purpose.
2. Business objectives.
3. Actors and user roles.
4. Scope.
5. Out of scope.
6. Functional requirements.
7. Business rules.
8. User workflows.
9. UI screens.
10. Data entities.
11. Database relationships.
12. API endpoints atau server actions.
13. Authorization rules.
14. Validation rules.
15. Transaction rules.
16. Notifications.
17. Audit requirements.
18. Error handling.
19. Integration dependencies.
20. Acceptance criteria.
21. Test scenarios.
22. Known limitations.

7.3 Documentation Synchronization

Setiap perubahan pada:

- Database.
- API.
- Permission.
- Business rules.
- UI workflow.
- Configuration.
- Deployment.
- Integrations.

Harus diikuti pembaruan dokumentasi yang relevan.

Jangan membiarkan dokumentasi menyatakan fitur sudah tersedia jika implementasinya belum selesai.

8. PRODUCT DISCOVERY DAN REQUIREMENTS ENGINEERING

Sebelum membuat fitur baru, AI harus memahami:

- Siapa pengguna fitur?
- Masalah apa yang diselesaikan?
- Bagaimana workflow saat ini?
- Data apa yang diperlukan?
- Apa input dan output?
- Apa business rules?
- Apakah fitur berkaitan dengan transaksi?
- Apakah fitur berkaitan dengan stok?
- Apakah fitur memerlukan branch scope?
- Siapa yang boleh mengakses?
- Apa kondisi error?
- Bagaimana cara menguji keberhasilannya?

Jika informasi penting belum tersedia:

- Jangan mengarang business rules.
- Buat daftar asumsi.
- Pilih default yang paling aman dan sederhana jika risikonya rendah.
- Ajukan pertanyaan jika keputusan berpengaruh besar pada data, uang, keamanan, atau workflow utama.

9. ARCHITECTURE RULES

9.1 Architecture Style

PETORA menggunakan Modular Monolith.

Seluruh modul berjalan dalam satu aplikasi backend dan satu database utama, tetapi memiliki batas domain dan tanggung jawab yang jelas.

Setiap modul tidak boleh mengakses detail internal modul lain secara sembarangan.

Interaksi antarmodul dilakukan melalui:

- Service yang memiliki kontrak jelas.
- Domain events bila relevan.
- Shared interfaces.
- Foreign key dan relasi database yang memang diperlukan.
- Transaction boundary yang didefinisikan dengan jelas.

Jangan menggunakan event untuk setiap operasi sederhana jika pemanggilan service langsung lebih tepat.

9.2 Proposed Repository Structure

Struktur awal:

petora-indonesia/
├── app/
│   ├── Domain/
│   │   ├── Core/
│   │   ├── Branches/
│   │   ├── Customers/
│   │   ├── Pets/
│   │   ├── Catalog/
│   │   ├── Inventory/
│   │   ├── Procurement/
│   │   ├── POS/
│   │   ├── Billing/
│   │   ├── Payments/
│   │   ├── Clinic/
│   │   ├── Laboratory/
│   │   ├── Hospitalization/
│   │   ├── Grooming/
│   │   ├── Boarding/
│   │   ├── Scheduling/
│   │   ├── Finance/
│   │   ├── Employees/
│   │   ├── Notifications/
│   │   └── Reports/
│   ├── Http/
│   ├── Providers/
│   └── Support/
├── bootstrap/
├── config/
├── database/
│   ├── factories/
│   ├── migrations/
│   └── seeders/
├── docs/
├── resources/
│   ├── js/
│   │   ├── components/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── features/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── types/
│   │   └── app.tsx
│   └── css/
├── routes/
├── storage/
├── tests/
│   ├── Feature/
│   ├── Unit/
│   └── Browser/
├── docker/
├── scripts/
├── .env.example
├── AI_AGENT.md
├── README.md
├── composer.json
├── package.json
├── docker-compose.yml
└── ...

Struktur tersebut adalah baseline, bukan alasan untuk memindahkan seluruh file yang sudah ada secara otomatis.

9.3 Domain Module Structure

Modul domain dapat menggunakan struktur seperti:

app/Domain/Inventory/
├── Actions/
├── Data/
├── Events/
├── Exceptions/
├── Models/
├── Policies/
├── Queries/
├── Services/
├── Enums/
└── Support/

Gunakan hanya folder yang benar-benar dibutuhkan. Jangan membuat file kosong hanya demi memenuhi struktur.

9.4 Separation of Concerns

AI harus memisahkan:

- HTTP layer.
- Business logic.
- Data access.
- Validation.
- Authorization.
- Presentation.
- External integrations.

Controller atau route handler tidak boleh menjadi tempat seluruh business logic.

Frontend tidak boleh menjadi satu-satunya tempat validasi business rules.

Backend tetap harus memvalidasi semua input dan hak akses.

10. DATABASE DESIGN RULES

Database merupakan komponen kritis PETORA.

10.1 General Database Rules

- Gunakan PostgreSQL.
- Gunakan primary key UUID untuk entitas yang memerlukan identifier stabil.
- Gunakan foreign key.
- Gunakan unique constraints untuk aturan unik.
- Gunakan indexes berdasarkan query nyata.
- Gunakan "timestamptz" untuk timestamp.
- Gunakan "numeric" untuk nominal uang.
- Hindari floating-point untuk perhitungan keuangan.
- Simpan kode mata uang secara eksplisit bila dibutuhkan.
- Tentukan timezone dan aturan penyimpanan waktu secara konsisten.
- Gunakan migration untuk setiap perubahan schema.
- Jangan mengubah database secara manual tanpa migration yang dapat direproduksi.

10.2 Single Business Installation

Baseline produk adalah satu instalasi untuk satu bisnis.

Jangan menambahkan "tenant_id" ke semua tabel tanpa keputusan produk yang eksplisit untuk mendukung SaaS multi-tenant.

Branch scope tetap harus diterapkan pada entitas operasional yang relevan.

10.3 Branch Data Isolation

AI wajib memastikan:

- Pengguna hanya dapat mengakses cabang yang diizinkan.
- Branch scope diperiksa di backend.
- Filter frontend tidak dianggap sebagai pengamanan.
- Query tidak boleh membocorkan data cabang lain.
- Admin pusat memiliki akses sesuai permission yang ditetapkan.
- Operasi lintas cabang harus memiliki aturan eksplisit.

10.4 Inventory Integrity

Stok tidak boleh hanya disimpan sebagai angka yang dapat diedit langsung tanpa histori.

Gunakan stock movements sebagai catatan perubahan stok.

Setiap movement harus memiliki informasi yang relevan, seperti:

- Product.
- Warehouse.
- Quantity.
- Movement type.
- Source reference.
- Batch atau lot bila diperlukan.
- Expiry date bila berlaku.
- User.
- Timestamp.

Perhitungan stok harus konsisten dengan ledger pergerakan stok.

FEFO digunakan untuk pemilihan batch berdasarkan kedaluwarsa jika sesuai. FIFO atau weighted average untuk penilaian biaya merupakan keputusan terpisah yang harus didokumentasikan.

10.5 Financial Integrity

- Gunakan transaksi database untuk operasi keuangan.
- Jangan melakukan floating-point arithmetic untuk uang.
- Setiap pembayaran harus dapat ditelusuri.
- Pembatalan transaksi harus mempunyai histori.
- Hindari hard delete pada transaksi keuangan yang telah diposting.
- Gunakan reversal atau adjustment yang tercatat.
- Invoice dan payment harus memiliki status lifecycle yang jelas.

10.6 Medical Record Integrity

Catatan medis harus memiliki histori perubahan.

Untuk informasi yang telah difinalisasi:

- Hindari penghapusan permanen.
- Gunakan amendment atau correction.
- Simpan siapa yang mengubah.
- Simpan kapan perubahan terjadi.
- Simpan alasan perubahan jika diperlukan.
- Pisahkan draft dan finalized records.

10.7 Migration Rules

Sebelum membuat migration:

1. Periksa tabel yang sudah tersedia.
2. Periksa relasi yang ada.
3. Periksa migration sebelumnya.
4. Tentukan dampak data.
5. Tambahkan constraints.
6. Tambahkan indexes yang relevan.
7. Periksa kompatibilitas migration.

Jangan melakukan destructive migration pada data produksi tanpa prosedur backup dan persetujuan.

11. BUSINESS RULES WAJIB PETORA

AI harus mempertahankan konsistensi aturan berikut.

11.1 Unified Billing

Semua layanan yang menghasilkan tagihan harus dapat dihubungkan dengan sistem billing.

Contoh sumber tagihan:

- POS.
- Clinic consultation.
- Medication.
- Laboratory.
- Grooming.
- Boarding.
- Hospitalization.
- Surgery.
- Additional services.

Setiap sumber harus memiliki hubungan yang dapat ditelusuri dengan invoice atau invoice item.

Pastikan:

- Tidak terjadi double billing.
- Pembuatan invoice dapat ditelusuri.
- Transaksi terkait diproses secara atomik bila diperlukan.
- Source reference bersifat idempotent.
- Perubahan status tidak merusak histori.

11.2 Payment

Payment harus mendukung:

- Cash.
- Bank transfer.
- QRIS atau payment gateway jika integrasi tersedia.
- Card payment jika tersedia.
- Split payment bila diperlukan.
- Partial payment bila diizinkan.
- Refund dan reversal.

Webhook payment harus:

- Memverifikasi signature.
- Memeriksa status transaksi.
- Memproses event secara idempotent.
- Mencatat payload yang relevan dengan aman.
- Tidak mempercayai callback hanya berdasarkan request body.

11.3 Inventory

Semua transaksi stok harus menghasilkan histori.

Contoh:

- Purchase receiving.
- POS sales.
- Return.
- Transfer.
- Adjustment.
- Expiry.
- Damage.
- Consumption for clinic.
- Internal usage.

Periksa concurrency agar dua pengguna tidak mengurangi stok yang sama melebihi jumlah tersedia.

11.4 Scheduling

Appointment harus memiliki aturan:

- Availability.
- Resource assignment.
- Staff assignment.
- Branch.
- Service duration.
- Conflict checking.
- Cancellation.
- Rescheduling.
- Status lifecycle.

11.5 Customer and Pet

Customer dan pet profile merupakan shared data untuk modul terkait.

Hindari membuat customer atau pet duplikat hanya karena transaksi berasal dari modul berbeda.

12. BACKEND CODING STANDARDS

12.1 Naming

Gunakan:

- PascalCase untuk class.
- camelCase untuk method dan variable.
- snake_case untuk database columns.
- English untuk nama identifier.
- Bahasa Indonesia untuk label UI bila sesuai.

Contoh:

class CreateInvoiceAction
{
    public function execute(array $data): Invoice
    {
        // Business logic
    }
}

12.2 Backend Rules

- Gunakan Form Requests atau mekanisme validasi terstruktur.
- Gunakan Policies dan Gates untuk authorization.
- Gunakan database transactions untuk operasi atomik.
- Gunakan queue untuk proses berat atau asynchronous.
- Gunakan exception yang jelas.
- Hindari business logic di controller.
- Hindari query N+1.
- Gunakan eager loading jika diperlukan.
- Gunakan pagination untuk daftar data besar.
- Hindari return data sensitif dari API.
- Gunakan explicit response contract.
- Gunakan idempotency untuk operasi yang dapat dikirim ulang.

12.3 Service and Action Rules

Gunakan Action untuk operasi bisnis yang jelas.

Gunakan Service jika terdapat proses yang digunakan bersama oleh beberapa bagian.

Jangan membuat class hanya untuk membungkus satu baris kode tanpa manfaat.

Setiap operasi penting harus memiliki input, output, dan failure behavior yang jelas.

13. FRONTEND CODING STANDARDS

13.1 React Rules

- Gunakan React dengan TypeScript.
- Hindari "any" kecuali benar-benar diperlukan dan diberi alasan.
- Gunakan reusable components.
- Gunakan hooks untuk reusable UI logic.
- Pisahkan page-level component dan feature component.
- Hindari komponen raksasa.
- Gunakan loading, empty, error, dan success states.
- Pastikan form memiliki validation feedback.
- Pastikan aksi berisiko memiliki confirmation.
- Hindari duplikasi state server dan client tanpa alasan.
- Hindari prop drilling yang tidak perlu.

13.2 Component Structure

Contoh:

resources/js/features/inventory/
├── components/
├── hooks/
├── schemas/
├── types/
├── services/
└── utils/

13.3 UI Standards

Seluruh modul harus mengikuti satu design system.

Komponen umum yang perlu distandardisasi:

- Button.
- Input.
- Select.
- Date picker.
- Dialog.
- Drawer.
- Dropdown.
- Data table.
- Pagination.
- Tabs.
- Badge.
- Status indicator.
- Alert.
- Toast.
- Form field.
- Search.
- Filter.
- Empty state.
- Loading skeleton.
- Confirmation dialog.

13.4 UX Requirements

Setiap halaman operasional harus memperhatikan:

- Kecepatan input.
- Jumlah klik.
- Navigasi yang konsisten.
- Responsif untuk desktop dan tablet.
- Informasi penting mudah ditemukan.
- Feedback yang jelas setelah aksi.
- Pencegahan double submission.
- Konfirmasi sebelum aksi destruktif.
- Accessibility dasar.
- Keyboard usability jika relevan.

Jangan membuat UI yang hanya bagus secara visual tetapi tidak praktis untuk staf.

14. API DAN INTEGRATION RULES

Setiap API atau integration contract harus terdokumentasi.

Dokumentasi minimal mencakup:

- Endpoint.
- HTTP method.
- Authentication.
- Permission.
- Request schema.
- Response schema.
- Validation.
- Error codes.
- Pagination.
- Filtering.
- Idempotency.
- Rate limits jika diperlukan.

External integrations harus menggunakan adapter atau interface yang jelas.

Jangan mencampur business logic inti dengan detail provider eksternal.

Jika provider gagal:

- Tangani error.
- Simpan status yang dapat ditelusuri.
- Gunakan retry hanya untuk operasi yang aman diulang.
- Jangan membuat transaksi ganda.
- Berikan informasi yang dapat dipahami pengguna.

15. SECURITY REQUIREMENTS

Security bukan fitur opsional.

AI wajib memperhatikan:

15.1 Authentication

- Password hashing menggunakan mekanisme aman.
- Session management yang benar.
- Secure cookie configuration.
- CSRF protection sesuai arsitektur.
- Rate limiting untuk endpoint sensitif.
- Mekanisme reset password yang aman.
- Logout dan session invalidation.

15.2 Authorization

- Role-based permissions.
- Branch-scoped permissions.
- Policy enforcement di backend.
- Principle of least privilege.
- Tidak mengandalkan hidden menu di frontend.
- Pengujian akses lintas cabang.

15.3 Data Protection

- Validasi semua input.
- Escape output sesuai konteks.
- Proteksi SQL injection.
- Proteksi mass assignment.
- Proteksi file upload.
- Validasi MIME type dan ukuran file.
- Secret tidak boleh masuk repository.
- Data sensitif tidak boleh ditulis ke log sembarangan.

15.4 Audit Trail

Audit log harus tersedia untuk aktivitas penting:

- Login.
- Perubahan permission.
- Transaksi keuangan.
- Perubahan stok.
- Refund.
- Penghapusan atau pembatalan.
- Perubahan medical record.
- Perubahan konfigurasi.
- Aktivitas administrator.

Audit trail harus dapat menjawab siapa melakukan apa, kapan, terhadap data apa, dan melalui konteks apa.

15.5 Security Review

Sebelum release, AI harus memeriksa:

- Authentication bypass.
- Authorization bypass.
- IDOR.
- CSRF.
- XSS.
- SQL injection.
- Mass assignment.
- Sensitive data exposure.
- File upload vulnerabilities.
- Insecure direct object references.
- Webhook spoofing.
- Session misconfiguration.
- Dependency vulnerabilities.
- Unsafe debug configuration.

16. TESTING GOVERNANCE

Tidak ada fitur yang dinyatakan selesai hanya karena halaman berhasil dibuka.

16.1 Testing Levels

Unit Tests

Untuk:

- Business calculations.
- Validation rules.
- Pricing.
- Tax calculations.
- Inventory calculations.
- Permission logic.
- Status transitions.

Feature Tests

Untuk:

- HTTP endpoints.
- Database operations.
- Authorization.
- Invoice workflows.
- Payment workflows.
- Stock movements.
- Customer and pet workflows.

Integration Tests

Untuk:

- POS to billing.
- Clinic to billing.
- Grooming to billing.
- Boarding to billing.
- Payment to invoice.
- Procurement to inventory.
- Inventory to finance.
- Notification integrations.

End-to-End Tests

Untuk workflow operasional utama dari awal hingga akhir.

16.2 Minimum Test Scenarios

AI harus menguji kondisi:

- Normal success.
- Invalid input.
- Unauthorized access.
- Cross-branch access.
- Duplicate request.
- Concurrent request.
- Empty data.
- Missing related data.
- Database failure.
- External service failure.
- Cancelled transaction.
- Partial payment.
- Refund.
- Out-of-stock.
- Expired batch.

16.3 Test Rules

- Jangan menghapus test yang gagal tanpa investigasi.
- Jangan menonaktifkan assertion agar test lulus.
- Jangan menganggap mock sebagai bukti integrasi provider nyata.
- Gunakan test database.
- Hindari menyentuh data produksi.
- Laporkan test yang belum dapat dijalankan.

17. IMPLEMENTATION ROADMAP

AI wajib mengembangkan PETORA secara bertahap.

Phase 0 — Repository Foundation

Deliverables:

- Repository initialized.
- Project conventions.
- AI_AGENT.md.
- README.
- Environment example.
- Development setup.
- Dependency baseline.
- CI baseline.
- Folder structure.
- Initial architecture documentation.

Exit criteria:

- Aplikasi dapat dijalankan secara lokal.
- Developer dapat mengikuti setup guide.
- Test baseline dapat dijalankan.

Phase 1 — Core Foundation

Modules:

- Authentication.
- User management.
- Role and permission.
- Branch management.
- Business settings.
- Audit logging.
- Shared master data.

Exit criteria:

- Authentication berjalan.
- Permission berjalan.
- Branch scope berjalan.
- Audit log tercatat.

Phase 2 — Customer, Pet, Catalog

Modules:

- Customer.
- Pet.
- Product.
- Service catalog.
- Categories.
- Pricing.

Exit criteria:

- Data customer dan pet dapat dikelola.
- Catalog dapat digunakan modul transaksi.
- Relasi dan validasi konsisten.

Phase 3 — POS, Billing, Payment

Modules:

- POS.
- Invoice.
- Invoice items.
- Payments.
- Refund.
- Receipt.

Exit criteria:

- Transaksi POS menghasilkan invoice.
- Pembayaran memperbarui status invoice dengan benar.
- Split atau partial payment mengikuti aturan produk.
- Duplicate transaction dapat dicegah.

Phase 4 — Inventory and Procurement

Modules:

- Warehouse.
- Stock.
- Stock movements.
- Product batches.
- Purchase orders.
- Receiving.
- Supplier.
- Stock transfer.

Exit criteria:

- Stok memiliki ledger.
- Receiving memperbarui stok.
- Penjualan mengurangi stok.
- Transfer memiliki histori.
- Concurrency diperhitungkan.

Phase 5 — Clinic

Modules:

- Appointment.
- Consultation.
- Clinical records.
- Diagnosis.
- Treatment.
- Prescription.
- Laboratory.
- Hospitalization.
- Surgery.

Exit criteria:

- Medical workflow dapat diselesaikan.
- Catatan medis memiliki histori.
- Layanan klinik terhubung dengan billing.
- Permission klinis berjalan.

Phase 6 — Grooming, Boarding, Scheduling

Exit criteria:

- Booking dapat dikelola.
- Resource dan staff assignment berjalan.
- Konflik jadwal dapat dicegah.
- Layanan terhubung dengan billing.

Phase 7 — Finance, Reporting, HR

Exit criteria:

- Financial records dapat ditelusuri.
- Laporan memiliki dasar data yang konsisten.
- Komisi dan employee-related workflows mengikuti aturan bisnis.

Phase 8 — Customer Portal and Integrations

Modules:

- Customer PWA.
- Appointment booking.
- Pet information.
- Notifications.
- WhatsApp integration.
- Email integration.
- Payment integration.
- External integrations.

Exit criteria:

- Customer hanya dapat mengakses data miliknya.
- Integrasi memiliki error handling.
- Notification dapat ditelusuri.

Phase 9 — Production Readiness

Deliverables:

- Security audit.
- Performance testing.
- Backup and restore.
- Deployment scripts.
- Monitoring.
- Logging.
- Health checks.
- CI/CD.
- User acceptance testing.
- Release checklist.
- Production documentation.

18. DEFINITION OF DONE

Sebuah task hanya boleh berstatus DONE jika seluruh kriteria relevan terpenuhi.

18.1 Feature Done

- Requirement dipahami.
- Acceptance criteria terpenuhi.
- Backend selesai.
- Frontend selesai jika diperlukan.
- Authorization diterapkan.
- Validation diterapkan.
- Error handling diterapkan.
- Database migration tersedia jika diperlukan.
- Test tersedia.
- Test berhasil.
- Integrasi diperiksa.
- Dokumentasi diperbarui.
- Tidak ada known critical issue.

18.2 Module Done

- Semua feature utama modul selesai.
- Workflow end-to-end berhasil.
- Permission matrix diuji.
- Data integrity diuji.
- Integration contract tersedia.
- Regression tests tersedia.
- Dokumentasi modul lengkap.
- UI states lengkap.

18.3 Release Done

- Build production berhasil.
- Migration dapat dijalankan.
- Environment terdokumentasi.
- Secret tidak tersimpan di repository.
- Backup tersedia.
- Restore sudah diuji.
- Security review selesai.
- Smoke test selesai.
- Logging tersedia.
- Monitoring tersedia.
- Deployment guide lengkap.
- Rollback plan tersedia.
- Tidak ada blocker release.

AI tidak boleh menyatakan seluruh produk siap production jika masih ada fitur kritis yang belum diimplementasikan atau belum diverifikasi.

19. GIT DAN REPOSITORY GOVERNANCE

19.1 Git Rules

Gunakan branch yang jelas:

main
develop
feature/<module>-<feature>
fix/<issue>
hotfix/<issue>
docs/<topic>

Untuk solo developer, workflow dapat disederhanakan jika tidak membutuhkan banyak branch.

19.2 Commit Convention

Gunakan Conventional Commits:

feat: add customer management
fix: prevent duplicate invoice payment
docs: update database design
refactor: simplify inventory service
test: add stock movement tests
chore: update dependencies
perf: optimize invoice queries
security: enforce branch access policy

19.3 Repository Hygiene

Jangan commit:

- ".env".
- API keys.
- Private keys.
- Production database dumps.
- Temporary files.
- Build artifacts yang tidak diperlukan.
- Personal credentials.
- Sensitive customer data.

Pastikan ".gitignore" sesuai kebutuhan.

19.4 Pull Request or Change Summary

Setiap kumpulan perubahan harus menyertakan:

- Purpose.
- Changes.
- Files affected.
- Database impact.
- Security impact.
- Tests executed.
- Documentation updates.
- Known limitations.

20. ERROR HANDLING AND OBSERVABILITY

AI harus membangun sistem yang mudah didiagnosis ketika terjadi masalah.

Wajib memperhatikan:

- Structured logging.
- Application error logs.
- Queue failure monitoring.
- Database connectivity.
- Health checks.
- Scheduled task monitoring.
- External integration failures.
- Request correlation ID bila relevan.
- Operational status.

Jangan mengirimkan stack trace atau detail internal kepada pengguna akhir.

Pesan error harus membantu pengguna memahami tindakan selanjutnya tanpa membocorkan informasi sensitif.

21. PERFORMANCE GOVERNANCE

AI harus memperhatikan:

- Database indexes.
- N+1 queries.
- Pagination.
- Eager loading.
- Query efficiency.
- Cache strategy.
- Queue processing.
- Asset optimization.
- Lazy loading.
- Image optimization.
- Large report processing.
- Database connection management.

Jangan melakukan premature optimization.

Gunakan profiling atau bukti pengukuran sebelum membuat optimasi kompleks.

22. SELF-HOSTED DEPLOYMENT REQUIREMENTS

PETORA harus dapat dipasang di server milik pengguna.

22.1 Deployment Components

Baseline deployment:

- Linux server.
- Docker Engine.
- Docker Compose.
- Nginx.
- PHP application container.
- PostgreSQL.
- Redis jika digunakan.
- Queue worker.
- Scheduler.
- Persistent storage.
- TLS/HTTPS.

22.2 Deployment Documentation

"docs/DEPLOYMENT.md" harus menjelaskan:

1. Server prerequisites.
2. Supported environment.
3. Domain and DNS setup.
4. Docker installation.
5. Environment configuration.
6. Secret configuration.
7. Database setup.
8. Storage setup.
9. Application build.
10. Migration.
11. Initial administrator setup.
12. Queue worker.
13. Scheduler.
14. Web server.
15. HTTPS.
16. Health check.
17. Backup.
18. Restore.
19. Upgrade.
20. Rollback.
21. Troubleshooting.

22.3 Environment Variables

AI harus menyediakan ".env.example" tanpa secret nyata.

Contoh variabel:

APP_NAME=PETORA
APP_ENV=production
APP_DEBUG=false
APP_URL=https://your-domain.example

DB_CONNECTION=pgsql
DB_HOST=postgres
DB_PORT=5432
DB_DATABASE=petora
DB_USERNAME=petora

REDIS_HOST=redis
REDIS_PORT=6379

MAIL_MAILER=smtp
MAIL_HOST=
MAIL_PORT=
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_ENCRYPTION=
MAIL_FROM_ADDRESS=
MAIL_FROM_NAME=PETORA

QUEUE_CONNECTION=redis

Nama dan isi variabel final harus mengikuti konfigurasi aktual aplikasi.

22.4 Production Safety

- Debug harus nonaktif.
- HTTPS harus aktif.
- Secret harus aman.
- Database tidak boleh diekspos langsung ke internet.
- Backup harus terenkripsi bila memungkinkan.
- Backup harus diuji melalui restore.
- Container harus menggunakan konfigurasi yang aman.
- File permission harus benar.
- Log harus memiliki retention policy.
- Upgrade harus memiliki prosedur rollback.

23. BACKUP AND DISASTER RECOVERY

AI harus merancang:

- Database backup.
- File storage backup.
- Backup scheduling.
- Retention policy.
- Backup encryption.
- Off-site backup.
- Restore procedure.
- Disaster recovery procedure.

Jangan menganggap backup berhasil hanya karena file backup berhasil dibuat.

Lakukan restore test secara berkala pada environment non-production.

Dokumentasikan target RPO dan RTO setelah kebutuhan operasional disepakati.

24. RELEASE MANAGEMENT

Setiap release harus memiliki:

- Version number.
- Changelog.
- Migration notes.
- Feature summary.
- Known issues.
- Upgrade guide.
- Backup recommendation.
- Rollback guidance.

Gunakan semantic versioning jika sesuai dengan model distribusi produk.

Jangan menjalankan migration destruktif sebagai bagian dari upgrade tanpa rencana migrasi dan perlindungan data.

25. AI TASK RESPONSE FORMAT

Untuk pekerjaan yang kompleks, AI harus menggunakan format laporan berikut:

Task

Nama pekerjaan.

Objective

Hasil yang ingin dicapai.

Current Findings

Kondisi repository dan implementasi saat ini.

Implementation Plan

Langkah implementasi.

Changes

File yang dibuat, diubah, atau dihapus.

Database Impact

Perubahan tabel, relasi, migration, dan data.

Security Impact

Permission, validation, branch scope, dan risiko.

Testing

Test yang dijalankan dan hasil sebenarnya.

Documentation

Dokumen yang diperbarui.

Remaining Work

Hal yang belum selesai.

Status

Gunakan status:

- NOT STARTED
- IN PROGRESS
- BLOCKED
- NEEDS REVIEW
- DONE

Jangan menggunakan DONE jika quality gate belum terpenuhi.

26. RULES FOR LARGE TASKS

Jika developer meminta implementasi besar seperti satu modul lengkap:

1. Pecah menjadi subtask.
2. Identifikasi dependency.
3. Tentukan urutan pengerjaan.
4. Tentukan acceptance criteria.
5. Periksa apakah database sudah siap.
6. Periksa integrasi modul.
7. Implementasikan secara bertahap.
8. Jalankan test setiap tahap.
9. Perbarui dokumentasi.
10. Berikan laporan progres yang jujur.

Jangan membuat puluhan file sekaligus tanpa memahami kontrak dan relasinya.

Jangan mengubah seluruh arsitektur hanya untuk menyelesaikan satu task.

27. RULES FOR EXISTING CODEBASE

Jika repository sudah berisi kode:

1. Baca "AI_AGENT.md".
2. Baca "README.md".
3. Periksa struktur folder.
4. Periksa dependency.
5. Periksa environment configuration.
6. Periksa migration.
7. Periksa routes.
8. Periksa models.
9. Periksa policies.
10. Periksa tests.
11. Periksa dokumentasi.
12. Buat ringkasan kondisi aktual.

Jangan melakukan rewrite seluruh aplikasi tanpa alasan yang kuat.

Prioritaskan perbaikan bertahap dan backward compatibility.

Sebelum menghapus atau mengganti implementasi yang sudah berjalan, periksa seluruh pemanggil dan dependensinya.

28. AI AUTONOMY AND APPROVAL POLICY

AI boleh melanjutkan sendiri untuk pekerjaan berisiko rendah dan dapat dibalik.

Contoh:

- Membuat dokumentasi.
- Membuat unit tests.
- Membuat reusable UI components.
- Memperbaiki typo.
- Refactoring lokal yang terukur.
- Menambah validasi yang sudah ditentukan requirement.
- Memperbaiki bug dengan cakupan jelas.

AI harus meminta persetujuan untuk keputusan berisiko tinggi:

- Menghapus data.
- Mengubah data produksi.
- Destructive database migration.
- Mengganti teknologi utama.
- Mengubah autentikasi secara besar.
- Mengubah permission model.
- Mengubah financial business rules.
- Mengubah medical record lifecycle.
- Mengubah deployment production.
- Mengirim komunikasi eksternal atas nama bisnis.
- Melakukan tindakan yang tidak dapat dibalik.

Jangan meminta persetujuan untuk setiap perubahan file kecil. Gunakan penilaian risiko dan dampak.

29. DEFINITION OF PRODUCTION READY

PETORA hanya dapat dinyatakan Production Ready jika:

Product

- Modul inti selesai.
- Workflow operasional utama berjalan.
- Business rules terdokumentasi.
- Acceptance criteria terpenuhi.

Engineering

- Backend stabil.
- Frontend stabil.
- Database migration lengkap.
- Integrasi antarmodul berjalan.
- Automated tests tersedia.
- Build production berhasil.

Security

- Authentication dan authorization diuji.
- Branch isolation diuji.
- Secret management aman.
- Security review selesai.
- Critical vulnerabilities tidak diketahui atau belum terselesaikan.

Operations

- Deployment dapat direproduksi.
- HTTPS tersedia.
- Database backup tersedia.
- Restore berhasil diuji.
- Monitoring dan logging tersedia.
- Queue dan scheduler berjalan.
- Rollback plan tersedia.

Documentation

- README lengkap.
- Architecture lengkap.
- Database design lengkap.
- API documentation lengkap.
- User workflows terdokumentasi.
- Deployment guide lengkap.
- Backup and restore guide lengkap.
- Release notes tersedia.

Acceptance

- UAT berhasil.
- Smoke test berhasil.
- Tidak ada blocker kritis.
- Seluruh known limitations dicatat.
- Developer menyetujui release.

30. MASTER EXECUTION COMMAND

Ketika developer memberikan instruksi:

"Mulai pengembangan PETORA INDONESIA dari tahap awal sampai siap production berdasarkan AI_AGENT.md."

AI harus menjalankan proses berikut secara berurutan:

Stage A — Repository Discovery

- Memeriksa repository.
- Memeriksa file dan dependency.
- Mengidentifikasi kode yang sudah tersedia.
- Membuat repository assessment.
- Mengidentifikasi gap.

Stage B — Product Documentation

- Menyusun product vision.
- Menyusun master specification.
- Menyusun requirements.
- Menyusun module specifications.
- Menyusun acceptance criteria.

Stage C — Architecture and Database

- Menyusun architecture.
- Menyusun module boundaries.
- Menyusun ERD.
- Menyusun database schema.
- Menyusun indexes dan constraints.
- Menyusun authorization matrix.
- Menyusun integration contracts.

Stage D — UX and Design System

- Menyusun navigation.
- Menyusun page inventory.
- Menyusun user flows.
- Menyusun design system.
- Menyusun responsive rules.
- Menyusun UI implementation plan.

Stage E — Foundation Implementation

- Menyiapkan backend.
- Menyiapkan frontend.
- Menyiapkan database.
- Menyiapkan authentication.
- Menyiapkan authorization.
- Menyiapkan branch management.
- Menyiapkan audit logging.
- Menyiapkan test framework.

Stage F — Module Implementation

- Mengimplementasikan modul berdasarkan dependency.
- Menambahkan backend.
- Menambahkan frontend.
- Menambahkan migrations.
- Menambahkan tests.
- Menambahkan integrations.
- Memperbarui dokumentasi.

Stage G — System Integration

- Menghubungkan seluruh modul.
- Memastikan unified billing.
- Memastikan inventory integration.
- Memastikan finance integration.
- Memastikan scheduling integration.
- Memastikan notifications.
- Memastikan customer portal.

Stage H — Quality Assurance

- Unit tests.
- Feature tests.
- Integration tests.
- End-to-end tests.
- Regression tests.
- Security review.
- Performance review.
- User acceptance testing.

Stage I — Deployment Preparation

- Docker production configuration.
- Nginx configuration.
- Environment setup.
- Database migration procedure.
- Queue worker.
- Scheduler.
- HTTPS.
- Backup and restore.
- Monitoring.
- Logging.
- Rollback.

Stage J — Final Release

- Production build.
- Final test.
- Release notes.
- Deployment guide.
- Known limitations.
- Final checklist.
- Developer approval.

AI tidak boleh melompati tahap yang memiliki dependency penting. Setiap stage harus memiliki deliverables dan exit criteria.

31. FINAL DIRECTIVE

AI Agent harus selalu mengingat bahwa PETORA INDONESIA bukan sekadar kumpulan halaman CRUD.

PETORA adalah sistem operasional bisnis yang mengelola data customer, hewan, stok, transaksi keuangan, pelayanan klinik, serta aktivitas karyawan.

Karena itu:

- Integritas data lebih penting daripada kecepatan menghasilkan kode.
- Business logic lebih penting daripada sekadar tampilan UI.
- Security harus diterapkan di backend.
- Semua transaksi harus dapat ditelusuri.
- Semua modul harus memiliki kontrak integrasi yang jelas.
- Dokumentasi harus sesuai implementasi.
- Test harus menjadi bagian dari proses development.
- Deployment harus dapat direproduksi.
- Tidak boleh ada klaim selesai tanpa bukti verifikasi.

Tujuan akhir AI Agent adalah membantu menghasilkan PETORA INDONESIA sebagai produk yang benar-benar dapat digunakan, dikelola, dikembangkan, dipasang pada server sendiri, dan dipelihara dalam jangka panjang.

---

END OF AI_AGENT.md

Project: PETORA INDONESIA
Document: Master AI Development Governance
Status: Initial Baseline — Subject to Versioned Updates
