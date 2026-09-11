# Referensi REST API & WebSocket NOCR

Dokumen ini berisi spesifikasi endpoint REST API dan event WebSocket yang tersedia pada Backend NOCR untuk integrasi Frontend.

---

## 1. Otentikasi & Authorization

Semua request privat wajib menyertakan Authorization Header atau Cookie:
- **Header:** `Authorization: Bearer <JWT_TOKEN>`
- **Cookie:** `nocr_token=<JWT_TOKEN>`

### Endpoint Auth
- `POST /api/auth/login`: Login user dengan username & password.
- `POST /api/auth/logout`: Menghapus session token.
- `GET /api/auth/me`: Mendapatkan data profil dan hak akses user yang sedang login.

---

## 2. Ringkasan Endpoint REST API

| Endpoint | Method | Deskripsi | Hak Akses |
|---|---|---|---|
| `/api/nocr/overview` | `GET` | Ringkasan metrik dashboard (total sites, UP/DOWN count, flapping) | Read |
| `/api/nocr/sites` | `GET`, `POST` | Mendapatkan list site atau menambahkan site baru | Read / Write |
| `/api/sites` | `GET`, `POST`, `PUT`, `DELETE` | CRUD data Site NOC | Read / Manage |
| `/api/sites/:ruijie_mac` | `GET`, `PUT`, `DELETE` | Detail site berdasarkan MAC address | Read / Manage |
| `/api/sites/:ruijie_mac/evidence` | `POST`, `GET` | Upload & ambil foto bukti instalasi | Write / Read |
| `/api/devices` | `GET`, `POST`, `PUT`, `DELETE` | CRUD data Router, Switch, OLT, Server | Read / Manage |
| `/api/ping` | `GET`, `POST` | Cek status ping manual atau daftar target ping | Read / Execute |
| `/api/monitor/mikrotik` | `GET` | Data real-time interface, traffic, dan resource MikroTik | Read |
| `/api/monitor/pppoe` | `GET` | Data pelanggan PPPoE aktif | Read |
| `/api/ruijie` | `GET`, `POST` | Data switch / AP dari Ruijie Cloud | Read / Sync |
| `/api/hsgq-olt` | `GET` | Data status PON & ONT HSGQ OLT | Read |
| `/api/topology` | `GET`, `POST` | Data node & edge topologi jaringan untuk visualisasi | Read / Manage |
| `/api/traffic/all` | `GET` | Riwayat agregasi traffic bandwidth harian/mingguan | Read |
| `/api/activity-logs` | `GET` | Daftar log aktivitas sistem & audit trail | Read |
| `/api/reports` | `GET` | Ekspor laporan PDF / Excel SLA uptime | Read |
| `/api/roles` | `GET`, `POST`, `PUT`, `DELETE` | Manajemen Role & Permission RBAC | Admin Only |
| `/api/settings/server` | `GET`, `POST` | Pengaturan interval ping, timeout & sync background | Admin Only |
| `/api/settings/company` | `GET`, `POST` | Pengaturan identitas perusahaan / branding | Admin Only |
| `/api/whatsapp/status` | `GET` | Status koneksi bot WhatsApp (QR code / Connected) | Admin / Read |
| `/api/whatsapp/chat` | `GET`, `POST` | Mengambil riwayat pesan / kirim pesan WhatsApp | Admin / Write |

---

## 3. Kontrak WebSocket (Socket.IO)

Koneksi Socket.IO menggunakan path default `/socket.io/` dengan token JWT pada `auth.token` atau cookie `nocr_token`.

### Event yang Dipancarkan Server (Server -> Client)

| Event Name | Payload Format | Keterangan |
|---|---|---|
| `ping_update` | `{ targets: Array<{ id, ip, status, latency, last_seen }> }` | Dikirim setiap interval ping selesai |
| `site_status_change` | `{ site_id, name, old_status, new_status, timestamp }` | Dikirim seketika saat ada site DOWN atau UP |
| `traffic_tick` | `{ timestamp, rx_bps, tx_bps, total_mbps }` | Data bandwidth real-time |
| `whatsapp_qr` | `{ qr: string }` | QR code untuk scan login WhatsApp bot |
| `whatsapp_ready` | `{ ready: boolean, phone: string }` | Notifikasi status WhatsApp terhubung |
| `system_health` | `{ cpu, memory, uptime, disk }` | Status utilisasi resource server |

### Event yang Dikirim Client (Client -> Server)

| Event Name | Payload Format | Keterangan |
|---|---|---|
| `subscribe_site` | `{ site_id: string }` | Berlangganan update detail 1 site tertentu |
| `unsubscribe_site`| `{ site_id: string }` | Berhenti berlangganan update detail site |
| `force_ping` | `{ ip: string }` | Meminta server melakukan ping instan ke IP |
