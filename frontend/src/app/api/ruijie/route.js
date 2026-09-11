import { NextResponse } from 'next/server';
import db from '@/lib/dbClient';
import { verifyAuth } from '@/lib/auth';

const sendError = (err, defaultStatus = 500) => {
    return NextResponse.json(
        { error: err.message || 'Kesalahan Server Internal', detail: err.detail },
        { status: err.status || defaultStatus }
    );
};

export async function GET(req) {
    try {
        verifyAuth(req);

        const { data: devices, error } = await db
            .from('ruijie_devices')
            .select('*')
            .order('alias', { ascending: true });

        if (error) throw error;

        return NextResponse.json(devices || []);
    } catch (err) {
        return sendError(err);
    }
}
