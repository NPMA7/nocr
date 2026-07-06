import { NextResponse } from 'next/server';
import db from '@/lib/dbClient';
import { resolveAuth, enforceAdmin } from '@/lib/auth';

const sendError = (err, defaultStatus = 500) => {
    return NextResponse.json(
        { error: err.message || 'Kesalahan Server Internal' },
        { status: err.status || defaultStatus }
    );
};

export async function GET(req) {
    try {
        const user = await resolveAuth(req);
        // Only admins can manage roles, but we might want users to see roles, so maybe we just allow logged in users to read
        // For now let's enforce admin for viewing roles list
        enforceAdmin(user, 'settings-roles');

        const { data, error } = await db.from('access_roles').select('*').order('created_at', { ascending: true });
        if (error) throw error;
        
        return NextResponse.json(data || []);
    } catch (err) {
        return sendError(err);
    }
}

export async function POST(req) {
    try {
        const user = await resolveAuth(req);
        enforceAdmin(user, 'settings-roles');

        const body = await req.json();
        const { name, description, permissions } = body;

        if (!name || name.trim().length === 0) {
            return NextResponse.json({ error: 'Nama role wajib diisi' }, { status: 400 });
        }

        const normalizedName = name.trim().toLowerCase();
        const permsData = (typeof permissions === 'object' && permissions !== null) ? permissions : {};

        const { data, error } = await db.from('access_roles')
            .insert({
                name: normalizedName,
                description: description || '',
                permissions: JSON.stringify(permsData)
            })
            .select();

        if (error) {
            if (error.code === '23505') return NextResponse.json({ error: 'Role dengan nama ini sudah ada' }, { status: 400 });
            throw error;
        }
        
        if (global.addActivityLog) {
            global.addActivityLog(`Role baru "${normalizedName}" dibuat oleh Administrator`);
        }

        return NextResponse.json(data[0]);
    } catch (err) {
        return sendError(err);
    }
}
