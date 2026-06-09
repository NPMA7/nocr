import { NextResponse } from 'next/server';
import db from '@/lib/dbClient';
import { verifyAuth, resolveAuth, enforceRoleForMutation } from '@/lib/auth';

const sendError = (err, defaultStatus = 500) => {
    return NextResponse.json(
        { error: err.message || 'Kesalahan Server Internal' },
        { status: err.status || defaultStatus }
    );
};

export async function GET(req) {
    try {
        verifyAuth(req);
        
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

        return NextResponse.json([...(devicesData || []), ...mappedNodes]);
    } catch (err) {
        return sendError(err);
    }
}

export async function POST(req) {
    try {
        const user = await resolveAuth(req);
        enforceRoleForMutation(req, user);

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
        return sendError(err);
    }
}
