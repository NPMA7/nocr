const express = require('express');
const next = require('next');
const http = require('http');
const net = require('net');
const crypto = require('crypto');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const ping = require('ping');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');
const db = require('./src/lib/dbClient');
const mikrotik = require('./src/lib/mikrotik');
const whatsapp = require('./src/lib/whatsapp');
const { getStatusLogInfo, filterFlappingLogs, getFlappingThresholdMs } = require('./src/lib/logUtils');

function getSystemSettings() {
    try {
        const filePath = path.join(__dirname, 'data', 'server-settings.json');
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(content);
        }
    } catch (e) {
        console.error('Gagal membaca server-settings.json:', e.message);
    }
    return {
        ping_interval_seconds: 5,
        ping_timeout_seconds: 15,
        core_broadcast_interval_seconds: 10,
        sync_ruijie_interval_seconds: 60,
        sync_mikrotik_interval_seconds: 60,
        sync_mappings_interval_seconds: 60,
        sync_hsgq_interval_seconds: 60
    };
}

function hasServerAccess(permissions, menuKey, action, legacyPerm) {
    if (!permissions) return false;
    let perms = permissions;
    if (typeof perms === 'string') {
        try { perms = JSON.parse(perms); } catch(e) { perms = {}; }
    }
    if (Array.isArray(perms)) {
        return perms.includes(legacyPerm);
    }
    if (perms && typeof perms === 'object') {
        if (Array.isArray(perms[menuKey]) && perms[menuKey].includes(action)) {
            return true;
        }
        if (menuKey.startsWith('settings-') && Array.isArray(perms['settings']) && perms['settings'].includes(action)) {
            return true;
        }
    }
    return false;
}

async function getUserInfo(userId) {
    if (!userId) return { role: 'visitor', permissions: [] };
    try {
        const { data: userData } = await db.from('users').select('role').eq('id', userId).single();
        if (userData && userData.role) {
            const role = userData.role;
            if (role === 'admin') {
                return { role, permissions: { '*': ['read', 'create', 'update', 'delete'] } };
            }
            const { data: roleData } = await db.from('access_roles').select('permissions').eq('name', role).single();
            if (roleData && roleData.permissions) {
                const permissions = typeof roleData.permissions === 'string' ? JSON.parse(roleData.permissions) : roleData.permissions;
                return { role, permissions };
            }
            return { role, permissions: [] };
        }
    } catch (e) {
        console.error('Gagal mengambil user info dari DB:', e);
    }
    return { role: 'visitor', permissions: [] };
}

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const server = express();
    const httpServer = http.createServer(server);

    // Disable X-Powered-By header (Information Disclosure mitigation)
    server.disable('x-powered-by');

    // Trust proxy for reverse proxies (Cloudflare, Nginx)
    server.set('trust proxy', 1);

    // HTTPS Redirect & Security Headers Middleware
    server.use((req, res, next) => {
        res.removeHeader('X-Powered-By');

        // Enforce HTTPS when behind proxy
        const proto = req.headers['x-forwarded-proto'];
        if (proto === 'http') {
            const host = req.headers.host || req.hostname;
            return res.redirect(301, `https://${host}${req.url}`);
        }

        // Standard Security Headers
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
        res.setHeader(
            'Content-Security-Policy',
            "default-src 'self'; script-src 'self' 'unsafe-inline' https: blob:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https: *.openstreetmap.org *.tile.openstreetmap.org; font-src 'self' data: https:; connect-src 'self' ws: wss: http: https:; frame-ancestors 'self';"
        );

        next();
    });

    // Helper Otentikasi Rute Express
    function extractExpressToken(req) {
        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return authHeader.split(' ')[1].trim();
        }
        if (req.headers.cookie) {
            const match = req.headers.cookie.match(/(?:^|;\s*)nocr_token=([^;]+)/);
            if (match) return decodeURIComponent(match[1]);
        }
        return null;
    }

    const getRateLimitKey = (req) => {
        const token = extractExpressToken(req);
        if (token) {
            try {
                const decoded = jwt.decode(token);
                if (decoded && decoded.id) return `user_${decoded.id}`;
            } catch (e) {}
        }
        const forwarded = req.headers['x-forwarded-for'];
        if (forwarded) {
            const ips = String(forwarded).split(',').map(s => s.trim()).filter(Boolean);
            if (ips.length > 0) return ips[0];
        }
        return req.ip || req.socket?.remoteAddress || '127.0.0.1';
    };

    // Rate Limiting khusus Login / Brute-force prevention (15 requests/menit per IP)
    const loginLimiter = rateLimit({
        windowMs: 60 * 1000,
        max: 15,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => {
            const forwarded = req.headers['x-forwarded-for'];
            if (forwarded) {
                const ips = String(forwarded).split(',').map(s => s.trim()).filter(Boolean);
                if (ips.length > 0) return ips[0];
            }
            return req.ip || req.socket?.remoteAddress || '127.0.0.1';
        },
        message: { error: 'Terlalu banyak percobaan login. Silakan coba lagi setelah beberapa saat.' },
        handler: (req, res, next, options) => {
            res.status(429).json(options.message);
        }
    });

    // Unified Rate Limiting pada seluruh endpoint /api/ (120 requests/menit per user/IP)
    // Cukup longgar untuk SPA dashboard polling & initial load, namun tetap mencegah scraping & abuse
    const apiLimiter = rateLimit({
        windowMs: 60 * 1000,
        max: 120,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: getRateLimitKey,
        message: { error: 'Terlalu banyak request. Silakan coba lagi nanti.' },
        handler: (req, res, next, options) => {
            res.status(429).json(options.message);
        }
    });

    server.use('/api/auth/login', loginLimiter);
    server.use('/api/', apiLimiter);
    
    // Helper Otentikasi Socket.io
    function extractSocketToken(socket) {
        const auth = socket.handshake.auth || {};
        const query = socket.handshake.query || {};
        const headers = socket.handshake.headers || {};
        
        let token = auth.token;

        if (!token && headers.authorization) {
            const parts = headers.authorization.split(' ');
            if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
                token = parts[1].trim();
            }
        }

        if (!token && headers.cookie) {
            const match = headers.cookie.match(/(?:^|;\s*)nocr_token=([^;]+)/);
            if (match) {
                try {
                    token = decodeURIComponent(match[1]);
                } catch (e) {
                    token = match[1];
                }
            }
        }

        if (!token && query.token) {
            token = query.token;
        }

        return token || null;
    }

    async function authenticateSocket(socket, next) {
        try {
            const token = extractSocketToken(socket);
            if (!token) {
                const err = new Error('Authentication required: Token tidak ditemukan');
                err.data = { code: 'AUTH_REQUIRED' };
                return next(err);
            }

            const jwtSecret = process.env.JWT_SECRET;
            if (!jwtSecret) {
                console.error('JWT_SECRET belum dikonfigurasi!');
                const err = new Error('Internal configuration error');
                err.data = { code: 'CONFIG_ERROR' };
                return next(err);
            }

            const decoded = jwt.verify(token, jwtSecret);
            const userInfo = await getUserInfo(decoded.id);
            socket.user = {
                id: decoded.id,
                username: decoded.username || userInfo.username,
                role: userInfo.role || decoded.role || 'visitor',
                permissions: userInfo.permissions || {}
            };
            return next();
        } catch (err) {
            const error = new Error('Authentication failed: Token tidak valid atau sudah kedaluwarsa');
            error.data = { code: 'AUTH_INVALID' };
            return next(error);
        }
    }

    function authorizeSocketNamespace(socket, next) {
        const user = socket.user;
        if (!user) {
            const err = new Error('Unauthorized: User tidak terautentikasi');
            err.data = { code: 'UNAUTHORIZED' };
            return next(err);
        }

        const nsp = socket.nsp.name;

        // Admin role has full access to all namespaces
        if (user.role === 'admin') {
            return next();
        }

        // Demo / readonly user: strictly blocked from admin, monitoring, devices, chat, alerts, logs, realtime, nocr
        if (user.role === 'demo') {
            if (nsp !== '/' && nsp !== '/dashboard') {
                const err = new Error(`Unauthorized: Akses ke namespace '${nsp}' tidak diizinkan untuk akun demo`);
                err.data = { code: 'FORBIDDEN' };
                return next(err);
            }
        }

        // Check namespace-specific permissions
        if (nsp === '/admin' || nsp.startsWith('/admin/')) {
            return next(new Error('Unauthorized: Admin access required'));
        } else if (nsp === '/dashboard' || nsp.startsWith('/dashboard/')) {
            if (!hasServerAccess(user.permissions, 'dashboard', 'read', 'dashboard')) {
                const err = new Error('Unauthorized: Dashboard access required');
                err.data = { code: 'FORBIDDEN' };
                return next(err);
            }
        } else if (nsp === '/monitoring' || nsp.startsWith('/monitoring/')) {
            const hasMonAccess = hasServerAccess(user.permissions, 'monitoring-pppoe', 'read', 'monitoring') ||
                                 hasServerAccess(user.permissions, 'monitoring-l2tp', 'read', 'monitoring');
            if (!hasMonAccess) {
                const err = new Error('Unauthorized: Monitoring access required');
                err.data = { code: 'FORBIDDEN' };
                return next(err);
            }
        } else if (nsp === '/devices' || nsp.startsWith('/devices/')) {
            const hasDevAccess = hasServerAccess(user.permissions, 'devices-mikrotik', 'read', 'devices') ||
                                 hasServerAccess(user.permissions, 'devices-ruijie', 'read', 'devices') ||
                                 hasServerAccess(user.permissions, 'devices-hsgq', 'read', 'devices');
            if (!hasDevAccess) {
                const err = new Error('Unauthorized: Devices access required');
                err.data = { code: 'FORBIDDEN' };
                return next(err);
            }
        } else if (nsp === '/chat' || nsp.startsWith('/chat/')) {
            if (!hasServerAccess(user.permissions, 'chat', 'read', 'chat.live')) {
                const err = new Error('Unauthorized: Chat access required');
                err.data = { code: 'FORBIDDEN' };
                return next(err);
            }
        } else if (nsp === '/logs' || nsp === '/alerts' || nsp.startsWith('/logs/') || nsp.startsWith('/alerts/')) {
            const hasLogAccess = hasServerAccess(user.permissions, 'settings-health', 'read', 'system.settings');
            if (!hasLogAccess) {
                const err = new Error('Unauthorized: Logs and Alerts access required');
                err.data = { code: 'FORBIDDEN' };
                return next(err);
            }
        } else if (nsp === '/topology' || nsp.startsWith('/topology/')) {
            if (!hasServerAccess(user.permissions, 'topology', 'read', 'topology')) {
                const err = new Error('Unauthorized: Topology access required');
                err.data = { code: 'FORBIDDEN' };
                return next(err);
            }
        } else if (nsp === '/sites' || nsp.startsWith('/sites/')) {
            if (!hasServerAccess(user.permissions, 'sites', 'read', 'sites')) {
                const err = new Error('Unauthorized: Sites access required');
                err.data = { code: 'FORBIDDEN' };
                return next(err);
            }
        } else if (nsp !== '/' && nsp !== '/realtime' && nsp !== '/nocr') {
            // Unknown or unsupported namespace
            const err = new Error(`Unauthorized: Akses ke namespace '${nsp}' tidak diizinkan`);
            err.data = { code: 'FORBIDDEN' };
            return next(err);
        }

        return next();
    }

    // Pengaturan Socket.io
    const io = new Server(httpServer, {
        cors: { origin: '*' }
    });
    global.io = io;

    // Explicitly enforce authorization on all 10 socket.io namespaces
    const PROTECTED_NAMESPACES = [
        '/',
        '/admin',
        '/monitoring',
        '/devices',
        '/alerts',
        '/logs',
        '/realtime',
        '/dashboard',
        '/chat',
        '/nocr'
    ];

    PROTECTED_NAMESPACES.forEach((nspName) => {
        const nsp = io.of(nspName);
        nsp.use(authenticateSocket);
        nsp.use(authorizeSocketNamespace);
    });

    // Wajibkan autentikasi JWT dan otorisasi RBAC pada namespace root dan seluruh dynamic namespace
    io.use(authenticateSocket);
    io.use(authorizeSocketNamespace);
    io.of(/.*/).use(authenticateSocket);
    io.of(/.*/).use(authorizeSocketNamespace);
    io.on('new_namespace', (nsp) => {
        nsp.use(authenticateSocket);
        nsp.use(authorizeSocketNamespace);
    });

    const activeMonitors = new Set();
    const clients = new Set();
    let isWorkerRunning = false;
    const previousMappingsStatus = {};
    const recentLogsCache = new Map(); // message -> timestamp (ms)
    
    // Inisialisasi status awal dari database agar tidak hilang log saat server di-restart
    db.from('device_mappings').select('ruijie_mac, final_status').then(
        ({ data }) => {
            if (data) {
                data.forEach(m => {
                    previousMappingsStatus[m.ruijie_mac] = m.final_status;
                });
            }
        },
        (err) => console.error('Gagal memuat state awal:', err.message)
    );

    // Jalankan pembersihan awal log flapping (<10m) di database
    cleanupFlappingActivityLogs();
    setInterval(cleanupFlappingActivityLogs, 60000);

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
            console.info(`Log database dipangkas: ${excess} entri lama dihapus.`);
        } catch (err) {
            console.error('Gagal memangkas log aktivitas:', err.message);
        }
    }

    const targetStatuses = {};
    const failCounters = {};

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

    async function cleanupFlappingActivityLogs() {
        try {
            const { data: logs, error } = await db
                .from('activity_logs')
                .select('*')
                .order('time', { ascending: false })
                .limit(500);

            if (error || !logs || logs.length === 0) return;

            const { flappingIds } = filterFlappingLogs(logs);
            if (flappingIds && flappingIds.length > 0) {
                console.info(`Memangkas ${flappingIds.length} log flapping (<10m) dari database...`);
                await db.from('activity_logs').delete().in('id', flappingIds);
                io.emit('activity_log_updated', { action: 'cleanup', deletedIds: flappingIds });
            }
        } catch (err) {
            console.error('Gagal membersihkan log flapping di DB:', err.message);
        }
    }

    // Fungsi utama penampung log - MURNI DB DAN EMIT SOCKET REALTIME
    async function addActivityLog(message) {
        if (!message) return;

        const now = Date.now();

        // Cek apakah pesan log merupakan perubahan status pelanggan / perangkat
        const statusInfo = getStatusLogInfo(message);
        if (statusInfo) {
            try {
                // Cari log status terakhir untuk target yang sama di database
                const { data: prevLogs } = await db
                    .from('activity_logs')
                    .select('*')
                    .ilike('message', `%${statusInfo.targetName}%berubah menjadi%`)
                    .order('time', { ascending: false })
                    .limit(1);

                if (prevLogs && prevLogs.length > 0) {
                    const prev = prevLogs[0];
                    const prevTime = new Date(prev.time).getTime();
                    const diff = now - prevTime;
                    const thresholdMs = getFlappingThresholdMs();
                    if (diff < thresholdMs) {
                        // Terdeteksi flapping (di bawah batas waktu konfigurasi server-settings.json):
                        // Hapus log status sebelumnya dari DB dan abaikan penyimpan log baru
                        console.info(`Log flapping terdeteksi untuk ${statusInfo.targetName}. Menghapus log sebelumnya (ID: ${prev.id}) dan mengabaikan log baru.`);
                        await db.from('activity_logs').delete().eq('id', prev.id);
                        io.emit('activity_log_updated', {
                            action: 'delete',
                            id: prev.id,
                            targetName: statusInfo.targetName,
                            message: prev.message
                        });
                        return;
                    }
                }
            } catch (flappingErr) {
                console.error("Gagal memeriksa log flapping:", flappingErr.message);
            }
        }

        // Bersihkan cache yang berumur lebih dari 10 detik
        for (const [msg, ts] of recentLogsCache.entries()) {
            if (now - ts > 10000) {
                recentLogsCache.delete(msg);
            }
        }
        
        // Cek in-memory cache terlebih dahulu
        if (recentLogsCache.has(message)) {
            return;
        }
        
        // Tambahkan ke in-memory cache SEGERA (SEBELUM await) untuk mencegah race condition konkuren
        recentLogsCache.set(message, now);
        
        // Cek database untuk menangani multi-instance/restart
        try {
            const tenSecondsAgo = new Date(now - 10000).toISOString();
            const { data: recentLogs, error: checkErr } = await db
                .from('activity_logs')
                .select('id')
                .eq('message', message)
                .gte('time', tenSecondsAgo)
                .limit(1);

            if (checkErr) {
                console.error("Gagal memeriksa duplikat log:", checkErr.message);
            } else if (recentLogs && recentLogs.length > 0) {
                return;
            }
        } catch (err) {
            console.error("Gagal memeriksa duplikat log:", err.message);
        }

        try {
            // Langsung masukkan ke tabel database dan select hasilnya
            const { data, error } = await db
                .from('activity_logs')
                .insert([{ message }])
                .select();
            
            if (error) {
                console.error("Gagal menyimpan log ke database:", error.message);
                // Jika gagal simpan, hapus dari cache agar bisa dicoba lagi nanti
                recentLogsCache.delete(message);
            } else {
                // Emit secara instan lewat socket
                if (data && data.length > 0) {
                    io.emit('activity_log_updated', data[0]);
                }
                await trimActivityLogsInDb();
                await cleanupFlappingActivityLogs();
            }
        } catch (err) {
            console.error("Gagal koneksi simpan log database:", err.message);
            recentLogsCache.delete(message);
        }
    }

    global.addActivityLog = addActivityLog;

    async function updateDailyReportRealtime(ruijieMac, prefixName, finalStatus) {
        try {
            const today = new Date().toLocaleDateString('sv', { timeZone: 'Asia/Jakarta' });
            const now = new Date().toISOString();
            const isOffline = finalStatus === 'Offline';

            // 1. Cek existing report
            const { data: allReports } = await db.from('daily_reports').select('*').eq('ruijie_mac', ruijieMac);
            let existing = (allReports || []).find(r => new Date(r.report_date).toLocaleDateString('sv', { timeZone: 'Asia/Jakarta' }) === today);
            if (!existing) {
                existing = (allReports || []).find(r => r.status_progress === 'Progress');
            }

            if (existing) {
                const updateData = {};
                let needsUpdate = false;

                if (isOffline) {
                    if (existing.status_progress === 'Done' && new Date(existing.report_date).toLocaleDateString('sv', { timeZone: 'Asia/Jakarta' }) === today) {
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
                    const { error } = await db.from('daily_reports').update(updateData).eq('id', existing.id);
                    if (error) throw error;
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

                    const { error } = await db.from('daily_reports').insert([{
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
                    if (error) throw error;
                } else {
                    const { data: sites } = await db.from('sites').select('full_address, latitude, longitude').eq('ruijie_mac', ruijieMac);
                    let loc = '';
                    if (sites && sites.length > 0) {
                        const s = sites[0];
                        if (s.full_address) loc = s.full_address;
                        else if (s.latitude && s.longitude) loc = `${s.latitude}, ${s.longitude}`;
                    }

                    const { error } = await db.from('daily_reports').insert([{
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
                    if (error) throw error;
                }
            }
        } catch (err) {
            console.error("Realtime Laporan Error:", err.message || err);
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

    let syncMappingsTimeout = null;
    function triggerSyncDeviceMappingsDebounced() {
        if (syncMappingsTimeout) clearTimeout(syncMappingsTimeout);
        syncMappingsTimeout = setTimeout(() => {
            // Reset semua cache terkait agar syncDeviceMappings terpaksa membaca data terbaru dari PostgreSQL
            deviceMappingsCache.data = null;
            ruijieDevicesCache.data = null;
            activePppoeCache.data = null;
            pppoeSecretsCache.data = null;
            networkInterfacesCache.data = null;
            syncDeviceMappings();
        }, 1000); // Debounce 1 detik untuk meminimalkan beban database
    }

    // Database Realtime fallback/sync
    const channel = db.channel('schema-db-changes')
        .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
            if (payload.table === 'network_interfaces') { networkInterfacesCache.data = null; io.emit('interface_update', payload); }
            if (payload.table === 'devices') devicesCache.data = null;
            if (payload.table === 'ruijie_devices') {
                ruijieDevicesCache.data = null;
                triggerSyncDeviceMappingsDebounced();
            }
            if (payload.table === 'device_mappings') deviceMappingsCache.data = null;
            if (payload.table === 'pppoe_active') {
                activePppoeCache.data = null;
                io.emit('pppoe_active_update', payload);
                triggerSyncDeviceMappingsDebounced();
            }
            if (payload.table === 'pppoe_secrets') { pppoeSecretsCache.data = null; io.emit('pppoe_secret_update', payload); }
            if (payload.table === 'topology_nodes' || payload.table === 'topology_edges') {
                nodesCache.data = null;
                io.emit('dashboard_topology_refresh');
            }
            if (payload.table === 'activity_logs' && payload.eventType === 'INSERT') {
                io.emit('activity_log_updated', payload.new);
            }
            if (payload.table === 'activity_logs' && payload.eventType === 'DELETE') {
                io.emit('activity_log_updated', { action: 'delete', id: payload.old?.id });
            }

            io.emit('db_change', payload);
        })
        .subscribe();

    io.on('connection', (socket) => {
        clients.add(socket.id);

        // Mengambil log awal langsung dari database secara asinkron saat client connect
        const sendCleanInitialLogs = async () => {
            try {
                const { data } = await db
                    .from('activity_logs')
                    .select('*')
                    .ilike('message', '%berubah menjadi%')
                    .order('time', { ascending: false })
                    .limit(100);
                if (data) {
                    const { cleanLogs, flappingIds } = filterFlappingLogs(data);
                    if (flappingIds && flappingIds.length > 0) {
                        db.from('activity_logs').delete().in('id', flappingIds).catch(() => {});
                    }
                    socket.emit('initial_logs', cleanLogs.slice(0, 20));
                }
            } catch (e) {
                console.error('Gagal memuat initial_logs:', e.message);
            }
        };

        sendCleanInitialLogs();

        socket.on('request_initial_logs', sendCleanInitialLogs);

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

        socket.on('force_sync_hsgq', () => {
            broadcastHsgqOltData();
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

        // Telnet session state per socket connection
        let activeTelnetSocket = null;

        socket.on('telnet_connect', ({ ip, port = 23 }) => {
            const user = socket.user;
            const isAllowed = user && (
                user.role === 'admin' ||
                hasServerAccess(user.permissions, 'monitoring-l2tp', 'update') ||
                hasServerAccess(user.permissions, 'monitoring-pppoe', 'update') ||
                hasServerAccess(user.permissions, 'devices-mikrotik', 'update')
            );
            if (!isAllowed) {
                socket.emit('telnet_data', '\r\n\x1b[31m[AKSES DITOLAK] Anda tidak memiliki izin role untuk mengakses Telnet router ini.\x1b[0m\r\n');
                socket.emit('telnet_status', { connected: false, error: 'Akses ditolak: Izin tidak mencukupi' });
                return;
            }

            if (!ip || !/^[0-9a-zA-Z.:-]+$/.test(String(ip).trim())) {
                socket.emit('telnet_data', '\r\n\x1b[31m[ERROR] Format IP target tidak valid.\x1b[0m\r\n');
                socket.emit('telnet_status', { connected: false, error: 'IP tidak valid' });
                return;
            }

            if (activeTelnetSocket) {
                try { activeTelnetSocket.destroy(); } catch (e) {}
                activeTelnetSocket = null;
            }

            const targetHost = String(ip).trim();
            const targetPort = parseInt(port, 10) || 23;

            socket.emit('telnet_status', { connected: false, connecting: true, message: `Menghubungkan ke ${targetHost}:${targetPort}...` });
            socket.emit('telnet_data', `\x1b[36m>>> Menghubungkan ke Telnet ${targetHost}:${targetPort}...\x1b[0m\r\n`);

            try {
                const client = net.createConnection({ host: targetHost, port: targetPort }, () => {
                    client.setKeepAlive(true, 10000);
                    client.setNoDelay(true);
                    socket.emit('telnet_status', { connected: true, connecting: false });
                    socket.emit('telnet_data', `\x1b[32m>>> Terhubung ke MikroTik ${targetHost}:${targetPort}\x1b[0m\r\n\r\n`);
                });

                activeTelnetSocket = client;

                client.on('data', (chunk) => {
                    // Telnet IAC (0xFF) Option Negotiation
                    let i = 0;
                    const out = [];
                    while (i < chunk.length) {
                        if (chunk[i] === 255) {
                            const command = chunk[i + 1];
                            const option = chunk[i + 2];
                            if (command === 253) { // DO -> reply WONT
                                client.write(Buffer.from([255, 252, option]));
                                i += 3;
                            } else if (command === 251) { // WILL -> reply DONT
                                client.write(Buffer.from([255, 254, option]));
                                i += 3;
                            } else if (command === 254 || command === 252) { // DONT / WONT
                                i += 3;
                            } else {
                                i += 2;
                            }
                        } else {
                            out.push(chunk[i]);
                            i++;
                        }
                    }
                    if (out.length > 0) {
                        socket.emit('telnet_data', Buffer.from(out).toString('utf-8'));
                    }
                });

                client.on('error', (err) => {
                    socket.emit('telnet_data', `\r\n\x1b[31m[Telnet Error] ${err.message}\x1b[0m\r\n`);
                    socket.emit('telnet_status', { connected: false, connecting: false, error: err.message });
                });

                client.on('close', () => {
                    activeTelnetSocket = null;
                    socket.emit('telnet_status', { connected: false, connecting: false });
                    socket.emit('telnet_data', '\r\n\x1b[33m>>> [Koneksi Telnet ditutup]\x1b[0m\r\n');
                });
            } catch (err) {
                socket.emit('telnet_data', `\r\n\x1b[31m[Gagal Membuat Koneksi] ${err.message}\x1b[0m\r\n`);
                socket.emit('telnet_status', { connected: false, error: err.message });
            }
        });

        socket.on('telnet_input', (input) => {
            if (activeTelnetSocket && !activeTelnetSocket.destroyed) {
                try {
                    activeTelnetSocket.write(input);
                } catch (e) {}
            }
        });

        socket.on('telnet_disconnect', () => {
            if (activeTelnetSocket) {
                try { activeTelnetSocket.destroy(); } catch (e) {}
                activeTelnetSocket = null;
            }
            socket.emit('telnet_status', { connected: false, connecting: false });
        });

        socket.on('disconnect', () => {
            if (activeTelnetSocket) {
                try { activeTelnetSocket.destroy(); } catch (e) {}
                activeTelnetSocket = null;
            }
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
            const settings = getSystemSettings();
            const timeoutSecs = settings.ping_timeout_seconds || 15;
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
                    const res = await ping.promise.probe(target.ip, { timeout: timeoutSecs });
                    let status = res.alive ? 'online' : 'offline';
                    
                    if (status === 'offline') {
                        failCounters[target.id] = (failCounters[target.id] || 0) + 1;
                        // Butuh 3 kali gagal berturut-turut untuk benar-benar dianggap offline
                        if (failCounters[target.id] < 3) {
                            // Jika belum mencapai threshold, kita anggap masih online / mempertahankan status sebelumnya
                            status = targetStatuses[target.id] === 'online' ? 'online' : 'offline';
                        }
                    } else {
                        failCounters[target.id] = 0;
                    }

                    const latency = res.alive ? Math.round(res.time) : 0;
                    const timestamp = new Date().toISOString();

                    // Deteksi perubahan status untuk log aktivitas (kecuali L2TP & PPPoE client yang sudah dikelola oleh mappings)
                    const previousStatus = targetStatuses[target.id];
                    if (previousStatus && previousStatus !== status) {
                        if (target.type !== 'client' && target.type !== 'pppoe-client') { // L2TP / PPPoE client logs via mappings now
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

    // Jalankan ping worker secara dinamis sesuai setting ping_interval_seconds
    const runPingWorkerLoop = async () => {
        await pingWorker();
        const settings = getSystemSettings();
        const intervalMs = (settings.ping_interval_seconds || 5) * 1000;
        setTimeout(runPingWorkerLoop, intervalMs);
    };
    runPingWorkerLoop();

    // Jalankan broadcast core metrics MikroTik secara dinamis sesuai setting core_broadcast_interval_seconds
    const runCoreStatusLoop = async () => {
        await broadcastDashboardCoreStatus();
        const settings = getSystemSettings();
        const intervalMs = (settings.core_broadcast_interval_seconds || 10) * 1000;
        setTimeout(runCoreStatusLoop, intervalMs);
    };
    runCoreStatusLoop();

    // Keep OLT Session Alive and fresh
    global.hsgqTokenTimestamp = global.hsgqTokenTimestamp || 0;

    async function keepHsgqOltSessionAlive(force = false) {
        const url = process.env.HSGQ_OLT_URL;
        const username = process.env.HSGQ_OLT_USERNAME;
        const key = process.env.HSGQ_OLT_KEY;
        const value = process.env.HSGQ_OLT_VALUE;
        const defaultToken = process.env.HSGQ_OLT_TOKEN || '';

        if (!url) {
            return null;
        }

        const axios = require('axios');

        const login = async () => {
            if (!username || !key || !value) {
                global.hsgqTokenCache = defaultToken;
                global.hsgqTokenTimestamp = Date.now();
                return defaultToken;
            }
            try {
                const payload = {
                    method: "set",
                    param: { name: username, key: key, value: value, captcha_v: "", captcha_f: "" }
                };
                const res = await axios.post(`${url}/userlogin?form=login`, payload, {
                    headers: { 'Content-Type': 'application/json;charset=UTF-8', 'x-token': 'null' },
                    timeout: 10000
                });
                if (res.data && res.data.code === 1 && res.headers['x-token']) {
                    global.hsgqTokenCache = res.headers['x-token'];
                    global.hsgqTokenTimestamp = Date.now();
                    console.info(`[OLT Session] Login sukses, token baru didapatkan.`);
                    return global.hsgqTokenCache;
                }
            } catch (e) {
                console.error(`[OLT Session] Gagal login ke OLT:`, e.message);
            }
            global.hsgqTokenCache = defaultToken;
            global.hsgqTokenTimestamp = Date.now();
            return defaultToken;
        };

        const isExpired = !global.hsgqTokenCache || (Date.now() - (global.hsgqTokenTimestamp || 0) > 120000);
        if (force || isExpired) {
            return await login();
        }

        let token = global.hsgqTokenCache;

        // Test if the current token is still valid
        try {
            const res = await axios.get(`${url}/ontinfo_table?_t=${Date.now()}`, {
                headers: { 'x-token': token },
                timeout: 10000
            });
            const isInvalid = !res.data || res.data.code !== 1 || (res.data.message && /token|timeout|login/i.test(res.data.message));
            if (isInvalid) {
                console.warn(`[OLT Session] Token kedaluwarsa (${res.data?.message || 'code 0'}). Melakukan login ulang otomatis...`);
                return await login();
            } else {
                return token;
            }
        } catch (err) {
            console.error(`[OLT Session] Gagal memverifikasi sesi OLT (network/timeout):`, err.message);
            if (err.response && (err.response.status === 401 || err.response.status === 403)) {
                return await login();
            }
            return token;
        }
    }

    // Jalankan pengecekan dan keep-alive sesi HSGQ OLT berkala setiap 1 menit
    const runHsgqOltKeepAliveLoop = async () => {
        await keepHsgqOltSessionAlive();
        setTimeout(runHsgqOltKeepAliveLoop, 60 * 1000); // 1 menit
    };
    setTimeout(runHsgqOltKeepAliveLoop, 3000);

    // Fungsi penjadwalan agar task berjalan tepat di awal pergantian interval secara dinamis
    function scheduleAtIntervalBoundary(callback, intervalKey, offsetSeconds = 0) {
        const runLoop = async () => {
            await callback();
            const settings = getSystemSettings();
            let intervalSeconds = 60;
            if (intervalKey === 'ruijie') intervalSeconds = settings.sync_ruijie_interval_seconds || 60;
            else if (intervalKey === 'mikrotik') intervalSeconds = settings.sync_mikrotik_interval_seconds || 60;
            else if (intervalKey === 'mappings') intervalSeconds = settings.sync_mappings_interval_seconds || 60;
            else if (intervalKey === 'hsgq') intervalSeconds = settings.sync_hsgq_interval_seconds || 60;
            
            setTimeout(runLoop, intervalSeconds * 1000);
        };

        const checkAndSchedule = () => {
            const now = new Date();
            const currentSeconds = now.getSeconds();
            const currentMs = now.getMilliseconds();
            
            const settings = getSystemSettings();
            let intervalSeconds = 60;
            if (intervalKey === 'ruijie') intervalSeconds = settings.sync_ruijie_interval_seconds || 60;
            else if (intervalKey === 'mikrotik') intervalSeconds = settings.sync_mikrotik_interval_seconds || 60;
            else if (intervalKey === 'mappings') intervalSeconds = settings.sync_mappings_interval_seconds || 60;
            else if (intervalKey === 'hsgq') intervalSeconds = settings.sync_hsgq_interval_seconds || 60;

            let msToNextTarget = ((intervalSeconds - (currentSeconds % intervalSeconds) + offsetSeconds) * 1000 - currentMs) % (intervalSeconds * 1000);
            if (msToNextTarget <= 0) msToNextTarget += intervalSeconds * 1000;
            
            setTimeout(runLoop, msToNextTarget);
        };

        checkAndSchedule();
    }

    // Global HSGQ OLT Data Cache
    global.hsgqDataCache = global.hsgqDataCache || {
        ontinfo: null,
        timestamp: 0
    };

    // Jalankan background sync dan broadcast HSGQ OLT secara berkala
    async function broadcastHsgqOltData() {
        const url = process.env.HSGQ_OLT_URL;
        if (!url) return;

        try {
            let token = await keepHsgqOltSessionAlive();
            if (!token) token = global.hsgqTokenCache || process.env.HSGQ_OLT_TOKEN || '';
            const axios = require('axios');

            // Trigger HSGQ OLT native hardware refresh across all PON ports so live states are continuously updated
            try {
                await Promise.all([
                    axios.get(`${url}/system?form=refreshtab`, { headers: { 'x-token': token }, timeout: 3000 }).catch(() => {}),
                    axios.get(`${url}/board?info=pon`, { headers: { 'x-token': token }, timeout: 3000 }).catch(() => {}),
                    axios.get(`${url}/board?info=system`, { headers: { 'x-token': token }, timeout: 3000 }).catch(() => {}),
                    axios.get(`${url}/gponmgmt?form=gpon_setting`, { headers: { 'x-token': token }, timeout: 3000 }).catch(() => {}),
                    axios.get(`${url}/gponont_mgmt?form=auth&port_id=0`, { headers: { 'x-token': token }, timeout: 3000 }).catch(() => {}),
                    axios.get(`${url}/gponont_mgmt?form=auth&port_id=1`, { headers: { 'x-token': token }, timeout: 3000 }).catch(() => {}),
                    axios.get(`${url}/gponont_mgmt?form=auth&port_id=2`, { headers: { 'x-token': token }, timeout: 3000 }).catch(() => {}),
                    axios.get(`${url}/gponont_mgmt?form=auth&port_id=3`, { headers: { 'x-token': token }, timeout: 3000 }).catch(() => {}),
                    axios.get(`${url}/system?form=hostname`, { headers: { 'x-token': token }, timeout: 3000 }).catch(() => {})
                ]);
            } catch (e) {}

            let res = await axios.get(`${url}/ontinfo_table?_t=${Date.now()}`, {
                headers: { ...(token ? { 'x-token': token } : {}) },
                timeout: 10000
            });

            // If token expired during fetch, re-login and retry immediately
            if (!res.data || res.data.code !== 1 || (res.data.message && /token|timeout|login/i.test(res.data.message))) {
                token = await keepHsgqOltSessionAlive(true);
                res = await axios.get(`${url}/ontinfo_table?_t=${Date.now()}`, {
                    headers: { ...(token ? { 'x-token': token } : {}) },
                    timeout: 10000
                });
            }

            if (res.data && (res.data.code === 1 || Array.isArray(res.data.data))) {
                let data = res.data;
                // Apply pending name updates if any
                if (data && data.data && global.pendingNameUpdates) {
                    const now = Date.now();
                    for (const key in global.pendingNameUpdates) {
                        if (now - global.pendingNameUpdates[key].timestamp > 65000) {
                            delete global.pendingNameUpdates[key];
                        }
                    }
                    data.data = data.data.map(row => {
                        const key = `${row.identifier}`;
                        if (global.pendingNameUpdates[key]) {
                            row.name = global.pendingNameUpdates[key].ont_name;
                            row.ont_name = global.pendingNameUpdates[key].ont_name;
                            row.ont_description = global.pendingNameUpdates[key].ont_description;
                        }
                        return row;
                    });
                }

                global.hsgqDataCache.ontinfo = data;
                global.hsgqDataCache.timestamp = Date.now();

                const ontList = Array.isArray(data.data) ? data.data : [];
                const onlineCount = ontList.filter(x => x.rstate === 1).length;
                const offlineCount = ontList.filter(x => x.rstate !== 1 && x.rstate !== 0).length;
                console.info(`[HSGQ OLT Sync] Sync sukses (${ontList.length} ONT, Online: ${onlineCount}, Offline: ${offlineCount})`);

                // Broadcast ke semua client yang sedang terhubung
                io.emit('hsgq_olt_update', {
                    endpoint: '/ontinfo_table',
                    type: 'Authenticate List',
                    data: data,
                    timestamp: new Date().toISOString()
                });
            }
        } catch (err) {
            console.error('[HSGQ OLT Sync] Gagal sinkronisasi data OLT:', err.message);
        }
    }

    broadcastHsgqOltData();
    scheduleAtIntervalBoundary(broadcastHsgqOltData, 'hsgq', 0);

    // Jalankan broadcast Ruijie secara otomatis
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
    scheduleAtIntervalBoundary(broadcastRuijieDevices, 'ruijie', 0);

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




    let isSyncingMappings = false;

    // Jalankan Sinkronisasi Mappings setiap pergantian menit lewat 5 detik (supaya data mentah Ruijie/Mikrotik masuk dulu)
    async function syncDeviceMappings() {
        if (isSyncingMappings) {
            return;
        }
        isSyncingMappings = true;
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
                if (apStatus === 'Online' && mikrotikStatus === 'Offline') issue = 'Mikrotik Tidak Terhubung';
                else if (apStatus === 'Offline' && mikrotikStatus === 'Offline') issue = 'Semua Perangkat Mati';
                else if (apStatus === 'Offline' && mikrotikStatus === 'Online') issue = 'Access Point Tidak Terhubung';
                else if (apStatus === 'Online' && mikrotikStatus === 'Online') issue = 'Normal';

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
                    addActivityLog(`Status ${prefixName} berubah menjadi ${finalStatus}`);
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
        } finally {
            isSyncingMappings = false;
        }
    }

    broadcastMikrotikData();
    scheduleAtIntervalBoundary(broadcastMikrotikData, 'mikrotik', 0);

    // Tunda eksekusi pertama 5 detik agar data awal terkumpul, setelah itu ikut pergantian interval lewat 5 detik
    setTimeout(() => {
        syncDeviceMappings();
    }, 5000);
    scheduleAtIntervalBoundary(syncDeviceMappings, 'mappings', 5);

    function authenticateExpressRequest(req, res) {
        const token = extractExpressToken(req);
        if (!token) {
            res.status(401).json({ error: 'Akses ditolak: Token tidak ditemukan' });
            return null;
        }
        try {
            const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
            return decoded;
        } catch (e) {
            res.status(401).json({ error: 'Token tidak valid atau sudah kedaluwarsa' });
            return null;
        }
    }

    // Rute Express WhatsApp Gateway
    server.use('/api/whatsapp', express.json());

    server.get('/api/whatsapp/status', (req, res) => {
        const user = authenticateExpressRequest(req, res);
        if (!user) return;
        res.json(whatsapp.getStatus());
    });

    server.post('/api/whatsapp/action', async (req, res) => {
        const user = authenticateExpressRequest(req, res);
        if (!user) return;

        try {
            const userInfo = await getUserInfo(user.id);
            const isAuthorized = userInfo.role === 'admin' || hasServerAccess(userInfo.permissions, 'settings-wa', 'update', 'system.settings');
            if (!isAuthorized) {
                return res.status(403).json({ error: 'Akses ditolak: Tidak ada izin' });
            }
        } catch (e) {
            return res.status(500).json({ error: 'Gagal memverifikasi hak akses' });
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
        const user = authenticateExpressRequest(req, res);
        if (!user) return;

        try {
            const userInfo = await getUserInfo(user.id);
            const isAuthorized = userInfo.role === 'admin' || hasServerAccess(userInfo.permissions, 'chat', 'read', 'chat.live');
            if (!isAuthorized) {
                return res.status(403).json({ error: 'Akses ditolak: Tidak ada izin' });
            }
            const chats = await whatsapp.getChats();
            res.json(chats);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    server.get('/api/whatsapp/chat/:id', async (req, res) => {
        const user = authenticateExpressRequest(req, res);
        if (!user) return;

        try {
            const userInfo = await getUserInfo(user.id);
            const isAuthorized = userInfo.role === 'admin' || hasServerAccess(userInfo.permissions, 'chat', 'read', 'chat.live');
            if (!isAuthorized) {
                return res.status(403).json({ error: 'Akses ditolak: Tidak ada izin' });
            }
            const messages = await whatsapp.getChatMessages(req.params.id);
            res.json(messages);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    server.post('/api/whatsapp/chat/send', async (req, res) => {
        const user = authenticateExpressRequest(req, res);
        if (!user) return;

        try {
            const userInfo = await getUserInfo(user.id);
            const isAuthorized = userInfo.role === 'admin' || hasServerAccess(userInfo.permissions, 'chat', 'create', 'chat.live');
            if (!isAuthorized) {
                return res.status(403).json({ error: 'Akses ditolak: Tidak ada izin' });
            }
        } catch (e) {
            return res.status(500).json({ error: 'Gagal memverifikasi hak akses' });
        }

        try {
            const result = await whatsapp.sendMessage(req.body.chatId, req.body.text);
            res.json({ success: true, message: result });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    server.get('/api/whatsapp/chat/media/:msgId', async (req, res) => {
        const user = authenticateExpressRequest(req, res);
        if (!user) return;

        try {
            const userInfo = await getUserInfo(user.id);
            const isAuthorized = userInfo.role === 'admin' || hasServerAccess(userInfo.permissions, 'chat', 'read', 'chat.live');
            if (!isAuthorized) {
                return res.status(403).json({ error: 'Akses ditolak: Tidak ada izin' });
            }

            const media = await whatsapp.getMessageMedia(req.params.msgId);
            if (!media) return res.status(404).json({ error: 'Media tidak ditemukan atau kedaluwarsa' });
            res.json({ success: true, media: media.data, mimetype: media.mimetype, filename: media.filename });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    whatsapp.start(); // Mulai otomatis saat server booting.

    server.post('/api/mappings/sync-notify', (req, res) => {
        const user = authenticateExpressRequest(req, res);
        if (!user) return;
        triggerSyncDeviceMappingsDebounced();
        res.json({ success: true, message: 'Sync triggered' });
    });

    function decodeChunkedBuffer(buffer) {
        if (!buffer || buffer.length === 0) return buffer;
        let offset = 0;
        const pieces = [];
        while (offset < buffer.length) {
            let lineEnd = buffer.indexOf('\r\n', offset);
            let delimiterLen = 2;
            if (lineEnd === -1) {
                lineEnd = buffer.indexOf('\n', offset);
                delimiterLen = 1;
            }
            if (lineEnd === -1) break;

            const hexHeader = buffer.slice(offset, lineEnd).toString('latin1').trim().split(';')[0];
            const chunkSize = parseInt(hexHeader, 16);
            if (isNaN(chunkSize)) {
                return buffer;
            }
            if (chunkSize === 0) break;

            const chunkStart = lineEnd + delimiterLen;
            const chunkEnd = chunkStart + chunkSize;
            pieces.push(buffer.slice(chunkStart, Math.min(chunkEnd, buffer.length)));
            offset = chunkEnd + 2;
        }
        return pieces.length > 0 ? Buffer.concat(pieces) : buffer;
    }

    // Reverse Proxy Universal untuk Web Management ONT (Mendukung Custom Port 8080 Desa & Standar 80 OPD)
    async function handleOntProxy(req, res, targetRaw, targetPath) {
        if (!targetRaw || !/^[0-9a-zA-Z.:-]+$/.test(targetRaw)) {
            return res.status(400).send('Format IP target ONT tidak valid');
        }
        const cleanHost = String(targetRaw || '').trim();
        let targetIp = cleanHost;
        let targetPort = 80;
        if (cleanHost.includes(':')) {
            const parts = cleanHost.split(':');
            targetIp = parts[0];
            targetPort = parseInt(parts[1], 10) || 80;
        }
        const targetKey = targetPort === 80 ? targetIp : `${targetIp}:${targetPort}`;

        // Normalisasi path target
        let cleanPath = targetPath ? (targetPath.startsWith('/') ? targetPath : `/${targetPath}`) : '/';
        const queryStr = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
        const fullPath = `${cleanPath}${queryStr}`;

        // Handler khusus Logout ONT
        if (cleanPath.includes('logout.asp') || cleanPath.includes('logout.cgi') || cleanPath.includes('logout.htm') || cleanPath.includes('logout.gch')) {
            const expiredCookies = [
                `UID=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`,
                `PSW=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`,
                `SESSIONID=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`,
                `LoginTimes=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`,
                `_lang=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`,
                `ont_proxy_ip=${targetKey}; Path=/; SameSite=Lax`
            ];
            res.setHeader('Set-Cookie', expiredCookies);
            return res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>Logging out...</title>
                    <script>
                        try {
                            if (window.top && window.top !== window && window.top.location.pathname.includes('/ont-proxy/')) {
                                window.top.location.href = '/ont-proxy/${targetKey}/';
                            } else if (window.parent && window.parent !== window && window.parent.location.pathname.includes('/ont-proxy/')) {
                                window.parent.location.href = '/ont-proxy/${targetKey}/';
                            } else {
                                window.location.href = '/ont-proxy/${targetKey}/';
                            }
                        } catch(e) {
                            window.location.href = '/ont-proxy/${targetKey}/';
                        }
                    </script>
                </head>
                <body style="background:#0f172a;color:#94a3b8;font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
                    <p style="font-size:14px;">Memproses Logout ONT...</p>
                </body>
                </html>
            `);
        }

        const socket = net.createConnection({ host: targetIp, port: targetPort, timeout: 3500 });
        const chunks = [];
        let isDone = false;

        function finish() {
            if (isDone || res.headersSent) return;
            isDone = true;
            try { socket.destroy(); } catch(e) {}

            const fullBuffer = Buffer.concat(chunks);
            const headerEndIdx = fullBuffer.indexOf('\r\n\r\n');
            const headerEndIdxLf = fullBuffer.indexOf('\n\n');

            let statusCode = 200;
            let headers = {};
            let bodyBuffer;

            if (headerEndIdx !== -1 && fullBuffer.slice(0, 10).toString('latin1').startsWith('HTTP/')) {
                const headerText = fullBuffer.slice(0, headerEndIdx).toString('latin1');
                bodyBuffer = fullBuffer.slice(headerEndIdx + 4);

                const headerLines = headerText.split(/\r?\n/);
                const statusLine = headerLines[0] || 'HTTP/1.0 200 OK';
                const statusMatch = statusLine.match(/HTTP\/\d\.\d\s+(\d+)/);
                if (statusMatch) statusCode = parseInt(statusMatch[1], 10);

                for (let i = 1; i < headerLines.length; i++) {
                    const colonIdx = headerLines[i].indexOf(':');
                    if (colonIdx !== -1) {
                        const name = headerLines[i].slice(0, colonIdx).trim().toLowerCase();
                        let val = headerLines[i].slice(colonIdx + 1).trim();
                        if (name === 'set-cookie') {
                            if (!headers['set-cookie']) headers['set-cookie'] = [];
                            headers['set-cookie'].push(val);
                        } else if (name === 'location') {
                            if (val.startsWith('/') && !val.startsWith('/ont-proxy/')) {
                                val = `/ont-proxy/${targetKey}${val}`;
                            }
                            headers['location'] = val;
                        } else {
                            headers[name] = val;
                        }
                    }
                }
            } else if (headerEndIdxLf !== -1 && fullBuffer.slice(0, 10).toString('latin1').startsWith('HTTP/')) {
                const headerText = fullBuffer.slice(0, headerEndIdxLf).toString('latin1');
                bodyBuffer = fullBuffer.slice(headerEndIdxLf + 2);
                const headerLines = headerText.split('\n');
                const statusMatch = (headerLines[0] || '').match(/HTTP\/\d\.\d\s+(\d+)/);
                if (statusMatch) statusCode = parseInt(statusMatch[1], 10);
            } else {
                bodyBuffer = fullBuffer;
                headers['content-type'] = 'text/html; charset=gb2312';
            }

            // Un-chunk data transfer jika berasal dari HTTP chunked encoding (seperti Huawei ONT)
            if (headers['transfer-encoding']?.toLowerCase().includes('chunked') || (bodyBuffer && /^[0-9a-fA-F]+\r?\n/.test(bodyBuffer.slice(0, 15).toString('latin1')))) {
                bodyBuffer = decodeChunkedBuffer(bodyBuffer);
                delete headers['transfer-encoding'];
            }

            // Koreksi otomatis MIME Type untuk ONT
            const lowerPath = cleanPath.toLowerCase();
            const bodyStrSample = bodyBuffer ? bodyBuffer.slice(0, 20).toString().trim() : '';
            if (lowerPath.endsWith('.json') || bodyStrSample.startsWith('{')) {
                headers['content-type'] = 'application/json; charset=utf-8';
            } else if (lowerPath.endsWith('.js') || lowerPath.includes('/js/') || lowerPath.includes('util.js')) {
                headers['content-type'] = 'application/javascript; charset=utf-8';
            } else if (lowerPath.endsWith('.css') || lowerPath.includes('/css/') || lowerPath.includes('cuscss')) {
                headers['content-type'] = 'text/css; charset=utf-8';
            } else if (lowerPath.endsWith('.png')) {
                headers['content-type'] = 'image/png';
            } else if (lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg')) {
                headers['content-type'] = 'image/jpeg';
            } else if (lowerPath.endsWith('.gif')) {
                headers['content-type'] = 'image/gif';
            } else if (lowerPath.endsWith('.cgi') || lowerPath.endsWith('.asp') || lowerPath.endsWith('.htm') || lowerPath.endsWith('.html') || lowerPath.endsWith('.ghtml') || (bodyBuffer && bodyBuffer.slice(0, 50).toString().toLowerCase().includes('<html'))) {
                headers['content-type'] = headers['content-type'] || 'text/html; charset=utf-8';
                headers['content-disposition'] = 'inline';
            }

            // Location redirect rewrite (mencegah duplicate /ont-proxy prefix dan mendukung relative location seperti index.asp)
            if (headers['location']) {
                let loc = headers['location'].trim();
                if (!loc.startsWith('http://') && !loc.startsWith('https://') && !loc.startsWith('/ont-proxy/')) {
                    const locPath = loc.startsWith('/') ? loc : `/${loc}`;
                    headers['location'] = `/ont-proxy/${targetKey}${locPath}`;
                }
            }

            // Gabungkan cookie ONT dengan ont_proxy_ip
            const rawCookies = Array.isArray(headers['set-cookie'])
                ? headers['set-cookie']
                : (headers['set-cookie'] ? [headers['set-cookie']] : []);
            const sanitizedCookies = rawCookies.map(c => {
                let cleaned = c.replace(/Domain=[^;]+;?/gi, '')
                               .replace(/Secure;?/gi, '')
                               .replace(/SameSite=[^;]+;?/gi, '')
                               .trim();
                if (!cleaned.toLowerCase().includes('path=')) {
                    cleaned += '; Path=/';
                }
                return cleaned + '; SameSite=Lax';
            });
            const outCookies = [...sanitizedCookies, `ont_proxy_ip=${targetKey}; Path=/; SameSite=Lax`];
            res.setHeader('Set-Cookie', outCookies);

            res.removeHeader('X-Content-Type-Options');
            res.removeHeader('X-Frame-Options');
            res.removeHeader('x-frame-options');
            res.removeHeader('Content-Security-Policy');
            res.removeHeader('content-security-policy');

            for (const [k, v] of Object.entries(headers)) {
                const lk = k.toLowerCase();
                if (lk !== 'set-cookie' && lk !== 'content-length' && lk !== 'content-encoding' && lk !== 'transfer-encoding' && lk !== 'x-frame-options' && lk !== 'content-security-policy' && lk !== 'x-content-type-options') {
                    res.setHeader(k, v);
                }
            }

            const contentType = String(headers['content-type'] || '').toLowerCase();
            const isJson = contentType.includes('application/json') || lowerPath.endsWith('.json') || bodyStrSample.startsWith('{');
            const isJs = contentType.includes('application/javascript') || lowerPath.endsWith('.js');
            const isTextOrHtml = !isJson && (contentType.includes('text/html') || contentType.includes('application/xhtml') || (bodyBuffer && bodyBuffer.slice(0, 50).toString().toLowerCase().includes('<html')));

            res.status(statusCode);

            if (isJson && bodyBuffer) {
                res.send(bodyBuffer);
            } else if (isJs && bodyBuffer) {
                let jsBody = bodyBuffer.toString('utf-8');
                const prefix = `/ont-proxy/${targetKey}`;
                jsBody = jsBody.replace(/["']\/?(html|asp|bbsp|cgi-bin|goform|boaform|JS|js|Cuscss|Cusjs|resource|custom|frameaspdes|images)\/([^"']+)["']/gi, `"${prefix}/$1/$2"`);
                res.send(Buffer.from(jsBody, 'utf-8'));
            } else if (isTextOrHtml && bodyBuffer) {
                let body = bodyBuffer.toString('utf-8');

                // Jika halaman root hanya berisi script redirect bawaan ONT, langsung kirim HTTP 302 redirect
                const matchRedirect = body.match(/(?:location\.replace|location\.href\s*=)\s*["'](\/cgi-bin\/[^"']+)["']/i);
                if ((cleanPath === '/' || cleanPath === '') && matchRedirect) {
                    return res.redirect(302, `/ont-proxy/${targetKey}${matchRedirect[1]}`);
                }

                const prefix = `/ont-proxy/${targetKey}`;
                body = body.replace(/action=["']\/?(login\.cgi|login\.asp|index\.asp|check_auth\.json|[^"']+)["']/gi, (m, p) => {
                    if (p.startsWith('http') || p.startsWith('/ont-proxy/')) return m;
                    const cleanP = p.startsWith('/') ? p : `/${p}`;
                    return `action="${prefix}${cleanP}"`;
                });
                body = body.replace(/\.action\s*=\s*(["'])\/?(login\.cgi|login\.asp|index\.asp|check_auth\.json|[^"'\s;]+)\1/gi, (m, q, p) => {
                    if (p.startsWith('http') || p.startsWith('/ont-proxy/')) return m;
                    const cleanP = p.startsWith('/') ? p : `/${p}`;
                    return `.action = ${q}${prefix}${cleanP}${q}`;
                });
                body = body.replace(/target=["']_top["']/gi, `target="_self"`);
                body = body.replace(/target=["']_parent["']/gi, `target="_self"`);
                body = body.replace(/(src|href)=(["'])(?!https?:\/\/|\/\/|#|data:|javascript:|mailto:|tel:|\/ont-proxy\/)\/?([^"'\s>]+)\2/gi, `$1=$2${prefix}/$3$2`);
                body = body.replace(/url\(\s*(["']?)\/?(img|images|css|Cuscss|resource|custom)\/([^"')\s]+)\1\s*\)/gi, `url($1${prefix}/$2/$3$1)`);
                body = body.replace(/location\.replace\(\s*(["'])(?!\/ont-proxy\/|https?:\/\/)\/?([^"'\s\)]+)\1\s*\)/gi, `location.replace($1${prefix}/$2$1)`);
                body = body.replace(/location\.href\s*=\s*(["'])(?!\/ont-proxy\/|https?:\/\/)\/?([^"'\s;]+)\1/gi, `location.href = $1${prefix}/$2$1`);
                body = body.replace(/location\.assign\(\s*(["'])(?!\/ont-proxy\/|https?:\/\/)\/?([^"'\s\)]+)\1\s*\)/gi, `location.assign($1${prefix}/$2$1)`);
                body = body.replace(/window\.location\s*=\s*(["'])(?!\/ont-proxy\/|https?:\/\/)\/?([^"'\s;]+)\1/gi, `window.location = $1${prefix}/$2$1`);

                res.send(Buffer.from(body, 'utf-8'));
            } else {
                res.send(bodyBuffer || Buffer.alloc(0));
            }
        }

        socket.on('connect', () => {
            const headers = { ...req.headers };
            headers['host'] = targetKey;
            headers['connection'] = 'close';
            
            // Format Referer dan Origin yang bersih untuk ONT
            if (req.headers['referer']) {
                let ref = req.headers['referer'];
                ref = ref.replace(/https?:\/\/[^\/]+\/ont-proxy\/[^\/]+/i, `http://${targetKey}`);
                headers['referer'] = ref;
            } else {
                headers['referer'] = `http://${targetKey}/index.asp`;
            }
            headers['origin'] = `http://${targetKey}`;

            // Filter out NOCR cookies (seperti JWT token nocr_token 800+ bytes) agar tidak menyebabkan buffer overflow di web server ONT
            if (headers['cookie']) {
                const ontCookies = headers['cookie'].split(';')
                    .map(c => c.trim())
                    .filter(c => {
                        const name = c.split('=')[0]?.trim();
                        return name && name !== 'nocr_token' && name !== 'ont_proxy_ip' && !name.startsWith('next-auth');
                    });
                if (ontCookies.length > 0) {
                    headers['cookie'] = ontCookies.join('; ');
                } else {
                    delete headers['cookie'];
                }
            }

            delete headers['accept-encoding'];
            delete headers['if-none-match'];
            delete headers['if-modified-since'];

            let bodyBuf = null;
            if (req.body) {
                if (Buffer.isBuffer(req.body)) {
                    bodyBuf = req.body;
                } else if (typeof req.body === 'string') {
                    bodyBuf = Buffer.from(req.body);
                } else if (typeof req.body === 'object' && Object.keys(req.body).length > 0) {
                    const querystring = require('querystring');
                    if (req.headers['content-type']?.includes('application/json')) {
                        bodyBuf = Buffer.from(JSON.stringify(req.body));
                    } else {
                        bodyBuf = Buffer.from(querystring.stringify(req.body));
                    }
                }
            }

            if (bodyBuf) {
                headers['content-length'] = bodyBuf.length;
            }

            let rawReq = `${req.method} ${fullPath} HTTP/1.0\r\n`;
            for (const [k, v] of Object.entries(headers)) {
                if (k.toLowerCase() === 'set-cookie') continue;
                if (Array.isArray(v)) {
                    v.forEach((val) => { rawReq += `${k}: ${val}\r\n`; });
                } else if (v !== undefined) {
                    rawReq += `${k}: ${v}\r\n`;
                }
            }
            rawReq += '\r\n';
            socket.write(rawReq);

            if (bodyBuf) {
                socket.write(bodyBuf);
            } else if (req.method === 'POST' || req.method === 'PUT') {
                req.pipe(socket);
            }
        });

        let htmlFinishTimer = null;
        socket.on('data', (chunk) => {
            chunks.push(chunk);
            const full = Buffer.concat(chunks);
            const str = full.toString('latin1');

            // 1. Selesaikan instan jika Content-Length telah tercapai
            const headerEnd = full.indexOf('\r\n\r\n');
            if (headerEnd !== -1) {
                const headerText = full.slice(0, headerEnd).toString('latin1');
                const matchCl = headerText.match(/content-length:\s*(\d+)/i);
                if (matchCl) {
                    const cl = parseInt(matchCl[1], 10);
                    if (full.length - (headerEnd + 4) >= cl) {
                        if (htmlFinishTimer) clearTimeout(htmlFinishTimer);
                        finish();
                        return;
                    }
                }

                // 2. Selesaikan instan jika respon berbentuk JSON auth/status
                const bodyStr = full.slice(headerEnd + 4).toString('latin1').trim();
                if (bodyStr.startsWith('{') && bodyStr.endsWith('}')) {
                    if (htmlFinishTimer) clearTimeout(htmlFinishTimer);
                    finish();
                    return;
                }
            }

            // 3. Jika tag penutup HTML telah tiba, beri jeda pendek (35ms) untuk menampung script lanjutan lalu selesaikan
            if (str.includes('</html>') || str.includes('</HTML>')) {
                if (htmlFinishTimer) clearTimeout(htmlFinishTimer);
                htmlFinishTimer = setTimeout(finish, 35);
            } else {
                if (htmlFinishTimer) clearTimeout(htmlFinishTimer);
                htmlFinishTimer = setTimeout(finish, 45);
            }
        });

        function renderOntUnreachableHtml(ip, port, detail) {
            const isDesaPort = (port === 8080);
            return `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${isDesaPort ? 'Web ONT Desa Belum Dikonfigurasi (Port 8080)' : 'Akses Web ONT Tidak Tersedia'} - ${ip}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            background-color: #0b0f19;
            color: #f1f5f9;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
        }
        .card {
            background: linear-gradient(145deg, rgba(30, 41, 59, 0.75), rgba(15, 23, 42, 0.85));
            border: 1px solid rgba(148, 163, 184, 0.15);
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05);
            border-radius: 18px;
            max-width: 580px;
            width: 100%;
            padding: 36px 32px;
            text-align: center;
            backdrop-filter: blur(12px);
        }
        .icon-wrap {
            width: 68px;
            height: 68px;
            margin: 0 auto 20px;
            border-radius: 20px;
            background: ${isDesaPort ? 'rgba(234, 179, 8, 0.12)' : 'rgba(239, 68, 68, 0.12)'};
            border: 1px solid ${isDesaPort ? 'rgba(234, 179, 8, 0.25)' : 'rgba(239, 68, 68, 0.25)'};
            display: flex;
            align-items: center;
            justify-content: center;
            color: ${isDesaPort ? '#eab308' : '#f87171'};
        }
        .badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 12px;
            background: ${isDesaPort ? 'rgba(234, 179, 8, 0.1)' : 'rgba(239, 68, 68, 0.1)'};
            border: 1px solid ${isDesaPort ? 'rgba(234, 179, 8, 0.2)' : 'rgba(239, 68, 68, 0.2)'};
            border-radius: 9999px;
            font-size: 11px;
            font-weight: 600;
            color: ${isDesaPort ? '#fef08a' : '#fca5a5'};
            margin-bottom: 16px;
            letter-spacing: 0.02em;
        }
        h1 {
            font-size: 20px;
            font-weight: 700;
            color: #f8fafc;
            margin-bottom: 10px;
            line-height: 1.3;
        }
        .desc {
            font-size: 13px;
            color: #94a3b8;
            line-height: 1.6;
            margin-bottom: 24px;
        }
        .info-box {
            background: rgba(15, 23, 42, 0.6);
            border: 1px solid rgba(51, 65, 85, 0.6);
            border-radius: 12px;
            padding: 16px;
            text-align: left;
            margin-bottom: 24px;
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            padding: 6px 0;
            border-bottom: 1px solid rgba(51, 65, 85, 0.4);
        }
        .info-row:last-child { border-bottom: none; }
        .info-label { color: #64748b; font-weight: 500; }
        .info-val { color: #cbd5e1; font-weight: 600; font-family: monospace; }
        .actions {
            display: flex;
            gap: 12px;
            justify-content: center;
            flex-wrap: wrap;
        }
        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 10px 18px;
            font-size: 13px;
            font-weight: 600;
            border-radius: 10px;
            cursor: pointer;
            text-decoration: none;
            transition: all 0.2s;
        }
        .btn-primary {
            background: #2563eb;
            color: #ffffff;
            border: 1px solid rgba(59, 130, 246, 0.3);
        }
        .btn-primary:hover { background: #1d4ed8; }
        .btn-secondary {
            background: rgba(51, 65, 85, 0.6);
            color: #cbd5e1;
            border: 1px solid rgba(71, 85, 105, 0.6);
        }
        .btn-secondary:hover { background: rgba(71, 85, 105, 0.8); color: #ffffff; }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon-wrap">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
            </svg>
        </div>
        <div class="badge">${isDesaPort ? 'DESA ONT REMOTE NAT (PORT 8080) BELUM AKTIF / TIMEOUT' : 'REMOTE ACCESS BLOCKED / UNAVAILABLE'}</div>
        <h1>${isDesaPort ? 'Akses Web ONT Desa Belum Dikonfigurasi (Port 8080)' : 'Akses Web Management ONT Tidak Tersedia'}</h1>
        <p class="desc">
            ${isDesaPort 
                ? `Perangkat Mikrotik Desa pada IP <b>${ip}</b> belum memiliki konfigurasi <b>DST-NAT Port Forwarding (Port 8080 ➔ Port 80 ONT)</b>, atau ONT lokal di bawah Mikrotik sedang offline.`
                : `Perangkat ONT pada IP ini tidak merespons koneksi Web (Port 80 HTTP). Fitur <b>WAN / Remote Web Management</b> kemungkinan belum diaktifkan pada konfigurasi ONT, atau port akses ditutup oleh sistem firewall.`}
        </p>
        
        <div class="info-box">
            <div class="info-row">
                <span class="info-label">${isDesaPort ? 'IP Mikrotik Desa' : 'Target IP ONT'}</span>
                <span class="info-val">${ip}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Port Akses Remote</span>
                <span class="info-val" style="color:${isDesaPort ? '#fbbf24' : '#f87171'};">${port} (TCP)</span>
            </div>
            <div class="info-row">
                <span class="info-label">Diagnosa Sistem</span>
                <span class="info-val" style="color:${isDesaPort ? '#eab308' : '#fbbf24'};">${isDesaPort ? 'DST-NAT 8080 Belum Dikonfigurasi di Mikrotik Desa' : 'WAN Remote Management Nonaktif'}</span>
            </div>

            ${isDesaPort ? `
            <div style="margin-top:14px; text-align:left;">
                <div style="font-size:11px; font-weight:600; color:#94a3b8; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
                    <span>📜 Script Konfigurasi NAT Mikrotik Desa:</span>
                    <button onclick="navigator.clipboard.writeText('/ip firewall nat\\nadd chain=dstnat protocol=tcp dst-port=8080 action=dst-nat to-addresses=192.168.10.1 to-ports=80 comment=\x22REMOTE ON HTTP\x22\\nadd chain=dstnat protocol=tcp dst-port=8080 action=dst-nat to-addresses=192.168.100.1 to-ports=80 comment=\x22REMOTE ON HTTP\x22\\nadd chain=dstnat protocol=tcp dst-port=8080 action=dst-nat to-addresses=192.168.101.1 to-ports=80 comment=\x22REMOTE ON HTTP\x22'); this.innerText='Tersalin!';" style="background:rgba(59,130,246,0.2); border:1px solid rgba(59,130,246,0.4); color:#93c5fd; padding:3px 8px; border-radius:5px; font-size:10.5px; cursor:pointer;">Salin Script NAT</button>
                </div>
                <pre style="background:#090d16; border:1px solid #1e293b; border-radius:8px; padding:10px; font-size:11px; color:#38bdf8; overflow-x:auto; font-family:monospace; line-height:1.45;">/ip firewall nat
add chain=dstnat protocol=tcp dst-port=8080 \\
action=dst-nat to-addresses=192.168.xxx.xxx to-ports=80 \\
comment="REMOTE ON HTTP"
            </div>
            ` : `
            <div style="font-size:11.5px; color:#94a3b8; text-align:left; margin-top:12px; line-height:1.5; padding-top:10px; border-top:1px dashed rgba(51,65,85,0.6);">
                💡 <b>Petunjuk:</b> Untuk mengaktifkan remote management pada ONT tipe ini, hubungkan laptop langsung ke port LAN ONT di lokasi, buka IP gateway lokal (192.168.1.1), lalu aktifkan opsi <i>WAN Access / Remote HTTP Management</i> di menu <i>Security / ACL</i>.
            </div>
            `}
        </div>

        <div class="actions">
            <button onclick="window.location.reload()" class="btn btn-secondary">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                Coba Lagi
            </button>
            <a href="/monitoring/desa" class="btn btn-primary">
                Kembali ke Monitoring Desa
            </a>
        </div>
    </div>
</body>
</html>`;
        }

        socket.on('timeout', () => {
            socket.destroy();
            if (!res.headersSent) {
                res.status(200).send(renderOntUnreachableHtml(targetIp, targetPort, 'Timeout (Port tidak merespons)'));
            }
        });

        socket.on('error', (err) => {
            if (!res.headersSent) {
                res.status(200).send(renderOntUnreachableHtml(targetIp, targetPort, err.message));
            }
        });
    }

    server.all('/ont-proxy/:ip/ont-proxy/:ip2/*', (req, res) => {
        const targetIp = req.params.ip2 || req.params.ip;
        const targetPath = req.params[0] || '';
        return res.redirect(302, `/ont-proxy/${targetIp}/${targetPath}`);
    });

    server.all('/ont-proxy/:target/*', (req, res) => {
        const user = authenticateExpressRequest(req, res);
        if (!user) return;
        const target = req.params.target;
        const targetPath = req.params[0] || '';
        handleOntProxy(req, res, target, targetPath);
    });

    server.all('/ont-proxy/:target', (req, res) => {
        const user = authenticateExpressRequest(req, res);
        if (!user) return;
        const target = req.params.target;
        handleOntProxy(req, res, target, '');
    });

    // Fallback handler untuk asset & form post ONT yang lepas dari prefix (Huawei, ZTE, Realtek, Boa)
    server.all([
        '/login.cgi', '/login.asp', '/index.asp', '/check_auth.json', '/frame.asp', '/*.cgi', '/*.asp', '/*.gch',
        '/frameaspdes/*', '/Cuscss/*', '/Cusjs/*', '/resource/*', '/custom/*', '/html/*', '/asp/*',
        '/ont-proxy/img/*', '/ont-proxy/images/*', '/ont-proxy/css/*', '/ont-proxy/js/*', '/ont-proxy/JS/*',
        '/ont-proxy/Cuscss/*', '/ont-proxy/Cusjs/*', '/ont-proxy/resource/*', '/ont-proxy/custom/*', '/ont-proxy/html/*',
        '/ont-proxy/frameaspdes/*',
        '/cgi-bin/*', '/JS/*', '/js/*', '/img/*', '/images/*', '/css/*',
        '/goform/*', '/boaform/*'
    ], (req, res, next) => {
        const cookieHeader = req.headers.cookie || '';
        const match = cookieHeader.match(/(?:^|;\s*)ont_proxy_ip=([^;]+)/);
        if (match) {
            const targetHost = decodeURIComponent(match[1]);
            const pathClean = req.path.replace(/^\/ont-proxy/, '');
            // Jika request adalah navigasi halaman utama GET (seperti /index.asp atau /frame.asp), lakukan redirect 302 ke path ber-prefix agar URL address bar browser tetap sinkron
            if (req.method === 'GET' && (pathClean.endsWith('.asp') || pathClean.endsWith('.html') || pathClean.endsWith('.htm') || pathClean.endsWith('.gch'))) {
                return res.redirect(302, `/ont-proxy/${targetHost}${req.url}`);
            }
            return handleOntProxy(req, res, targetHost, pathClean);
        }
        next();
    });

    // Global Express Error Handler (prevents PostgreSQL error message leakage)
    server.use((err, req, res, next) => {
        console.error('Express Internal Error:', err);
        const errMsg = String(err?.message || '');
        if (err.code === '22P02' || errMsg.toLowerCase().includes('invalid input syntax')) {
            return res.status(400).json({ error: 'Format data tidak valid' });
        }
        const status = err.status || 500;
        res.status(status).json({
            error: status < 500 ? (err.message || 'Format data tidak valid') : 'Terjadi kesalahan pada server. Silakan coba lagi.'
        });
    });

    // Default Next.js Handler
    server.all('*', (req, res) => {
        return handle(req, res);
    });

    httpServer.listen(port, (err) => {
        if (err) throw err;
        console.info(`> Ready on http://${hostname}:${port}`);
    });

    const handleShutdown = async (signal) => {
        console.info(`Received ${signal}. Cleaning up...`);
        try {
            await whatsapp.stop();
            console.info('WhatsApp client stopped successfully.');
        } catch (e) {
            console.error('Error stopping WhatsApp client during shutdown:', e);
        }
        process.exit(0);
    };

    process.on('SIGINT', () => handleShutdown('SIGINT'));
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
});