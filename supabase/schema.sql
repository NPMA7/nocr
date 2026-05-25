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
    site_id UUID DEFAULT NULL,
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
ALTER TABLE public.topology_nodes ADD COLUMN IF NOT EXISTS site_id UUID DEFAULT NULL;

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

-- =========================================================================
-- 4. SITES / WILAYAH (Detail L2TP — ujicoba, dapat diperluas ke tipe lain)
-- =========================================================================

-- Tabel Sites: metadata wilayah per tautan L2TP (device_mappings)
CREATE TABLE IF NOT EXISTS public.sites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ruijie_mac VARCHAR(50) UNIQUE NOT NULL REFERENCES public.device_mappings(ruijie_mac) ON DELETE CASCADE,
    connection_type VARCHAR(50) NOT NULL DEFAULT 'l2tp',
    vendor VARCHAR(255) DEFAULT NULL,
    customer_id VARCHAR(255) DEFAULT NULL,
    activation_date DATE DEFAULT NULL,
    full_address TEXT DEFAULT NULL,
    latitude DOUBLE PRECISION DEFAULT NULL,
    longitude DOUBLE PRECISION DEFAULT NULL,
    topology_node_id VARCHAR(100) DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabel PIC per site (boleh lebih dari satu)
CREATE TABLE IF NOT EXISTS public.site_pics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) DEFAULT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sites_ruijie_mac ON public.sites (ruijie_mac);
CREATE INDEX IF NOT EXISTS idx_sites_connection_type ON public.sites (connection_type);
CREATE INDEX IF NOT EXISTS idx_site_pics_site_id ON public.site_pics (site_id);

-- FK tautan topology_nodes ↔ sites (setelah kedua tabel ada)
ALTER TABLE public.topology_nodes DROP CONSTRAINT IF EXISTS topology_nodes_site_id_fkey;
ALTER TABLE public.topology_nodes
    ADD CONSTRAINT topology_nodes_site_id_fkey
    FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE SET NULL;

ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS topology_node_id VARCHAR(100) DEFAULT NULL;
ALTER TABLE public.sites DROP CONSTRAINT IF EXISTS sites_topology_node_id_fkey;
ALTER TABLE public.sites
    ADD CONSTRAINT sites_topology_node_id_fkey
    FOREIGN KEY (topology_node_id) REFERENCES public.topology_nodes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_topology_nodes_site_id ON public.topology_nodes (site_id);

-- Vendor / PIC / koordinat wilayah hanya di sites + site_pics (bukan di topology_nodes).
-- topology_nodes menyimpan posisi peta (latitude/longitude) + site_id (tautan 1:1).

DROP INDEX IF EXISTS public.idx_topology_nodes_site_id_unique;
DROP INDEX IF EXISTS public.idx_sites_topology_node_id_unique;

-- Pindahkan data lama topology_nodes.vendor / pic_name / pic_phone → sites + site_pics (jika kolom lama masih ada)
DO $migrate_topology_vendor$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'topology_nodes'
          AND column_name = 'vendor'
    ) THEN
        INSERT INTO public.sites (ruijie_mac, connection_type, vendor, latitude, longitude, topology_node_id)
        SELECT DISTINCT ON (m.ruijie_mac)
            m.ruijie_mac,
            'l2tp',
            n.vendor,
            n.latitude,
            n.longitude,
            n.id
        FROM public.topology_nodes n
        INNER JOIN public.device_mappings m
            ON LOWER(TRIM(n.linked_interface)) = LOWER(TRIM(m.prefix))
        WHERE n.linked_interface IS NOT NULL
          AND m.prefix IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM public.sites s WHERE s.ruijie_mac = m.ruijie_mac)
        ORDER BY m.ruijie_mac, n.created_at ASC NULLS LAST, n.id ASC;

        UPDATE public.sites
        SET
            vendor = COALESCE(sites.vendor, n.vendor),
            latitude = COALESCE(sites.latitude, n.latitude),
            longitude = COALESCE(sites.longitude, n.longitude),
            topology_node_id = COALESCE(sites.topology_node_id, n.id),
            updated_at = CURRENT_TIMESTAMP
        FROM public.topology_nodes n
        INNER JOIN public.device_mappings m
            ON LOWER(TRIM(n.linked_interface)) = LOWER(TRIM(m.prefix))
        WHERE sites.ruijie_mac = m.ruijie_mac
          AND n.linked_interface IS NOT NULL
          AND m.prefix IS NOT NULL
          AND (n.vendor IS NOT NULL OR n.pic_name IS NOT NULL OR n.pic_phone IS NOT NULL);

        INSERT INTO public.site_pics (site_id, name, phone, sort_order)
        SELECT s.id, TRIM(n.pic_name), NULLIF(TRIM(n.pic_phone), ''), 0
        FROM public.topology_nodes n
        INNER JOIN public.device_mappings m
            ON LOWER(TRIM(n.linked_interface)) = LOWER(TRIM(m.prefix))
        INNER JOIN public.sites s ON s.ruijie_mac = m.ruijie_mac
        WHERE n.pic_name IS NOT NULL AND TRIM(n.pic_name) <> ''
          AND NOT EXISTS (
              SELECT 1 FROM public.site_pics sp
              WHERE sp.site_id = s.id AND sp.sort_order = 0
          );
    END IF;
END
$migrate_topology_vendor$;

ALTER TABLE public.topology_nodes DROP COLUMN IF EXISTS vendor;
ALTER TABLE public.topology_nodes DROP COLUMN IF EXISTS pic_name;
ALTER TABLE public.topology_nodes DROP COLUMN IF EXISTS pic_phone;

-- Backfill sites dari node yang punya prefix L2TP (tanpa kolom vendor di topology)
INSERT INTO public.sites (ruijie_mac, connection_type, latitude, longitude, topology_node_id)
SELECT DISTINCT ON (m.ruijie_mac)
    m.ruijie_mac,
    'l2tp',
    n.latitude,
    n.longitude,
    n.id
FROM public.topology_nodes n
INNER JOIN public.device_mappings m ON LOWER(TRIM(n.linked_interface)) = LOWER(TRIM(m.prefix))
WHERE n.linked_interface IS NOT NULL
  AND m.prefix IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.sites s WHERE s.ruijie_mac = m.ruijie_mac)
ORDER BY m.ruijie_mac, n.created_at ASC NULLS LAST, n.id ASC
ON CONFLICT (ruijie_mac) DO NOTHING;

-- Tautan 1:1 node ↔ site (satu statement: CTE tidak boleh dipakai di query terpisah)
WITH node_site_pairs AS (
    SELECT DISTINCT ON (s.id)
        n.id AS node_id,
        s.id AS site_id
    FROM public.sites s
    INNER JOIN public.device_mappings m ON m.ruijie_mac = s.ruijie_mac
    INNER JOIN public.topology_nodes n
        ON n.linked_interface IS NOT NULL
        AND m.prefix IS NOT NULL
        AND LOWER(TRIM(n.linked_interface)) = LOWER(TRIM(m.prefix))
    ORDER BY
        s.id,
        (s.topology_node_id IS NOT NULL AND n.id = s.topology_node_id) DESC,
        n.created_at ASC NULLS LAST,
        n.id ASC
),
cleared AS (
    UPDATE public.topology_nodes n
    SET site_id = NULL
    WHERE n.site_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM node_site_pairs p WHERE p.node_id = n.id AND p.site_id = n.site_id
      )
    RETURNING 1
),
linked_nodes AS (
    UPDATE public.topology_nodes n
    SET site_id = p.site_id
    FROM node_site_pairs p
    WHERE n.id = p.node_id
    RETURNING n.id
)
UPDATE public.sites s
SET topology_node_id = p.node_id
FROM node_site_pairs p
WHERE s.id = p.site_id;

WITH site_node_winners AS (
    SELECT DISTINCT ON (topology_node_id)
        id AS site_id,
        topology_node_id AS node_id
    FROM public.sites
    WHERE topology_node_id IS NOT NULL
    ORDER BY topology_node_id, updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id ASC
)
UPDATE public.sites s
SET topology_node_id = NULL
WHERE s.topology_node_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM site_node_winners w
      WHERE w.site_id = s.id AND w.node_id = s.topology_node_id
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_topology_nodes_site_id_unique
    ON public.topology_nodes (site_id) WHERE site_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sites_topology_node_id_unique
    ON public.sites (topology_node_id) WHERE topology_node_id IS NOT NULL;

ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS full_address TEXT DEFAULT NULL;
