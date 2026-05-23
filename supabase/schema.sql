-- Skema Database NOCR untuk Supabase (PostgreSQL) - Versi Geografis (Leaflet.js)
-- Dapat dijalankan berulang kali (Idempotent) tanpa menghapus data yang ada.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================================
-- 1. PENDAPATAN TABEL-TABEL UTAMA (Sesuai dengan struktur final / fresh setup)
-- =========================================================================

-- Tabel Devices
CREATE TABLE IF NOT EXISTS public.devices (
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

-- Tabel Topology Nodes (Koordinat Geografis)
CREATE TABLE IF NOT EXISTS public.topology_nodes (
    id VARCHAR(100) PRIMARY KEY,
    device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
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

-- Tabel Topology Edges (Link Kabel Fiber Optik)
CREATE TABLE IF NOT EXISTS public.topology_edges (
    id VARCHAR(100) PRIMARY KEY,
    from_node VARCHAR(100) NOT NULL REFERENCES public.topology_nodes(id) ON DELETE CASCADE,
    to_node VARCHAR(100) NOT NULL REFERENCES public.topology_nodes(id) ON DELETE CASCADE,
    label VARCHAR(255),
    status VARCHAR(50) DEFAULT 'up',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabel PPPoE Secrets (Cache + simpan data pelanggan dari MikroTik)
CREATE TABLE IF NOT EXISTS public.pppoe_secrets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID REFERENCES public.devices(id) ON DELETE CASCADE,
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

-- Tabel Network Interfaces (Cache interface dari MikroTik)
CREATE TABLE IF NOT EXISTS public.network_interfaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID REFERENCES public.devices(id) ON DELETE CASCADE,
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

-- Tabel PPPoE Active Sessions (Cache sesi aktif dari MikroTik)
CREATE TABLE IF NOT EXISTS public.pppoe_active (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID REFERENCES public.devices(id) ON DELETE CASCADE,
    ros_id VARCHAR(50),
    name VARCHAR(255),
    address VARCHAR(50),
    caller_id VARCHAR(100),
    service VARCHAR(100),
    uptime VARCHAR(100),
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_device_active_session UNIQUE (device_id, name)
);

-- Tabel Device Status (Status monitoring ping terupdate)
CREATE TABLE IF NOT EXISTS public.device_status (
    device_id UUID PRIMARY KEY REFERENCES public.devices(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'offline',
    latency INTEGER DEFAULT 0,
    last_check TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabel Admin Users (Manajemen Pengguna Panel NOCR)
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'visitor', -- admin | editor | visitor
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabel VPN Settings (Konfigurasi VPN Auto-Dial Backend)
CREATE TABLE IF NOT EXISTS public.vpn_settings (
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

-- Tabel Activity Logs (Penyimpanan Log Aktivitas Sistem NOCR)
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    message TEXT NOT NULL
);

-- Tabel Mappings Manual (Ruijie ke MikroTik)
CREATE TABLE IF NOT EXISTS public.device_mappings (
    ruijie_mac VARCHAR(50) PRIMARY KEY,
    mikrotik_name VARCHAR(255) NOT NULL,
    prefix VARCHAR(255),
    ruijie_alias VARCHAR(255),
    mikrotik_alias VARCHAR(255),
    status_ruijie VARCHAR(50),
    status_mikrotik VARCHAR(50),
    final_status VARCHAR(50),
    issue TEXT,
    is_manual BOOLEAN DEFAULT false,
    is_prefix_manual BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- =========================================================================
-- 2. INDEKS & DATA AWAL (SEED)
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_activity_logs_time ON public.activity_logs (time ASC);

-- Inisialisasi awal VPN settings jika belum ada
INSERT INTO public.vpn_settings (id, name, active_platform)
VALUES (1, 'MikroTik Auto-Dial VPN', 'windows')
ON CONFLICT (id) DO NOTHING;

-- =========================================================================
-- 3. SKRIP MIGRASI / PENYESUAIAN SKEMA TERHADAP DATABASE LAMA
-- (Aman dijalankan jika database sudah terisi data lama)
-- =========================================================================

-- Migrasi topology_nodes
ALTER TABLE public.topology_nodes ADD COLUMN IF NOT EXISTS linked_interface VARCHAR(255) DEFAULT NULL;
ALTER TABLE public.topology_nodes ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'unknown';
ALTER TABLE public.topology_nodes ADD COLUMN IF NOT EXISTS vendor VARCHAR(255) DEFAULT NULL;
ALTER TABLE public.topology_nodes ADD COLUMN IF NOT EXISTS pic_name VARCHAR(255) DEFAULT NULL;
ALTER TABLE public.topology_nodes ADD COLUMN IF NOT EXISTS pic_phone VARCHAR(50) DEFAULT NULL;

-- Migrasi vpn_settings
ALTER TABLE public.vpn_settings ADD COLUMN IF NOT EXISTS windows_name VARCHAR(255) DEFAULT NULL;
ALTER TABLE public.vpn_settings ADD COLUMN IF NOT EXISTS windows_username VARCHAR(255) DEFAULT NULL;
ALTER TABLE public.vpn_settings ADD COLUMN IF NOT EXISTS windows_password VARCHAR(255) DEFAULT NULL;
ALTER TABLE public.vpn_settings ADD COLUMN IF NOT EXISTS linux_name VARCHAR(255) DEFAULT NULL;
ALTER TABLE public.vpn_settings ADD COLUMN IF NOT EXISTS linux_username VARCHAR(255) DEFAULT NULL;
ALTER TABLE public.vpn_settings ADD COLUMN IF NOT EXISTS linux_password VARCHAR(255) DEFAULT NULL;
ALTER TABLE public.vpn_settings ADD COLUMN IF NOT EXISTS active_platform VARCHAR(50) DEFAULT 'windows';

-- Migrasi pppoe_secrets
ALTER TABLE public.pppoe_secrets ADD COLUMN IF NOT EXISTS ros_id VARCHAR(50);
ALTER TABLE public.pppoe_secrets ADD COLUMN IF NOT EXISTS disabled BOOLEAN DEFAULT false;
ALTER TABLE public.pppoe_secrets ADD COLUMN IF NOT EXISTS last_logged_out TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.pppoe_secrets ADD COLUMN IF NOT EXISTS local_address VARCHAR(50);
ALTER TABLE public.pppoe_secrets ADD COLUMN IF NOT EXISTS remote_address VARCHAR(50);
ALTER TABLE public.pppoe_secrets ADD COLUMN IF NOT EXISTS synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Migrasi device_mappings
ALTER TABLE public.device_mappings ADD COLUMN IF NOT EXISTS is_prefix_manual BOOLEAN DEFAULT false;
