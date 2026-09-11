# Arsitektur Sistem NOCR (Network Operations Center)

Dokumen ini menjelaskan arsitektur tingkat tinggi sistem NOCR, komponen penyusun, dan pola komunikasi antar layanan.

---

## 1. Diagram Arsitektur

```mermaid
graph TD
    User([Browser / Web Client]) -->|HTTPS / Next.js UI| Frontend[Frontend (Next.js 15 / React 19)]
    User -->|WebSocket (WSS)| SocketIO[Backend Socket.IO Server]
    Frontend -->|REST API Proxy| ExpressAPI[Backend Express API Server]

    subgraph Backend Core Service [backend/server.js & backend/src/lib/]
        ExpressAPI
        SocketIO
        AuthJWT[Auth JWT & RBAC]
        PingEngine[ICMP Ping Worker]
        MikroTikEngine[MikroTik RouterOS Poller]
        RuijieSync[Ruijie Cloud Sync]
        HSGQEngine[HSGQ OLT Poller]
        WhatsAppBot[WhatsApp-Web.js Client]
        CronWorkers[Automated Cron Jobs]
    end

    subgraph Data Layer
        PostgreSQL[(PostgreSQL 18 Database)]
        PrismaORM[Prisma ORM Client]
        LocalCache[In-Memory Cache & JSON Settings]
        LocalFiles[Uploads & Media Storage]
    end

    ExpressAPI --> PrismaORM
    ExpressAPI --> LocalCache
    PrismaORM --> PostgreSQL
    PingEngine --> SocketIO
    MikroTikEngine --> SocketIO
    RuijieSync --> PostgreSQL
    HSGQEngine --> PostgreSQL
    WhatsAppBot --> LocalFiles

    subgraph Network Hardware Layer
        MikroTikRouters[MikroTik Routers (RouterOS API)]
        RuijieSwitches[Ruijie Cloud / Switches]
        HSGQOLT[HSGQ EPON/GPON OLT]
        TargetDevices[Target Ping Nodes / Sites]
    end

    PingEngine -->|ICMP Ping| TargetDevices
    MikroTikEngine -->|API Port 8728/8729| MikroTikRouters
    RuijieSync -->|OpenAPI HTTPS| RuijieSwitches
    HSGQEngine -->|HTTP/SNMP| HSGQOLT
```

---

## 2. Komponen Utama

### A. Frontend Layer (`frontend/`)
- **Next.js 15 (App Router)**: Menangani server-side rendering, routing halaman, layout, dan dynamic imports.
- **UI & Visualization**: Tailwind CSS v4, Lucide React Icons, Leaflet / React Leaflet untuk mapping geolokasi tower/site, Vis-network untuk diagram topologi jaringan.
- **Client Realtime**: Socket.IO Client untuk menerima pembaruan latency ping, status device, notifikasi alarm, dan log aktivitas secara realtime.

### B. Backend Layer (`backend/`)
- **Express Server**: REST API endpoint untuk CRUD sites, devices, users, roles, settings, reports, topology data, and traffic data.
- **Socket.IO Server**: Hub realtime WebSocket yang membroadcast status ping, device up/down alerts, dan whatsapp status.
- **Hardware Integration Engines**:
  - `mikrotik.js`: Menggunakan `node-routeros` untuk polling interface bandwidth, PPPoE active, ARP, dan IP pool.
  - `ping.js`: Worker ICMP ping berkala untuk ribuan target host.
  - `whatsapp.js`: Bot notifikasi WhatsApp via `whatsapp-web.js` (Puppeteer/Chromium).
  - `gdrivePhotos.js` / `sitesApi.js`: Sinkronisasi foto lokasi dan mapping data.
- **Prisma & DB Client**: ORM query builder dan raw PostgreSQL client (`pg`) dengan pooling.

---

## 3. Aliran Data Realtime (WebSocket)

1. `backend/server.js` menjalankan interval ping dan polling hardware di background.
2. Saat terjadi perubahan status (misal Site DOWN atau UP):
   - Backend mencatat riwayat ke PostgreSQL (`activity_logs` / `site_status_logs`).
   - Backend memancarkan event Socket.IO ke semua client (`ping_update`, `device_alert`).
   - Bot WhatsApp mengirimkan pesan alert ke grup teknisi (jika notifikasi aktif).
3. Frontend menerima event Socket.IO dan memperbarui state React seketika tanpa perlu reload halaman.
