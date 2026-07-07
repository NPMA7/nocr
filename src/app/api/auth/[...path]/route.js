import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '@/lib/dbClient';
import { JWT_SECRET, verifyAuth, resolveAuth, enforceAdmin, normalizeRole, hasAccess } from '@/lib/auth';

// Helper untuk respon error
const sendError = (err, defaultStatus = 500) => {
    return NextResponse.json(
        { error: err.message || 'Kesalahan Server Internal' },
        { status: err.status || defaultStatus }
    );
};

export async function GET(req, { params }) {
    const { path } = await params;
    
    try {
        if (path[0] === 'status') {
            const { count, error } = await db
                .from('users')
                .select('*', { count: 'exact', head: true });

            if (error) {
                if (error.code === '42P01') {
                    return NextResponse.json({ initialized: false, error: 'TABEL_TIDAK_DITEMUKAN' });
                }
                throw error;
            }
            return NextResponse.json({ initialized: count > 0 });
        }

        if (path[0] === 'me') {
            const user = await resolveAuth(req);
            return NextResponse.json({ user });
        }

        if (path[0] === 'users') {
            const user = await resolveAuth(req);
            enforceAdmin(user, 'settings-users');
            
            const { data, error } = await db.from('users').select('id, username, role, created_at');
            if (error) throw error;
            return NextResponse.json(
                (data || []).map((u) => ({
                    ...u,
                    role: normalizeRole(u.role) || 'visitor'
                }))
            );
        }

        return NextResponse.json({ error: 'Route not found' }, { status: 404 });
    } catch (err) {
        return sendError(err);
    }
}

export async function POST(req, { params }) {
    const { path } = await params;
    
    try {
        if (path[0] === 'setup') {
            const body = await req.json();
            const { username, password } = body;

            if (!username || !password) {
                return NextResponse.json({ error: 'Username dan password wajib diisi' }, { status: 400 });
            }

            const { count } = await db.from('users').select('*', { count: 'exact', head: true });
            if (count > 0) {
                return NextResponse.json({ error: 'Sistem sudah dikonfigurasi. Silakan login.' }, { status: 403 });
            }

            const salt = await bcrypt.genSalt(10);
            const password_hash = await bcrypt.hash(password, salt);

            const { data, error } = await db
                .from('users')
                .insert([{ username, password_hash, role: 'admin' }])
                .select();

            if (error) throw error;

            const token = jwt.sign(
                { id: data[0].id, username: data[0].username, role: data[0].role },
                JWT_SECRET,
                { expiresIn: '7d' }
            );

            return NextResponse.json({
                message: 'Setup berhasil!',
                token,
                user: { id: data[0].id, username: data[0].username, role: normalizeRole(data[0].role) || 'admin' }
            });
        }

        if (path[0] === 'login') {
            const body = await req.json();
            const { username, password } = body;

            if (!username || !password) {
                return NextResponse.json({ error: 'Username dan password wajib diisi' }, { status: 400 });
            }

            const { data, error } = await db
                .from('users')
                .select('*')
                .eq('username', username)
                .single();

            if (error || !data) {
                return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 });
            }

            const isValid = await bcrypt.compare(password, data.password_hash);
            if (!isValid) {
                return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 });
            }

            const userRole = data.role || 'visitor';

            const roleData = await db.from('access_roles').select('permissions').eq('name', userRole).single();
            let permissions = [];
            if (roleData.data && roleData.data.permissions) {
                try {
                    permissions = typeof roleData.data.permissions === 'string' 
                        ? JSON.parse(roleData.data.permissions) 
                        : roleData.data.permissions;
                } catch(e) {}
            }

            const token = jwt.sign(
                { id: data.id, username: data.username, role: userRole },
                JWT_SECRET,
                { expiresIn: '7d' }
            );

            return NextResponse.json({
                message: 'Login berhasil',
                token,
                user: { id: data.id, username: data.username, role: userRole, permissions }
            });
        }

        if (path[0] === 'users') {
            const user = await resolveAuth(req);
            enforceAdmin(user, 'settings-users');
            
            const body = await req.json();
            const { username, password, role } = body;

            if (!username || !password) {
                return NextResponse.json({ error: 'Username dan password wajib diisi' }, { status: 400 });
            }

            const normalizedRole = normalizeRole(role);
            if (!normalizedRole) {
                return NextResponse.json(
                    { error: 'Role tidak valid. Gunakan admin, editor, atau visitor.' },
                    { status: 400 }
                );
            }

            const salt = await bcrypt.genSalt(10);
            const password_hash = await bcrypt.hash(password, salt);

            const { data, error } = await db
                .from('users')
                .insert([{ username: username.trim(), password_hash, role: normalizedRole }])
                .select('id, username, role, created_at');
                
            if (error) {
                if (error.code === '23505') return NextResponse.json({ error: 'Username sudah digunakan' }, { status: 400 });
                throw error;
            }
            return NextResponse.json(data[0]);
        }

        return NextResponse.json({ error: 'Route not found' }, { status: 404 });
    } catch (err) {
        return sendError(err);
    }
}

export async function PATCH(req, { params }) {
    const { path } = await params;

    try {
        if (path[0] === 'users' && path[1]) {
            const user = await resolveAuth(req);
            const id = path[1];
            const body = await req.json();

            const isSelf = user.id === id;
            const canManageUsers = hasAccess(user, 'settings-users', 'update');

            // Cek otorisasi: harus bisa mengelola pengguna atau memodifikasi profil sendiri
            if (!canManageUsers && !isSelf) {
                return NextResponse.json(
                    { error: 'Akses ditolak: Anda tidak memiliki izin untuk mengubah data ini.' },
                    { status: 403 }
                );
            }

            const updateData = {};

            // 1. Role Update (Admin only)
            if (body.role !== undefined) {
                if (!canManageUsers) {
                    return NextResponse.json(
                        { error: 'Akses ditolak: Hanya peran dengan izin yang dapat mengubah role.' },
                        { status: 403 }
                    );
                }

                const normalizedRole = normalizeRole(body.role);
                if (!normalizedRole) {
                    return NextResponse.json(
                        { error: 'Role tidak valid. Gunakan admin, editor, atau visitor.' },
                        { status: 400 }
                    );
                }
                updateData.role = normalizedRole;
            }

            // 2. Password Update (Admin or self with permission)
            if (body.password !== undefined) {
                if (isSelf && !hasAccess(user, 'settings-password', 'update')) {
                    return NextResponse.json(
                        { error: 'Akses ditolak: Anda tidak memiliki izin untuk mengubah password.' },
                        { status: 403 }
                    );
                }
                const password = body.password;
                if (typeof password !== 'string' || password.length < 4) {
                    return NextResponse.json(
                        { error: 'Password minimal harus 4 karakter.' },
                        { status: 400 }
                    );
                }
                const salt = await bcrypt.genSalt(10);
                const password_hash = await bcrypt.hash(password, salt);
                updateData.password_hash = password_hash;
            }

            if (Object.keys(updateData).length === 0) {
                return NextResponse.json(
                    { error: 'Tidak ada field data yang diubah.' },
                    { status: 400 }
                );
            }

            // Ambil detail pengguna saat ini dari DB
            const targetUser = await db.from('users').select('username, role').eq('id', id).single();
            if (targetUser.error || !targetUser.data) {
                return NextResponse.json(
                    { error: 'Pengguna tidak ditemukan.' },
                    { status: 404 }
                );
            }
            const previousRole = normalizeRole(targetUser.data.role);

            // Cek keamanan: Tidak bisa menurunkan jabatan admin terakhir yang tersisa
            if (updateData.role && updateData.role !== 'admin' && previousRole === 'admin') {
                const { data: allUsers } = await db.from('users').select('id, role');
                const adminCount = (allUsers || []).filter(
                    (u) => normalizeRole(u.role) === 'admin'
                ).length;
                if (adminCount <= 1) {
                    return NextResponse.json(
                        { error: 'Tidak dapat mengubah role: minimal harus ada satu Administrator.' },
                        { status: 400 }
                    );
                }
            }

            const { data, error } = await db
                .from('users')
                .update(updateData)
                .eq('id', id)
                .select('id, username, role, created_at')
                .single();

            if (error) throw error;

            const updated = {
                ...data,
                role: normalizeRole(data.role) || 'visitor'
            };

            // Emit socket updates if role changed
            if (updateData.role && global.io) {
                global.io.emit('user_role_updated', {
                    userId: updated.id,
                    username: updated.username,
                    role: updated.role
                });
            }

            // Write to Activity Logs
            if (global.addActivityLog) {
                if (updateData.role && previousRole !== updateData.role) {
                    global.addActivityLog(`Hak akses (Role) pengguna ${updated.username} diubah menjadi ${updateData.role.toUpperCase()}`);
                }
                if (updateData.password_hash) {
                    const actorLabel = isSelf ? 'Pengguna' : 'Administrator';
                    global.addActivityLog(`${actorLabel} memperbarui password untuk pengguna ${updated.username}`);
                }
            }

            return NextResponse.json(updated);
        }

        return NextResponse.json({ error: 'Route not found' }, { status: 404 });
    } catch (err) {
        return sendError(err);
    }
}

export async function DELETE(req, { params }) {
    const { path } = await params;
    
    try {
        if (path[0] === 'users' && path[1]) {
            const user = await resolveAuth(req);
            enforceAdmin(user, 'settings-users');
            
            const id = path[1];
            if (user.id === id) {
                return NextResponse.json({ error: 'Tidak dapat menghapus akun Anda sendiri' }, { status: 400 });
            }
            
            const { error } = await db.from('users').delete().eq('id', id);
            if (error) throw error;
            
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Route not found' }, { status: 404 });
    } catch (err) {
        return sendError(err);
    }
}
