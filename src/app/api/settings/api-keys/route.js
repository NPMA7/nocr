import { NextResponse } from 'next/server';
import crypto from 'crypto';
import db from '@/lib/dbClient';
import { resolveAuth, sendApiError, hasAccess } from '@/lib/auth';

function maskKey(key) {
  if (!key || typeof key !== 'string') return '';
  if (key.length <= 16) return key.slice(0, 4) + '...' + key.slice(-4);
  return key.slice(0, 12) + '...' + key.slice(-6);
}

export async function GET(req) {
  try {
    const user = await resolveAuth(req);
    if ((user?.role || '').toLowerCase() !== 'superadmin') {
      return NextResponse.json({ error: 'Akses Ditolak: Hanya superadmin yang dapat mengelola API Key' }, { status: 403 });
    }

    const { data: keys, error } = await db
      .from('api_keys')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formatted = (keys || []).map(k => ({
      id: k.id,
      name: k.name,
      masked_key: maskKey(k.key),
      key_prefix: k.key_prefix || (k.key ? k.key.slice(0, 14) : 'nocr_live_'),
      role: k.role || 'visitor',
      permissions: k.permissions || {},
      created_by: k.created_by || 'system',
      is_active: k.is_active !== false,
      expires_at: k.expires_at,
      last_used_at: k.last_used_at,
      created_at: k.created_at,
      updated_at: k.updated_at
    }));

    return NextResponse.json({
      success: true,
      data: formatted
    });
  } catch (error) {
    return sendApiError(error);
  }
}

export async function POST(req) {
  try {
    const user = await resolveAuth(req);
    if ((user?.role || '').toLowerCase() !== 'superadmin') {
      return NextResponse.json({ error: 'Akses Ditolak: Hanya superadmin yang dapat membuat API Key baru' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const name = (body.name || '').trim();
    const role = (body.role || 'visitor').toLowerCase().trim();
    const expires_in_days = parseInt(body.expires_in_days || 0, 10);
    const custom_permissions = body.permissions || null;

    if (!name) {
      return NextResponse.json({ error: 'Nama API Key / Klien wajib diisi' }, { status: 400 });
    }

    // Generate secure random key: e.g. nocr_live_a1b2c3d4e5f6... (48 hex chars = 24 bytes)
    const randomHex = crypto.randomBytes(24).toString('hex');
    const generatedKey = `nocr_live_${randomHex}`;
    const keyPrefix = generatedKey.slice(0, 14) + '...';

    let expiresAt = null;
    if (expires_in_days > 0) {
      const exp = new Date();
      exp.setDate(exp.getDate() + expires_in_days);
      expiresAt = exp.toISOString();
    }

    const newRecord = {
      name,
      key: generatedKey,
      key_prefix: keyPrefix,
      role,
      permissions: custom_permissions ? (typeof custom_permissions === 'string' ? custom_permissions : JSON.stringify(custom_permissions)) : JSON.stringify({}),
      created_by: user.username || 'admin',
      is_active: true,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: inserted, error } = await db
      .from('api_keys')
      .insert(newRecord)
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'API Key berhasil dibuat dan siap digunakan',
      data: {
        id: inserted?.id || inserted?.[0]?.id,
        name: inserted?.name || name,
        key: generatedKey, // Only returned once on creation
        key_prefix: keyPrefix,
        role: inserted?.role || role,
        is_active: true,
        expires_at: expiresAt,
        created_at: inserted?.created_at || newRecord.created_at
      }
    }, { status: 201 });

  } catch (error) {
    return sendApiError(error);
  }
}
