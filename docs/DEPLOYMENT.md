# Panduan Deployment NOCR

Dokumen ini menjelaskan tata cara deployment sistem NOCR pada lingkungan server produksi menggunakan Nginx, PM2 / Node service, dan Docker.

---

## 1. Arsitektur Port & Service

| Komponen | Host / Port | Service / Runner |
|---|---|---|
| **PostgreSQL** | `127.0.0.1:5432` | Native PostgreSQL Service atau Docker |
| **Backend (Express + Socket.IO)** | `127.0.0.1:8888` / `9371` | Node.js via PM2 / Systemd |
| **Frontend (Next.js App)** | `127.0.0.1:3000` | Next.js Server via PM2 / Standalone |
| **Reverse Proxy & SSL** | `80` & `443` (HTTPS) | Nginx |

---

## 2. Deployment via PM2 (Bare Metal / VPS)

### Step 1: Install Dependencies
```bash
# Di root direktori
npm install

# Di backend
cd backend && npm install

# Di frontend
cd ../frontend && npm install
npm run build
```

### Step 2: Konfigurasi PM2 (`ecosystem.config.js`)
Jalankan backend dan frontend menggunakan PM2:
```bash
# Jalankan backend
pm2 start backend/server.js --name nocr-backend

# Jalankan frontend
cd frontend && pm2 start npm --name nocr-frontend -- start
```

---

## 3. Konfigurasi Nginx Reverse Proxy

Gunakan konfigurasi pada `nginx_site.conf` untuk mengarahkan request domain publik:
- Request `/socket.io/` dan `/api/*` diteruskan ke Backend (`127.0.0.1:8888`).
- Request halaman UI, static chunks `/_next/` diteruskan ke Frontend (`127.0.0.1:3000`).
- Request folder upload `/uploads/` dilayani langsung via alias disk `/var/www/nocr/backend/data/uploads/`.

Salin dan aktifkan di Nginx:
```bash
sudo cp nginx_site.conf /etc/nginx/sites-available/nocr
sudo ln -s /etc/nginx/sites-available/nocr /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

## 4. Deployment via Docker Compose

Untuk menjalankan seluruh stack secara otomatis:
```bash
docker compose up -d --build
```
Semua container (PostgreSQL dan NOCR App) akan berjalan secara terisolasi dan tersambung dalam jaringan internal `nocr-net`.
