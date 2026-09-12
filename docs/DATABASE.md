# Dokumentasi Database NOCR (PostgreSQL)

Dokumen ini menjelaskan tata cara instalasi, inisialisasi, skema tabel, dan manajemen migrasi database PostgreSQL pada sistem NOCR.

---

## 1. Konfigurasi Koneksi

Backend terhubung ke PostgreSQL menggunakan:
- **Connection Pool**: Direct connection pool via `pg` (`src/lib/dbClient.js`)
- **ORM**: Prisma 7 Client (`prisma/schema.prisma`)

Variabel environment standar pada file `backend/.env`:
```env
DATABASE_URL="postgresql://postgres:password@127.0.0.1:5432/nocr?schema=public"
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=password
DB_NAME=nocr
```

---

## 2. Panduan Setup Database Native (Tanpa Docker)

Gunakan panduan ini jika Anda menjalankan PostgreSQL langsung pada sistem operasi host (Ubuntu/Debian).

### Langkah 1: Install PostgreSQL di Server
```bash
apt update
apt install -y postgresql postgresql-contrib postgresql-client
```

Pastikan service PostgreSQL berjalan dan aktif saat boot:
```bash
systemctl enable postgresql
systemctl start postgresql
systemctl status postgresql
```

### Langkah 2: Set Password User `postgres` & Buat Database `nocr`
Atur password user `postgres` (sesuaikan dengan yang diinginkan, misal: `password`):
```bash
su - postgres -c "psql -c \"ALTER USER postgres WITH PASSWORD 'password';\""
```

Buat database untuk sistem NOCR:
```bash
su - postgres -c "psql -c \"CREATE DATABASE nocr;\""
```

### Langkah 3: Aktifkan Ekstensi UUID & Schema `extensions` (WAJIB)
> [!IMPORTANT]
> Skema Prisma NOCR menggunakan fungsi bawaan `extensions.uuid_generate_v4()`. Pada instalasi PostgreSQL baru/fresh, schema dan ekstensi ini harus diaktifkan secara manual sebelum menjalankan migrasi Prisma:

```bash
su - postgres -c "psql -d nocr -c 'CREATE SCHEMA IF NOT EXISTS extensions; CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\" SCHEMA extensions; CREATE EXTENSION IF NOT EXISTS pgcrypto;'"
```

### Langkah 4: Siapkan Konfigurasi `.env` Backend
Salin template konfigurasi jika belum ada:
```bash
cd /var/www/nocr/backend
cp .env.example .env
```
*Pastikan nilai `DATABASE_URL` di dalam `backend/.env` sudah sesuai dengan user, password, dan port yang Anda konfigurasi.*

### Langkah 5: Sinkronisasi Skema Database via Prisma
Jalankan sinkronisasi skema ke database:
```bash
cd /var/www/nocr/backend
npx prisma db push
```

### Langkah 6: Seeding Data Dummy Awal
Untuk mengisi akun default admin (`admin` / `password123`), data site, dan dummy logs:
```bash
cd /var/www/nocr/backend
npm run seed:dummy
```

---

## 3. Opsi Setup Menggunakan Docker Compose

Jika Anda lebih memilih menjalankan PostgreSQL dalam container terisolasi:

```bash
cd /var/www/nocr

# 1. Pastikan file backend/.env atau backend/.env.production sudah tersedia
cp backend/.env.example backend/.env

# 2. Jalankan container PostgreSQL di background
docker compose up -d postgres

# 3. Jalankan migrasi Prisma
cd backend
npx prisma db push
npm run seed:dummy
```

Untuk masuk ke console `psql` di dalam container Docker:
```bash
docker exec -it nocr_postgres psql -U postgres -d nocr
```

---

## 4. Tabel-tabel Utama

| Nama Tabel | Deskripsi |
|---|---|
| `users` | Akun pengguna sistem, password hash bcrypt, role & status aktif |
| `access_roles` | Daftar level hak akses dan matriks permissions JSON |
| `sites` | Data Site / Tower / POP (nama, IP, MAC Ruijie, lat/lng, status UP/DOWN) |
| `device_mappings` | Pemetaan perangkat MikroTik dan Ruijie Cloud AP |
| `devices` | Perangkat jaringan router core, switch, dan OLT |
| `network_interfaces` | Status dan interface fisik/virtual MikroTik |
| `pppoe_active` & `pppoe_secrets` | Data sesi dan user PPPoE MikroTik |
| `ruijie_devices` | Cache data perangkat AP/Switch dari Ruijie Cloud |
| `topology_nodes` | Koordinat posisi node visual untuk peta diagram topologi jaringan |
| `topology_edges` | Relasi garis koneksi/link antar node (fiber optic, wireless link) |
| `daily_reports` | Rekapitulasi laporan gangguan harian |
| `api_keys` | Manajemen token API untuk integrasi sistem eksternal |
| `vpn_settings` | Konfigurasi dial-in / dial-out VPN server |
| `site_traffic_snapshots` | Snapshot statistik throughput bandwidth |
| `activity_logs` | Audit trail pencatatan aktivitas pengguna dan aksi sistem |

---

## 5. Maintenance & Backup Rutin

### Backup Database:
```bash
cd /var/www/nocr/backend
./scripts/backup-db.sh
```

### Restore Database dari File Backup:
```bash
psql -U postgres -d nocr -f /var/www/nocr/backend/data/backups/nama_file_backup.sql
```

---

## 6. Troubleshooting Umum

### 1. `Error: The datasource.url property is required in your Prisma config file`
- **Penyebab**: File `backend/.env` belum ada, atau variabel `DATABASE_URL` belum didefinisikan.
- **Solusi**: Salin file contoh dengan `cp backend/.env.example backend/.env` dan pastikan `DATABASE_URL` sudah terisi.

### 2. `Error: ERROR: schema "extensions" does not exist`
- **Penyebab**: PostgreSQL fresh belum memiliki schema `extensions` untuk fungsi `uuid_generate_v4()`.
- **Solusi**: Jalankan perintah berikut:
  ```bash
  su - postgres -c "psql -d nocr -c 'CREATE SCHEMA IF NOT EXISTS extensions; CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\" SCHEMA extensions; CREATE EXTENSION IF NOT EXISTS pgcrypto;'"
  ```

### 3. `psql: command not found`
- **Penyebab**: Paket PostgreSQL client belum terpasang di host server.
- **Solusi**: Jalankan `apt update && apt install -y postgresql-client`.

