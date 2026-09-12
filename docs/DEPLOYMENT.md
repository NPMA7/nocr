# Panduan Deployment NOCR

Dokumen ini menjelaskan tata cara deployment sistem NOCR pada lingkungan server produksi menggunakan Nginx dan Docker Compose.

---

## 1. Arsitektur Port & Service

| Komponen | Host / Port | Lingkungan | Service / Container |
|---|---|---|---|
| **PostgreSQL 18** | `127.0.0.1:5432` | Production (Internal Docker) | Container `nocr_postgres` |
| **Backend & Frontend App** | `127.0.0.1:9371` | Production (Internal Docker) | Container `nocr_app` (Next.js + Express) |
| **Backend Dev (Lokal)** | `127.0.0.1:8888` | Development (Manual) | `npm run dev:backend` |
| **Frontend Dev (Lokal)** | `127.0.0.1:3000` | Development (Manual) | `npm run dev:frontend` |
| **Reverse Proxy & SSL** | `80` & `443` (HTTPS) | Host Publik (`nocrnetwork.com`) | Nginx |

---

## 2. Deployment via Docker Compose (Direkomendasikan)

Stack produksi berjalan secara otomatis dengan container terisolasi dalam jaringan `nocr-net`:

### Step 1: Konfigurasi Environment Produksi
Pastikan file `backend/.env.production` telah terisi kredensial server produksi:
```bash
# Cek / sesuaikan konfigurasi produksi
nano backend/.env.production
```

### Step 2: Build & Jalankan Container
```bash
# Build image Docker dan jalankan di background
docker compose up -d --build

# Cek status container yang aktif
docker compose ps

# Memeriksa log aplikasi live
docker compose logs -f nocr
```

---

## 3. Konfigurasi Nginx Reverse Proxy & SSL

Gunakan konfigurasi pada `nginx_site.conf` untuk mengarahkan request domain publik:
- Request `/socket.io/` dan request aplikasi diteruskan ke upstream `127.0.0.1:9371`.
- Request folder upload `/uploads/` dilayani langsung via alias disk `/backend/data/uploads/`.

Salin dan aktifkan di Nginx:
```bash
sudo cp nginx_site.conf /etc/nginx/sites-available/nocr
sudo ln -s /etc/nginx/sites-available/nocr /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

## 4. Maintenance & Backup Rutin

### Backup Database:
```bash
cd backend
./scripts/backup-db.sh
```

### Sinkronisasi Foto & Database ke Google Drive:
```bash
cd backend
./scripts/sync-all-to-gdrive.sh
```
