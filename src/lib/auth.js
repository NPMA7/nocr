import jwt from 'jsonwebtoken';
import db from '@/lib/dbClient';
import { normalizeRole, ROLES, canEditTopology } from '@/lib/roles';

export { normalizeRole, ROLES, canEditTopology, canMutateApp, canRevealPasswords } from '@/lib/roles';

export const JWT_SECRET = process.env.JWT_SECRET || 'nocr_super_secret_key_123';

export function isValidRole(role) {
    return ROLES.includes(normalizeRole(role));
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
        .from('admin_users')
        .select('id, username, role')
        .eq('id', decoded.id)
        .single();

    if (error || !data) {
        throw Object.assign(new Error('User tidak ditemukan atau tidak aktif'), { status: 401 });
    }

    return {
        id: data.id,
        username: data.username,
        role: normalizeRole(data.role) || 'visitor'
    };
}

export function enforceAdmin(user) {
    if (normalizeRole(user?.role) !== 'admin') {
        throw Object.assign(new Error('Akses Ditolak: Anda bukan Administrator'), { status: 403 });
    }
}

export function enforceRoleForMutation(req, user) {
    if (req.method !== 'GET') {
        const role = normalizeRole(user?.role);
        if (role !== 'admin') {
            throw Object.assign(new Error('Akses Ditolak: Fitur ini hanya untuk Administrator'), { status: 403 });
        }
    }
}

export function enforceTopologyMutation(user) {
    if (!canEditTopology(user?.role)) {
        throw Object.assign(new Error('Akses Ditolak: Edit topologi hanya untuk Admin atau Editor'), { status: 403 });
    }
}
