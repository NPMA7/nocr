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

// Rate limiter per IP for auth endpoints (5 attempts per minute)
const loginAttemptsByIp = new Map();
const IP_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_IP_ATTEMPTS = 5;

// Account Lockout per Username (5 failed attempts locks account for 5 minutes)
const failedAttemptsByUser = new Map();
const USER_LOCKOUT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_USER_FAILED_ATTEMPTS = 5;

function checkIpRateLimit(ip) {
    const now = Date.now();
    const attempts = (loginAttemptsByIp.get(ip) || []).filter(t => now - t < IP_RATE_LIMIT_WINDOW_MS);
    if (attempts.length >= MAX_IP_ATTEMPTS) {
        const retryAfter = Math.ceil((attempts[0] + IP_RATE_LIMIT_WINDOW_MS - now) / 1000);
        return { limited: true, retryAfter: Math.max(1, retryAfter) };
    }
    attempts.push(now);
    loginAttemptsByIp.set(ip, attempts);
    return { limited: false };
}

function checkUserLockout(username) {
    if (!username) return { locked: false };
    const key = String(username).trim().toLowerCase();
    const record = failedAttemptsByUser.get(key);
    if (!record) return { locked: false };

    const now = Date.now();
    const recentFailures = (record.attempts || []).filter(t => now - t < USER_LOCKOUT_WINDOW_MS);
    if (recentFailures.length >= MAX_USER_FAILED_ATTEMPTS) {
        const retryAfter = Math.ceil((recentFailures[0] + USER_LOCKOUT_WINDOW_MS - now) / 1000);
        return { locked: true, retryAfter: Math.max(1, retryAfter) };
    }
    return { locked: false };
}

function recordFailedLogin(username) {
    if (!username) return;
    const key = String(username).trim().toLowerCase();
    const now = Date.now();
    const record = failedAttemptsByUser.get(key) || { attempts: [] };
    const recent = record.attempts.filter(t => now - t < USER_LOCKOUT_WINDOW_MS);
    recent.push(now);
    failedAttemptsByUser.set(key, { attempts: recent });
}

function resetFailedLogin(username) {
    if (!username) return;
    const key = String(username).trim().toLowerCase();
    failedAttemptsByUser.delete(key);
}

function getClientIp(req) {
    const getHeader = (name) => {
        if (typeof req.headers?.get === 'function') {
            return req.headers.get(name);
        }
        return req.headers?.[name] || req.headers?.[name.toLowerCase()];
    };

    // 1. Cloudflare connecting IP (unspoofable when behind Cloudflare proxy)
    const cfConnectingIp = getHeader('cf-connecting-ip');
    if (cfConnectingIp) {
        return String(cfConnectingIp).trim();
    }

    // 2. True-Client-IP (Cloudflare Enterprise / Akamai)
    const trueClientIp = getHeader('true-client-ip');
    if (trueClientIp) {
        return String(trueClientIp).trim();
    }

    // 3. X-Real-IP (Direct reverse proxy like Nginx)
    const xRealIp = getHeader('x-real-ip');
    if (xRealIp) {
        return String(xRealIp).trim();
    }

    // 4. X-Forwarded-For: In direct reverse proxy setups, take the first valid IP
    const forwarded = getHeader('x-forwarded-for');
    if (forwarded) {
        const ips = String(forwarded).split(',').map(s => s.trim()).filter(Boolean);
        if (ips.length > 0) {
            return ips[0];
        }
    }

    return req.ip || req.socket?.remoteAddress || '127.0.0.1';
}

function checkAuthRateLimit(ip) {
    const now = Date.now();
    const attempts = (loginAttempts.get(ip) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    if (attempts.length >= MAX_LOGIN_ATTEMPTS) {
        const retryAfter = Math.ceil((attempts[0] + RATE_LIMIT_WINDOW_MS - now) / 1000);
        return { limited: true, retryAfter: Math.max(1, retryAfter) };
    }
    attempts.push(now);
    loginAttempts.set(ip, attempts);
    return { limited: false };
}

const COOKIE_NAME = 'nocr_token';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

function setAuthCookie(response, token) {
    response.cookies.set({
        name: COOKIE_NAME,
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: COOKIE_MAX_AGE
    });
    return response;
}

function clearAuthCookie(response) {
    response.cookies.set({
        name: COOKIE_NAME,
        value: '',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0
    });
    return response;
}

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

        if (path[0] === 'check-setup') {
            const { count, error } = await db
                .from('users')
                .select('*', { count: 'exact', head: true });

            if (error) {
                if (error.code === '42P01') {
                    return NextResponse.json({ isSetup: true, needsSetup: true, initialized: false, error: 'TABEL_TIDAK_DITEMUKAN' });
                }
                throw error;
            }
            return NextResponse.json({ 
                isSetup: count === 0, 
                needsSetup: count === 0, 
                initialized: count > 0 
            });
        }

        if (path[0] === 'me') {
            const user = await resolveAuth(req);
            return NextResponse.json({ user });
        }

        if (path[0] === 'users') {
            const user = await resolveAuth(req);
            if (!hasAccess(user, 'settings-users', 'read')) {
                throw Object.assign(new Error('Akses Ditolak: Anda tidak memiliki izin untuk melihat Pengguna'), { status: 403 });
            }
            
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
        if (path[0] === 'logout') {
            const response = NextResponse.json({ message: 'Logout berhasil' });
            return clearAuthCookie(response);
        }

        if (path[0] === 'setup') {
            const ip = getClientIp(req);
            const rateCheck = checkIpRateLimit(ip);
            if (rateCheck.limited) {
                return NextResponse.json(
                    { error: `Terlalu banyak percobaan. Silakan coba lagi dalam ${rateCheck.retryAfter} detik.` },
                    { 
                        status: 429, 
                        headers: { 'Retry-After': String(rateCheck.retryAfter) } 
                    }
                );
            }

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

            const response = NextResponse.json({
                message: 'Setup berhasil!',
                token,
                user: { id: data[0].id, username: data[0].username, role: normalizeRole(data[0].role) || 'admin' }
            });
            return setAuthCookie(response, token);
        }

        if (path[0] === 'login') {
            const ip = getClientIp(req);
            const ipCheck = checkIpRateLimit(ip);
            if (ipCheck.limited) {
                return NextResponse.json(
                    { error: `Terlalu banyak percobaan login dari IP ini. Silakan coba lagi dalam ${ipCheck.retryAfter} detik.` },
                    { 
                        status: 429, 
                        headers: { 'Retry-After': String(ipCheck.retryAfter) } 
                    }
                );
            }

            const body = await req.json();
            const { username, password } = body;

            if (!username || !password) {
                return NextResponse.json({ error: 'Username dan password wajib diisi' }, { status: 400 });
            }

            // Check Account Lockout per Username (prevents botnet / IP rotation attacks)
            const userLock = checkUserLockout(username);
            if (userLock.locked) {
                return NextResponse.json(
                    { error: `Akun ini terkunci sementara karena terlalu banyak percobaan gagal. Silakan coba lagi dalam ${userLock.retryAfter} detik.` },
                    { 
                        status: 429, 
                        headers: { 'Retry-After': String(userLock.retryAfter) } 
                    }
                );
            }

            const { data, error } = await db
                .from('users')
                .select('*')
                .eq('username', username)
                .single();

            if (error || !data) {
                recordFailedLogin(username);
                // Dummy compare to prevent timing attack enumeration
                await bcrypt.compare(password, '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopq');
                return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 });
            }

            const isValid = await bcrypt.compare(password, data.password_hash);
            if (!isValid) {
                recordFailedLogin(username);
                return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 });
            }

            // Successful login: reset failed login attempts for this user
            resetFailedLogin(username);

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

            const response = NextResponse.json({
                message: 'Login berhasil',
                token,
                user: { id: data.id, username: data.username, role: userRole, permissions }
            });
            return setAuthCookie(response, token);
        }

        if (path[0] === 'users') {
            const user = await resolveAuth(req);
            if (!hasAccess(user, 'settings-users', 'create')) {
                throw Object.assign(new Error('Akses Ditolak: Anda tidak memiliki izin untuk menambah Pengguna'), { status: 403 });
            }
            
            const body = await req.json();
            const { username, password, role } = body;

            if (!username || !password) {
                return NextResponse.json({ error: 'Username dan password wajib diisi' }, { status: 400 });
            }

            const normalizedRole = normalizeRole(role);
            if (!normalizedRole) {
                return NextResponse.json(
                    { error: 'Role tidak valid.' },
                    { status: 400 }
                );
            }

            const requestorRole = normalizeRole(user.role);
            if (normalizedRole === 'admin' && requestorRole !== 'admin') {
                return NextResponse.json(
                    { error: 'Akses ditolak: Hanya administrator yang dapat membuat pengguna dengan role admin.' },
                    { status: 403 }
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

            // Ambil detail pengguna saat ini dari DB
            const targetUser = await db.from('users').select('username, role').eq('id', id).single();
            if (targetUser.error || !targetUser.data) {
                return NextResponse.json(
                    { error: 'Pengguna tidak ditemukan.' },
                    { status: 404 }
                );
            }
            const previousRole = normalizeRole(targetUser.data.role);

            const isSelf = user.id === id;
            const canManageUsers = hasAccess(user, 'settings-users', 'update');

            // Cek otorisasi: harus bisa mengelola pengguna atau memodifikasi profil sendiri
            if (!canManageUsers && !isSelf) {
                return NextResponse.json(
                    { error: 'Akses ditolak: Anda tidak memiliki izin untuk mengubah data ini.' },
                    { status: 403 }
                );
            }

            const requestorRole = normalizeRole(user.role);
            const isTargetAdmin = previousRole === 'admin';
            const isSettingToAdmin = body.role !== undefined && normalizeRole(body.role) === 'admin';

            if ((isTargetAdmin || isSettingToAdmin) && requestorRole !== 'admin') {
                return NextResponse.json(
                    { error: 'Akses ditolak: Hanya administrator yang dapat memodifikasi akun administrator atau menunjuk role admin.' },
                    { status: 403 }
                );
            }

            const updateData = {};

            // 1. Role Update (Admin only)
            if (body.role !== undefined) {
                const normalizedRole = normalizeRole(body.role);
                if (!normalizedRole) {
                    return NextResponse.json(
                        { error: 'Role tidak valid.' },
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
            // (pembacaan dipindah ke awal handler PATCH)

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
            if (!hasAccess(user, 'settings-users', 'delete')) {
                throw Object.assign(new Error('Akses Ditolak: Anda tidak memiliki izin untuk menghapus Pengguna'), { status: 403 });
            }
            
            const id = path[1];
            if (user.id === id) {
                return NextResponse.json({ error: 'Tidak dapat menghapus akun Anda sendiri' }, { status: 400 });
            }

            const targetUser = await db.from('users').select('role').eq('id', id).single();
            if (targetUser.error || !targetUser.data) {
                return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 });
            }

            const targetRole = normalizeRole(targetUser.data.role);

            if (targetRole === 'admin') {
                const requestorRole = normalizeRole(user.role);
                if (requestorRole !== 'admin') {
                    return NextResponse.json(
                        { error: 'Akses ditolak: Hanya administrator yang dapat menghapus akun administrator.' },
                        { status: 403 }
                    );
                }

                const { data: allUsers } = await db.from('users').select('id, role');
                const adminCount = (allUsers || []).filter(
                    (u) => normalizeRole(u.role) === 'admin'
                ).length;
                if (adminCount <= 1) {
                    return NextResponse.json(
                        { error: 'Tidak dapat menghapus pengguna: minimal harus ada satu Administrator.' },
                        { status: 400 }
                    );
                }
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
