import { NextResponse } from 'next/server';
import db from '@/lib/dbClient';
import { resolveAuth, hasAccess, sendApiError } from '@/lib/auth';

export async function GET(req) {
  try {
    const user = await resolveAuth(req);
    if (!hasAccess(user, 'monitoring-l2tp', 'read') && !hasAccess(user, 'devices-mikrotik', 'read')) {
      return NextResponse.json({ error: 'Akses Ditolak: Anda tidak memiliki izin untuk melihat monitoring MikroTik' }, { status: 403 });
    }
    const [secretsResult, activeResult] = await Promise.all([
      db.from('pppoe_secrets').select('name, service, disabled'),
      db.from('pppoe_active').select('name, address, uptime')
    ]);

    if (secretsResult.error) throw secretsResult.error;
    if (activeResult.error) throw activeResult.error;

    return NextResponse.json({
      secrets: secretsResult.data || [],
      pppoe: activeResult.data || []
    });
  } catch (error) {
    return sendApiError(error);
  }
}
