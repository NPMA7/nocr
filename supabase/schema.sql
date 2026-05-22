-- Skema Database NOCR untuk Supabase (PostgreSQL) - Versi Geografis (Leaflet.js)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- PENTING: Jangan hapus tabel jika sudah ada data di dalamnya.
-- Jika ingin mereset ulang database dari awal, silakan aktifkan baris DROP TABLE di bawah ini.
-- DROP TABLE IF EXISTS topology_edges CASCADE;
-- DROP TABLE IF EXISTS topology_nodes CASCADE;
-- DROP TABLE IF EXISTS devices CASCADE;
-- DROP TABLE IF EXISTS device_status CASCADE;
-- DROP TABLE IF EXISTS admin_users CASCADE;
-- DROP TABLE IF EXISTS vpn_settings CASCADE;

-- 1. Tabel Devices
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    username VARCHAR(100),
    password VARCHAR(255),
    port INTEGER DEFAULT 8728,
    type VARCHAR(50) DEFAULT 'mikrotik',
    status VARCHAR(50) DEFAULT 'unknown',
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabel Topology Nodes (Koordinat Geografis)
CREATE TABLE IF NOT EXISTS topology_nodes (
    id VARCHAR(100) PRIMARY KEY,
    device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
    label VARCHAR(255) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    type VARCHAR(50) DEFAULT 'odp', -- olt, odc, odp, pole, client
    group_name VARCHAR(100) DEFAULT 'unknown',
    linked_interface VARCHAR(255) DEFAULT NULL,
    status VARCHAR(50) DEFAULT 'unknown',
    vendor VARCHAR(255) DEFAULT NULL,
    pic_name VARCHAR(255) DEFAULT NULL,
    pic_phone VARCHAR(50) DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabel Topology Edges (Link Kabel Fiber Optik)
CREATE TABLE IF NOT EXISTS topology_edges (
    id VARCHAR(100) PRIMARY KEY,
    from_node VARCHAR(100) NOT NULL REFERENCES topology_nodes(id) ON DELETE CASCADE,
    to_node VARCHAR(100) NOT NULL REFERENCES topology_nodes(id) ON DELETE CASCADE,
    label VARCHAR(255),
    status VARCHAR(50) DEFAULT 'up',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE devices DISABLE ROW LEVEL SECURITY;
ALTER TABLE topology_nodes DISABLE ROW LEVEL SECURITY;
ALTER TABLE topology_edges DISABLE ROW LEVEL SECURITY;

-- 4. Tabel PPPoE Secrets (Cache + simpan data pelanggan dari MikroTik)
CREATE TABLE IF NOT EXISTS pppoe_secrets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
    ros_id VARCHAR(50),  -- .id dari RouterOS (e.g. *1)
    name VARCHAR(255) NOT NULL,
    password VARCHAR(255),
    profile VARCHAR(255) DEFAULT 'default',
    service VARCHAR(255) DEFAULT 'any',
    disabled BOOLEAN DEFAULT false,
    last_logged_out TIMESTAMP WITH TIME ZONE,
    local_address VARCHAR(50),
    remote_address VARCHAR(50),
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_device_secret_name UNIQUE (device_id, name)
);

ALTER TABLE pppoe_secrets DISABLE ROW LEVEL SECURITY;

-- 5. Tabel Network Interfaces (Cache interface dari MikroTik)
CREATE TABLE IF NOT EXISTS network_interfaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
    ros_id VARCHAR(50),  -- .id dari RouterOS
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100),
    mac_address VARCHAR(50),
    mtu INTEGER,
    running BOOLEAN DEFAULT false,
    disabled BOOLEAN DEFAULT false,
    comment TEXT,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_device_interface_name UNIQUE (device_id, name)
);

ALTER TABLE network_interfaces DISABLE ROW LEVEL SECURITY;

-- 6. Tabel PPPoE Active Sessions (Cache sesi aktif dari MikroTik)
CREATE TABLE IF NOT EXISTS pppoe_active (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
    ros_id VARCHAR(50),
    name VARCHAR(255),
    address VARCHAR(50),
    caller_id VARCHAR(100),
    service VARCHAR(100),
    uptime VARCHAR(100),
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_device_active_session UNIQUE (device_id, name)
);

ALTER TABLE pppoe_active DISABLE ROW LEVEL SECURITY;

-- 7. Tabel Device Status (Status monitoring ping terupdate)
CREATE TABLE IF NOT EXISTS device_status (
    device_id UUID PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'offline',
    latency INTEGER DEFAULT 0,
    last_check TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE device_status DISABLE ROW LEVEL SECURITY;

-- 8. Tabel Admin Users (Manajemen Pengguna Panel NOCR)
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'visitor', -- admin | editor | visitor
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE admin_users DISABLE ROW LEVEL SECURITY;

-- 9. Tabel VPN Settings (Konfigurasi VPN Auto-Dial Backend)
CREATE TABLE IF NOT EXISTS vpn_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    name VARCHAR(255) NOT NULL,
    username VARCHAR(255),
    password VARCHAR(255),
    windows_name VARCHAR(255) DEFAULT NULL,
    windows_username VARCHAR(255) DEFAULT NULL,
    windows_password VARCHAR(255) DEFAULT NULL,
    linux_name VARCHAR(255) DEFAULT NULL,
    linux_username VARCHAR(255) DEFAULT NULL,
    linux_password VARCHAR(255) DEFAULT NULL,
    active_platform VARCHAR(50) DEFAULT 'windows',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT single_row CHECK (id = 1)
);

ALTER TABLE vpn_settings DISABLE ROW LEVEL SECURITY;

-- 10. Migrasi/Penyesuaian Kolom Baru (Aman jika tabel sudah ada)
ALTER TABLE topology_nodes ADD COLUMN IF NOT EXISTS linked_interface VARCHAR(255) DEFAULT NULL;
ALTER TABLE topology_nodes ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'unknown';
ALTER TABLE topology_nodes ADD COLUMN IF NOT EXISTS vendor VARCHAR(255) DEFAULT NULL;
ALTER TABLE topology_nodes ADD COLUMN IF NOT EXISTS pic_name VARCHAR(255) DEFAULT NULL;
ALTER TABLE topology_nodes ADD COLUMN IF NOT EXISTS pic_phone VARCHAR(50) DEFAULT NULL;

-- 11. Migrasi/Penyesuaian Kolom VPN Settings Baru (Aman jika tabel sudah ada)
ALTER TABLE vpn_settings ADD COLUMN IF NOT EXISTS windows_name VARCHAR(255) DEFAULT NULL;
ALTER TABLE vpn_settings ADD COLUMN IF NOT EXISTS windows_username VARCHAR(255) DEFAULT NULL;
ALTER TABLE vpn_settings ADD COLUMN IF NOT EXISTS windows_password VARCHAR(255) DEFAULT NULL;
ALTER TABLE vpn_settings ADD COLUMN IF NOT EXISTS linux_name VARCHAR(255) DEFAULT NULL;
ALTER TABLE vpn_settings ADD COLUMN IF NOT EXISTS linux_username VARCHAR(255) DEFAULT NULL;
ALTER TABLE vpn_settings ADD COLUMN IF NOT EXISTS linux_password VARCHAR(255) DEFAULT NULL;
ALTER TABLE vpn_settings ADD COLUMN IF NOT EXISTS active_platform VARCHAR(50) DEFAULT 'windows';

-- 12. Tabel Activity Logs (Penyimpanan Log Aktivitas Sistem NOCR, dipangkas maks 1000 di server)
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    message TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_time ON activity_logs (time ASC);

ALTER TABLE activity_logs DISABLE ROW LEVEL SECURITY;

-- 13. Migrasi/Penyesuaian Kolom PPPoE Secrets Baru (Aman jika tabel sudah ada)
ALTER TABLE pppoe_secrets ADD COLUMN IF NOT EXISTS ros_id VARCHAR(50);
ALTER TABLE pppoe_secrets ADD COLUMN IF NOT EXISTS disabled BOOLEAN DEFAULT false;
ALTER TABLE pppoe_secrets ADD COLUMN IF NOT EXISTS last_logged_out TIMESTAMP WITH TIME ZONE;
ALTER TABLE pppoe_secrets ADD COLUMN IF NOT EXISTS local_address VARCHAR(50);
ALTER TABLE pppoe_secrets ADD COLUMN IF NOT EXISTS remote_address VARCHAR(50);
ALTER TABLE pppoe_secrets ADD COLUMN IF NOT EXISTS synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
