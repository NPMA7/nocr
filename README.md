# 🌐 NOCR: Network Operations Center & Reporting
**Platform Terpadu Pemantauan & Manajemen Infrastruktur Jaringan Berstandar Enterprise**

![Status](https://img.shields.io/badge/Status-Production_Ready-success?style=for-the-badge) ![Architecture](https://img.shields.io/badge/Architecture-Modular_Monorepo-blueviolet?style=for-the-badge) ![Version](https://img.shields.io/badge/Version-2.0.0-blue?style=for-the-badge) ![Frontend](https://img.shields.io/badge/Frontend-Next.js_15_|_React_19-black?style=for-the-badge) ![Backend](https://img.shields.io/badge/Backend-Node.js_|_Express_|_Socket.IO-green?style=for-the-badge) ![Database](https://img.shields.io/badge/Database-PostgreSQL_18_|_Prisma_ORM-336791?style=for-the-badge)

---

## 📑 Ringkasan Eksekutif

**NOCR (Network Operations Center & Reporting)** adalah platform *Network Management System* (NMS) berbasis web modern yang dirancang untuk memusatkan, mengotomatisasi, dan mengamankan pemantauan infrastruktur jaringan berskala menengah hingga besar (Diskominfo, ISP, dan Enterprise).

NOCR mengintegrasikan perangkat multi-vendor (**MikroTik, HSGQ EPON/GPON OLT, Ruijie Cloud AP/Switch**) ke dalam satu dashboard terpadu (*Single Pane of Glass*), dilengkapi dengan visualisasi peta geolokasi, builder topologi interaktif, sistem peringatan dini WhatsApp Gateway otomatis, audit trail granular, serta pelaporan resmi SLA Uptime.

---

## 🧭 Panduan Modul & Halaman Aktif Aplikasi

Aplikasi NOCR memiliki modul-modul fungsional yang dapat diakses melalui antarmuka dashboard:

### 1. 📊 Dashboard & Monitoring Real-time
| Halaman / Rute | Deskripsi Fungsionalitas |
|---|---|
| **`/dashboard`** | Halaman utama yang menampilkan ringkasan metrik status jaringan (Total Sites, UP, DOWN, FLAPPING), utilisasi resource router core (CPU, RAM, Uptime), dan *live activity stream*. |
| **`/monitoring/desa`** | Monitoring status ketersediaan koneksi seluruh titik Site Desa / Kelurahan secara real-time. |
| **`/monitoring/desa/traffic/[ruijie_mac]`** | Grafik bandwidth dan statistik throughput data real-time untuk site desa tertentu. |
| **`/monitoring/opd`** | Monitoring status koneksi jaringan kantor Organisasi Perangkat Daerah (OPD) / Dinas. |
| **`/monitoring/opd/traffic/[ruijie_mac]`** | Grafik bandwidth dan analisis traffic perangkat pada lokasi kantor OPD tertentu. |
| **`/monitoring/traffic`** | Monitoring agregasi total throughput bandwidth seluruh jaringan (Rx / Tx Mbps). |

### 2. 📍 Manajemen Sites & Pemetaan Geolokasi
| Halaman / Rute | Deskripsi Fungsionalitas |
|---|---|
| **`/sites/desa`** | Manajemen inventaris Site Desa (nama titik, IP address, MAC Ruijie, koordinat, kontak penanggung jawab). |
| **`/sites/desa/[ruijie_mac]`** | Detail mendalam site desa, riwayat pergantian status, dan galeri foto bukti instalasi (*Evidence Photos*). |
| **`/sites/opd`** | Manajemen inventaris Site Kantor Dinas / Instansi OPD. |
| **`/sites/opd/[ruijie_mac]`** | Detail profil site OPD beserta histori stabilitas koneksi. |
| **`/maps`** | Peta geolokasi interaktif berbasis **Leaflet & OpenStreetMap** yang menampilkan sebaran titik tower/site dengan indikator status warna dinamis (Hijau = UP, Merah = DOWN, Kuning = FLAPPING). |

### 3. 🔌 Multi-Vendor Device Management
| Halaman / Rute | Deskripsi Fungsionalitas |
|---|---|
| **`/device/mikrotik`** | Monitoring MikroTik Core: resource router, status interface, traffic per port, daftar sesi pelanggan PPPoE aktif, dan terminal web interaktif. |
| **`/device/hsgq-olt`** | Manajemen HSGQ EPON/GPON OLT: status port PON, pemantauan optical power (redaman optik dBm), list 160+ ONU/ONT online/offline, dan aksi remote reboot ONT. |
| **`/device/ruijie`** | Monitoring perangkat AP & Switch Ruijie Cloud serta akses remote ke Web GUI perangkat (*eWeb Modal*). |

### 4. 🗺️ Builder Topologi Jaringan Interaktif
| Halaman / Rute | Deskripsi Fungsionalitas |
|---|---|
| **`/topology`** | Visualisasi diagram arsitektur jaringan berbasis `vis-network` (Core Router, Distribution Switch, OLT, Tower, Access Point). Dilengkapi fitur **Co-Editing Presence Lock** berbasis WebSocket untuk mencegah bentrokan edit saat beberapa administrator bekerja bersamaan, simulasi failover jalur, dan kalkulasi propagasi status link (Fiber Optic / Wireless). |

### 5. 📑 Pelaporan SLA & Rekapitulasi Gangguan
| Halaman / Rute | Deskripsi Fungsionalitas |
|---|---|
| **`/report`** & **`/report/dashboard`** | Pusat laporan persentase SLA Uptime per site, durasi total downtime, dan ekspor laporan resmi dalam format **PDF** dan **Excel (.xlsx)**. |
| **`/report/dashboard/sites`** | Analisis performa ketersediaan jaringan per kategori site (Desa vs OPD). |
| **`/daily-reports`** & **`/daily-reports/dashboard`** | Pencatatan rekapitulasi tiket gangguan harian (*Issue Description* & *Corrective Action* teknisi) dengan fitur **Bulk Upsert** dari spreadsheet. |

### 6. ⚙️ Pengaturan Sistem & Granular RBAC
| Halaman / Rute | Deskripsi Fungsionalitas |
|---|---|
| **`/settings/server`** / **`/settings/system`** | Konfigurasi interval ICMP ping background, timeout flapping log, dan sinkronisasi hardware. |
| **`/settings/health`** | Monitoring utilisasi CPU, RAM, Disk, dan Uptime server host aplikasi. |
| **`/settings/roles`** | Pengaturan level hak akses **Role-Based Access Control (RBAC)** per menu dan aksi (Read, Create, Update, Delete). |
| **`/settings/users`** | Manajemen akun pengguna sistem, aktivasi user, dan penetapan role. |
| **`/settings/core`** / **`/settings/mikrotik-gateway`** | Konfigurasi IP, port API, dan kredensial Router MikroTik gateway. |
| **`/settings/company`** | Pengaturan identitas instansi, nama branding, dan logo kop laporan resmi. |
| **`/settings/api-keys`** | Manajemen token API untuk integrasi sistem eksternal. |
| **`/settings/vpn`** | Kontrol koneksi dial VPN server host (L2TP/PPTP/OpenVPN). |
| **`/settings/design`** | Kustomisasi tema antarmuka dashboard (*Glassmorphism*, palet warna, dan mode tampilan). |
| **`/settings/password`** | Ubah password akun administrator. |

---

## 🏗️ Struktur Codebase Modular

Codebase proyek telah ditata ke dalam struktur folder terpisah:

```text
/nocr/
├── backend/                     # Khusus Tim Backend (Node.js, Express, Socket.IO, Prisma)
│   ├── server.js                # Server utama Express, WebSocket hub, & background pollers
│   ├── src/lib/                 # Library inti (MikroTik, DB client, WhatsApp, Ping engine, OLT)
│   ├── database/                # schema.sql & skrip inisialisasi database PostgreSQL
│   ├── prisma/                  # Skema Prisma ORM & migrasi database
│   ├── scripts/                 # Skrip automasi backup database & Google Drive sync
│   ├── data/                    # Penyimpanan runtime (uploads/, server-settings.json, session)
│   ├── package.json             # Dependensi khusus backend
│   └── .env.example             # Template konfigurasi backend
│
├── frontend/                    # Khusus Tim Frontend (Next.js 15, React 19, Tailwind CSS)
│   ├── src/app/                 # Next.js App Router (Pages, layout, route handlers)
│   ├── src/components/          # Komponen antarmuka React (Dashboard, Maps, Topology, Modals)
│   ├── src/hooks/               # Custom React Hooks (useSocket, useAuth, useToast)
│   ├── src/lib/                 # Helper frontend (theme engine, formatters)
│   ├── src/index.css            # Styling Tailwind CSS setup
│   ├── public/                  # Asset statis publik (logo, audio alarm, icons)
│   ├── next.config.mjs          # Konfigurasi Next.js
│   ├── package.json             # Dependensi khusus frontend
│   └── .env.example             # Template konfigurasi frontend
│
├── docs/                        # Dokumentasi & Panduan Kolaborasi Tim
│   ├── ARCHITECTURE.md          # Diagram arsitektur sistem & aliran data
│   ├── API_REFERENCE.md         # Spesifikasi lengkap REST API & event WebSocket
│   ├── COLLABORATION_GUIDE.md   # Panduan alur kerja Git & pembagian tugas
│   ├── DATABASE.md              # Struktur tabel PostgreSQL & skema Prisma
│   └── DEPLOYMENT.md            # Panduan instalasi lokal, Docker Compose & Nginx
│
├── docker-compose.yml           # Orchestration container produksi (App & PostgreSQL)
├── Dockerfile                   # Multi-stage production container build
├── nginx_site.conf              # Konfigurasi reverse proxy Nginx & SSL
├── package.json                 # Root script runner
└── README.md                    # Dokumentasi utama ini
```

---

## 🚀 Panduan Memulai (PC Developer)

Ikuti alur ini agar pengembangan di PC lokal **100% aman dan terisolasi dari database/hardware produksi**:

1. **Clone Repositori:**
   ```bash
   git clone https://github.com/NPMA7/nocr.git
   cd nocr
   ```
2. **Install Dependensi:**
   ```bash
   npm run install:all
   ```
3. **Setup Database Lokal & Dummy Data:**
   Pastikan database PostgreSQL sudah aktif dan ekstensi `extensions` sudah dibuat (lihat detail lengkap di [docs/DATABASE.md](docs/DATABASE.md)):
   ```bash
   cd backend
   cp .env.example .env
   npx prisma db push
   npm run seed:dummy
   ```
   *(Menghasilkan akun admin `admin` / `password123`, data dummy router, 5 site peta desa/OPD, dan log)*

4. **Jalankan Aplikasi di PC:**
   Buka 2 terminal terpisah:
   * **Terminal 1 (Backend Dev):** `npm run dev:backend` *(Port 8888, DEMO_MODE aktif)*
   * **Terminal 2 (Frontend Dev):** `npm run dev:frontend` *(Port 3000, otomatis proxy ke 8888)*

Buka browser di **`http://localhost:3000`**. Developer bebas mengubah kode dan data tanpa khawatir mengganggu server produksi!

---

## 🐳 Deployment Produksi (`nocrnetwork.com`)

Sistem produksi dijalankan menggunakan Docker Compose dan Nginx Reverse Proxy:

```bash
# 1. Build & jalankan container produksi
docker compose up -d --build

# 2. Cek status container
docker compose ps

# 3. Cek log output realtime
docker compose logs -f nocr
```

---

## 📚 Tautan Dokumentasi Lanjutan

- 📖 [Panduan Kolaborasi Tim (Git & Workflow)](/docs/COLLABORATION_GUIDE.md)
- 🔌 [Referensi REST API & Event WebSocket](/docs/API_REFERENCE.md)
- 🏗️ [Arsitektur Sistem & Alur Integrasi Hardware](/docs/ARCHITECTURE.md)
- 🗄️ [Dokumentasi Database PostgreSQL & Prisma](/docs/DATABASE.md)
- 🚀 [Panduan Lengkap Deployment & Nginx](/docs/DEPLOYMENT.md)

---

*Dikelola dan dikembangkan oleh tim Network Operations Center (NPMA).*
