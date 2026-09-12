/**
 * NOCR - Dummy Data Seeder for Local Development
 * 
 * Script ini mengisi database lokal developer dengan data dummy:
 * - Akun User (Admin, Teknisi, Visitor)
 * - Access Roles & Permissions
 * - Perangkat Jaringan (MikroTik, OLT, Switch)
 * - Device Mappings & Sites (Desa & OPD) beserta koordinat peta
 * - Activity Logs dummy
 * 
 * Aman dijalankan berulang kali (Idempotent / Upsert).
 */

const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

// Muat konfigurasi .env.development jika ada, atau fallback ke .env
const envDevPath = path.resolve(__dirname, '../.env.development');
const envDefaultPath = path.resolve(__dirname, '../.env');

if (fs.existsSync(envDevPath)) {
    require('dotenv').config({ path: envDevPath });
} else if (fs.existsSync(envDefaultPath)) {
    require('dotenv').config({ path: envDefaultPath });
} else {
    require('dotenv').config();
}

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@127.0.0.1:5432/nocr?schema=public';
console.log(`\n🌱 [NOCR SEEDER] Menghubungkan ke: ${connectionString.replace(/:[^:@]+@/, ':****@')}`);

const pool = new Pool({ connectionString });

async function seed() {
    const client = await pool.connect();
    try {
        console.log('🚀 Memulai pengisian data dummy untuk pengembangan lokal...');

        // 1. Pastikan ekstensi uuid tersedia
        await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
        await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

        // 2. Seed Access Roles
        console.log('📦 Menyiapkan Access Roles...');
        const allMenus = [
            'dashboard', 'monitoring-l2tp', 'monitoring-pppoe', 'devices-ruijie',
            'devices-mikrotik', 'devices-hsgq', 'sites', 'topology', 'maps',
            'laporan-harian', 'settings-company', 'settings-mikrotik', 'settings-vpn',
            'settings-health', 'settings-users', 'settings-roles', 'settings-apikeys',
            'settings-password', 'settings-system'
        ];

        const adminPermissions = {};
        allMenus.forEach(m => {
            adminPermissions[m] = ['read', 'create', 'update', 'delete'];
        });

        const teknisiPermissions = {};
        ['dashboard', 'monitoring-l2tp', 'monitoring-pppoe', 'devices-ruijie',
         'devices-mikrotik', 'devices-hsgq', 'sites', 'topology', 'maps', 'laporan-harian']
            .forEach(m => {
                teknisiPermissions[m] = ['read', 'create', 'update'];
            });

        const visitorPermissions = {};
        ['dashboard', 'maps', 'topology'].forEach(m => {
            visitorPermissions[m] = ['read'];
        });

        const roles = [
            { name: 'admin', desc: 'Super Administrator', perms: adminPermissions },
            { name: 'teknisi', desc: 'Teknisi Lapangan / NOC', perms: teknisiPermissions },
            { name: 'visitor', desc: 'Tamu / Read Only', perms: visitorPermissions },
        ];

        for (const r of roles) {
            await client.query(`
                INSERT INTO access_roles (name, description, permissions)
                VALUES ($1, $2, $3::jsonb)
                ON CONFLICT (name) DO UPDATE 
                SET description = EXCLUDED.description, permissions = EXCLUDED.permissions;
            `, [r.name, r.desc, JSON.stringify(r.perms)]);
        }

        // 3. Seed Users (Password default: password123)
        console.log('👤 Menyiapkan Akun Pengguna Dummy...');
        const salt = await bcrypt.genSalt(10);
        const defaultPasswordHash = await bcrypt.hash('password123', salt);

        const users = [
            { username: 'admin', role: 'admin' },
            { username: 'teknisi', role: 'teknisi' },
            { username: 'visitor', role: 'visitor' },
        ];

        for (const u of users) {
            await client.query(`
                INSERT INTO users (username, password_hash, role)
                VALUES ($1, $2, $3)
                ON CONFLICT (username) DO UPDATE
                SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role;
            `, [u.username, defaultPasswordHash, u.role]);
        }
        console.log('   ✓ Akun admin: user "admin" / pass "password123"');
        console.log('   ✓ Akun teknisi: user "teknisi" / pass "password123"');
        console.log('   ✓ Akun visitor: user "visitor" / pass "password123"');

        // 4. Seed Devices
        console.log('📡 Menyiapkan Perangkat Jaringan Dummy...');
        const devices = [
            { name: 'Core-Router-Mikrotik-01', ip: '192.168.88.1', type: 'mikrotik', status: 'online' },
            { name: 'OLT-HSGQ-Core-01', ip: '192.168.1.100', type: 'olt', status: 'online' },
            { name: 'Switch-Ruijie-Agg-01', ip: '192.168.1.2', type: 'ruijie', status: 'online' },
        ];

        for (const d of devices) {
            const devRes = await client.query(`
                INSERT INTO devices (name, ip_address, type, status, port)
                VALUES ($1, $2, $3, $4, 8728)
                ON CONFLICT DO NOTHING
                RETURNING id;
            `, [d.name, d.ip, d.type, d.status]);

            const devId = devRes.rows[0]?.id;
            if (devId) {
                await client.query(`
                    INSERT INTO device_status (device_id, status, latency)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (device_id) DO UPDATE
                    SET status = EXCLUDED.status, latency = EXCLUDED.latency;
                `, [devId, d.status, Math.floor(Math.random() * 15) + 2]);
            }
        }

        // 5. Seed Device Mappings & Sites (Lokasi Peta Dummy)
        console.log('🗺️ Menyiapkan Data Site & Titik Koordinat Peta Dummy...');
        const dummySites = [
            {
                mac: '00:11:22:33:44:01',
                name: 'DESA-SUKAMAKMUR',
                alias: 'Kantor Desa Sukamakmur',
                prefix: 'DESA-SUKAMAKMUR',
                type: 'l2tp',
                status: 'online',
                lat: -6.4150,
                lng: 106.8320,
                address: 'Jl. Raya Sukamakmur No. 12'
            },
            {
                mac: '00:11:22:33:44:02',
                name: 'DESA-BOJONGGEDE',
                alias: 'Kantor Desa Bojonggede',
                prefix: 'DESA-BOJONGGEDE',
                type: 'l2tp',
                status: 'online',
                lat: -6.4950,
                lng: 106.7970,
                address: 'Jl. Bojong Indah No. 45'
            },
            {
                mac: '00:11:22:33:44:03',
                name: 'OPD-DISMINFO',
                alias: 'Dinas Komunikasi dan Informatika',
                prefix: 'OPD-DISMINFO',
                type: 'pppoe',
                status: 'online',
                lat: -6.4820,
                lng: 106.8400,
                address: 'Komplek Perkantoran Pemda Blok A'
            },
            {
                mac: '00:11:22:33:44:04',
                name: 'OPD-BAPPEDA',
                alias: 'Badan Perencanaan Pembangunan',
                prefix: 'OPD-BAPPEDA',
                type: 'pppoe',
                status: 'offline',
                lat: -6.4850,
                lng: 106.8450,
                address: 'Komplek Perkantoran Pemda Blok B'
            },
            {
                mac: '00:11:22:33:44:05',
                name: 'DESA-CIBINONG',
                alias: 'Kantor Kelurahan Cibinong',
                prefix: 'DESA-CIBINONG',
                type: 'l2tp',
                status: 'online',
                lat: -6.4800,
                lng: 106.8550,
                address: 'Jl. Raya Jakarta-Bogor KM 42'
            },
        ];

        for (const s of dummySites) {
            // Upsert device_mapping
            await client.query(`
                INSERT INTO device_mappings (
                    ruijie_mac, mikrotik_name, prefix, ruijie_alias, mikrotik_alias,
                    status_ruijie, status_mikrotik, final_status
                )
                VALUES ($1, $2, $3, $4, $4, $5, $5, $5)
                ON CONFLICT (ruijie_mac) DO UPDATE
                SET mikrotik_name = EXCLUDED.mikrotik_name,
                    prefix = EXCLUDED.prefix,
                    ruijie_alias = EXCLUDED.ruijie_alias,
                    status_ruijie = EXCLUDED.status_ruijie,
                    status_mikrotik = EXCLUDED.status_mikrotik,
                    final_status = EXCLUDED.final_status;
            `, [s.mac, s.name, s.prefix, s.alias, s.status]);

            // Upsert sites
            await client.query(`
                INSERT INTO sites (ruijie_mac, connection_type, vendor, latitude, longitude, full_address)
                VALUES ($1, $2, 'Ruijie', $3, $4, $5)
                ON CONFLICT (ruijie_mac) DO UPDATE
                SET connection_type = EXCLUDED.connection_type,
                    latitude = EXCLUDED.latitude,
                    longitude = EXCLUDED.longitude,
                    full_address = EXCLUDED.full_address;
            `, [s.mac, s.type, s.lat, s.lng, s.address]);
        }

        // 6. Seed Activity Logs Dummy
        console.log('📝 Menyiapkan Riwayat Log Aktivitas Dummy...');
        const sampleLogs = [
            'Sistem NOCR Dev Mode berhasil diinisialisasi.',
            'DESA-BOJONGGEDE status berubah menjadi ONLINE (Latency: 8ms)',
            'DESA-SUKAMAKMUR status berubah menjadi ONLINE (Latency: 12ms)',
            'OPD-DISMINFO status berubah menjadi ONLINE (Latency: 5ms)',
            'OPD-BAPPEDA status berubah menjadi OFFLINE (Unreachable)',
        ];

        for (const msg of sampleLogs) {
            await client.query(`
                INSERT INTO activity_logs (message, time)
                VALUES ($1, NOW() - (random() * interval '6 hours'));
            `, [msg]);
        }

        console.log('\n✅ [SUKSES] Seluruh data dummy pengujian berhasil dibuat!');
        console.log('   Silakan login di dev mode dengan:');
        console.log('   👉 Username: admin');
        console.log('   👉 Password: password123\n');

    } catch (err) {
        console.error('\n❌ Gagal terhubung atau menjalankan seeder:');
        if (err.code === '28P01') {
            console.error('   👉 Autentikasi gagal (username/password DB salah).');
            console.error('   👉 Pastikan DATABASE_URL di .env.development mengarah ke database lokal Anda.');
        } else if (err.code === 'ECONNREFUSED') {
            console.error('   👉 Tidak dapat terhubung ke PostgreSQL (Koneksi ditolak).');
            console.error('   👉 Pastikan service PostgreSQL lokal / Docker Postgres di PC Anda sudah aktif.');
        } else {
            console.error('   👉 Pesan error:', err.message || err);
        }
        console.error('\nTips: Di PC developer, buat database lokal bernama "nocr_dev" lalu sesuaikan DATABASE_URL di backend/.env.development.\n');
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

seed();
