import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
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

        const { data: devices, error } = await supabase
            .from('ruijie_devices')
            .select('*')
            .eq('connection_type', 'L2TP')
            .order('alias', { ascending: true });

        if (error) throw error;

        return NextResponse.json(devices || []);
    } catch (err) {
        return sendError(err);
    }
}
