import { NextResponse } from 'next/server';
import db from '@/lib/dbClient';
import { verifyAuth, resolveAuth, enforceRoleForMutation, hasAccess, sendApiError } from '@/lib/auth';

export async function GET(req) {
    try {
        const user = await resolveAuth(req);
        const canReadDevices = hasAccess(user, 'devices-mikrotik', 'read');
        const canReadTopology = hasAccess(user, 'topology', 'read');
        const canReadMaps = hasAccess(user, 'maps', 'read');

        if (!canReadDevices && !canReadTopology && !canReadMaps) {
            throw Object.assign(new Error('Akses Ditolak: Anda tidak memiliki izin untuk melihat data perangkat'), { status: 403 });
        }
        
        const { data: devicesData, error: devicesError } = await db
            .from('devices')
            .select('id, name, ip_address, port, type, status, last_seen')
            .order('created_at', { ascending: false });
            
        if (devicesError) throw devicesError;

        const { data: nodesData, error: nodesError } = await db
            .from('topology_nodes')
            .select('*')
            .is('device_id', null);

        if (nodesError) throw nodesError;

        const mappedNodes = (nodesData || []).map(node => ({
            id: node.id,
            name: node.label,
            ip_address: '-',
            port: null,
            type: node.type,
            status: 'unknown',
            last_seen: null
        }));

        // If user does not have devices-mikrotik permission, redact internal IP addresses and ports
        const sanitizedDevices = (devicesData || []).map(d => ({
            ...d,
            ip_address: canReadDevices ? d.ip_address : '-',
            port: canReadDevices ? d.port : null
        }));

        return NextResponse.json([...sanitizedDevices, ...mappedNodes]);
    } catch (err) {
        return sendApiError(err);
    }
}

export async function POST(req) {
    try {
        const user = await resolveAuth(req);
        if (!hasAccess(user, 'devices-mikrotik', 'create')) {
            throw Object.assign(new Error('Akses Ditolak: Anda tidak memiliki izin untuk menambah perangkat'), { status: 403 });
        }

        const body = await req.json();
        const { name, ip_address, username, password, port, type } = body;
        
        const { data, error } = await db
            .from('devices')
            .insert([{
                name, 
                ip_address, 
                username, 
                password, 
                port: port || 8728, 
                type: type || 'mikrotik',
                status: 'unknown'
            }])
            .select();
            
        if (error) throw error;

        if (global.addActivityLog) {
            global.addActivityLog(`Perangkat baru ditambahkan: ${name} (${ip_address})`);
        }

        return NextResponse.json({ id: data[0].id, message: 'Device added successfully' });
    } catch (err) {
        return sendApiError(err);
    }
}
