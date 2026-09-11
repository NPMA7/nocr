import { NextResponse } from 'next/server';
import db from '@/lib/dbClient';
import { resolveAuth, sendApiError, hasAccess } from '@/lib/auth';

export async function PATCH(req, { params }) {
  try {
    const user = await resolveAuth(req);
    if ((user?.role || '').toLowerCase() !== 'superadmin') {
      return NextResponse.json({ error: 'Akses Ditolak: Hanya superadmin yang dapat memperbarui API Key' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const updatePayload = {
      updated_at: new Date().toISOString()
    };

    if (typeof body.is_active === 'boolean') {
      updatePayload.is_active = body.is_active;
    }
    if (body.name && typeof body.name === 'string') {
      updatePayload.name = body.name.trim();
    }
    if (body.role && typeof body.role === 'string') {
      updatePayload.role = body.role.toLowerCase().trim();
    }
    if (body.expires_at !== undefined) {
      updatePayload.expires_at = body.expires_at ? new Date(body.expires_at).toISOString() : null;
    }

    const { data: updated, error } = await db
      .from('api_keys')
      .update(updatePayload)
      .eq('id', id)
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Status API Key berhasil diperbarui',
      data: updated
    });
  } catch (error) {
    return sendApiError(error);
  }
}

export async function DELETE(req, { params }) {
  try {
    const user = await resolveAuth(req);
    if ((user?.role || '').toLowerCase() !== 'superadmin') {
      return NextResponse.json({ error: 'Akses Ditolak: Hanya superadmin yang dapat menghapus API Key' }, { status: 403 });
    }

    const { id } = await params;
    const { error } = await db
      .from('api_keys')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'API Key berhasil dihapus'
    });
  } catch (error) {
    return sendApiError(error);
  }
}
