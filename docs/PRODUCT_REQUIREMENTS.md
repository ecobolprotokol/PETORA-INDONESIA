# Kebutuhan Produk PETORA INDONESIA

- Status: Draft baseline untuk tinjauan produk
- Sumber: `AI_AGENT.md`; tidak ada sumber kebutuhan lain di repository saat dokumen ini dibuat.
- Prioritas: tidak ditetapkan selain urutan fase pada `AI_AGENT.md`; dokumen ini tidak menambahkan ranking bisnis.
- Status requirement: **Baseline** berarti kebutuhan eksplisit di instruksi; **Roadmap** berarti tercantum sebagai arah fase tetapi rincian/availability belum diputuskan; **TBD** berarti perlu keputusan pemilik produk.

## Cara Membaca

ID requirement stabil untuk traceability. Acceptance criteria di bawah bersifat observable namun tidak menetapkan angka/policy yang belum diketahui. Kebutuhan ini bukan spesifikasi schema/API. Detail per modul dan keputusan terbuka ada di `docs/modules/*/SPECIFICATION.md`.

## Kebutuhan Lintas Modul

| ID | Status | Kebutuhan | Bukti penerimaan tingkat produk |
|---|---|---|---|
| REQ-X-01 | Baseline | Sistem adalah modular monolith untuk satu bisnis per instalasi, mendukung banyak cabang, bukan SaaS multi-tenant baseline. | Arsitektur dan authorization menerapkan batas instalasi/cabang tanpa tenant_id generik pada semua tabel. |
| REQ-X-02 | Baseline | Backend memvalidasi input dan menegakkan authentication, authorization, serta branch scope. | Test menolak input invalid, akses tanpa hak, dan akses lintas cabang yang tidak diizinkan. |
| REQ-X-03 | Baseline | Transaksi uang dan stok menjaga konsistensi, histori, dan idempotency pada operasi yang dapat diulang. | Test duplicate/concurrent/failure membuktikan tidak ada pencatatan parsial atau transaksi ganda. |
| REQ-X-04 | Baseline | Perubahan penting dapat diaudit; medical record finalized tidak berubah tanpa jejak. | Audit/amendment menunjukkan actor, waktu, objek dan konteks yang disepakati. |
| REQ-X-05 | Baseline | Customer dan pet merupakan shared data lintas modul. | Workflow lintas modul memakai referensi profil yang sama; aturan deduplikasi final disepakati. |
| REQ-X-06 | Baseline | Dokumentasi disinkronkan dengan implementasi; fitur hanya Done setelah acceptance dan test relevan lulus. | Review perubahan menunjukkan requirement, test, dan dokumentasi sesuai behavior aktual. |

## Kebutuhan per Modul

### Core (`docs/modules/core/SPECIFICATION.md`)
| ID | Status | Kebutuhan dan acceptance |
|---|---|---|
| REQ-CORE-01 | Baseline | Sistem menyediakan authentication dan pengelolaan user. Acceptance: alur autentikasi dapat diuji dan akses tidak sah ditolak. |
| REQ-CORE-02 | Baseline | Role/permission, business settings, dan audit logging menjadi fondasi. Acceptance: policy diterapkan backend dan aktivitas sensitif yang disepakati mempunyai jejak audit. |

### Branches (`docs/modules/branches/SPECIFICATION.md`)
| ID | Status | Kebutuhan dan acceptance |
|---|---|---|
| REQ-BRN-01 | Baseline | Pengguna hanya mengakses cabang yang diizinkan; akses lintas cabang ditentukan eksplisit. Acceptance: test positif dan negatif membuktikan isolasi backend. |
| REQ-BRN-02 | Baseline | Entitas operasional yang relevan mempunyai konteks cabang. Acceptance: workflow lintas cabang tidak terjadi tanpa aturan/permission eksplisit. |

### Customers (`docs/modules/customers/SPECIFICATION.md`)
| ID | Status | Kebutuhan dan acceptance |
|---|---|---|
| REQ-CUS-01 | Baseline | Profil customer dikelola sebagai data bersama. Acceptance: modul transaksi dapat menautkan customer yang sama. |
| REQ-CUS-02 | TBD | Deduplikasi, merge, field wajib, consent, retensi, dan penghapusan harus ditetapkan. Acceptance: aturan disetujui dan test kasus duplikat/privasi tersedia sebelum rilis. |

### Pets (`docs/modules/pets/SPECIFICATION.md`)
| ID | Status | Kebutuhan dan acceptance |
|---|---|---|
| REQ-PET-01 | Baseline | Profil pet terkait customer dan digunakan lintas modul. Acceptance: clinic/booking/transaksi merujuk profil yang sama. |
| REQ-PET-02 | Baseline | Histori medis yang finalized dilindungi dari perubahan tanpa jejak. Acceptance: correction/amendment tercatat, bukan hard delete diam-diam. |

### Catalog (`docs/modules/catalog/SPECIFICATION.md`)
| ID | Status | Kebutuhan dan acceptance |
|---|---|---|
| REQ-CAT-01 | Roadmap | Catalog produk, service, kategori, dan pricing dapat digunakan modul transaksi. Acceptance: transaksi merujuk item catalog yang konsisten. |
| REQ-CAT-02 | TBD | Price effective date, pajak, diskon, varian, dan perubahan harga pada transaksi harus disepakati. |

### Inventory (`docs/modules/inventory/SPECIFICATION.md`)
| ID | Status | Kebutuhan dan acceptance |
|---|---|---|
| REQ-INV-01 | Baseline | Seluruh perubahan stok menghasilkan stock movement; angka stok tidak diedit tanpa histori. Acceptance: saldo dapat ditelusuri ke ledger. |
| REQ-INV-02 | Baseline | Movement mendukung konteks product, warehouse, quantity, type, source, user, timestamp, dan batch/expiry bila berlaku. |
| REQ-INV-03 | Baseline | FEFO dipakai untuk pemilihan batch bila relevan; costing FIFO/weighted average adalah keputusan terpisah. Acceptance: algoritma yang dipilih terdokumentasi dan teruji. |
| REQ-INV-04 | Baseline | Concurrency diperhitungkan agar konsumsi paralel tidak melampaui stok yang tersedia menurut policy. Acceptance: test concurrent dan out-of-stock lulus. |

### Procurement (`docs/modules/procurement/SPECIFICATION.md`)
| ID | Status | Kebutuhan dan acceptance |
|---|---|---|
| REQ-PROC-01 | Roadmap | Supplier, purchase order, receiving, transfer terkait, dan proses pengadaan tersedia. Acceptance: receiving yang disetujui menghasilkan stock movement terlacak. |
| REQ-PROC-02 | TBD | Approval, partial receipt, cancellation, return, dan penilaian biaya ditetapkan sebelum implementasi. |

### POS (`docs/modules/pos/SPECIFICATION.md`)
| ID | Status | Kebutuhan dan acceptance |
|---|---|---|
| REQ-POS-01 | Roadmap | POS menjual produk/layanan dan menghubungkan hasil transaksi ke billing. Acceptance: sale memiliki referensi invoice tanpa double billing. |
| REQ-POS-02 | Baseline | Penjualan stok menghasilkan pergerakan stok dengan referensi sumber dan aman terhadap duplicate/concurrent submission. |

### Billing (`docs/modules/billing/SPECIFICATION.md`)
| ID | Status | Kebutuhan dan acceptance |
|---|---|---|
| REQ-BILL-01 | Baseline | Billing menerima sumber POS, clinic, medication, laboratory, grooming, boarding, hospitalization, surgery, dan additional services. Acceptance: source dapat ditelusuri ke invoice/item. |
| REQ-BILL-02 | Baseline | Source reference idempotent; invoice/payment lifecycle tidak kehilangan histori. Acceptance: pengiriman ulang source tidak membuat tagihan ganda. |
| REQ-BILL-03 | TBD | Aturan invoice numbering, tax, discount, void, credit note, dan rounding menunggu keputusan. |

### Payments (`docs/modules/payments/SPECIFICATION.md`)
| ID | Status | Kebutuhan dan acceptance |
|---|---|---|
| REQ-PAY-01 | Baseline | Payment tercatat dan memperbarui invoice secara konsisten; dukung metode yang disepakati dari cash, transfer, QRIS/gateway bila integrasi tersedia, atau kartu bila tersedia. |
| REQ-PAY-02 | Baseline/TBD | Partial/split payment, refund, reversal harus memiliki lifecycle; izin dan policy bisnis masih perlu persetujuan. Acceptance: test status, duplicate, refund/reversal. |
| REQ-PAY-03 | Baseline | Webhook memverifikasi signature/status, idempotent, dan mencatat payload relevan secara aman. Acceptance: spoofed/duplicate callback tidak mengubah pembayaran secara tidak sah. |

### Clinic (`docs/modules/clinic/SPECIFICATION.md`)
| ID | Status | Kebutuhan dan acceptance |
|---|---|---|
| REQ-CLI-01 | Roadmap | Mendukung appointment, consultation, clinical record, diagnosis, treatment, prescription, laboratory, hospitalization, dan surgery melalui workflow klinis yang disetujui. |
| REQ-CLI-02 | Baseline | Catatan finalized memiliki histori koreksi dan akses klinis dibatasi. Acceptance: test lifecycle dan authorization disetujui. |
| REQ-CLI-03 | Baseline | Layanan klinik terkait dengan billing dan medication/consumption dapat terkait inventory. Acceptance: source traceable dan tidak double billed. |

### Laboratory (`docs/modules/laboratory/SPECIFICATION.md`)
| ID | Status | Kebutuhan dan acceptance |
|---|---|---|
| REQ-LAB-01 | Roadmap | Workflow laboratory terhubung ke clinic/pet dan unified billing. Acceptance: permintaan/hasil yang disepakati dapat ditelusuri ke pasien dan source invoice. |
| REQ-LAB-02 | TBD | Test catalog, sample workflow, result validation, sign-off, external lab, dan retensi hasil belum ditentukan. |

### Hospitalization (`docs/modules/hospitalization/SPECIFICATION.md`)
| ID | Status | Kebutuhan dan acceptance |
|---|---|---|
| REQ-HOSP-01 | Roadmap | Hospitalization dan surgery terkait pet/clinic, billing, serta inventory consumption bila ada. Acceptance: lifecycle yang disepakati diuji end-to-end. |
| REQ-HOSP-02 | TBD | Kapasitas, bed/resource, consent, observation, discharge, dan clinical sign-off perlu validasi klinis. |

### Grooming (`docs/modules/grooming/SPECIFICATION.md`)
| ID | Status | Kebutuhan dan acceptance |
|---|---|---|
| REQ-GROOM-01 | Roadmap | Grooming mengelola layanan terjadwal dan dapat menghasilkan billing. Acceptance: service source tertaut ke invoice dan konflik jadwal ditangani. |
| REQ-GROOM-02 | TBD | Paket, durasi, resource, deposit, cancellation, dan catatan kondisi pet ditetapkan bersama pengguna. |

### Boarding (`docs/modules/boarding/SPECIFICATION.md`)
| ID | Status | Kebutuhan dan acceptance |
|---|---|---|
| REQ-BOARD-01 | Roadmap | Boarding mengelola layanan/booking dan menautkan biaya ke billing. Acceptance: booking dan source charge ditelusuri. |
| REQ-BOARD-02 | TBD | Kapasitas, check-in/out, tarif, deposit, feeding/medication, incident, dan cancellation perlu disepakati. |

### Scheduling (`docs/modules/scheduling/SPECIFICATION.md`)
| ID | Status | Kebutuhan dan acceptance |
|---|---|---|
| REQ-SCH-01 | Baseline | Appointment mempertimbangkan availability, resource, staff, branch, duration, conflict, cancel, reschedule, dan status lifecycle. |
| REQ-SCH-02 | TBD | Definisi availability, slotting, conflict precedence, timezone, dan cancellation policy disetujui serta diuji. |

### Finance (`docs/modules/finance/SPECIFICATION.md`)
| ID | Status | Kebutuhan dan acceptance |
|---|---|---|
| REQ-FIN-01 | Roadmap | Catatan keuangan dapat ditelusuri ke transaksi sumber; nilai uang tidak dihitung dengan floating point. Acceptance: rekonsiliasi sumber dan histori diuji. |
| REQ-FIN-02 | TBD | Chart of accounts, posting, tax, period close, cash management, dan accounting scope memerlukan keputusan. |

### Employees (`docs/modules/employees/SPECIFICATION.md`)
| ID | Status | Kebutuhan dan acceptance |
|---|---|---|
| REQ-EMP-01 | Roadmap | Employee management mendukung kebutuhan operasional dan role/staff assignment yang ditetapkan. Acceptance: relasi staf ke cabang/assignment mematuhi authorization. |
| REQ-EMP-02 | TBD | Data HR, jadwal kerja, komisi, payroll, dan data sensitif tidak dianggap masuk scope sebelum disetujui. |

### Notifications (`docs/modules/notifications/SPECIFICATION.md`)
| ID | Status | Kebutuhan dan acceptance |
|---|---|---|
| REQ-NOTIF-01 | Roadmap | Notifikasi dapat dikirim dan ditelusuri sesuai event serta channel yang disepakati. Acceptance: failure/retry aman dan tidak menggandakan efek bisnis. |
| REQ-NOTIF-02 | TBD | Channel, consent, template, opt-out, delivery status, provider, dan retensi ditetapkan sebelum integrasi. |

### Customer Portal (`docs/modules/customer-portal/SPECIFICATION.md`)
| ID | Status | Kebutuhan dan acceptance |
|---|---|---|
| REQ-PORTAL-01 | Roadmap | Portal customer menyediakan kemampuan customer yang ditetapkan, termasuk appointment booking, informasi pet, dan notifikasi sesuai roadmap. |
| REQ-PORTAL-02 | Baseline | Customer hanya dapat mengakses data miliknya. Acceptance: IDOR/cross-customer tests menolak akses yang tidak sah. |
| REQ-PORTAL-03 | TBD | Authentication, pet ownership/shared guardian, perubahan data, dan workflow booking harus disepakati. |

### Reports (`docs/modules/reports/SPECIFICATION.md`)
| ID | Status | Kebutuhan dan acceptance |
|---|---|---|
| REQ-RPT-01 | Roadmap | Reports/analytics disusun dari transaksi dan data sumber yang konsisten. Acceptance: definisi metrik dapat ditelusuri ke sumber dan hasil diuji. |
| REQ-RPT-02 | Baseline | Akses laporan memperhatikan permission dan branch scope backend. Acceptance: filter UI tidak dapat membuka data cabang lain. |
| REQ-RPT-03 | TBD | KPI, definisi waktu, ekspor, retention, dan kebutuhan performa laporan disetujui. |

## Kebutuhan Non-Fungsional

| ID | Kebutuhan | Acceptance |
|---|---|---|
| REQ-NF-01 | Security by default: validasi backend, least privilege, session/authentication aman, perlindungan CSRF/XSS/SQL injection/mass assignment/file upload. | Security review dan test yang relevan tidak menunjukkan bypass kritis yang belum ditangani. |
| REQ-NF-02 | Integritas dan audit untuk uang, stok, medical records, dan perubahan administratif. | Unit/feature/integration tests menutup success, invalid, unauthorized, duplicate, concurrent, dan failure path terkait. |
| REQ-NF-03 | Self-hosted deployment dapat direproduksi pada Linux dengan baseline Docker/Compose, Nginx, TLS, persistent storage, dan komponen yang benar-benar digunakan. | Deployment staging dan backup/restore test terdokumentasi; tidak ada klaim production sebelum semua gate lulus. |
| REQ-NF-04 | Observability mencakup structured logs, health checks, queue/scheduler dan integrasi eksternal yang digunakan. | Kegagalan operasional dapat didiagnosis tanpa membocorkan data sensitif. |
| REQ-NF-05 | Performa memakai pagination, query yang efisien, dan optimasi berbasis pengukuran. | Target metrik ditetapkan sebelum performance acceptance; tidak mengklaim target yang belum disetujui. |
| REQ-NF-06 | Maintainability untuk solo developer dan modular monolith. | Batas modul, konvensi, test, dan dokumentasi dapat ditinjau; tidak ada microservices/abstraksi tanpa alasan dan persetujuan. |

## Keputusan Terbuka yang Memblokir Finalisasi

Tidak ada persetujuan bisnis atau data historis pada repository untuk mengisi detail yang ditandai TBD. Sebelum implementasi modul terkait, pemilik produk perlu menyetujui: MVP; lifecycle dan approval; pricing/tax/currency/rounding; payment/refund; inventory costing/negative stock; data privacy/retention; clinical workflow; kapasitas/booking; role/permission; provider integrations; finance/report definitions; dan target nonfunctional. Requirement berubah menjadi final setelah keputusan direkam dan dokumen terkait diperbarui.
