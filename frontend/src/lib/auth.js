import jwt from 'jsonwebtoken';
import db from '@/lib/dbClient';
import { normalizeRole, hasAccess } from '@/lib/roles';
import { sendApiError } from '@/lib/errorHandler';

export { normalizeRole, hasAccess } from '@/lib/roles';
export { sendApiError } from '@/lib/errorHandler';

export const JWT_SECRET = process.env.JWT_SECRET || 'nocr_dev_secret_key';

export function isValidRole(role) {
    return !!normalizeRole(role);
}

export function extractApiKey(req) {
    if (!req) return null;

    // 1. Check headers (x-api-key, x-api-token)
    if (typeof req.headers?.get === 'function') {
        const xKey = req.headers.get('x-api-key') || req.headers.get('x-api-token');
        if (xKey) return xKey.trim();
    } else if (req.headers) {
        const xKey = req.headers['x-api-key'] || req.headers['x-api-token'];
        if (xKey) return typeof xKey === 'string' ? xKey.trim() : xKey[0].trim();
    }

    // 2. Check Authorization header (Bearer nocr_...)
    let authHeader = null;
    if (typeof req.headers?.get === 'function') {
        authHeader = req.headers.get('authorization');
    } else if (req.headers && req.headers['authorization']) {
        authHeader = req.headers['authorization'];
    }
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const candidate = authHeader.split(' ')[1].trim();
        if (candidate.startsWith('nocr_') || candidate.split('.').length !== 3) {
            return candidate;
        }
    }

    // 3. Check query param (?api_key= or ?apiKey=)
    if (req.url) {
        try {
            const urlObj = new URL(req.url, 'http://localhost');
            const qKey = urlObj.searchParams.get('api_key') || urlObj.searchParams.get('apiKey');
            if (qKey) return qKey.trim();
        } catch (e) {}
    } else if (req.query?.api_key || req.query?.apiKey) {
        return (req.query.api_key || req.query.apiKey).trim();
    }

    return null;
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
    const apiKey = extractApiKey(req);
    if (apiKey) {
        return { id: 'apikey', isApiKey: true, apiKey };
    }

    const token = extractToken(req);
    if (!token) {
        throw Object.assign(new Error('Akses Ditolak: Token atau API Key tidak ditemukan'), { status: 401 });
    }

    if (token.startsWith('nocr_')) {
        return { id: 'apikey', isApiKey: true, apiKey: token };
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return decoded;
    } catch (err) {
        throw Object.assign(new Error('Token tidak valid atau sudah kedaluwarsa'), { status: 401 });
    }
}

/** Auth dengan role terbaru dari database (mendukung JWT & API Key). */
export async function resolveAuth(req) {
    // 1. Cek Autentikasi API Key
    const apiKey = extractApiKey(req);
    if (apiKey) {
        const { data: keyData, error } = await db
            .from('api_keys')
            .select('*')
            .eq('key', apiKey)
            .maybeSingle();

        if (error || !keyData) {
            throw Object.assign(new Error('Akses Ditolak: API Key tidak valid'), { status: 401 });
        }

        if (keyData.is_active === false) {
            throw Object.assign(new Error('Akses Ditolak: API Key telah dinonaktifkan'), { status: 401 });
        }

        if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
            throw Object.assign(new Error('Akses Ditolak: API Key telah kedaluwarsa'), { status: 401 });
        }

        // API Key bersifat Strictly READ-ONLY (Hanya HTTP GET / HEAD)
        const reqMethod = req?.method || '';
        if (reqMethod && reqMethod.toUpperCase() !== 'GET' && reqMethod.toUpperCase() !== 'HEAD' && reqMethod.toUpperCase() !== 'OPTIONS') {
            throw Object.assign(
                new Error('Akses Ditolak: API Key bersifat Read-Only (Hanya HTTP GET)'),
                { status: 403 }
            );
        }

        // Perbarui last_used_at secara non-blocking
        db.from('api_keys')
            .update({ last_used_at: new Date().toISOString() })
            .eq('id', keyData.id)
            .execute()
            .catch(() => {});

        let permissions = {};
        if (keyData.permissions) {
            try {
                permissions = typeof keyData.permissions === 'string'
                    ? JSON.parse(keyData.permissions)
                    : keyData.permissions;
            } catch (e) {}
        }

        const role = (keyData.role || 'visitor').toLowerCase().trim();
        if (role === 'superadmin' || role === 'admin') {
            return {
                id: keyData.id,
                username: `apikey:${keyData.name || 'client'}`,
                name: keyData.name,
                role: 'superadmin',
                isApiKey: true,
                apiKeyId: keyData.id,
                permissions
            };
        }

        const roleData = await db.from('access_roles').select('permissions').eq('name', role).maybeSingle();
        if (roleData.data && roleData.data.permissions) {
            try {
                const parsed = typeof roleData.data.permissions === 'string'
                    ? JSON.parse(roleData.data.permissions)
                    : roleData.data.permissions;
                permissions = { ...parsed, ...permissions };
            } catch (e) {}
        }

        return {
            id: keyData.id,
            username: `apikey:${keyData.name || 'client'}`,
            name: keyData.name,
            role,
            isApiKey: true,
            apiKeyId: keyData.id,
            permissions
        };
    }

    // 2. Cek Autentikasi JWT Normal
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


