const express = require('express');
const next = require('next');
const http = require('http');
const { Server } = require('socket.io');
const ping = require('ping');
const db = require('./src/lib/dbClient');
const mikrotik = require('./src/lib/mikrotik');
const whatsapp = require('./src/lib/whatsapp');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const server = express();
    const httpServer = http.createServer(server);
    
    // Pengaturan Socket.io
    const io = new Server(httpServer, {
        cors: { origin: '*' }
    });
    global.io = io;

    const activeMonitors = new Set();
    const clients = new Set();
    let isWorkerRunning = false;
    const previousMappingsStatus = {};
    let previousTidakSinkronCount = -1;

    // Registri presensi node: nodeId → { userId, username, socketId, since }
    const nodePresence = new Map();

    function broadcastNodePresence() {
        const payload = {};
        for (const [nodeId, info] of nodePresence.entries()) {
            payload[nodeId] = { userId: info.userId, username: info.username, since: info.since };
        }
        io.emit('node_presence', payload);
    }

    // Batasan jumlah log di database
    const MAX_ACTIVITY_LOGS_DB = 1000;

    // Fungsi otomatis memangkas log lama di database agar tidak bengkak
    async function trimActivityLogsInDb() {
        try {
            const { count, error: countErr } = await db
                .from('activity_logs')
                .select('*', { count: 'exact', head: true });
            if (countErr || count == null || count <= MAX_ACTIVITY_LOGS_DB) return;

            const excess = count - MAX_ACTIVITY_LOGS_DB;
            const { data: oldest, error: fetchErr } = await db
                .from('activity_logs')
                .select('id')
                .order('time', { ascending: true })
                .limit(excess);
            if (fetchErr || !oldest?.length) return;

            const ids = oldest.map((r) => r.id);
            const batchSize = 200;
            for (let i = 0; i < ids.length; i += batchSize) {
                const batch = ids.slice(i, i + batchSize);
                const { error: delErr } = await db.from('activity_logs').delete().in('id', batch);
                if (delErr) {
                    console.error('Gagal memangkas log aktivitas di database:', delErr.message);
                    return;
                }
            }
            console.log(`Log database dipangkas: ${excess} entri lama dihapus.`);
        } catch (err) {
            console.error('Gagal memangkas log aktivitas:', err.message);
        }
    }

    const targetStatuses = {};

    async function getCoreDevice() {
        const devices = await getCachedDevices();
        if (!devices) return null;
        const core = devices.find(d => d.type === 'mikrotik-core');
        if (core) return core;
        const fallback = devices.find(d => d.type === 'mikrotik');
        return fallback || null;
    }

    let lastCpuAlert = 0;
    let lastMemAlert = 0;
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

            const cpuLoad = parseInt(resource['cpu-load']) || 0;
            const freeMem = parseInt(resource['free-memory']) || 0;
            const totalMem = parseInt(resource['total-memory']) || 1;
            const memUsage = Math.round(((totalMem - freeMem) / totalMem) * 100);

            const nowTime = Date.now();
            if (cpuLoad >= 60 && nowTime - lastCpuAlert > 5 * 60 * 1000) {
                if (global.addActivityLog) global.addActivityLog(`Peringatan: Penggunaan CPU MikroTik mencapai ${cpuLoad}%!`);
                lastCpuAlert = nowTime;
            }

            if (memUsage >= 60 && nowTime - lastMemAlert > 5 * 60 * 1000) {
                if (global.addActivityLog) global.addActivityLog(`Peringatan: Penggunaan Memori MikroTik mencapai ${memUsage}%!`);
                lastMemAlert = nowTime;
            }

            io.emit('dashboard_core_update', {
                connected: true,
                device_name: device.name,
                ip_address: device.ip_address,
                cpu: resource['cpu-load'],
                free_memory: freeMem,
                total_memory: totalMem,
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

    // Fungsi utama penampung log - MURNI DB DAN EMIT SOCKET REALTIME
    async function addActivityLog(message) {
        const log = { time: new Date().toISOString(), message };

        try {
            // Langsung masukkan ke tabel database
            const { error } = await db
                .from('activity_logs')
                .insert([{ message }]);
            
            if (error) {
                console.error("Gagal menyimpan log ke database:", error.message);
            } else {
                await trimActivityLogsInDb();
            }
        } catch (err) {
            console.error("Gagal koneksi simpan log database:", err.message);
        }

        // Socket emission dipindahkan ke event postgres_changes agar API Next.js juga ikut terpancar
    }

    global.addActivityLog = addActivityLog;

    async function updateDailyReportRealtime(ruijieMac, prefixName, finalStatus) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const now = new Date().toISOString();
            const isOffline = finalStatus === 'Offline';

            // 1. Cek existing report
            const { data: allReports } = await db.from('daily_reports').select('*').eq('ruijie_mac', ruijieMac);
            let existing = (allReports || []).find(r => new Date(r.report_date).toISOString().split('T')[0] === today);
            if (!existing) {
                existing = (allReports || []).find(r => r.status_progress === 'Progress');
            }

            if (existing) {
                const updateData = {};
                let needsUpdate = false;

                if (isOffline) {
                    if (existing.status_progress === 'Done' && new Date(existing.report_date).toISOString().split('T')[0] === today) {
                        updateData.offline_since = now;
                        updateData.online_since = null;
                        updateData.status_progress = 'Progress';
                        needsUpdate = true;
                    }
                } else {
                    if (existing.status_progress === 'Progress') {
                        updateData.online_since = now;
                        updateData.status_progress = 'Done';
                        needsUpdate = true;
                    }
                }

                if (needsUpdate) {
                    await db.from('daily_reports').update(updateData).eq('id', existing.id);
                }
            } else {
                if (isOffline) {
                    const { data: sites } = await db.from('sites').select('full_address, latitude, longitude').eq('ruijie_mac', ruijieMac);
                    let loc = '';
                    if (sites && sites.length > 0) {
                        const s = sites[0];
                        if (s.full_address) loc = s.full_address;
                        else if (s.latitude && s.longitude) loc = `${s.latitude}, ${s.longitude}`;
                    }

                    await db.from('daily_reports').insert([{
                        report_date: today,
                        ruijie_mac: ruijieMac,
                        prefix_name: prefixName,
                        location: loc,
                        offline_since: now,
                        online_since: null,
                        status_progress: 'Progress',
                        issue: '',
                        tindakan: ''
                    }]);
                } else {
                    const { data: sites } = await db.from('sites').select('full_address, latitude, longitude').eq('ruijie_mac', ruijieMac);
                    let loc = '';
                    if (sites && sites.length > 0) {
                        const s = sites[0];
                        if (s.full_address) loc = s.full_address;
                        else if (s.latitude && s.longitude) loc = `${s.latitude}, ${s.longitude}`;
                    }

                    await db.from('daily_reports').insert([{
                        report_date: today,
                        ruijie_mac: ruijieMac,
                        prefix_name: prefixName,
                        location: loc,
                        offline_since: null,
                        online_since: now,
                        status_progress: 'Done',
                        issue: '',
                        tindakan: ''
                    }]);
                }
            }
        } catch (err) {
            console.error("Realtime Laporan Error:", err.message);
        }
    }

    // Cache untuk worker ping
    let devicesCache = { data: null, timestamp: 0 };
    let nodesCache = { data: null, timestamp: 0 };
    let activePppoeCache = { data: null, timestamp: 0 };

    let ruijieDevicesCache = { data: null, timestamp: 0 };
    let deviceMappingsCache = { data: null, timestamp: 0 };
    let pppoeSecretsCache = { data: null, timestamp: 0 };
    let networkInterfacesCache = { data: null, timestamp: 0 };


    async function getCachedDevices() {
        if (devicesCache.data && (Date.now() - devicesCache.timestamp < 30000)) {
            return devicesCache.data;
        }
        const { data } = await db.from('devices').select('id, name, ip_address, type, username, password, port');
        devicesCache = { data, timestamp: Date.now() };
        return data;
    }

    async function getCachedNodes() {
        if (nodesCache.data && (Date.now() - nodesCache.timestamp < 60000 * 5)) {
            return nodesCache.data;
        }
        const { data } = await db.from('topology_nodes').select('id, label, type');
        nodesCache = { data, timestamp: Date.now() };
        return data;
    }

    async function getCachedActivePppoe() {
        if (global.cachedPppoeActive) {
            return global.cachedPppoeActive;
        }
        if (activePppoeCache.data && (Date.now() - activePppoeCache.timestamp < 60000 * 1)) {
            return activePppoeCache.data;
        }
        const { data } = await db.from('pppoe_active').select('name, address');
        activePppoeCache = { data, timestamp: Date.now() };
        return data;
    }

    // Database Realtime fallback/sync
    const channel = db.channel('schema-db-changes')
        .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
            if (payload.table === 'network_interfaces') { networkInterfacesCache.data = null; io.emit('interface_update', payload); }
            if (payload.table === 'devices') devicesCache.data = null;
            if (payload.table === 'ruijie_devices') ruijieDevicesCache.data = null;
            if (payload.table === 'device_mappings') deviceMappingsCache.data = null;
            if (payload.table === 'pppoe_active') {
                activePppoeCache.data = null;
                io.emit('pppoe_active_update', payload);
                // broadcastDashboardCoreStatus() dihapus untuk mencegah pemanggilan API Mikrotik massal saat bulk insert
            }
            if (payload.table === 'pppoe_secrets') { pppoeSecretsCache.data = null; io.emit('pppoe_secret_update', payload); }
            if (payload.table === 'topology_nodes' || payload.table === 'topology_edges') {
                nodesCache.data = null;
                io.emit('dashboard_topology_refresh');
            }
            if (payload.table === 'activity_logs' && payload.eventType === 'INSERT') {
                io.emit('activity_log_updated', payload.new);
            }

            io.emit('db_change', payload);
        })
        .subscribe();

    io.on('connection', (socket) => {
        clients.add(socket.id);

        // Mengambil log awal langsung dari database secara asinkron saat client connect
        db
            .from('activity_logs')
            .select('time, message')
            .not('message', 'ilike', '%berubah menjadi Online%')
            .not('message', 'ilike', '%berubah menjadi Offline%')
            .order('time', { ascending: false })
            .limit(20)
            .then(({ data }) => {
                if (data) socket.emit('initial_logs', data);
            });


        socket.on('request_initial_logs', async () => {
            const { data } = await db
                .from('activity_logs')
                .select('time, message')
                .not('message', 'ilike', '%berubah menjadi Online%')
                .not('message', 'ilike', '%berubah menjadi Offline%')
                .order('time', { ascending: false })
                .limit(20);
            if (data) socket.emit('initial_logs', data);
        });

        socket.on('subscribe_monitor', (deviceId) => {
            activeMonitors.add(deviceId);
        });
        
        socket.on('unsubscribe_monitor', (deviceId) => {
            activeMonitors.delete(deviceId);
        });

        socket.on('force_sync_mappings', () => {
            deviceMappingsCache.data = null;
            syncDeviceMappings();
        });

        // Node presence: client mengunci node saat mulai edit
        socket.on('node_lock', ({ nodeId, userId, username }) => {
            if (!nodeId) return;
            // Lepas lock lama milik socket ini jika pindah node
            for (const [nid, info] of nodePresence.entries()) {
                if (info.socketId === socket.id && nid !== nodeId) {
                    nodePresence.delete(nid);
                }
            }
            nodePresence.set(nodeId, { userId, username: username || userId, socketId: socket.id, since: Date.now() });
            broadcastNodePresence();
        });

        // Node presence: client melepas lock
        socket.on('node_unlock', ({ nodeId }) => {
            if (!nodeId) return;
            // '__all__' = lepas semua lock milik socket ini
            if (nodeId === '__all__') {
                let changed = false;
                for (const [nid, info] of nodePresence.entries()) {
                    if (info.socketId === socket.id) {
                        nodePresence.delete(nid);
                        changed = true;
                    }
                }
                if (changed) broadcastNodePresence();
                return;
            }
            const info = nodePresence.get(nodeId);
            if (info && info.socketId === socket.id) {
                nodePresence.delete(nodeId);
                broadcastNodePresence();
            }
        });

        socket.on('disconnect', () => {
            clients.delete(socket.id);
            if (clients.size === 0) activeMonitors.clear();
            // Lepas semua lock milik socket ini
            let changed = false;
            for (const [nid, info] of nodePresence.entries()) {
                if (info.socketId === socket.id) {
                    nodePresence.delete(nid);
                    changed = true;
                }
            }
            if (changed) broadcastNodePresence();
        });
    });

    // Worker Ping Latar Belakang
    const pingWorker = async () => {
        if (isWorkerRunning) return;
        isWorkerRunning = true;

        try {
            const devices = await getCachedDevices();
            const nodes = await getCachedNodes();
            const activePppoe = await getCachedActivePppoe();

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

                    // Deteksi perubahan status untuk log aktivitas (kecuali L2TP yang sudah dikelola oleh mappings)
                    const previousStatus = targetStatuses[target.id];
                    if (previousStatus && previousStatus !== status) {
                        if (target.type !== 'client') { // L2TP / client logs via mappings now
                            addActivityLog(`Status ${target.type === 'client' || target.type === 'pppoe-client' ? 'pelanggan' : 'perangkat'} ${target.name} berubah menjadi ${status === 'online' ? 'Online' : 'Offline'}`);
                        }
                    }
                    targetStatuses[target.id] = status;

                    try {
                        await db
                            .from('device_status')
                            .upsert({
                                device_id: target.id,
                                status,
                                latency,
                                last_check: timestamp
                            }, { onConflict: 'device_id' });
                    } catch (dbErr) {
                        // Abaikan error upsert status di background
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
                    // Abaikan error probe ping satuan
                }
            }
        } catch (error) {
            console.error('Ping Worker Error:', error);
        } finally {
            isWorkerRunning = false;
        }
    };

    // Jalankan ping worker setiap 5 detik
    setInterval(pingWorker, 5000);

    // Jalankan broadcast core metrics MikroTik setiap 10 detik
    broadcastDashboardCoreStatus();
    setInterval(broadcastDashboardCoreStatus, 10000);

    // Fungsi penjadwalan agar task berjalan tepat di awal pergantian menit
    function scheduleAtMinuteBoundary(callback, offsetSeconds = 0) {
        const now = new Date();
        const currentSeconds = now.getSeconds();
        const currentMs = now.getMilliseconds();
        let msToNextTarget = ((60 - currentSeconds + offsetSeconds) * 1000 - currentMs) % 60000;
        if (msToNextTarget <= 0) msToNextTarget += 60000;
        
        setTimeout(() => {
            callback();
            setInterval(callback, 60000);
        }, msToNextTarget);
    }

    // Jalankan broadcast Ruijie secara otomatis setiap 1 menit (60 detik)
    async function broadcastRuijieDevices() {
        try {
            if (ruijieDevicesCache.data && (Date.now() - ruijieDevicesCache.timestamp < 30000)) {
                io.emit('ruijie_update', ruijieDevicesCache.data);
                return;
            }
            const { data: devices, error } = await db
                .from('ruijie_devices')
                .select('*')
                .order('alias', { ascending: true });
            
            if (!error && devices) {
                ruijieDevicesCache = { data: devices, timestamp: Date.now() };
                io.emit('ruijie_update', devices);
            }
        } catch (err) {
            console.error('Ruijie broadcast error:', err.message);
        }
    }


    broadcastRuijieDevices();
    scheduleAtMinuteBoundary(broadcastRuijieDevices, 0); // Tepat pergantian menit (:00)

    // Jalankan broadcast data MikroTik (Interfaces, PPPoE, Secrets) secara otomatis setiap 1 menit (60 detik)
    async function broadcastMikrotikData() {
        try {
            const device = await getCoreDevice();
            if (!device) return;

            const conn = await mikrotik.connect(device);
            if (!conn.connected) return;

            // Eksekusi secara berurutan untuk menghindari crash/drop koneksi pada RouterOS API (Bug umum di versi 7.x)
            const interfaces = await mikrotik.getInterfaces(device);
            const pppoe = await mikrotik.getActivePPPoEDetails(device);
            const secrets = await mikrotik.getPPPoESecrets(device);

            const now = new Date().toISOString();
            
            async function syncTable(tableName, items, mapFn) {
                if (!items || items.length === 0) return;
                
                const { data: existing } = await db.from(tableName).select('*').eq('device_id', device.id);
                const existingMap = new Map((existing || []).map(e => [e.ros_id || e.name, e]));
                
                const rowsToUpsert = [];
                const currentKeys = new Set();
                
                items.forEach(item => {
                    const row = mapFn(item);
                    const key = row.ros_id || row.name;
                    currentKeys.add(key);
                    
                    const exist = existingMap.get(key);
                    if (!exist) {
                        rowsToUpsert.push(row);
                    } else {
                        let isChanged = false;
                        for (let k in row) {
                            if (k !== 'id' && k !== 'synced_at' && row[k] !== exist[k]) {
                                isChanged = true;
                                break;
                            }
                        }
                        if (isChanged) {
                            row.id = exist.id;
                            rowsToUpsert.push(row);
                        }
                    }
                });

                if (rowsToUpsert.length > 0) {
                    for (let i = 0; i < rowsToUpsert.length; i += 100) {
                        await db.from(tableName).upsert(rowsToUpsert.slice(i, i + 100));
                    }
                }
                
                const idsToDelete = (existing || []).filter(e => !currentKeys.has(e.ros_id || e.name)).map(e => e.id);
                if (idsToDelete.length > 0) {
                    for (let i = 0; i < idsToDelete.length; i += 100) {
                        await db.from(tableName).delete().in('id', idsToDelete.slice(i, i + 100));
                    }
                }
            }

            if (interfaces && interfaces.length > 0) {
                try {
                    await syncTable('network_interfaces', interfaces, iface => ({
                        device_id: device.id,
                        ros_id: iface['.id'] || null,
                        name: iface.name,
                        type: iface.type || null,
                        mac_address: iface['mac-address'] || null,
                        mtu: parseInt(iface.mtu) || null,
                        running: iface.running === 'true',
                        disabled: iface.disabled === 'true',
                        comment: iface.comment || null,
                        synced_at: now
                    }));
                } catch (e) { console.warn('Cache Interface Error:', e.message); }
            }

            if (pppoe && pppoe.length >= 0) {
                try {
                    global.cachedPppoeActive = pppoe.map(p => ({
                        name: p.name || null,
                        address: p.address || null
                    }));
                    await syncTable('pppoe_active', pppoe, p => ({
                        device_id: device.id,
                        ros_id: p['.id'] || null,
                        name: p.name || null,
                        address: p.address || null,
                        caller_id: p['caller-id'] || null,
                        service: p.service || null,
                        uptime: p.uptime || null,
                        synced_at: now
                    }));
                } catch (e) { console.warn('Cache PPPoE Active Error:', e.message); }
            }

            if (secrets && secrets.length >= 0) {
                try {
                    await syncTable('pppoe_secrets', secrets, sec => ({
                        device_id: device.id,
                        ros_id: sec['.id'] || null,
                        name: sec.name,
                        password: sec.password || '',
                        profile: sec.profile || 'default',
                        service: sec.service || 'any',
                        disabled: sec.disabled === 'true',
                        local_address: sec['local-address'] || null,
                        remote_address: sec['remote-address'] || null,
                        synced_at: now
                    }));
                } catch (e) { console.warn('Cache PPPoE Secrets Error:', e.message); }
            }

            io.emit('mikrotik_full_update', { 
                interfaces: interfaces || [], 
                pppoe: pppoe || [], 
                secrets: secrets || [],
                timestamp: now
            });
        } catch (err) {
            console.error('MikroTik full broadcast error:', err.message);
        }
    }




    // Jalankan Sinkronisasi Mappings setiap pergantian menit lewat 5 detik (supaya data mentah Ruijie/Mikrotik masuk dulu)
    async function syncDeviceMappings() {
        try {
            const device = await getCoreDevice();
            if (!device) return;

            const fetchCache = async (cacheObj, table, selectQuery, filterObj = null) => {
                if (cacheObj.data && (Date.now() - cacheObj.timestamp < 30000)) return cacheObj.data;
                let q = db.from(table).select(selectQuery);
                if (filterObj) q = q.eq(filterObj.col, filterObj.val);
                const { data } = await q;
                cacheObj.data = data || [];
                cacheObj.timestamp = Date.now();
                return cacheObj.data;
            };

            const [ruijie, mappings, active, secrets, interfaces] = await Promise.all([
                fetchCache(ruijieDevicesCache, 'ruijie_devices', '*'),
                fetchCache(deviceMappingsCache, 'device_mappings', '*'),
                fetchCache(activePppoeCache, 'pppoe_active', 'name', {col: 'device_id', val: device.id}),
                fetchCache(pppoeSecretsCache, 'pppoe_secrets', 'name', {col: 'device_id', val: device.id}),
                fetchCache(networkInterfacesCache, 'network_interfaces', 'name, running, disabled', {col: 'device_id', val: device.id})
            ]);
            
            const normalizeName = (name) => name ? name.toLowerCase().replace(/[-_\s]/g, '') : '';

            const upsertData = ruijie.map(ap => {
                let existing = mappings.find(m => m.ruijie_mac === ap.mac_address);
                let secretName = null;
                let isActive = false;
                
                const isL2TP = ap.connection_type === 'L2TP';
                const isPPPoE = ap.connection_type === 'PPPOE';

                const checkActive = (name) => {
                    if (!name) return false;
                    if (isPPPoE) {
                        const hasActiveSession = active.some(a => a.name === name);
                        const staticIface = interfaces.find(i => 
                            i.name === `PPPoE - ${name}` || 
                            i.name === `<pppoe-${name}>` || 
                            i.name === `PPPoE-${name}` ||
                            i.name === name
                        );
                        if (staticIface) {
                            return staticIface.running && !staticIface.disabled;
                        }
                        return hasActiveSession;
                    } else if (isL2TP) {
                        const iface = interfaces.find(i => 
                            i.name === name ||
                            i.name === `<l2tp-${name}>` ||
                            i.name === `l2tp-${name}` ||
                            i.name === `L2TP-${name}` ||
                            i.name === `<l2tp-${name.toLowerCase()}>`
                        );
                        if (iface) return iface.running && !iface.disabled;
                        return false;
                    }
                    return false;
                };

                if (existing && existing.is_manual) {
                    secretName = existing.mikrotik_name;
                    if (isPPPoE || isL2TP) {
                        const sec = secrets.find(s => s.name === secretName);
                        if (sec) secretName = sec.name;
                    }
                    isActive = checkActive(secretName);
                } else {
                    const normAlias = normalizeName(ap.alias);
                    if (isPPPoE || isL2TP) {
                        const sec = secrets.find(s => normalizeName(s.name) === normAlias);
                        if (sec) {
                            secretName = sec.name;
                        } else if (isL2TP) {
                            // Fallback to interface matching if secret not found
                            const iface = interfaces.find(i => {
                                const nName = normalizeName(i.name);
                                return nName === normAlias ||
                                       nName === `<l2tp${normAlias}>` ||
                                       nName === `l2tp${normAlias}`;
                            });
                            if (iface) {
                                // Extract secret name from interface if possible, or just use interface name
                                const match = iface.name.match(/<l2tp-(.+)>/i) || iface.name.match(/l2tp-(.+)/i);
                                secretName = match ? match[1] : iface.name;
                            }
                        }
                    }
                    isActive = checkActive(secretName);
                }

                let mikrotikStatus = secretName ? (isActive ? 'Online' : 'Offline') : 'Unknown';
                let apStatus = ap.status === 'ON' ? 'Online' : 'Offline';
                let finalStatus = 'Unknown';
                let issue = null;

                finalStatus = apStatus;
                if (apStatus === 'Online' && mikrotikStatus === 'Offline') issue = 'Mikrotik Mati';
                else if (apStatus === 'Offline' && mikrotikStatus === 'Offline') issue = 'Semua Perangkat Mati';
                else if (apStatus === 'Offline' && mikrotikStatus === 'Online') issue = 'Access Point Mati / Kecabut';

                if (!secretName || secretName === '-') {
                    issue = 'Belum ditautkan (Nama Tidak Cocok)';
                } else if (existing && existing.is_manual && !secrets.find(s => s.name === secretName)) {
                    issue = 'Akun Mikrotik tidak ditemukan (Manual Link Salah)';
                }

                let autoPrefix = secretName || ap.alias;
                if (isPPPoE) {
                    autoPrefix = ap.alias || secretName;
                }
                const prefixName = ((existing && existing.is_prefix_manual) ? existing.prefix : autoPrefix)?.toUpperCase();

                const prevStatus = previousMappingsStatus[ap.mac_address];
                if (prevStatus && prevStatus !== finalStatus) {
                    addActivityLog(`Status pelanggan ${prefixName} berubah menjadi ${finalStatus}`);
                    updateDailyReportRealtime(ap.mac_address, prefixName, finalStatus).catch(console.error);
                }
                previousMappingsStatus[ap.mac_address] = finalStatus;

                return {
                    ruijie_mac: ap.mac_address,
                    mikrotik_name: secretName || '-',
                    prefix: prefixName,
                    ruijie_alias: ap.alias,
                    mikrotik_alias: secretName || '-',
                    status_ruijie: apStatus,
                    status_mikrotik: mikrotikStatus,
                    final_status: finalStatus,
                    issue: issue || '',
                    is_manual: existing ? existing.is_manual : false,
                    is_prefix_manual: existing ? !!existing.is_prefix_manual : false
                };
            });

            const changedData = upsertData.filter(d => {
                const exist = mappings.find(m => m.ruijie_mac === d.ruijie_mac);
                if (!exist) return true;
                return exist.final_status !== d.final_status || 
                       exist.status_mikrotik !== d.status_mikrotik || 
                       exist.mikrotik_name !== d.mikrotik_name ||
                       exist.prefix !== d.prefix ||
                       exist.issue !== d.issue;
            });

            if (changedData.length > 0) {
                for (let i = 0; i < changedData.length; i += 100) {
                    const batch = changedData.slice(i, i + 100);
                    await db.from('device_mappings').upsert(batch, { onConflict: 'ruijie_mac' });
                }
            }

            // Removed Tidak Sinkron logging per user request
            if (changedData.length > 0) {
                io.emit('mappings_updated');
            }
        } catch (err) {
            console.error('Sync Mappings Error:', err.message);
        }
    }

    broadcastMikrotikData();
    scheduleAtMinuteBoundary(broadcastMikrotikData, 0); // Tepat pergantian menit (:00)

    // Tunda eksekusi pertama 5 detik agar data awal terkumpul, setelah itu ikut pergantian menit lewat 5 detik
    setTimeout(() => {
        syncDeviceMappings();
    }, 5000);
    scheduleAtMinuteBoundary(syncDeviceMappings, 5); // Tepat di detik ke-05 setiap menit

    // Rute Express WhatsApp Gateway
    server.use('/api/whatsapp', express.json());

    server.get('/api/whatsapp/status', (req, res) => {
        res.json(whatsapp.getStatus());
    });

    server.post('/api/whatsapp/action', async (req, res) => {
        // Otentikasi dan otorisasi
        const authHeader = req.headers['authorization'];
        if (!authHeader) return res.status(401).json({ error: 'Akses ditolak: Token tidak ada' });
        try {
            const token = authHeader.split(' ')[1];
            const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET || 'nocr_super_secret_key_123');
            const perms = decoded.permissions || [];
            if (!perms.includes('system.settings') && decoded.role !== 'admin') {
                return res.status(403).json({ error: 'Akses ditolak: Tidak ada izin' });
            }
        } catch (e) {
            return res.status(401).json({ error: 'Token tidak valid' });
        }

        const { action, settings } = req.body;
        try {
            let result;
            if (action === 'start') result = await whatsapp.start();
            else if (action === 'stop') result = await whatsapp.stop();
            else if (action === 'logout') result = await whatsapp.logout();
            else if (action === 'settings') {
                whatsapp.saveSettings(settings);
                result = { success: true, message: 'Pengaturan disimpan' };
            } else {
                return res.status(400).json({ error: 'Invalid action' });
            }
            res.json(result);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    server.get('/api/whatsapp/chat', async (req, res) => {
        const chats = await whatsapp.getChats();
        res.json(chats);
    });

    server.get('/api/whatsapp/chat/:id', async (req, res) => {
        const messages = await whatsapp.getChatMessages(req.params.id);
        res.json(messages);
    });

    server.post('/api/whatsapp/chat/send', async (req, res) => {
        // Otentikasi dan otorisasi
        const authHeader = req.headers['authorization'];
        if (!authHeader) return res.status(401).json({ error: 'Akses ditolak: Token tidak ada' });
        try {
            const token = authHeader.split(' ')[1];
            const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET || 'nocr_super_secret_key_123');
            const perms = decoded.permissions || [];
            if (!perms.includes('chat.live') && decoded.role !== 'admin') {
                return res.status(403).json({ error: 'Akses ditolak: Tidak ada izin' });
            }
        } catch (e) {
            return res.status(401).json({ error: 'Token tidak valid' });
        }

        try {
            const result = await whatsapp.sendMessage(req.body.chatId, req.body.text);
            res.json({ success: true, message: result });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    whatsapp.start(); // Mulai otomatis saat server booting.

    // Default Next.js Handler
    server.all('*', (req, res) => {
        return handle(req, res);
    });

    httpServer.listen(port, (err) => {
        if (err) throw err;
        console.log(`> Ready on http://${hostname}:${port}`);
    });
});