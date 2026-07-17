import { NextResponse } from 'next/server';
import { resolveAuth } from '@/lib/auth';
import { hasAccess } from '@/lib/roles';

// groupId mapping berdasarkan connection_type (sesuai CONFIG di ruijie-scrape/src/server.js)
const GROUP_ID_MAP = {
  L2TP: '7940586',
  PPPOE: '7904031',
};

const RUIJIE_SERVER_URL = process.env.RUIJIE_SCRAPE_URL || 'http://127.0.0.1:5000';

export async function POST(request) {
  try {
    let user;
    try {
      user = await resolveAuth(request);
    } catch (e) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasAccess(user, 'sites', 'read')) {
      return NextResponse.json({ error: 'Akses Ditolak' }, { status: 403 });
    }

    const body = await request.json();
    const { type = 'L2TP', rangeType = 'today', deviceSn, groupId: customGroupId, startDate, endDate } = body;

    const groupId = customGroupId || GROUP_ID_MAP[type?.toUpperCase()] || GROUP_ID_MAP.L2TP;

    const payload = {
      groupId,
      rangeType,
      type: type.toLowerCase(),
      ...(deviceSn ? { deviceSn } : {}),
      ...(rangeType === 'custom' && startDate ? { startDate } : {}),
      ...(rangeType === 'custom' && endDate ? { endDate } : {}),
    };

    let res;
    try {
      res = await fetch(`${RUIJIE_SERVER_URL}/api/traffic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(60000),
      });
    } catch (fetchErr) {
      console.error('[traffic/site] Ruijie scrape server tidak dapat dihubungi:', fetchErr.message);
      return NextResponse.json(
        { error: 'Ruijie scrape server tidak dapat dihubungi. Pastikan server berjalan di port 5000.' },
        { status: 503 }
      );
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return NextResponse.json(
        { error: `Ruijie server error ${res.status}: ${text}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[traffic/site] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
