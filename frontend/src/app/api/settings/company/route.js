import { NextResponse } from 'next/server';
import db from '@/lib/dbClient';
import { resolveAuth, sendApiError } from '@/lib/auth';
import { hasAccess } from '@/lib/roles';

export async function GET(req) {
    try {
        const user = await resolveAuth(req);
        if (!hasAccess(user, 'settings-company', 'read')) {
            return NextResponse.json({ error: 'Akses Ditolak: Anda tidak memiliki izin untuk melihat Profil Perusahaan' }, { status: 403 });
        }

        const { data, error } = await db
            .from('company_profile')
            .select('*')
            .eq('id', 1)
            .maybeSingle();

        if (error) throw error;

        const defaultProfile = {
            name: 'PT Milenial Inti Telekomunikasi',
            code: 'MIT',
            region: 'Kabupaten Bandung',
            region_code: 'KAB-BDG',
            coverage_area: '31 Kecamatan, Wilayah Desa & Instansi OPD Kabupaten Bandung',
            address: 'Jalan Biak No. 19 C RT 002 RW 005 Kel. Cideng Kec. Gambir Jakarta Pusat 10150',
            phone: '+62 881 0827 99999 / (021) 21693078',
            email: 'support@milenetwork.co.id',
            website: 'https://nocrnetwork.com',
            description: 'Penyelenggara Jasa Internet, Monitoring Jaringan Terpadu, dan Pengelolaan Jaringan Telekomunikasi Wilayah Kabupaten Bandung.'
        };

        return NextResponse.json(data || defaultProfile);
    } catch (err) {
        return sendApiError(err);
    }
}

export async function POST(req) {
    try {
        const user = await resolveAuth(req);
        if (!hasAccess(user, 'settings-company', 'update') && !hasAccess(user, 'settings-system', 'update')) {
            return NextResponse.json({ error: 'Akses Ditolak: Anda tidak memiliki izin untuk mengubah Profil Perusahaan' }, { status: 403 });
        }

        const body = await req.json();
        const payload = {
            id: 1,
            name: body.name || 'PT Milenial Inti Telekomunikasi',
            code: body.code || 'MIT',
            region: body.region || 'Kabupaten Bandung',
            region_code: body.region_code || 'KAB-BDG',
            coverage_area: body.coverage_area || '',
            address: body.address || '',
            phone: body.phone || '',
            email: body.email || '',
            website: body.website || '',
            description: body.description || '',
            updated_at: new Date().toISOString()
        };

        const { data, error } = await db
            .from('company_profile')
            .upsert(payload, { onConflict: 'id' })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, message: 'Profil perusahaan berhasil disimpan!', data });
    } catch (err) {
        return sendApiError(err);
    }
}
