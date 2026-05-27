const express = require('express');
const next = require('next');
const http = require('http');
const { Server } = require('socket.io');
const ping = require('ping');
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
    const previousMappingsStatus = {};
    let previousTidakSinkronCount = -1;

    // Node presence registry: nodeId → { userId, username, socketId, since }
    const nodePresence = new Map();

    function broadcastNodePresence() {
        const payload = {};
        for (const [nodeId, info] of nodePresence.entries()) {
            payload[nodeId] = { userId: info.userId, username: info.username, since: info.since };
        }
        io.emit('node_presence', payload);
    }

    // Batasan jumlah log di database Supabase
    const MAX_ACTIVITY_LOGS_DB = 1000;

    // Fungsi otomatis memangkas log lama di Supabase agar database tidak bengkak
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
        const { data } = await supabase.from('devices').select('*').eq('type', 'mikrotik-core').limit(1);
        if (data?.length) return data[0];
        const { data: fallback } = await supabase.from('devices').select('*').eq('type', 'mikrotik').limit(1);
        return fallback?.[0] || null;
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
            // Langsung masukkan ke tabel database Supabase
            const { error } = await supabase
                .from('activity_logs')
                .insert([{ message }]);
            
            if (error) {
                console.error("Gagal menyimpan log ke database Supabase:", error.message);
            } else {
                await trimActivityLogsInDb();
            }
        } catch (err) {
            console.error("Gagal koneksi simpan log database:", err.message);
        }

        // Socket emission dipindahkan ke event postgres_changes agar API Next.js juga ikut terpancar
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
            if (payload.table === 'activity_logs' && payload.eventType === 'INSERT') {
                io.emit('activity_log_updated', payload.new);
            }

            io.emit('db_change', payload);
        })
        .subscribe();

    io.on('connection', (socket) => {
        clients.add(socket.id);

        // Mengambil log awal langsung dari database secara asinkron saat client connect
        supabase
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
            const { data } = await supabase
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

                    // Deteksi perubahan status untuk log aktivitas (kecuali L2TP yang sudah dikelola oleh mappings)
                    const previousStatus = targetStatuses[target.id];
                    if (previousStatus && previousStatus !== status) {
                        if (target.type !== 'client') { // L2TP / client logs via mappings now
                            addActivityLog(`Status ${target.type === 'client' || target.type === 'pppoe-client' ? 'pelanggan' : 'perangkat'} ${target.name} berubah menjadi ${status === 'online' ? 'Online' : 'Offline'}`);
                        }
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
            const { data: devices, error } = await supabase
                .from('ruijie_devices')
                .select('*')
                .order('alias', { ascending: true });
            
            if (!error && devices) {
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

            const [interfaces, pppoe, secrets] = await Promise.all([
                mikrotik.getInterfaces(device),
                mikrotik.getActivePPPoEDetails(device),
                mikrotik.getPPPoESecrets(device)
            ]);

            const now = new Date().toISOString();

            if (interfaces && interfaces.length > 0) {
                try {
                    await supabase.from('network_interfaces').delete().eq('device_id', device.id);
                    const rows = interfaces.map(iface => ({
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
                    await supabase.from('network_interfaces').insert(rows);
                } catch (e) { console.warn('Cache Interface Error:', e.message); }
            }

            if (pppoe && pppoe.length >= 0) {
                try {
                    await supabase.from('pppoe_active').delete().eq('device_id', device.id);
                    if (pppoe.length > 0) {
                        const rows = pppoe.map(p => ({
                            device_id: device.id,
                            ros_id: p['.id'] || null,
                            name: p.name || null,
                            address: p.address || null,
                            caller_id: p['caller-id'] || null,
                            service: p.service || null,
                            uptime: p.uptime || null,
                            synced_at: now
                        }));
                        await supabase.from('pppoe_active').insert(rows);
                    }
                } catch (e) { console.warn('Cache PPPoE Active Error:', e.message); }
            }

            if (secrets && secrets.length >= 0) {
                try {
                    await supabase.from('pppoe_secrets').delete().eq('device_id', device.id);
                    if (secrets.length > 0) {
                        const rows = secrets.map(sec => ({
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
                        await supabase.from('pppoe_secrets').insert(rows);
                    }
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

            const [resRuijie, resManual, resActive, resSecrets, resInterfaces] = await Promise.all([
                supabase.from('ruijie_devices').select('*'),
                supabase.from('device_mappings').select('*'),
                supabase.from('pppoe_active').select('name'),
                supabase.from('pppoe_secrets').select('name'),
                supabase.from('network_interfaces').select('name, running, disabled')
            ]);
            
            const ruijie = resRuijie.data || [];
            const mappings = resManual.data || [];
            const active = resActive.data || [];
            const secrets = resSecrets.data || [];
            const interfaces = resInterfaces.data || [];

            const normalizeName = (name) => name ? name.toLowerCase().replace(/[-_\s]/g, '') : '';

            const upsertData = ruijie.map(ap => {
                let existing = mappings.find(m => m.ruijie_mac === ap.mac_address);
                let secretName = null;
                let isActive = false;
                
                const isL2TP = ap.connection_type === 'L2TP';
                const isPPPoE = ap.connection_type === 'PPPOE';

                const checkActive = (name) => {
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
                        const iface = interfaces.find(i => i.name === name);
                        if (iface) return iface.running && !iface.disabled;
                        return false;
                    }
                    return false;
                };

                if (existing && existing.is_manual) {
                    secretName = existing.mikrotik_name; // Prioritize mikrotik_name which is the true manual input
                    if (isPPPoE) {
                        const sec = secrets.find(s => s.name === secretName);
                        if (sec) secretName = sec.name;
                    } else if (isL2TP) {
                        const iface = interfaces.find(i => i.name === secretName);
                        if (iface) secretName = iface.name;
                    }
                    isActive = checkActive(secretName);
                } else {
                    const normAlias = normalizeName(ap.alias);
                    if (isPPPoE) {
                        const sec = secrets.find(s => normalizeName(s.name) === normAlias);
                        if (sec) secretName = sec.name;
                    } else if (isL2TP) {
                        const iface = interfaces.find(i => normalizeName(i.name) === normAlias);
                        if (iface) secretName = iface.name;
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

                const prefixName = ((existing && existing.is_prefix_manual) ? existing.prefix : (secretName || ap.alias))?.toUpperCase();

                // Kembalikan log aktivitas karena dibutuhkan di tabel Log Aktivitas Dashboard
                const prevStatus = previousMappingsStatus[ap.mac_address];
                if (prevStatus && prevStatus !== finalStatus) {
                    addActivityLog(`Status pelanggan ${prefixName} berubah menjadi ${finalStatus}`);
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

            // Upsert ke database batch per 100 baris untuk keamanan memori
            for (let i = 0; i < upsertData.length; i += 100) {
                const batch = upsertData.slice(i, i + 100);
                await supabase.from('device_mappings').upsert(batch, { onConflict: 'ruijie_mac' });
            }

            const currentTidakSinkron = upsertData.filter(d => d.status_mikrotik === 'Online' && d.status_ruijie === 'Offline').length;
            if (currentTidakSinkron !== previousTidakSinkronCount && currentTidakSinkron > 0) {
                if (global.addActivityLog) global.addActivityLog(`Ditemukan ${currentTidakSinkron} perangkat dengan status Tidak Sinkron`);
            }
            previousTidakSinkronCount = currentTidakSinkron;
            
            // Emit update agar tabel langsung segar
            io.emit('mappings_updated');
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

    // Default Next.js Handler
    server.all('*', (req, res) => {
        return handle(req, res);
    });

    httpServer.listen(port, (err) => {
        if (err) throw err;
        console.log(`> Ready on http://${hostname}:${port}`);
    });
});