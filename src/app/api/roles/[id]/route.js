import { NextResponse } from 'next/server';
import db from '@/lib/dbClient';
import { resolveAuth, enforceAdmin } from '@/lib/auth';

const sendError = (err, defaultStatus = 500) => {
    return NextResponse.json(
        { error: err.message || 'Kesalahan Server Internal' },
        { status: err.status || defaultStatus }
    );
};

export async function PATCH(req, { params }) {
    try {
        const user = await resolveAuth(req);
        enforceAdmin(user, 'settings-roles');

        const id = (await params).id;
        const body = await req.json();
        const { name, description, permissions } = body;

        const updateData = {};
        if (name !== undefined) updateData.name = name.trim().toLowerCase();
        if (description !== undefined) updateData.description = description;
        if (permissions !== undefined) updateData.permissions = JSON.stringify((typeof permissions === 'object' && permissions !== null) ? permissions : {});

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: 'Tidak ada data yang diubah' }, { status: 400 });
        }

        // Prevent modifying admin role permissions to lock it out
        const roleQuery = await db.from('access_roles').select('*').eq('id', id).single();
        if (roleQuery.error || !roleQuery.data) {
            return NextResponse.json({ error: 'Role tidak ditemukan' }, { status: 404 });
        }

        if (roleQuery.data.name === 'admin' && updateData.name && updateData.name !== 'admin') {
            return NextResponse.json({ error: 'Tidak bisa mengubah nama role admin bawaan' }, { status: 403 });
        }

        const { data, error } = await db.from('access_roles')
            .update(updateData)
            .eq('id', id)
            .select();

        if (error) {
            if (error.code === '23505') return NextResponse.json({ error: 'Role dengan nama ini sudah ada' }, { status: 400 });
            throw error;
        }

        if (global.addActivityLog) {
            global.addActivityLog(`Role "${data[0].name}" diperbarui oleh Administrator`);
        }

        return NextResponse.json(data[0]);
    } catch (err) {
        return sendError(err);
    }
}

export async function DELETE(req, { params }) {
    try {
        const user = await resolveAuth(req);
        enforceAdmin(user, 'settings-roles');

        const id = (await params).id;

        const roleQuery = await db.from('access_roles').select('*').eq('id', id).single();
        if (roleQuery.error || !roleQuery.data) {
            return NextResponse.json({ error: 'Role tidak ditemukan' }, { status: 404 });
        }

        if (['admin', 'editor', 'visitor'].includes(roleQuery.data.name)) {
            return NextResponse.json({ error: `Tidak bisa menghapus role bawaan sistem (${roleQuery.data.name})` }, { status: 403 });
        }

        // Check if any users are using this role
        const usersQuery = await db.from('admin_users').select('*').eq('role', roleQuery.data.name);
        if (usersQuery.data && usersQuery.data.length > 0) {
            return NextResponse.json({ error: `Tidak bisa menghapus role. Ada ${usersQuery.data.length} pengguna yang masih menggunakan role ini.` }, { status: 400 });
        }

        const { error } = await db.from('access_roles').delete().eq('id', id);
        if (error) throw error;

        if (global.addActivityLog) {
            global.addActivityLog(`Role "${roleQuery.data.name}" dihapus oleh Administrator`);
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        return sendError(err);
    }
}
