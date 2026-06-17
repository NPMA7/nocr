-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" UUID NOT NULL DEFAULT extensions.uuid_generate_v4(),
    "time" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "message" TEXT NOT NULL,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" UUID NOT NULL DEFAULT extensions.uuid_generate_v4(),
    "username" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" VARCHAR(50) DEFAULT 'visitor',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_mappings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ruijie_mac" TEXT NOT NULL,
    "mikrotik_name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "prefix" VARCHAR(255),
    "ruijie_alias" VARCHAR(255),
    "mikrotik_alias" VARCHAR(255),
    "status_ruijie" VARCHAR(50),
    "status_mikrotik" VARCHAR(50),
    "final_status" VARCHAR(50),
    "issue" TEXT,
    "is_manual" BOOLEAN DEFAULT false,
    "is_prefix_manual" BOOLEAN DEFAULT false,

    CONSTRAINT "device_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_status" (
    "device_id" UUID NOT NULL,
    "status" VARCHAR(50) DEFAULT 'offline',
    "latency" INTEGER DEFAULT 0,
    "last_check" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_status_pkey" PRIMARY KEY ("device_id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL DEFAULT extensions.uuid_generate_v4(),
    "name" VARCHAR(255) NOT NULL,
    "ip_address" VARCHAR(45) NOT NULL,
    "username" VARCHAR(100),
    "password" VARCHAR(255),
    "port" INTEGER DEFAULT 8728,
    "type" VARCHAR(50) DEFAULT 'mikrotik',
    "status" VARCHAR(50) DEFAULT 'unknown',
    "last_seen" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "network_interfaces" (
    "id" UUID NOT NULL DEFAULT extensions.uuid_generate_v4(),
    "device_id" UUID,
    "ros_id" VARCHAR(50),
    "name" VARCHAR(255) NOT NULL,
    "type" VARCHAR(100),
    "mac_address" VARCHAR(50),
    "mtu" INTEGER,
    "running" BOOLEAN DEFAULT false,
    "disabled" BOOLEAN DEFAULT false,
    "comment" TEXT,
    "synced_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "network_interfaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pppoe_active" (
    "id" UUID NOT NULL DEFAULT extensions.uuid_generate_v4(),
    "device_id" UUID,
    "ros_id" VARCHAR(50),
    "name" VARCHAR(255),
    "address" VARCHAR(50),
    "caller_id" VARCHAR(100),
    "service" VARCHAR(100),
    "uptime" VARCHAR(100),
    "synced_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pppoe_active_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pppoe_secrets" (
    "id" UUID NOT NULL DEFAULT extensions.uuid_generate_v4(),
    "device_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "profile" VARCHAR(255) DEFAULT 'default',
    "service" VARCHAR(255) DEFAULT 'pppoe',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "ros_id" VARCHAR(50),
    "disabled" BOOLEAN DEFAULT false,
    "last_logged_out" TIMESTAMPTZ(6),
    "local_address" VARCHAR(50),
    "remote_address" VARCHAR(50),
    "synced_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pppoe_secrets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ruijie_devices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sn" TEXT NOT NULL,
    "mac_address" TEXT,
    "alias" TEXT,
    "ip_address" TEXT,
    "status" TEXT,
    "clients" INTEGER DEFAULT 0,
    "last_online" TEXT,
    "last_offline" TEXT,
    "last_log_history" TEXT,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "connection_type" TEXT,

    CONSTRAINT "ruijie_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_pics" (
    "id" UUID NOT NULL DEFAULT extensions.uuid_generate_v4(),
    "site_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(50),
    "sort_order" INTEGER DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_pics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sites" (
    "id" UUID NOT NULL DEFAULT extensions.uuid_generate_v4(),
    "ruijie_mac" VARCHAR(50) NOT NULL,
    "connection_type" VARCHAR(50) NOT NULL DEFAULT 'l2tp',
    "vendor" VARCHAR(255),
    "customer_id" VARCHAR(255),
    "activation_date" DATE,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "topology_node_id" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "full_address" TEXT,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topology_edges" (
    "id" VARCHAR(100) NOT NULL,
    "from_node" VARCHAR(100) NOT NULL,
    "to_node" VARCHAR(100) NOT NULL,
    "label" VARCHAR(255),
    "status" VARCHAR(50) DEFAULT 'up',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "topology_edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topology_nodes" (
    "id" VARCHAR(100) NOT NULL,
    "device_id" UUID,
    "label" VARCHAR(255) NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "type" VARCHAR(50) DEFAULT 'odp',
    "group_name" VARCHAR(100) DEFAULT 'unknown',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "linked_interface" VARCHAR(255),
    "status" VARCHAR(50) DEFAULT 'unknown',
    "site_id" UUID,
    "last_modified_at" TIMESTAMPTZ(6),

    CONSTRAINT "topology_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vpn_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "name" VARCHAR(255) NOT NULL,
    "username" VARCHAR(255),
    "password" VARCHAR(255),
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "windows_name" VARCHAR(255),
    "windows_username" VARCHAR(255),
    "windows_password" VARCHAR(255),
    "linux_name" VARCHAR(255),
    "linux_username" VARCHAR(255),
    "linux_password" VARCHAR(255),
    "active_platform" VARCHAR(50) DEFAULT 'windows',

    CONSTRAINT "vpn_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_roles" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" VARCHAR(255),
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "report_date" DATE NOT NULL,
    "ruijie_mac" VARCHAR(50) NOT NULL,
    "prefix_name" VARCHAR(255),
    "location" TEXT,
    "offline_since" TIMESTAMPTZ(6),
    "online_since" TIMESTAMPTZ(6),
    "status_progress" VARCHAR(50) DEFAULT 'Progress',
    "issue" TEXT,
    "tindakan" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "name" VARCHAR(50) NOT NULL,
    "permissions" TEXT NOT NULL DEFAULT '[]',
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("name")
);

-- CreateIndex
CREATE INDEX "idx_activity_logs_time" ON "activity_logs"("time");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_username_key" ON "admin_users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "device_mappings_ruijie_mac_key" ON "device_mappings"("ruijie_mac");

-- CreateIndex
CREATE UNIQUE INDEX "unique_device_interface_name" ON "network_interfaces"("device_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "unique_device_active_session" ON "pppoe_active"("device_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "unique_device_secret_name" ON "pppoe_secrets"("device_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ruijie_devices_sn_key" ON "ruijie_devices"("sn");

-- CreateIndex
CREATE INDEX "idx_site_pics_site_id" ON "site_pics"("site_id");

-- CreateIndex
CREATE UNIQUE INDEX "sites_ruijie_mac_key" ON "sites"("ruijie_mac");

-- CreateIndex
CREATE UNIQUE INDEX "idx_sites_topology_node_id_unique" ON "sites"("topology_node_id") WHERE (topology_node_id IS NOT NULL);

-- CreateIndex
CREATE INDEX "idx_sites_connection_type" ON "sites"("connection_type");

-- CreateIndex
CREATE INDEX "idx_sites_ruijie_mac" ON "sites"("ruijie_mac");

-- CreateIndex
CREATE UNIQUE INDEX "idx_topology_nodes_site_id_unique" ON "topology_nodes"("site_id") WHERE (site_id IS NOT NULL);

-- CreateIndex
CREATE INDEX "idx_topology_nodes_site_id" ON "topology_nodes"("site_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_roles_name_key" ON "admin_roles"("name");

-- CreateIndex
CREATE INDEX "idx_daily_reports_date" ON "daily_reports"("report_date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_reports_report_date_ruijie_mac_key" ON "daily_reports"("report_date", "ruijie_mac");

-- AddForeignKey
ALTER TABLE "device_status" ADD CONSTRAINT "device_status_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "site_pics" ADD CONSTRAINT "site_pics_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sites" ADD CONSTRAINT "sites_ruijie_mac_fkey" FOREIGN KEY ("ruijie_mac") REFERENCES "device_mappings"("ruijie_mac") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sites" ADD CONSTRAINT "sites_topology_node_id_fkey" FOREIGN KEY ("topology_node_id") REFERENCES "topology_nodes"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "topology_edges" ADD CONSTRAINT "topology_edges_from_node_fkey" FOREIGN KEY ("from_node") REFERENCES "topology_nodes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "topology_edges" ADD CONSTRAINT "topology_edges_to_node_fkey" FOREIGN KEY ("to_node") REFERENCES "topology_nodes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "topology_nodes" ADD CONSTRAINT "topology_nodes_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "topology_nodes" ADD CONSTRAINT "topology_nodes_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

