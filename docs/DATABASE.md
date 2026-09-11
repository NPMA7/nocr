# Dokumentasi Database NOCR (PostgreSQL)

Dokumen ini menjelaskan struktur data, skema tabel, dan manajemen migrasi database PostgreSQL pada NOCR.

---

## 1. Konfigurasi Koneksi

Backend terhubung ke PostgreSQL menggunakan:
- **Connection Pool**: Direct connection pool via `pg` (`src/lib/dbClient.js`)
- **ORM**: Prisma 7 Client (`prisma/schema.prisma`)

Variabel environment standar:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/nocr?schema=public"
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=password
DB_NAME=nocr
```

---

## 2. Tabel-tabel Utama

| Nama Tabel | Deskripsi |
|---|---|
| `users` | Akun pengguna sistem, password hash bcrypt, role & status aktif |
| `roles` | Daftar level hak akses dan matriks permissions JSON |
| `sites` | Data Site / Tower / POP (nama, IP, MAC Ruijie, lat/lng, status UP/DOWN) |
| `site_status_logs` | Histori log pergantian status UP/DOWN/FLAPPING untuk kalkulasi SLA |
| `devices` | Perangkat jaringan (Router, Switch, OLT, Server, Access Point) |
| `topology_nodes` | Koordinat posisi node visual untuk peta diagram topologi jaringan |
| `topology_edges` | Relasi garis koneksi/link antar node (fiber optic, wireless link) |
| `traffic_records` | Riwayat throughput data per interface / site |
| `activity_logs` | Audit trail pencatatan aktivitas pengguna dan aksi sistem |
| `settings` | Pengaturan global sistem dan konfigurasi API keys pihak ketiga |

---

## 3. Menjalankan Skrip & Migrasi

Semua skrip database berada di dalam folder `backend/database/` dan `backend/prisma/`.

### Import Skema Awal:
```bash
cd backend
# Menggunakan file SQL mentah:
psql -U postgres -d nocr -f database/schema.sql

# Atau sinkronisasi via Prisma:
npx prisma db push
```

### Membuat Backup Database:
```bash
cd backend
./scripts/backup-db.sh
```
