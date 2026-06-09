# NOCR (Network Operations Center)

NOCR adalah sistem monitoring jaringan terpusat (Network Operations Center) yang dikembangkan untuk memonitor, mengelola, dan memetakan infrastruktur jaringan, termasuk MikroTik (Core), perangkat L2TP/PPPoE, dan Access Point Ruijie.

Aplikasi ini menggunakan perpaduan **Next.js** untuk antarmuka pengguna (Frontend), **Node.js** untuk backend/WebSocket server, serta skrip **Python** untuk menjalankan *scraper* di latar belakang.

## Fitur Utama

- 📊 **Dashboard Interaktif**: Ringkasan status perangkat jaringan dan log aktivitas harian.
- 🗺️ **Peta Topologi**: Visualisasi interaktif hubungan antar-*node* jaringan (Core, Router, AP).
- 📡 **MikroTik Core Management**: Pantau status, antarmuka (interface), dan sumber daya router MikroTik pusat secara *real-time*.
- 🌐 **L2TP & PPPoE Monitoring**: Deteksi otomatis dan pemantauan klien PPPoE & tunnel L2TP yang terhubung.
- 📍 **Data Wilayah (Sites)**: Pemetaan dan manajemen koordinat lokasi perangkat untuk visualisasi geografis.
- 📶 **Ruijie AP Monitoring**: Integrasi *scraper* Python otomatis untuk menarik data kesehatan perangkat dari *cloud* Ruijie.
- 🛡️ **VPN Auto-Dial**: Dukungan untuk fitur auto-koneksi VPN (untuk Windows/Linux) jika jaringan terputus.
- 🖥️ **System & Database Health**: Dasbor khusus admin untuk memantau performa CPU, RAM, Uptime server, ukuran & koneksi PostgreSQL, serta manajemen proses *scraper* PM2.
- 🔐 **Role-Based Access Control**: Manajemen peran pengguna (Admin, Editor, Visitor).

## Teknologi yang Digunakan

- **Frontend**: Next.js (App Router), React, Tailwind CSS, Lucide Icons
- **Backend**: Node.js, Express, Socket.io (Real-time updates)
- **Database**: PostgreSQL (Koneksi langsung melalui `pg` module dengan kustom *QueryBuilder*)
- **Background Workers**: Python 3 (Scraper), PM2 (Process Manager)

## Struktur Sistem

Aplikasi ini terdiri dari beberapa *service* utama yang berjalan berdampingan menggunakan PM2:
1. `nocr-app`: Aplikasi utama Next.js.
2. `server.js` (biasanya berjalan beriringan dengan `nocr-app`): Menangani koneksi WebSocket, sinkronisasi API MikroTik, dan pemrosesan *background job*.
3. `ruijie-l2tp` & `ruijie-pppoe`: Skrip scraper Python (`ruijie_scraper.py` & `ruijie_scraper_pppoe.py`) yang mengumpulkan status Ruijie AP dan menyimpannya langsung ke PostgreSQL.

## Prasyarat Server

- **Sistem Operasi**: Linux (Ubuntu/Debian direkomendasikan)
- **Node.js**: Versi 18.x atau lebih baru
- **Python**: Python 3.x (dengan pustaka tambahan seperti `psycopg2`, `requests`, dsb)
- **Database**: PostgreSQL
- **Process Manager**: PM2 (`npm install -g pm2`)

## Konfigurasi

Semua konfigurasi utama diatur di dalam file `.env`. Pastikan Anda telah membuat file tersebut dan mengisi kredensial database PostgreSQL serta konfigurasi lainnya.

Contoh `.env`:
```env
DATABASE_URL=postgresql://postgres:password@192.168.10.6:5432/nocr
# Konfigurasi lainnya...
```

## Cara Menjalankan

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Build Aplikasi**
   ```bash
   npm run build
   ```

3. **Jalankan Aplikasi dengan PM2**
   ```bash
   # Jalankan web app
   pm2 start npm --name "nocr-app" -- run start

   # Jalankan scraper python
   pm2 start /var/www/ruijie-scrape/ruijie_scraper.py --name "ruijie-l2tp" --interpreter python3
   pm2 start /var/www/ruijie-scrape/ruijie_scraper_pppoe.py --name "ruijie-pppoe" --interpreter python3
   
   # Simpan konfigurasi PM2
   pm2 save
   ```

4. **Akses Dashboard**
   Buka browser Anda dan kunjungi alamat IP server atau domain yang telah dikonfigurasi.

## Hak Akses & Peran Pengguna

- **Admin**: Memiliki kontrol penuh terhadap pengaturan sistem, manajemen pengguna, mengubah password *core*, merestart *scraper*, dan semua fitur manipulasi data.
- **Editor**: Dapat menambah/mengubah data perangkat, topologi, dan *site*, namun terbatas pada pengaturan utama.
- **Visitor**: Mode baca-saja (*Read Only*). Hanya bisa melihat statistik, dashboard, peta, dan tabel, tanpa opsi untuk menyimpan perubahan atau mengeksekusi aksi kritis.

---

*Dikembangkan oleh npma.*
