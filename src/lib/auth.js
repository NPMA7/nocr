import jwt from 'jsonwebtoken';
import db from '@/lib/dbClient';
import { normalizeRole, hasAccess } from '@/lib/roles';

export { normalizeRole, hasAccess } from '@/lib/roles';

export const JWT_SECRET = process.env.JWT_SECRET;

export function isValidRole(role) {
    return !!normalizeRole(role);
}

export function verifyAuth(req) {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw Object.assign(new Error('Akses Ditolak: Token tidak ditemukan'), { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return decoded;
    } catch (err) {
        throw Object.assign(new Error('Token tidak valid atau sudah kedaluwarsa'), { status: 403 });
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
    if (!hasAccess(user, 'topology', 'update')) {
        throw Object.assign(new Error('Akses Ditolak: Edit topologi hanya untuk Admin atau Editor'), { status: 403 });
    }
}

export function enforceNetworkDevicesMutation(user) {
    if (!hasAccess(user, 'devices-mikrotik', 'update')) {
        throw Object.assign(new Error('Akses Ditolak: Anda tidak memiliki izin untuk mengonfigurasi perangkat jaringan'), { status: 403 });
    }
}
