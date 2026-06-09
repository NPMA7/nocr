import { NextResponse } from 'next/server';
import db from '@/lib/dbClient';
import mikrotik from '@/lib/mikrotik';
import { verifyAuth, resolveAuth, enforceRoleForMutation } from '@/lib/auth';

const sendError = (err, defaultStatus = 500) => {
    return NextResponse.json(
        { error: err.message || 'Kesalahan Server Internal', detail: err.detail },
        { status: err.status || defaultStatus }
    );
};

// Helper: find the core MikroTik device
async function getCoreDevice() {
    const { data } = await db
        .from('devices')
        .select('*')
        .eq('type', 'mikrotik-core')
        .limit(1);
    if (data && data.length > 0) return data[0];
    const { data: fallback } = await db
        .from('devices')
        .select('*')
        .eq('type', 'mikrotik')
        .limit(1);
    return fallback?.[0] || null;
}

let coreStatusCache = { data: null, last_sync: 0, device_id: null };

export async function GET(req, { params }) {
    const { path } = await params;
    const url = new URL(req.url);

    try {
        verifyAuth(req);

        if (path[0] === 'core') {
            const device = await getCoreDevice();
            if (!device) return NextResponse.json({ error: 'Core MikroTik belum dikonfigurasi.' }, { status: 404 });

            if (path[1] === 'status') {
                const maxAge = parseInt(url.searchParams.get('max_age')) || 0;
                if (maxAge > 0 && coreStatusCache.data && coreStatusCache.device_id === device.id) {
                    if (Date.now() - coreStatusCache.last_sync <= maxAge * 1000) {
                        return NextResponse.json(coreStatusCache.data);
                    }
                }

                const conn = await mikrotik.connect(device);
                if (!conn.connected) {
                    return NextResponse.json({ connected: false, error: conn.error, device_name: device.name, ip_address: device.ip_address });
                }

                const resource = await mikrotik.getSystemResource(device);
                const pppoeCount = await mikrotik.getActivePPPoE(device);
                const l2tpCount = await mikrotik.getActiveL2TP(device);
                
                const data = {
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
                    l2tp_active: l2tpCount
                };
                coreStatusCache = { data, last_sync: Date.now(), device_id: device.id };
                return NextResponse.json(data);
            }

            if (path[1] === 'interfaces') {
                const maxAge = parseInt(url.searchParams.get('max_age')) || 0;
                let useCacheFallback = false;
                let connError = null;

                const checkCache = async () => {
                    const { data: cached } = await db
                        .from('network_interfaces')
                        .select('*')
                        .eq('device_id', device.id)
                        .order('name');
                    if (cached && cached.length > 0) {
                        const lastSync = new Date(cached[0].synced_at).getTime();
                        if (useCacheFallback || (maxAge > 0 && (Date.now() - lastSync <= maxAge * 1000))) {
                            return cached.map(r => ({
                                '.id': r.ros_id,
                                name: r.name,
                                type: r.type,
                                'mac-address': r.mac_address,
                                mtu: r.mtu ? String(r.mtu) : '-',
                                running: r.running ? 'true' : 'false',
                                disabled: r.disabled ? 'true' : 'false',
                                comment: r.comment || '',
                                _fromCache: true
                            }));
                        }
                    }
                    return null;
                };

                if (maxAge > 0 && url.searchParams.get('force') !== 'true') {
                    const freshCache = await checkCache();
                    if (freshCache) return NextResponse.json(freshCache);
                }

                const conn = await mikrotik.connect(device);
                if (!conn.connected) {
                    useCacheFallback = true;
                    connError = conn.error;
                    const fallback = await checkCache();
                    if (fallback) return NextResponse.json(fallback);
                    return NextResponse.json({ error: 'Gagal koneksi ke MikroTik dan tidak ada cache', detail: connError }, { status: 500 });
                }

                const interfaces = await mikrotik.getInterfaces(device);

                if (interfaces && interfaces.length > 0) {
                    (async () => {
                        try {
                            await db.from('network_interfaces').delete().eq('device_id', device.id);
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
                                synced_at: new Date().toISOString()
                            }));
                            await db.from('network_interfaces').insert(rows);
                        } catch (dbErr) {
                            console.warn('⚠️ [Cache] Gagal menyimpan interfaces:', dbErr.message);
                        }
                    })();
                }

                return NextResponse.json(interfaces || []);
            }

            if (path[1] === 'pppoe') {
                const maxAge = parseInt(url.searchParams.get('max_age')) || 0;
                let useCacheFallback = false;
                
                const checkCache = async () => {
                    const { data: cached } = await db
                        .from('pppoe_active')
                        .select('*')
                        .eq('device_id', device.id);
                    if (cached && cached.length > 0) {
                        const lastSync = new Date(cached[0].synced_at).getTime();
                        if (useCacheFallback || (maxAge > 0 && (Date.now() - lastSync <= maxAge * 1000))) {
                            return cached.map(r => ({
                                '.id': r.ros_id,
                                name: r.name,
                                address: r.address,
                                'caller-id': r.caller_id,
                                service: r.service,
                                uptime: r.uptime,
                                _fromCache: true
                            }));
                        }
                    }
                    return null;
                };

                if (maxAge > 0 && url.searchParams.get('force') !== 'true') {
                    const freshCache = await checkCache();
                    if (freshCache) return NextResponse.json(freshCache);
                }

                const conn = await mikrotik.connect(device);
                if (!conn.connected) {
                    useCacheFallback = true;
                    const fallback = await checkCache();
                    if (fallback) return NextResponse.json(fallback);
                    return NextResponse.json({ error: 'Gagal koneksi ke MikroTik dan tidak ada cache' }, { status: 500 });
                }

                const pppoe = await mikrotik.getActivePPPoEDetails(device);

                (async () => {
                    try {
                        await db.from('pppoe_active').delete().eq('device_id', device.id);
                        if (pppoe && pppoe.length > 0) {
                            const rows = pppoe.map(p => ({
                                device_id: device.id,
                                ros_id: p['.id'] || null,
                                name: p.name || null,
                                address: p.address || null,
                                caller_id: p['caller-id'] || null,
                                service: p.service || null,
                                uptime: p.uptime || null,
                                synced_at: new Date().toISOString()
                            }));
                            await db.from('pppoe_active').insert(rows);
                        }
                    } catch (dbErr) {
                        console.warn('⚠️ [Cache] Gagal menyimpan sesi PPPoE aktif:', dbErr.message);
                    }
                })();

                return NextResponse.json(pppoe || []);
            }

            if (path[1] === 'pppoe-secrets') {
                const maxAge = parseInt(url.searchParams.get('max_age')) || 0;
                let useCacheFallback = false;

                const checkCache = async () => {
                    const { data: cached } = await db
                        .from('pppoe_secrets')
                        .select('*')
                        .eq('device_id', device.id)
                        .order('name');
                    if (cached && cached.length > 0) {
                        const lastSync = new Date(cached[0].synced_at).getTime();
                        if (useCacheFallback || (maxAge > 0 && (Date.now() - lastSync <= maxAge * 1000))) {
                            return cached.map(r => ({
                                '.id': r.ros_id,
                                name: r.name,
                                password: r.password,
                                profile: r.profile,
                                service: r.service,
                                disabled: r.disabled ? 'true' : 'false',
                                'last-logged-out': r.last_logged_out,
                                'local-address': r.local_address,
                                'remote-address': r.remote_address,
                                _fromCache: true
                            }));
                        }
                    }
                    return null;
                };

                if (maxAge > 0 && url.searchParams.get('force') !== 'true') {
                    const freshCache = await checkCache();
                    if (freshCache) return NextResponse.json(freshCache);
                }

                const conn = await mikrotik.connect(device);
                if (!conn.connected) {
                    useCacheFallback = true;
                    const fallback = await checkCache();
                    if (fallback) return NextResponse.json(fallback);
                    return NextResponse.json({ error: 'Gagal koneksi ke MikroTik dan tidak ada cache' }, { status: 500 });
                }

                const secrets = await mikrotik.getPPPoESecrets(device);

                if (secrets && secrets.length > 0) {
                    (async () => {
                        try {
                            const { error: delErr } = await db.from('pppoe_secrets').delete().eq('device_id', device.id);
                            if (delErr) {
                                console.error('⚠️ [Cache] Gagal menghapus cache PPPoE secrets lama:', delErr.message);
                                return;
                            }
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
                                synced_at: new Date().toISOString()
                            }));
                            const { error: insErr } = await db.from('pppoe_secrets').insert(rows);
                            if (insErr) {
                                console.error('⚠️ [Cache] Gagal menyisipkan PPPoE secrets baru ke Supabase:', insErr.message, insErr.details);
                            } else {
                                console.log(`✅ [Cache] Berhasil menyinkronkan ${rows.length} PPPoE secrets ke database.`);
                            }
                        } catch (dbErr) {
                            console.error('⚠️ [Cache] Exception terjadi saat sinkronisasi PPPoE secrets:', dbErr);
                        }
                    })();
                }

                return NextResponse.json(secrets || []);
            }
        } else if (path.length === 1) { // Single device GET /[id]
            const id = path[0];
            const { data, error } = await db
                .from('devices')
                .select('*')
                .eq('id', id)
                .single();
                
            if (error) throw error;
            return NextResponse.json(data);
        }

        return NextResponse.json({ error: 'Route not found' }, { status: 404 });
    } catch (err) {
        return sendError(err);
    }
}

export async function POST(req, { params }) {
    const { path } = await params;
    
    try {
        const user = await resolveAuth(req);
        enforceRoleForMutation(req, user);

        if (path[0] === 'core') {
            const device = await getCoreDevice();
            if (!device) return NextResponse.json({ error: 'Core MikroTik belum dikonfigurasi.' }, { status: 404 });

            const conn = await mikrotik.connect(device);
            if (!conn.connected) {
                return NextResponse.json({ error: 'Gagal koneksi ke MikroTik', detail: conn.error }, { status: 500 });
            }

            if (path[1] === 'interfaces') {
                const body = await req.json();
                const result = await mikrotik.addInterface(device, body);
                
                try {
                    const ros_id = result && result[0] ? result[0].ret : null;
                    await db.from('network_interfaces').insert([{
                        device_id: device.id,
                        ros_id: ros_id,
                        name: body.name,
                        type: body.type,
                        mtu: body.mtu ? parseInt(body.mtu) : null,
                        running: true,
                        disabled: false,
                        synced_at: new Date().toISOString()
                    }]);
                } catch (e) {}
                
                return NextResponse.json({ success: true, message: 'Interface berhasil ditambahkan ke MikroTik & Cache!' });
            }

            if (path[1] === 'pppoe-secrets') {
                const body = await req.json();
                await mikrotik.addPPPoESecret(device, body);

                try {
                    await db.from('pppoe_secrets').insert([{
                        device_id: device.id,
                        name: body.name,
                        password: body.password,
                        profile: body.profile || 'default',
                        service: body.service || 'pppoe'
                    }]);
                } catch (dbErr) {}

                if (global.addActivityLog) {
                    global.addActivityLog(`Pelanggan baru ditambahkan: ${body.name} (Profile: ${body.profile || 'default'})`);
                }

                return NextResponse.json({ success: true, message: 'Pelanggan berhasil ditambahkan ke MikroTik!' });
            }
        }

        return NextResponse.json({ error: 'Route not found' }, { status: 404 });
    } catch (err) {
        return sendError(err);
    }
}

export async function PUT(req, { params }) {
    const { path } = await params;
    
    try {
        const user = await resolveAuth(req);
        enforceRoleForMutation(req, user);

        if (path[0] === 'core') {
            const device = await getCoreDevice();
            if (!device) return NextResponse.json({ error: 'Core MikroTik belum dikonfigurasi.' }, { status: 404 });

            const conn = await mikrotik.connect(device);
            if (!conn.connected) {
                return NextResponse.json({ error: 'Gagal koneksi ke MikroTik', detail: conn.error }, { status: 500 });
            }

            if (path[1] === 'interfaces' && path[2]) {
                const id = path[2];
                const body = await req.json();
                const { name, mtu, disabled, type } = body;

                await mikrotik.editInterface(device, id, type, { name, mtu, disabled });
                return NextResponse.json({ success: true, message: 'Interface berhasil diubah!' });
            }

            if (path[1] === 'pppoe-secrets' && path[2]) {
                const id = path[2];
                const body = await req.json();
                const { name, password, profile, service, oldName } = body;

                await mikrotik.editPPPoESecret(device, id, { name, password, profile, service });

                try {
                    await db.from('pppoe_secrets')
                        .update({
                            name: name,
                            password: password,
                            profile: profile || 'default',
                            service: service || 'pppoe'
                        })
                        .eq('device_id', device.id)
                        .eq('name', oldName || name);
                } catch (dbErr) {}

                if (global.addActivityLog) {
                    global.addActivityLog(`Konfigurasi pelanggan ${name} diperbarui`);
                }

                return NextResponse.json({ success: true, message: 'Pelanggan berhasil diubah!' });
            }
        } else if (path.length === 1) { // PUT /[id]
            const id = path[0];
            const body = await req.json();
            const { name, ip_address, username, password, port, type } = body;
            const updateData = { name, ip_address, username, port, type };
            if (password) updateData.password = password;
            
            const { error } = await db
                .from('devices')
                .update(updateData)
                .eq('id', id);
                
            if (error) throw error;

            if (global.addActivityLog) {
                global.addActivityLog(`Konfigurasi perangkat ${name} diperbarui`);
            }

            return NextResponse.json({ message: 'Device updated successfully' });
        }

        return NextResponse.json({ error: 'Route not found' }, { status: 404 });
    } catch (err) {
        return sendError(err);
    }
}

export async function DELETE(req, { params }) {
    const { path } = await params;
    const url = new URL(req.url);

    try {
        const user = await resolveAuth(req);
        enforceRoleForMutation(req, user);

        if (path[0] === 'core') {
            const device = await getCoreDevice();
            if (!device) return NextResponse.json({ error: 'Core MikroTik belum dikonfigurasi.' }, { status: 404 });

            const conn = await mikrotik.connect(device);
            if (!conn.connected) {
                return NextResponse.json({ error: 'Gagal koneksi ke MikroTik', detail: conn.error }, { status: 500 });
            }

            if (path[1] === 'interfaces' && path[2]) {
                const id = path[2];
                const type = url.searchParams.get('type');

                await mikrotik.deleteInterface(device, id, type);
                
                try {
                    await db.from('network_interfaces').delete()
                        .eq('device_id', device.id)
                        .eq('ros_id', id);
                } catch (e) {}
                
                return NextResponse.json({ success: true, message: 'Interface berhasil dihapus' });
            }

            if (path[1] === 'pppoe' && path[2]) {
                const id = path[2];
                
                // Fetch active session name first for logging
                let sessionName = 'Tidak diketahui';
                try {
                    const { data: actSess } = await db.from('pppoe_active').select('name').eq('device_id', device.id).eq('ros_id', id).maybeSingle();
                    if (actSess?.name) sessionName = actSess.name;
                } catch (err) {}

                await mikrotik.disconnectPPPoESession(device, id);
                await db.from('pppoe_active').delete().eq('device_id', device.id).eq('ros_id', id);

                if (global.addActivityLog) {
                    global.addActivityLog(`Sesi PPPoE aktif ${sessionName} diputus secara paksa`);
                }

                return NextResponse.json({ success: true, message: 'Sesi berhasil diputus!' });
            }

            if (path[1] === 'pppoe-secrets' && path[2]) {
                const id = path[2];
                const name = url.searchParams.get('name');

                await mikrotik.deletePPPoESecret(device, id);

                if (name) {
                    try {
                        await db.from('pppoe_secrets')
                            .delete()
                            .eq('device_id', device.id)
                            .eq('name', name);
                    } catch (dbErr) {}
                }

                if (global.addActivityLog) {
                    global.addActivityLog(`Pelanggan ${name || 'Tidak diketahui'} dihapus`);
                }

                return NextResponse.json({ success: true, message: 'Pelanggan berhasil dihapus!' });
            }
        } else if (path.length === 1) { // DELETE /[id]
            const id = path[0];
            if (id.startsWith('node_')) {
                let nodeLabel = id;
                try {
                    const { data: nodeData } = await db.from('topology_nodes').select('label').eq('id', id).maybeSingle();
                    if (nodeData?.label) nodeLabel = nodeData.label;
                } catch (e) {}

                const { error } = await db.from('topology_nodes').delete().eq('id', id);
                if (error) throw error;

                if (global.addActivityLog) {
                    global.addActivityLog(`Node topologi dihapus: ${nodeLabel}`);
                }
            } else {
                let devName = id;
                try {
                    const { data: devData } = await db.from('devices').select('name').eq('id', id).maybeSingle();
                    if (devData?.name) devName = devData.name;
                } catch (e) {}

                const { error } = await db.from('devices').delete().eq('id', id);
                if (error) throw error;

                if (global.addActivityLog) {
                    global.addActivityLog(`Perangkat dihapus: ${devName}`);
                }
            }
            return NextResponse.json({ message: 'Device deleted successfully' });
        }

        return NextResponse.json({ error: 'Route not found' }, { status: 404 });
    } catch (err) {
        return sendError(err);
    }
}
