# Panduan Kolaborasi Tim NOCR (Frontend & Backend)

Dokumen ini adalah panduan standar untuk mempermudah kolaborasi antara tim **Backend** dan **Frontend** pada proyek NOCR.

---

## 1. Pembagian Peran & Tanggung Jawab

| Peran | Tanggung Jawab Utama | Folder Kerja | Kontak / Lead |
|---|---|---|---|
| **Backend Engineer** | REST API, WebSocket (Socket.IO), Database PostgreSQL & Prisma, Background Sync (MikroTik, Ruijie, OLT, Ping Loop), WhatsApp Bot, Security & Auth | `backend/` | Backend Dev |
| **Frontend Engineer** | User Interface (React 19, Next.js App Router), Styling & Responsiveness (Tailwind CSS), Map Visualization (Leaflet/OSM), State Management, Real-time UI Updates | `frontend/` | Frontend Dev |

---

## 2. Struktur Repository

```text
nocr/
├── backend/               # Workspace Node.js / Express / Socket.IO / Prisma
│   ├── server.js          # Main server & worker runner
│   ├── src/lib/           # Core library (MikroTik, DB, Auth, WhatsApp, OLT)
│   ├── database/          # SQL scripts & schema PostgreSQL
│   ├── prisma/            # Prisma ORM schema & migrations
│   ├── scripts/           # Maintenance scripts (Backup DB, Drive Sync)
│   ├── data/              # Storage runtime (uploads/, server-settings.json)
│   ├── package.json       # Dependencies backend
│   ├── .env.development  # Konfigurasi dev lokal (Port 8888, Demo mode)
│   └── .env.production   # Konfigurasi prod server (Port 9371)
│
├── frontend/              # Workspace Next.js App Router & React UI
│   ├── src/app/           # Next.js Pages & Layouts
│   ├── src/components/    # Reusable UI Components (Dashboard, Maps, Topology)
│   ├── src/hooks/         # Custom React Hooks
│   ├── src/lib/           # Frontend utilities (themes, helpers)
│   ├── public/            # Static assets (images, logos, audio)
│   ├── package.json       # Dependencies frontend
│   ├── .env.development  # Target backend dev (http://localhost:8888)
│   └── .env.production   # Target backend prod (http://localhost:9371)
│
├── docs/                  # Dokumentasi teknis & spesifikasi API
│   ├── ARCHITECTURE.md    # Arsitektur sistem & aliran data
│   ├── API_REFERENCE.md   # Spesifikasi REST API & Socket Events
│   ├── COLLABORATION_GUIDE.md # Panduan ini
│   ├── DATABASE.md        # Dokumentasi skema PostgreSQL
│   └── DEPLOYMENT.md      # Panduan instalasi lokal & server
│
├── docker-compose.yml     # Container database & app orchestration
├── Dockerfile             # Multi-stage production container build
├── package.json           # Root package.json (Shortcut scripts)
└── README.md              # Dokumentasi umum
```

---

## 3. Workflow Pengembangan Lokal

### A. Instalasi Dependensi
```bash
# Di root direktori (Install kedua folder):
npm run install:all

# Atau install mandiri:
npm run install:backend   # di folder backend/
npm run install:frontend  # di folder frontend/
```

### B. Menjalankan Backend Saja (Bagi Backend Dev)
```bash
npm run dev:backend
# atau:
cd backend && npm run dev
```
Backend akan berjalan pada `http://localhost:8888` dengan `DEMO_MODE=true` (aman tanpa mengganggu perangkat jaringan fisik).

### C. Menjalankan Frontend Saja (Bagi Frontend Dev)
```bash
npm run dev:frontend
# atau:
cd frontend && npm run dev
```
Frontend akan berjalan pada `http://localhost:3000` dan otomatis terhubung ke backend dev (`http://localhost:8888`) atau bisa diarahkan ke backend staging/prod via `frontend/.env.development`.

---

## 4. Standar Alur Git & Branching

1. **Branch Utama:**
   - `master` / `main`: Branch produksi yang selalu stabil.
   - `staging` / `dev`: Branch integrasi sebelum rilis ke production.

2. **Format Penamaan Feature Branch:**
   - Frontend: `feat/fe-<nama-fitur>` (contoh: `feat/fe-topology-map`)
   - Backend: `feat/be-<nama-fitur>` (contoh: `feat/be-mikrotik-sync`)
   - Bugfix: `fix/fe-<nama-bug>` atau `fix/be-<nama-bug>`
   - Dokumen: `docs/<nama-dokumen>`

3. **Pull Request (PR) & Code Review:**
   - Setiap perubahan dibuat melalui Pull Request ke branch `staging` atau `master`.
   - Lakukan code review silang: Frontend dev mereview dampak UI, Backend dev mereview dampak performa/keamanan API.

---

## 5. Kontrak API & Komunikasi Perubahan

1. **API First / Kontrak Terlebih Dahulu:**
   - Sebelum membuat fitur baru yang melibatkan data baru, Backend dan Frontend sepakati bentuk payload request dan response terlebih dahulu di [docs/API_REFERENCE.md](file:///var/www/nocr/docs/API_REFERENCE.md).
2. **Real-time Event Contract:**
   - Daftar event WebSocket Socket.IO (misal: `ping_update`, `traffic_update`, `device_status_change`) harus terdokumentasi di [docs/API_REFERENCE.md](file:///var/www/nocr/docs/API_REFERENCE.md).
3. **Breaking Change Notification:**
   - Jika Backend mengubah struktur data yang sudah ada, wajib memberitahu Frontend dev sebelum melakukan merge ke branch bersama.

---

## 6. Penanganan Environment Variables (.env)

- **Backend:** Gunakan `backend/.env.development` untuk dev lokal dan `backend/.env.production` untuk server produksi.
- **Frontend:** Gunakan `frontend/.env.development` untuk dev lokal dan `frontend/.env.production` untuk build produksi.
- **PENTING:** File `.env.development` dan `.env.production` otomatis diabaikan oleh Git (`.gitignore`). Hanya file `.env.example` yang dikomit sebagai template.
