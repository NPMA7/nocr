import jwt from 'jsonwebtoken';
import db from '@/lib/dbClient';
import { normalizeRole, hasAccess } from '@/lib/roles';
import { sendApiError } from '@/lib/errorHandler';

export { normalizeRole, hasAccess } from '@/lib/roles';
export { sendApiError } from '@/lib/errorHandler';

export const JWT_SECRET = process.env.JWT_SECRET;

export function isValidRole(role) {
    return !!normalizeRole(role);
}

export function extractToken(req) {
    if (!req) return null;

    // 1. Authorization header (Bearer token)
    let authHeader = null;
    if (typeof req.headers?.get === 'function') {
        authHeader = req.headers.get('authorization');
    } else if (req.headers && req.headers['authorization']) {
        authHeader = req.headers['authorization'];
    }

    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.split(' ')[1].trim();
    }

    // 2. Next.js Request cookies object
    if (req.cookies) {
        if (typeof req.cookies.get === 'function') {
            const cookieVal = req.cookies.get('nocr_token')?.value;
            if (cookieVal) return cookieVal;
        } else if (typeof req.cookies === 'object' && req.cookies.nocr_token) {
            return req.cookies.nocr_token;
        }
    }

    // 3. Raw cookie header
    let cookieHeader = null;
    if (typeof req.headers?.get === 'function') {
        cookieHeader = req.headers.get('cookie');
    } else if (req.headers && req.headers['cookie']) {
        cookieHeader = req.headers['cookie'];
    }

    if (cookieHeader) {
        const match = cookieHeader.match(/(?:^|;\s*)nocr_token=([^;]+)/);
        if (match) return decodeURIComponent(match[1]);
    }

    return null;
}

export function verifyAuth(req) {
    const token = extractToken(req);
    if (!token) {
        throw Object.assign(new Error('Akses Ditolak: Token tidak ditemukan'), { status: 401 });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return decoded;
    } catch (err) {
        throw Object.assign(new Error('Token tidak valid atau sudah kedaluwarsa'), { status: 401 });
    }
}

/** Auth dengan role terbaru dari database (bukan hanya dari JWT). */
export async function resolveAuth(req) {
    const decoded = verifyAuth(req);
    const { data, error } = await db
        .from('users')
        .select('id, username, role')
        .eq('id', decoded.id)
        .single();

    if (error || !data) {
        throw Object.assign(new Error('User tidak ditemukan atau tidak aktif'), { status: 401 });
    }

    const roleData = await db.from('access_roles').select('permissions').eq('name', data.role).single();
    let permissions = [];
    if (roleData.data && roleData.data.permissions) {
        try {
            permissions = typeof roleData.data.permissions === 'string' 
                ? JSON.parse(roleData.data.permissions) 
                : roleData.data.permissions;
        } catch(e) {}
    }

    return {
        id: data.id,
        username: data.username,
        role: data.role,
        permissions
    };
}

export function enforceAdmin(user, requiredKey = 'settings-users') {
    if (!hasAccess(user, requiredKey, 'update')) {
        throw Object.assign(new Error('Akses Ditolak: Anda tidak memiliki izin Administrator'), { status: 403 });
    }
}

export function enforceRoleForMutation(req, user, requiredKey = 'settings-mikrotik') {
    if (req.method !== 'GET') {
        if (!hasAccess(user, requiredKey, 'update')) {
            throw Object.assign(new Error('Akses Ditolak: Anda tidak memiliki izin memodifikasi sistem'), { status: 403 });
        }
    }
}

export function enforceTopologyMutation(user) {
    if (
        !hasAccess(user, 'topology', 'update') &&
        !hasAccess(user, 'topology', 'create') &&
        !hasAccess(user, 'topology', 'delete')
    ) {
        throw Object.assign(new Error('Akses Ditolak: Anda tidak memiliki izin untuk mengubah topologi'), { status: 403 });
    }
}


