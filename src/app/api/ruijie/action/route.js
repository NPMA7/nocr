import { NextResponse } from 'next/server';
import { verifyAuth, resolveAuth, hasAccess } from '@/lib/auth';
import axios from 'axios';

// Backend ruijie-scraper port is 5000
const SCRAPER_API_URL = 'http://localhost:5000/api';

const sendError = (err, defaultStatus = 500) => {
    return NextResponse.json(
        { error: err.response?.data?.error || err.message || 'Kesalahan Server Internal' },
        { status: err.response?.status || err.status || defaultStatus }
    );
};

export async function POST(req) {
    try {
        const user = await resolveAuth(req);
        
        // Periksa action tipe apa dari JSON body
        const body = await req.json();
        const { action, sn, type, alias, newAlias } = body;

        if (action === 'reboot') {
            if (!hasAccess(user, 'devices-ruijie', 'delete')) {
                return NextResponse.json({ error: 'Akses Ditolak: Anda tidak memiliki izin untuk me-reboot perangkat' }, { status: 403 });
            }
            const res = await axios.post(`${SCRAPER_API_URL}/reboot`, { sn, type });
            return NextResponse.json(res.data);
        }

        if (action === 'eweb') {
            if (!hasAccess(user, 'devices-ruijie', 'update')) {
                return NextResponse.json({ error: 'Akses Ditolak: Anda tidak memiliki izin untuk eWeb tunnel' }, { status: 403 });
            }
            const res = await axios.post(`${SCRAPER_API_URL}/eweb`, { sn, type });
            return NextResponse.json(res.data);
        }

        if (action === 'rename') {
            if (!hasAccess(user, 'devices-ruijie', 'update')) {
                return NextResponse.json({ error: 'Akses Ditolak: Anda tidak memiliki izin untuk mengubah alias' }, { status: 403 });
            }
            const targetAlias = (newAlias || alias || '').trim();
            const res = await axios.post(`${SCRAPER_API_URL}/rename`, { 
                sn, 
                type, 
                alias: targetAlias
            });

            // Hanya teruskan request rename ke backend ruijie-scraper, biarkan scraper memutakhirkan DB secara alami
            return NextResponse.json(res.data);
        }

        return NextResponse.json({ error: 'Aksi tidak valid atau tidak didukung' }, { status: 400 });

    } catch (err) {
        return sendError(err);
    }
}
