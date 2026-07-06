# 🌐 NOCR: Network Operations Center & Reporting
**Sistem Pemantauan Terpadu & Manajemen Infrastruktur Jaringan**

![Status](https://img.shields.io/badge/Status-Production_Ready-success?style=for-the-badge) ![Version](https://img.shields.io/badge/Version-1.0.0-blue?style=for-the-badge) ![Tech](https://img.shields.io/badge/Platform-Next.js_15_|_Node.js_|_PostgreSQL-black?style=for-the-badge)

---

## 📑 Ringkasan Eksekutif
**NOCR (Network Operations Center & Reporting)** adalah platform *Network Management System* (NMS) berbasis web mutakhir yang dirancang khusus untuk memusatkan, mengotomatisasi, dan mengamankan operasi jaringan berskala menengah hingga besar. Sistem ini secara khusus ditargetkan untuk **Dinas Komunikasi dan Informatika (Diskominfo), Penyedia Layanan Internet (ISP), dan Institusi Enterprise**.

NOCR menjembatani berbagai perangkat dari berbagai vendor (MikroTik, HSGQ, Ruijie) ke dalam satu pintu komando (*Single Pane of Glass*), dilengkapi dengan pelaporan otomatis dan integrasi WhatsApp terdedikasi.

---

## 🚨 Latar Belakang Masalah
Dalam operasional infrastruktur jaringan modern, instansi sering kali menghadapi tantangan berikut:
1. **Sistem Terpecah (Fragmented Systems):** Tim IT harus membuka banyak aplikasi bawaan vendor (Winbox untuk MikroTik, Web GUI untuk OLT, Ruijie Cloud untuk AP) secara terpisah hanya untuk melihat status jaringan.
2. **Keterlambatan Penanganan (High MTTR):** Informasi gangguan sering kali baru diketahui *setelah* pengguna/masyarakat melapor. Tidak ada deteksi dini yang otomatis.
3. **Risiko Keamanan Akses:** Pembagian kredensial (seperti *password* administrator) sering kali diberikan secara penuh kepada teknisi tingkat bawah karena kurangnya sistem pembatasan akses (*Granular Access*).
4. **Pelaporan Manual yang Menyita Waktu:** Proses rekapitulasi gangguan, koneksi, dan laporan harian untuk pimpinan masih dikerjakan secara manual.

---

## 💡 Solusi yang NOCR Hadirkan
NOCR mengeliminasi masalah-masalah di atas melalui ekosistem yang terotomatisasi dan aman:

### 1. 🎯 *Single Pane of Glass* (Pemantauan Terpusat)
Memantau seluruh aset secara *Real-Time* menggunakan teknologi **WebSockets**.
- **MikroTik Core:** Pantau *Interface*, penggunaan CPU/Memory, serta manajemen *Tunnel* L2TP & PPPoE aktif.
- **HSGQ OLT:** Pantau redaman optik dan kelola perangkat ONU/ONT dari jarak jauh.
- **Ruijie AP:** Lacak status seluruh perangkat pemancar WiFi secara terpusat di berbagai area (Menggunakan modul eksternal [ruijie-scrape](https://github.com/NPMA7/ruijie-scrape)).
- **Peta Topologi Cerdas:** Visualisasi jaringan menggunakan `vis-network` dan peta interaktif `Leaflet`.

### 2. 🤖 Otomatisasi & Peringatan Dini (*Early Warning System*)
- **WhatsApp Gateway Terintegrasi:** Berjalan langsung di dalam server aplikasi (`whatsapp-web.js`), sistem secara cerdas akan mendeteksi node/perangkat yang *offline* atau latensi tinggi, lalu mengirim pesan WhatsApp secara instan ke grup teknisi.
- **Auto-Generated PDF Reports:** Laporan harian operasi jaringan (*Daily Reports*) dapat di-generate menjadi format dokumen resmi secara otomatis dan dikirimkan ke meja pimpinan.

### 3. 🛡️ Keamanan & Hak Akses Berstandar Enterprise (Granular RBAC)
Tidak semua teknisi membutuhkan akses penuh. NOCR dilengkapi dengan manajemen *Role-Based Access Control* (RBAC) granular:
- **Batasan per Modul (CRUD):** *Super-Admin* dapat mendefinisikan *role* (misalnya: *Helpdesk*, *Network Engineer*). *Helpdesk* mungkin hanya diberi akses **Read** untuk melihat status tanpa bisa memutuskan koneksi, sementara *Engineer* bisa memiliki akses **Update** dan **Delete**.
- **Keamanan Data Mutakhir:** Memanfaatkan enkripsi *bcrypt* dan JSON Web Tokens (JWT) dengan *backend* PostgreSQL (Supabase/Prisma ORM) untuk integritas data tingkat tinggi.

---

## ⚙️ Arsitektur Teknologi

Aplikasi ini tidak dibangun dengan tumpukan teknologi lawas. NOCR menggunakan standar industri teknologi tahun 2024-2025:

| Komponen | Teknologi yang Digunakan |
| :--- | :--- |
| **Frontend Framework** | **Next.js 15 (App Router)** & **React 19** untuk rendering super cepat. |
| **Styling & UI** | **TailwindCSS 4** & **Lucide Icons** dengan desain *Glassmorphism* & *Dark Mode* modern yang elegan. |
| **Backend API** | **Node.js** terintegrasi, dengan *socket.io* untuk aliran data 2 arah secara *real-time*. |
| **Database & ORM** | **PostgreSQL** (*Supabase*) dikelola menggunakan **Prisma Client** modern. |
| **Integrasi Perangkat** | `node-routeros` (MikroTik API), REST API HSGQ, [ruijie-scrape](https://github.com/NPMA7/ruijie-scrape) (Ruijie API), dan `ping` Daemon. |

---

## 📈 Potensi Dampak / *Return on Investment* (ROI)
Bagi Instansi atau ISP yang mengadopsi NOCR:
1. **Efisiensi Waktu (SLA Meningkat):** Waktu identifikasi gangguan berkurang drastis berkat sistem *monitoring realtime* dan integrasi WhatsApp. Keluhan publik/pengguna dapat ditekan.
2. **Akuntabilitas Kinerja:** Setiap klik dan perubahan konfigurasi dicatat dalam **Log Aktivitas** yang permanen, memudahkan proses audit investigasi (*Who did what and when*).

---

> *"NOCR bukan sekadar alat pemantau; ini adalah pusat komando cerdas yang merampingkan kerumitan infrastruktur IT Anda menjadi sebuah kanvas yang bersih, responsif, dan sangat aman."*

**Siap untuk melakukan modernisasi infrastruktur jaringan instansi Anda?** 
Mari jadwalkan demonstrasi (*Live Demo*) aplikasi NOCR.
