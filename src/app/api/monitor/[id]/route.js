import { NextResponse } from 'next/server';
import db from '@/lib/dbClient';
import { verifyAuth } from '@/lib/auth';

const sendError = (err, defaultStatus = 500) => {
    return NextResponse.json(
        { error: err.message || 'Kesalahan Server Internal' },
        { status: err.status || defaultStatus }
    );
};

export async function GET(req, { params }) {
    const { id } = await params;
    
    try {
        verifyAuth(req);

        let targetIp = null;
        let deviceName = null;
        let originalType = null;
        let isPppoe = false;

        // Cek Devices
        const { data: dev } = await db.from('devices').select('ip_address, name').eq('id', id).single();
        if (dev) {
            targetIp = dev.ip_address;
            deviceName = dev.name;
        } else {
            // Cek Nodes (Mungkin PPPoE client / AP / Switch)
            const { data: node } = await db.from('topology_nodes').select('label, type').eq('id', id).single();
            if (node) {
                deviceName = node.label;
                originalType = node.type;
                if (node.type === 'pppoe-client' || node.type === 'client') {
                    // Cari IP dari session active
                    const { data: pppoe } = await db.from('pppoe_active').select('address').eq('name', node.label).single();
                    if (pppoe && pppoe.address) {
                        targetIp = pppoe.address;
                        isPppoe = true;
                    }
                }
            }
        }

        if (!targetIp) {
            if (isPppoe || originalType === 'pppoe-client' || originalType === 'client') {
                return NextResponse.json({
                    status: 'offline',
                    latency: 0,
                    last_check: new Date(),
                    ip: 'Not Connected',
                    name: deviceName || id
                });
            }
            return NextResponse.json({ error: 'IP Address tidak ditemukan untuk perangkat ini' }, { status: 404 });
        }

        // Ambil data dari tabel device_status yang diupdate oleh worker di server.js
        const { data: statusData } = await db
            .from('device_status')
            .select('*')
            .eq('device_id', id)
            .single();

        if (statusData) {
            return NextResponse.json({
                status: statusData.status,
                latency: statusData.latency,
                last_check: statusData.last_check,
                ip: targetIp,
                name: deviceName || id
            });
        } else {
            // Belum ada data di-ping oleh worker
            return NextResponse.json({
                status: 'unknown',
                latency: 0,
                last_check: new Date(),
                ip: targetIp,
                name: deviceName || id
            });
        }
    } catch (err) {
        return sendError(err);
    }
}
