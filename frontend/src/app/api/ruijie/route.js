import { NextResponse } from 'next/server';
import db from '@/lib/dbClient';
import { resolveAuth, hasAccess } from '@/lib/auth';

const sendError = (err, defaultStatus = 500) => {
    return NextResponse.json(
        { error: err.message || 'Kesalahan Server Internal', detail: err.detail },
        { status: err.status || defaultStatus }
    );
};

export async function GET(req) {
    try {
        const user = await resolveAuth(req);
        const canReadDevices = hasAccess(user, 'devices-ruijie', 'read');
        const canReadDashboard = hasAccess(user, 'dashboard', 'read');

        if (!canReadDevices && !canReadDashboard) {
            return NextResponse.json({ error: 'Akses Ditolak: Anda tidak memiliki izin untuk melihat perangkat Ruijie' }, { status: 403 });
        }

        const { data: devices, error } = await db
            .from('ruijie_devices')
            .select('*')
            .order('alias', { ascending: true });

        if (error) throw error;

        // If user only has dashboard access, redact sensitive serial numbers
        const sanitized = (devices || []).map(d => canReadDevices ? d : {
            ...d,
            sn: undefined,
            serial_num: undefined
        });

        return NextResponse.json(sanitized);
    } catch (err) {
        return sendError(err);
    }
}
