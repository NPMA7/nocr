const express = require('express');
const next = require('next');
const http = require('http');
const { Server } = require('socket.io');
const ping = require('ping');
const fs = require('fs');
const path = require('path');
const supabase = require('./src/lib/supabaseClient');
const mikrotik = require('./src/lib/mikrotik');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const server = express();
    const httpServer = http.createServer(server);
    
    // Socket.io setup
    const io = new Server(httpServer, {
        cors: { origin: '*' }
    });
    global.io = io;

    const activeMonitors = new Set();
    const clients = new Set();
    let isWorkerRunning = false;

    // Activity logging system
    const MAX_ACTIVITY_LOGS_DB = 1000;
    const MAX_ACTIVITY_LOGS_UI = 50;
    const logFilePath = path.join(__dirname, 'src', 'lib', 'data', 'activity_logs.json');
    let activityLogs = [];

    async function trimActivityLogsInDb() {
        try {
            const { count, error: countErr } = await supabase
                .from('activity_logs')
                .select('*', { count: 'exact', head: true });
            if (countErr || count == null || count <= MAX_ACTIVITY_LOGS_DB) return;

            const excess = count - MAX_ACTIVITY_LOGS_DB;
            const { data: oldest, error: fetchErr } = await supabase
                .from('activity_logs')
                .select('id')
                .order('time', { ascending: true })
                .limit(excess);
            if (fetchErr || !oldest?.length) return;

            const ids = oldest.map((r) => r.id);
            const batchSize = 200;
            for (let i = 0; i < ids.length; i += batchSize) {
                const batch = ids.slice(i, i + batchSize);
                const { error: delErr } = await supabase.from('activity_logs').delete().in('id', batch);
                if (delErr) {
                    console.error('Gagal memangkas log aktivitas:', delErr.message);
                    return;
                }
            }
            console.log(`Log aktivitas dipangkas: ${excess} entri lama dihapus (maks ${MAX_ACTIVITY_LOGS_DB}).`);
        } catch (err) {
            console.error('Gagal memangkas log aktivitas:', err.message);
        }
    }

    // Local fallback loader
    function loadLocalLogs() {
        try {
            if (fs.existsSync(logFilePath)) {
                const data = fs.readFileSync(logFilePath, 'utf8');
                activityLogs = JSON.parse(data);
            }
        } catch (e) {
            console.error("Gagal memuat log aktivitas lokal:", e);
        }
        if (activityLogs.length === 0) {
            activityLogs.push({ time: new Date().toISOString(), message: "Sistem monitoring NOCR berhasil dijalankan" });
            saveLocalLogs();
        }
    }

    function saveLocalLogs() {
        try {
            const dir = path.dirname(logFilePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            const trimmed = activityLogs.slice(0, MAX_ACTIVITY_LOGS_DB);
            fs.writeFileSync(logFilePath, JSON.stringify(trimmed, null, 2));
        } catch (e) {
            console.error("Gagal menyimpan log aktivitas lokal:", e);
        }
    }

    async function initActivityLogs() {
        try {
            // Try fetching from Supabase database
            const { data, error } = await supabase
                .from('activity_logs')
                .select('time, message')
                .order('time', { ascending: false })
                .limit(MAX_ACTIVITY_LOGS_UI);
            
            if (error) {
                console.warn("Gagal mengambil log dari database, menggunakan fallback lokal:", error.message);
                loadLocalLogs();
            } else if (data && data.length > 0) {
                activityLogs = data.map(item => ({
                    time: item.time,
                    message: item.message
                }));
                console.log(`Berhasil memuat ${activityLogs.length} log aktivitas dari database.`);
            } else {
                // Table is empty, seed with initial log
                console.log("Tabel log aktivitas kosong, melakukan seeding awal.");
                const initialLog = { time: new Date().toISOString(), message: "Sistem monitoring NOCR berhasil dijalankan" };
                activityLogs.push(initialLog);
                await supabase.from('activity_logs').insert([{ message: "Sistem monitoring NOCR berhasil dijalankan" }]);
                saveLocalLogs();
            }
        } catch (err) {
            console.warn("Gagal inisialisasi database log, menggunakan fallback lokal:", err.message);
            loadLocalLogs();
        }

        await trimActivityLogsInDb();
    }

    // Trigger initial logs load
    initActivityLogs();

    const targetStatuses = {};

    async function getCoreDevice() {
        const { data } = await supabase.from('devices').select('*').eq('type', 'mikrotik-core').limit(1);
        if (data?.length) return data[0];
        const { data: fallback } = await supabase.from('devices').select('*').eq('type', 'mikrotik').limit(1);
        return fallback?.[0] || null;
    }

    async function broadcastDashboardCoreStatus() {
        try {
            const device = await getCoreDevice();
            if (!device) return;

            const conn = await mikrotik.connect(device);
            if (!conn.connected) {
                io.emit('dashboard_core_update', {
                    connected: false,
                    error: conn.error,
                    device_name: device.name,
                    ip_address: device.ip_address
                });
                return;
            }

            const resource = await mikrotik.getSystemResource(device);
            const pppoeCount = await mikrotik.getActivePPPoE(device);
            const l2tpCount = await mikrotik.getActiveL2TP(device);

            io.emit('dashboard_core_update', {
                connected: true,
                device_name: device.name,
                ip_address: device.ip_address,
                cpu: resource['cpu-load'],
                free_memory: parseInt(resource['free-memory']) || 0,
                total_memory: parseInt(resource['total-memory']) || 0,
                uptime: resource.uptime,
                board: resource['board-name'],
                version: resource.version,
                architecture: resource['architecture-name'] || '-',
                pppoe_active: pppoeCount,
                l2tp_active: l2tpCount,
                updated_at: new Date().toISOString()
            });
        } catch (err) {
            console.error('Dashboard core broadcast error:', err.message);
        }
    }

    async function addActivityLog(message) {
        const log = { time: new Date().toISOString(), message };
        activityLogs.unshift(log);
        if (activityLogs.length > MAX_ACTIVITY_LOGS_UI) {
            activityLogs.pop();
        }

        saveLocalLogs();

        try {
            const { error } = await supabase
                .from('activity_logs')
                .insert([{ message }]);
            if (error) {
                console.error("Gagal menyimpan log ke database:", error.message);
            } else {
                await trimActivityLogsInDb();
            }
        } catch (err) {
            console.error("Gagal menyimpan log ke database:", err.message);
        }

        io.emit('status', log);
    }

    global.addActivityLog = addActivityLog;

    // Supabase Realtime fallback/sync
    const channel = supabase.channel('schema-db-changes')
        .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
            if (payload.table === 'network_interfaces') io.emit('interface_update', payload);
            if (payload.table === 'pppoe_active') {
                io.emit('pppoe_active_update', payload);
                broadcastDashboardCoreStatus();
            }
            if (payload.table === 'pppoe_secrets') io.emit('pppoe_secret_update', payload);
            if (payload.table === 'topology_nodes' || payload.table === 'topology_edges') {
                io.emit('dashboard_topology_refresh');
            }

            io.emit('db_change', payload);
        })
        .subscribe();

    io.on('connection', (socket) => {
        clients.add(socket.id);
        
        // Send initial logs upon connecting
        socket.emit('initial_logs', activityLogs);

        // Handle explicit request for initial logs to avoid race conditions
        socket.on('request_initial_logs', () => {
            socket.emit('initial_logs', activityLogs);
        });

        socket.on('subscribe_monitor', (deviceId) => {
            activeMonitors.add(deviceId);
        });
        
        socket.on('unsubscribe_monitor', (deviceId) => {
            activeMonitors.delete(deviceId);
        });

        socket.on('disconnect', () => {
            clients.delete(socket.id);
            if (clients.size === 0) activeMonitors.clear();
        });
    });

    // Background Ping Worker
    const pingWorker = async () => {
        if (isWorkerRunning) return;
        isWorkerRunning = true;

        try {
            const { data: devices } = await supabase.from('devices').select('id, name, ip_address, type');
            const { data: nodes } = await supabase.from('topology_nodes').select('id, label, type');
            const { data: activePppoe } = await supabase.from('pppoe_active').select('name, address');

            const allTargets = [];

            if (devices) {
                devices.forEach(d => {
                    allTargets.push({ id: d.id, ip: d.ip_address, name: d.name, type: d.type });
                });
            }

            if (nodes) {
                nodes.forEach(n => {
                    if (n.type === 'pppoe-client' || n.type === 'client') {
                        const pppoeSession = activePppoe?.find(p => p.name === n.label);
                        if (pppoeSession && pppoeSession.address) {
                            allTargets.push({ id: n.id, ip: pppoeSession.address, name: n.label, type: n.type });
                        }
                    }
                });
            }

            for (const target of allTargets) {
                if (!target.ip) continue;
                
                try {
                    const res = await ping.promise.probe(target.ip, { timeout: 2 });
                    const status = res.alive ? 'online' : 'offline';
                    const latency = res.alive ? Math.round(res.time) : 0;
                    const timestamp = new Date().toISOString();

                    // Log status changes
                    const previousStatus = targetStatuses[target.id];
                    if (previousStatus && previousStatus !== status) {
                        addActivityLog(`Status ${target.type === 'client' || target.type === 'pppoe-client' ? 'pelanggan' : 'perangkat'} ${target.name} berubah menjadi ${status === 'online' ? 'Online' : 'Offline'}`);
                    }
                    targetStatuses[target.id] = status;

                    try {
                        await supabase
                            .from('device_status')
                            .upsert({
                                device_id: target.id,
                                status,
                                latency,
                                last_check: timestamp
                            }, { onConflict: 'device_id' });
                    } catch (dbErr) {
                        // Ignore DB errors in background
                    }

                    io.emit('device-status', {
                        id: target.id,
                        status,
                        latency,
                        timestamp
                    });

                    if (activeMonitors.has(target.id) || activeMonitors.has('all')) {
                        io.emit('monitor_update', {
                            deviceId: target.id,
                            status,
                            latency,
                            timestamp
                        });
                    }
                } catch (e) {
                    // Ignore ping errors
                }
            }
        } catch (error) {
            console.error('Ping Worker Error:', error);
        } finally {
            isWorkerRunning = false;
        }
    };

    // Run ping worker every 5 seconds
    setInterval(pingWorker, 5000);

    // Broadcast MikroTik core metrics to all dashboards (every 10s)
    broadcastDashboardCoreStatus();
    setInterval(broadcastDashboardCoreStatus, 10000);

    // Default Next.js Handler (Custom Server)
    server.all('*', (req, res) => {
        return handle(req, res);
    });

    httpServer.listen(port, (err) => {
        if (err) throw err;
        console.log(`> Ready on http://${hostname}:${port}`);
    });
});
