# DOKUMEN ARSITEKTUR & RENCANA PENGERJAAN
# MODUL SALESMANSHIP (REKAP CALLSHEET HARIAN & LAPORAN RIS)

**Proyek:** HSERA Platform  
**Komponen Terlibat:**
- `hsera-auth-backend` (Layanan Otoritas, SSO, ACL, Karyawan & Operation Unit)
- `hsera-salesmanship-backend` (Layanan Domain Salesmanship & Transaksi RIS - Database Terpisah)
- `hsera-dashboard` (Frontend Tunggal React + Vite di `src/presentation/pages/Salesmanship/`)

---

## 1. Ringkasan Eksekutif & Prinsip Desain

Sistem Salesmanship mengotomatisasi rekap callsheet harian salesman (kunjungan toko/outlet rokok) menjadi pelaporan performa mingguan (format RIS YYWW ISO 8601), bulanan, dan evaluasi target. Sesuai spesifikasi **Rancangan Sistem Inputan RIS Revisi 5**:
1. **Input Global per Salesman per Hari**: Tanpa master data outlet mikro; input berupa rekapitulasi angka per brand per hari dari callsheet fisik/lapangan.
2. **Database & Service Mandiri**: `hsera-salesmanship-backend` berdiri sendiri dengan database PostgreSQL khusus (`hsera_salesmanship`), terpisah dari database auth.
3. **Penyelarasan Role Management**: Terhubung langsung dengan `hsera-auth-backend` untuk verifikasi token JWT, pembatasan hak akses berbasis level menu (ACL Level 1-4), pembatasan teritori berbasis Operation Unit (Unit Operasi), dan lookup data profil Salesman.
4. **Satu Kesatuan Frontend**: Seluruh antarmuka disatukan di `hsera-dashboard` dalam satu menu Header **"Salesmanship"** yang membawahi 4 submenu utama.

---

## 2. Struktur Menu & Role Management Framework

### 2.1 Pendaftaran Menu di `hsera-auth-backend`
Di tabel `menu`, didaftarkan 1 Menu Header dan 4 Submenu Detail:

| Menu UUID | Nama Menu | Upline UUID | Tipe | Link URL Path | Icon |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `d1000000-0000-4000-d000-000000000010` | **Salesmanship** | `NULL` | `Header` | `salesmanship` | `TrendingUp` |
| `d1000000-0000-4000-d000-000000000011` | **Teritori Management** | `...0010` | `Detail` | `salesmanship/territory` | `MapPin` |
| `d1000000-0000-4000-d000-000000000012` | **Setup Target** | `...0010` | `Detail` | `salesmanship/target` | `Target` |
| `d1000000-0000-4000-d000-000000000013` | **Form Callsheet** | `...0010` | `Detail` | `salesmanship/callsheet` | `FileText` |
| `d1000000-0000-4000-d000-000000000014` | **Monitoring Callsheet** | `...0010` | `Detail` | `salesmanship/monitoring` | `BarChart3` |

### 2.2 Hak Akses (Matrix ACL Levels)
Mengikuti standar Framework V1:
- **Level 1 (View / Read)**: Melihat data, daftar, filter, pencarian, dan laporan.
- **Level 2 (Create / Input)**: Menambah data baru, input rekap callsheet harian.
- **Level 3 (Update / Edit)**: Mengubah data existing (sebelum minggu dikunci).
- **Level 4 (Delete / Super Action)**: Menghapus data (soft-delete status `NONAKTIF`), serta kewenangan **Kunci dan Buka Kunci Minggu** (`sys_kunci_minggu`).

### 2.3 Pemetaan Peran (Role Mapping)

| Peran Pengguna | Teritori Management | Setup Target | Form Callsheet | Monitoring Callsheet |
| :--- | :---: | :---: | :---: | :---: |
| **Super Admin (SA) / HO Admin** | Level 4 (Full) | Level 4 (Full) | Level 4 (Full) | Level 4 (Termasuk Kunci/Buka) |
| **Petugas Rekap Cabang** | Level 1 (Read) | Level 1 (Read) | Level 3 (Input & Edit Draft) | Level 1 (Cek Kelengkapan Cabang) |
| **Supervisor Cabang** | Level 1 (Read) | Level 1 (Read) | Level 1 (Review) | Level 1 (Monitoring, Pantau Anomali) |
| **Manajer / Executive Viewer** | Level 1 (Read) | Level 1 (Read) | Level 1 (Read) | Level 1 (Laporan & Capaian Target) |

### 2.4 Pembatasan Wilayah Operasi (Operation Unit Scoping)
Sesuai **FR-20** dan arsitektur `UserScopeContext`:
- Token JWT memuat `scope: { allowedUnitIds, isSuperAdmin, unitCode }`.
- **Super Admin**: Dapat melihat & memilih seluruh Unit Operasi nasional.
- **Pengguna Cabang (Regional / Area Office / Cabang)**: Query backend otomatis difilter dengan klausa `WHERE ou_kode IN (:allowedUnitCodes)`. Akses rekap atau teritori di luar wilayah cabang akan ditolak (`403 Forbidden`).

---

## 3. Arsitektur Komunikasi Antar-Layanan

```
┌─────────────────────────────────────────────────────────────────┐
│                 FRONTEND (hsera-dashboard)                      │
│             React + Vite + Tailwind CSS (#eb282d)               │
│                                                                 │
│   Auth Context & Storage ──► Bearer Token JWT                   │
│   ├── Client 1 (VITE_API_URL): http://localhost:5001 (Auth API) │
│   └── Client 2 (VITE_SALESMANSHIP_API_URL): :5003 (Sales API)   │
└───────────────┬─────────────────────────────────┬───────────────┘
                │                                 │
     (Auth & Master Karyawan)            (Transaksi RIS & Target)
                │                                 │
                ▼                                 ▼
┌───────────────────────────────┐ ┌───────────────────────────────┐
│     hsera-auth-backend        │ │  hsera-salesmanship-backend   │
│         (Port 5001)           │ │         (Port 5003)           │
│                               │ │                               │
│ - Login & Verifikasi User     │ │ - AuthMiddleware (Verify JWT) │
│ - Master Karyawan (Salesman)  │ │ - AclMiddleware (Level Menu)  │
│ - Master Operation Unit (OU)  │ │ - Operation Unit Scoper       │
│ - Menu & ACL RBAC             │ │ - REST API Domain RIS         │
└───────────────┬───────────────┘ └───────────────┬───────────────┘
                │                                 │
                │◄─────── HTTP Inter-service ─────┤ (Lookup Salesman
                │      (Fetch Salesman info)      │  by Karyawan ID)
                ▼                                 ▼
┌───────────────────────────────┐ ┌───────────────────────────────┐
│    Database: hsera (Auth)     │ │Database: hsera_salesmanship   │
│         PostgreSQL            │ │         PostgreSQL            │
└───────────────────────────────┘ └───────────────────────────────┘
```

---

## 4. Desain Database `hsera_salesmanship` (PostgreSQL)

### 4.1 Tabel Master
1. **`mst_district` (Teritori Management)**:
   - `id` (UUID PK)
   - `ou_kode` (VARCHAR(20), NOT NULL) - Kode Operation Unit dari auth framework.
   - `kode` (VARCHAR(10), NOT NULL) - Kode wilayah (contoh '001', '002').
   - `karyawan_id` (VARCHAR(50), NOT NULL) - Karyawan ID / NIK Salesman dari auth backend.
   - `status` (VARCHAR(10), DEFAULT 'AKTIF') - AKTIF / NONAKTIF.
   - `created_at`, `created_by`, `updated_at`, `updated_by`
   - *Constraint*: `UNIQUE (ou_kode, kode)`.

2. **`mst_brand` (Produk Brand)**:
   - `id` (UUID PK)
   - `kode` (VARCHAR(20), UNIQUE, NOT NULL) - '12DJ', '16GMD', dll.
   - `nama` (VARCHAR(100), NOT NULL)
   - `kategori` (VARCHAR(20), NOT NULL) - 'SKT', 'SKMFF', 'SKMP', dll.
   - `urutan` (INT, NOT NULL) - No Urut tampilan baris form & laporan.
   - `status` (VARCHAR(10), DEFAULT 'AKTIF')
   - `created_at` (TIMESTAMP(6), DEFAULT NOW())
   - `created_by` (VARCHAR(50), NULL) - ID/Username pengguna pembuat
   - `updated_at` (TIMESTAMP(6))
   - `updated_by` (VARCHAR(50), NULL) - ID/Username pengguna pengubah terakhir

3. **`mst_notasi` (Katalog Notasi Input & Header)**:
   - `id` (UUID PK)
   - `kode` (VARCHAR(50), UNIQUE, NOT NULL) - 'OOS', 'SK', 'SL', 'BD', 'Stock', 'Buy', dll.
   - `nama` (VARCHAR(150), NOT NULL)
   - `level_input` (VARCHAR(20), NOT NULL) - 'BRAND', 'HARIAN', 'TURUNAN', 'TARGET'.
   - `kelompok_tampil` (VARCHAR(20), NULL) - 'STATUS', 'KUANTITAS', 'FACEUP', 'HARIAN'.
   - `rumus` (VARCHAR(200), NULL) - Contoh BD: `'OOS+SK+SL+SD+SB'`.
   - `satuan` (VARCHAR(20), NOT NULL) - 'OUTLET', 'QTY'.
   - `urutan` (INT, NOT NULL) - No Urut dalam kelompok tampil.
   - `status` (VARCHAR(10), DEFAULT 'AKTIF')
   - `created_at` (TIMESTAMP(6), DEFAULT NOW())
   - `created_by` (VARCHAR(50), NULL) - ID/Username pengguna pembuat
   - `updated_at` (TIMESTAMP(6))
   - `updated_by` (VARCHAR(50), NULL) - ID/Username pengguna pengubah terakhir

4. **`mst_target` (Setup Target)**:
   - `id` (UUID PK)
   - `jenis_target` (VARCHAR(20), NOT NULL) - 'KUNJUNGAN', 'BD', 'EC', 'FACEUP', 'VOLUME'.
   - `district_id` (UUID NULL, FK -> mst_district) - NULL berlaku untuk semua district.
   - `hari_kunjungan` (SMALLINT NULL) - 1..6 (Senin..Sabtu), NULL berlaku semua hari.
   - `nilai` (NUMERIC(14,2), NOT NULL)
   - `berlaku_dari` (DATE, NOT NULL)
   - `berlaku_sampai` (DATE, NULL)
   - `status` (VARCHAR(10), DEFAULT 'AKTIF')
   - `created_at` (TIMESTAMP(6), DEFAULT NOW())
   - `created_by` (VARCHAR(50), NULL) - ID/Username pengguna pembuat
   - `updated_at` (TIMESTAMP(6))
   - `updated_by` (VARCHAR(50), NULL) - ID/Username pengguna pengubah terakhir

### 4.2 Tabel Transaksi & Sistem
5. **`trx_rekap_harian` (1 Salesman × 1 Hari Kunjungan)**:
   - `id` (UUID PK)
   - `district_id` (UUID, NOT NULL, FK -> mst_district)
   - `tgl_kunjungan` (DATE, NOT NULL) - Hanya Senin s/d Sabtu.
   - `hari_kunjungan` (SMALLINT GENERATED / TRIGGER) - 1..6 ISO.
   - `kode_minggu` (INT GENERATED / TRIGGER) - Format `YYYYWW` (ISO 8601).
   - `karyawan_id` (VARCHAR(50), NOT NULL) - Snapshot dari district.
   - `ou_kode` (VARCHAR(20), NOT NULL) - Snapshot dari district.
   - `jenis_rekap` (VARCHAR(30), DEFAULT 'NORMAL') - 'NORMAL' / 'TIDAK_ADA_KUNJUNGAN'.
   - `alasan` (VARCHAR(150), NULL) - Wajib bila TIDAK_ADA_KUNJUNGAN.
   - `jumlah_kunjungan` (INT, DEFAULT 0)
   - `total_ec` (INT, DEFAULT 0)
   - `volume_gg` (NUMERIC(14,2), NULL)
   - `status_rekap` (VARCHAR(20), DEFAULT 'DRAFT') - 'DRAFT' / 'FINAL'.
   - `status` (VARCHAR(10), DEFAULT 'AKTIF') - Soft delete.
   - `catatan` (TEXT, NULL)
   - `created_at` (TIMESTAMP(6), DEFAULT NOW())
   - `created_by` (VARCHAR(50), NULL) - ID/Username pengguna penginput callsheet
   - `updated_at` (TIMESTAMP(6))
   - `updated_by` (VARCHAR(50), NULL) - ID/Username pengguna pengubah callsheet
   - *Constraint*: Partial Unique `(district_id, tgl_kunjungan)` WHERE `status = 'AKTIF'`.

6. **`trx_rekap_harian_nilai` (Detail Nilai Grid Brand × Notasi)**:
   - `id` (UUID PK)
   - `rekap_id` (UUID, NOT NULL, FK -> trx_rekap_harian ON DELETE CASCADE)
   - `brand_id` (UUID, NOT NULL, FK -> mst_brand)
   - `notasi_id` (UUID, NOT NULL, FK -> mst_notasi)
   - `nilai` (NUMERIC(14,2), NOT NULL DEFAULT 0)
   - `status` (VARCHAR(10), DEFAULT 'AKTIF')
   - `created_at` (TIMESTAMP(6), DEFAULT NOW())
   - `created_by` (VARCHAR(50), NULL) - ID/Username pengguna pembuat
   - `updated_at` (TIMESTAMP(6))
   - `updated_by` (VARCHAR(50), NULL) - ID/Username pengguna pengubah
   - *Constraint*: `UNIQUE (rekap_id, brand_id, notasi_id)`.

7. **`sys_kunci_minggu` (Kontrol Tutup Buku Mingguan)**:
   - `kode_minggu` (INT PK) - Format `YYYYWW`.
   - `status` (VARCHAR(10), NOT NULL) - 'AKTIF' = Terkunci, 'NONAKTIF' = Dibuka kembali.
   - `catatan` (TEXT, NULL) - Alasan kunci atau buka kunci.
   - `created_at` (TIMESTAMP(6), DEFAULT NOW())
   - `created_by` (VARCHAR(50), NULL) - ID/Username pengguna pengunci/pembuka
   - `updated_at` (TIMESTAMP(6))
   - `updated_by` (VARCHAR(50), NULL) - ID/Username pengguna pengubah terakhir

8. **`v_ris_mingguan` (SQL View Laporan Wide / Unpivot)**:
   - Agregasi data rekap status FINAL per `kode_minggu`, `ou_kode`, `district`, `hari_kunjungan`, `brand`, dan `notasi`.

---

## 5. Rencana Modul Frontend di `hsera-dashboard`

Semua halaman disimpan di folder:
`/Users/dyra/Documents/Docker/hsera/hsera-dashboard/src/presentation/pages/Salesmanship/`

### 5.1 Submenu 1: Teritori Management (`salesmanship/territory`)
- **Tampilan**: Tabel teritori aktif/nonaktif per Operation Unit.
- **Fitur**:
  - Filter dropdown Operation Unit (sesuai hak akses pengguna).
  - Modal Create/Edit Teritori: Input Kode District (misal: `001`, `002`), pemilihan Operation Unit, dan dropdown penugasan Salesman (mengambil data dari API karyawan auth backend dengan pencarian instan nama & NIK).
  - Validasi keunikan `(ou_kode, kode)`.

### 5.2 Submenu 2: Setup Target (`salesmanship/target`)
- **Tampilan**: Pengaturan target kinerja operasional.
- **Fitur**:
  - Konfigurasi 5 dimensi target: **Kunjungan**, **BD (Brand Distribusi)**, **EC (Effective Call)**, **Face Up**, dan **Volume**.
  - Opsi penetapan: Global semua district, spesifik per district, atau spesifik hari tertentu (misal: Senin-Jumat = 40, Sabtu = 20).
  - Periode berlaku target (`berlaku_dari` s/d `berlaku_sampai`).

### 5.3 Submenu 3: Form Callsheet (`salesmanship/callsheet`)
- **Tampilan**: Form input transaksi harian berbentuk **Grid Interaktif (Matriks Brand × Notasi)** yang meniru format callsheet fisik.
- **Fitur**:
  1. **Header Form**: Pemilihan District dan Tanggal Kunjungan (Senin-Sabtu). Sistem otomatis mendeteksi Hari (Route 1-6), Minggu ISO (`YYWW`), dan nama Salesman.
  2. **Mode Saklar**: Switch *"Tidak Ada Kunjungan Hari Ini"* (otomatis membuka dropdown alasan: Libur Nasional, Cuti, Sakit, Cuaca Ekstrem).
  3. **Section Level Harian**: Input Jumlah Realisasi Kunjungan, Total EC, dan Volume Total GG.
  4. **Matriks Grid Brand**:
     - Baris: 13+ Brand terurut berdasarkan `mst_brand.urutan`.
     - Kolom: Status (SK, SL, SD, OOS, SB, TL, BPJ) -> **BD (Dihitung Real-time)** -> Kuantitas (Stock, Buy) -> Face Up (QTY, Outlet).
     - Navigasi cepat tombol keyboard (Tab, Enter, Arrow keys).
  5. **Mesin Validasi Real-time**:
     - Peringatan instan jika `(7 Status) > Jumlah Kunjungan`.
     - Validasi keras jika minggu sudah berstatus terkunci di `sys_kunci_minggu`.
  6. **Aksi Simpan**: Simpan sebagai Draft atau Finalisasi.

### 5.4 Submenu 4: Monitoring Callsheet (`salesmanship/monitoring`)
- **Tampilan**: Dashboard terpadu kendali kelengkapan dan pelaporan RIS.
- **Fitur**:
  1. **Grid Monitoring Kelengkapan Mingguan**:
     - Matrix District × Hari (Senin-Sabtu) untuk minggu berjalan.
     - Indikator visual status: *Sudah Direkap (Hijau)*, *Tidak Ada Kunjungan (Abu-abu/Kuning)*, *Belum Direkap (Merah)*.
  2. **Kendali Kunci Minggu (Admin Level 4)**:
     - Tombol Kunci Minggu ISO (menutup seluruh input Senin-Sabtu).
     - Tombol Buka Kunci disertai modal input alasan pembukaan untuk audit log.
  3. **Laporan RIS Mingguan (Format Wide YYWW)**:
     - Tampilan tabel horizontal dengan kolom minggu (misal `2634`, `2635`, `2636`).
     - Pemfilteran per District, Brand, dan Kategori.
  4. **Laporan Bulanan & Capaian vs Target**:
     - Tab evaluasi capaian realisasi vs target Kunjungan, BD, EC, Face Up, dan Volume.
  5. **Export Excel**: Tombol unduh laporan berformat `.xlsx` resmi.

---

## 6. Daftar Endpoint REST API Siap Digunakan Frontend (Port 5003)

Semua endpoint dilindungi oleh `AuthMiddleware` (Bearer JWT dari `hsera-auth-backend`) dan `AclMiddleware` berbasis Role & Level Menu:

### 6.1 Teritori Management (Submenu: `f054f502-72d0-47fb-919d-4de7122145cf`)
- `GET /api/salesmanship/districts` (Level 1)
  - Query: `ouKode`, `status`, `search` (Otomatis difilter sesuai `allowedUnitIds` pengguna jika bukan Super Admin).
  - Return: Daftar District lengkap dengan nama Salesman (`karyawanName`).
- `GET /api/salesmanship/districts/:id` (Level 1)
- `POST /api/salesmanship/districts` (Level 2)
  - Body: `{ ouKode, kode, karyawanId, status }`
- `PUT /api/salesmanship/districts/:id` (Level 3)
  - Body: `{ ouKode, kode, karyawanId, status }`
- `DELETE /api/salesmanship/districts/:id` (Level 4)
  - Validasi: Ditolak jika district telah memiliki riwayat callsheet.

### 6.2 Setup Target (Submenu: `f4fda652-4730-4e12-ac08-7a4d1ab2e864`)
- `GET /api/salesmanship/targets` (Level 1)
  - Query: `districtId`, `jenisTarget` (`KUNJUNGAN` | `BD` | `EC` | `FACEUP` | `VOLUME`), `status`.
- `POST /api/salesmanship/targets` (Level 2/3)
  - Body: `{ id?, jenisTarget, districtId?, hariKunjungan?, nilai, berlakuDari, berlakuSampai?, status? }`
- `DELETE /api/salesmanship/targets/:id` (Level 4)

### 6.3 Form Callsheet (Submenu: `de9ab023-de01-4545-82ad-968e50b24e1e`)
- `GET /api/salesmanship/callsheets/form` (Level 1)
  - Query: `districtId`, `date` (format `YYYY-MM-DD`).
  - Return: Kerangka Form Lengkap / Skeleton:
    - `hariKunjungan` (1..6) & `namaHari` (Senin..Sabtu).
    - `kodeMinggu` (ISO YYYYWW) & `kodeMingguDisplay` (YYWW).
    - `isLocked` (status kunci minggu).
    - `targets` (`kunjungan`, `bd`, `ec`).
    - `brands` (13 Brand terurut).
    - `notasiList` (14 Notasi terurut).
    - `rekap` (nilai existing atau inisialisasi matriks 0).
- `GET /api/salesmanship/callsheets/:id` (Level 1)
- `POST /api/salesmanship/callsheets` (Level 2/3)
  - Body: `{ id?, districtId, tglKunjungan, jenisRekap, alasan?, jumlahKunjungan, totalEc, volumeGg, statusRekap, catatan?, matrix: [{ brandId, notasiKode, nilai }] }`
  - **Business Rules Aktif**:
    1. Hari Minggu ditolak otomatis (`400 Bad Request`).
    2. Minggu yang berstatus terkunci (`LOCKED`) ditolak otomatis (`400 Bad Request`).
    3. Jika `jenisRekap === 'TIDAK_ADA_KUNJUNGAN'`, alasan wajib diisi dan nilai diset 0.
    4. Auto-kalkulasi Brand Distribution: `BD = OOS + SK + SL + SD + SB` dihitung otomatis di backend.
- `DELETE /api/salesmanship/callsheets/:id` (Level 4)

#### Evaluasi Rencana Desain UI & Penyesuaian Form Callsheet (Persiapan Pengerjaan)

Berdasarkan evaluasi terhadap rencana desain (mockup terlampir) dan dokumen teknis backend untuk 3 poin yang disebutkan:
- **6.3 Form Callsheet** (`de9ab023-de01-4545-82ad-968e50b24e1e`)
- **6.5 Kontrol Kunci Minggu (Proteksi Audit)**
- **6.6 Referensi & Katalog**

Berikut adalah hasil evaluasi mendalam, khususnya komponen UI apa saja yang perlu dikurangi/dihilangkan/disesuaikan agar sesuai dengan kontrak database, API backend, dan UX yang bersih di `hsera-dashboard`:

##### 1. Apa Saja yang Perlu DIKURANGI / DIHILANGKAN dari UI Mockup?

* **1.1. Sub-Kolom Face Up: Dari 2 Kolom (QTY FU & Outlet FU) $\rightarrow$ Cukup 1 Kolom (Face Up)**
  * **Kondisi di Mockup**: Menampilkan 2 sub-kolom di bawah Face Up: `QTY FU` dan `Outlet FU`.
  * **Kondisi Riil Backend & DB**: Di tabel master `mst_notasi` dan skema database `trx_rekap_harian_nilai`, hanya terdaftar 1 notasi Face Up yaitu kode `FACE_UP` (Kelompok: `FACEUP`, Level: `BRAND`). Target di backend juga hanya mengenal 1 jenis target `"FACEUP"`.
  * **Rekomendasi Pengurangan**: Hapus pemecahan 2 kolom tersebut. Cukup gunakan 1 kolom input: **`Face Up` (atau `FU`)** agar payload matrix `[{ brandId, notasiKode: "FACE_UP", nilai }]` klop 1-to-1 dengan database.

* **1.2. Top Bar Global (Navbar Atas Ganda) $\rightarrow$ Dihilangkan dari Halaman**
  * **Kondisi di Mockup**: Di bagian paling atas terdapat bar horizontal berisi: *Unit Operasi HO*, *Siklus Aktif W-42*, dropdown *PERAN: Admin Pusat*, lonceng notifikasi, dan avatar user (*Bambang Sudiro*).
  * **Alasan Pengurangan**: Di template `hsera-dashboard`, elemen-elemen ini sudah tersedia di `AdminLayout` dan `Header.tsx`. Selain itu, dropdown ganti peran (*switch role*) di dalam halaman form tidak valid karena otorisasi role terikat pada JWT token session yang sedang login.
  * **Rekomendasi**: Hapus bar atas ini dari konten halaman agar tidak terjadi duplikasi navbar (*double header*).

* **1.3. Fitur Auto-Save Background ("Tersimpan otomatis 10:42:15") $\rightarrow$ Ditiadakan**
  * **Kondisi di Mockup**: Terdapat indikator *"Tersimpan otomatis 10:42:15"*.
  * **Alasan Pengurangan**: Form Callsheet memiliki matriks besar (15 Brand × 10 Notasi = 150 cell input angka). Melakukan auto-save berkala di background saat user sedang mengetik setengah angka berisiko memicu *validation error* (misal matriks belum seimbang) atau menyimpan status kotor (*dirty draft*) di server.
  * **Rekomendasi**: Menghapus auto-save background. Cukup sediakan aksi eksplisit yang jelas: tombol **Simpan Draft** (`statusRekap: "DRAFT"`) dan tombol **Finalkan Rekap** (`statusRekap: "FINAL"`) dengan *hotkey* `Ctrl+S`.

* **1.4. Tombol "Riwayat Versi" $\rightarrow$ Dihilangkan**
  * **Kondisi di Mockup**: Terdapat tombol *"Riwayat Versi"* di banner ungu.
  * **Alasan Pengurangan**: Di skema tabel database `trx_rekap_harian`, backend hanya menyimpan audit log standar (`created_at`, `created_by`, `updated_at`, `updated_by`). Tidak ada tabel audit log snapshot versi historis / *time-travel revision* di backend. Menampilkan tombol ini akan membuatnya menjadi tombol mati (*dead button*).
  * **Rekomendasi**: Hapus tombol "Riwayat Versi". Info audit cukup menampilkan teks kecil: *"Terakhir diubah oleh {updated_by} pada {updated_at}"*.

* **1.5. Status "Lembar: TERVERIFIKASI SPV" $\rightarrow$ Disesuaikan Menjadi Status Riil**
  * **Kondisi di Mockup**: Terdapat status *"Lembar: TERVERIFIKASI SPV"*.
  * **Alasan Pengurangan**: Di backend, status rekap harian hanya mengenal enum: `"DRAFT"` atau `"FINAL"`. Belum ada siklus status multilevel *approval* SPV di tabel `trx_rekap_harian`.
  * **Rekomendasi**: Ganti badge tersebut dengan badge status riil sistem: **`DRAFT`** (warna kuning/abu-abu) atau **`FINAL`** (warna hijau).

* **1.6. Subteks Karton: "Kosongkan utk auto-sum: 24 ctn" $\rightarrow$ Dihilangkan**
  * **Kondisi di Mockup**: Di kartu *Volume Total GG*, terdapat subteks kecil *"Kosongkan utk auto-sum: 24 ctn"*.
  * **Alasan Pengurangan**: Kolom `volume_gg` di backend bertipe `numeric(14,2)` dengan satuan murni (batang/bungkus). Backend tidak memiliki logika kalkulasi konversi satuan karton (`ctn`).
  * **Rekomendasi**: Hilangkan subteks karton tersebut agar pengguna tidak bingung mengenai satuan unit input.

* **1.7. Tombol "Reset Data" $\rightarrow$ Disederhanakan / Dihilangkan**
  * **Alasan Pengurangan**: Meletakkan tombol reset tepat di samping status sangat berisiko tertekan tidak sengaja saat user sudah mengisi ratusan sel. Cukup sediakan tombol **Batal** standar di bagian bawah.

##### 2. Elemen Mockup yang SANGAT BAGUS dan HARUS DIPERTAHANKAN

* **Matriks Grid 15 Brand × Status Notasi**:
  * Layout baris 15 Brand dengan pengelompokan kolom sangat intuitif dan profesional.
  * Brand diambil secara dinamis dari API `GET /api/salesmanship/callsheets/form` (`brands` list dari master `mst_brand`).
* **Kolom BD (Brand Distribution) Auto-sum**:
  * Kolom BD berwarna ungu harus berstatus **Read-Only / Disabled**, dihitung otomatis secara live di frontend:
    $\text{BD} = \text{OOS} + \text{SK} + \text{SL} + \text{SD} + \text{SB}$
    Hal ini 100% selaras dengan *business rule* yang juga diterapkan oleh backend di `SaveCallsheetUseCase`.
* **Toggle Mode Pelaporan**:
  * Tombol *Normal Berjalan* vs *Tidak Ada Kunjungan*. Jika "Tidak Ada Kunjungan" dipilih, seluruh matriks di-disable (nilai 0), dan muncul textarea input **Alasan** (wajib diisi sesuai aturan backend).
* **Validasi Baris Live "Status vs Kunjungan"**:
  * Indikator real-time per baris (misal `32 / 32 OK`, `30 / 32 (-2)`, `34 / 32 (+2)`) dan summary error di footer tabel sangat membantu salesman/checker memvalidasi input sebelum finalisasi.
* **Kartu Summary KPI Atas**:
  * Kartu `Jumlah Kunjungan`, `Total EC (Effective Calls)`, dan `Volume Total GG` dengan perbandingan target harian.
* **Shortcut Keyboard**:
  * Navigasi `Tab` / `Enter` untuk pindah sel matriks dan `Ctrl+S` untuk simpan draft sangat mempercepat proses entry data.

##### 3. Keterkaitan dengan Poin 6.5 dan 6.6

* **Poin 6.5 Kontrol Kunci Minggu (Proteksi Audit)**:
  * Di Form Callsheet (6.3), integrasi dengan 6.5 adalah: ketika tanggal yang dipilih jatuh pada minggu yang statusnya terkunci (`isLocked: true`), seluruh form otomatis berstatus **Read-Only** (semua input disabled, tombol simpan dinonaktifkan, dan muncul alert peringatan kunci minggu).
  * Halaman/Modal untuk mengunci/membuka minggu (`POST /api/salesmanship/locks/toggle`) merupakan fitur otorisasi terpisah untuk level Supervisor/Admin.
* **Poin 6.6 Referensi & Katalog**:
  * Form Callsheet tidak memerlukan form CRUD master data. Data 15 Brand, 14 Notasi, list Salesman, dan Operation Unit dikonsumsi secara dinamis dari endpoint katalog yang sudah disediakan backend.

##### 4. Lembar Jawaban & Konfirmasi Review User
> **Catatan & Jawaban User**:
> Silakan tuliskan keputusan / jawaban untuk poin evaluasi di atas di bawah ini sebelum pengerjaan form callsheet dimulai:
>
> - [SETUJU]] Sub-kolom Face Up cukup 1 kolom: **[SETUJU / CATATAN LAIN]**
> - [SETUJU] Hilangkan Top Bar ganda (mengikuti header layout utama): **[SETUJU / CATATAN LAIN]**
> - [SETUJU] Hilangkan Auto-save otomatis (gunakan tombol Simpan Draft & Finalkan): **[SETUJU / CATATAN LAIN]**
> - [SETUJU] Hilangkan tombol Riwayat Versi: **[SETUJU / CATATAN LAIN]**
> - [SETUJU] Status lembar menggunakan status riil (Draft / Final): **[SETUJU / CATATAN LAIN]**
> - [SETUJU] Hilangkan subteks auto-sum karton (24 ctn): **[SETUJU / CATATAN LAIN]**
> - [SETUJU] Kolom BD otomatis read-only: **[SETUJU / CATATAN LAIN]**


### 6.4 Monitoring & Laporan Callsheet (Submenu: `2cc8cdbd-c155-48fc-a5e5-f72dafab86d6`)
- `GET /api/salesmanship/monitoring/weekly` (Level 1)
  - Query: `kodeMinggu` (opsional, default minggu berjalan), `ouKode` (opsional).
  - Return: Matriks grid kelengkapan hari Senin s/d Sabtu untuk seluruh district di OU terpilih:
    - Status hari (`TERISI` | `TIDAK_ADA_KUNJUNGAN` | `KOSONG`), tanggal, rekap ID, jumlah kunjungan, total EC.
    - Total hari terisi & persentase kelengkapan.
    - Status penguncian minggu berjalan.
- `GET /api/salesmanship/monitoring/report/wide-ris` (Level 1)
  - Query: `kodeMinggu` / `startDate` & `endDate`, `ouKode`, `districtId`.
  - Return: Laporan Pivot Matriks RIS dengan kolom per brand & per notasi.

### 6.5 Kontrol Kunci Minggu (Proteksi Audit)
- `GET /api/salesmanship/locks` (Level 1) - Daftar seluruh minggu yang dikunci.
- `GET /api/salesmanship/locks/:kodeMinggu` (Level 1) - Cek status kunci minggu tertentu.
- `POST /api/salesmanship/locks/toggle` (Level 3/4)
  - Body: `{ kodeMinggu, status: 'AKTIF' | 'NONAKTIF', catatan? }`

### 6.6 Referensi & Katalog
- `GET /api/salesmanship/references/salesmen` - Daftar karyawan/salesman (terkoneksi ke auth backend).
- `GET /api/salesmanship/references/operation-units` - Daftar Operation Unit (terkoneksi ke auth backend).
- `GET /api/salesmanship/brands` - Katalog master brand.
- `GET /api/salesmanship/notasi` - Katalog master notasi.

### 6.7 Dokumentasi Interaktif & Health Check
- Health check: `GET http://localhost:5003/health`
- Swagger UI API Docs: `GET http://localhost:5003/api-docs`

---

## 7. Status Eksekusi & Hasil Pengujian

- [x] Database `hsera_salesmanship` di PostgreSQL aktif & ter-migrasi.
- [x] Seed data (13 Brands, 14 Notasi, Target Default, Sampel District) sukses dijalankan.
- [x] Unit & Integration Tests (Vitest) 8/8 lolos pengujian (Status 100% Passed).
- [x] TypeScript build (`npm run build`) berhasil tanpa error (`exit code 0`).
- [x] Konfigurasi Docker & `docker-compose.yml` telah terhubung.
- [x] **Frontend sama sekali tidak disentuh**, siap dikerjakan pada tahap berikutnya.

