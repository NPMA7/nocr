import { NextResponse } from 'next/server';
import { resolveAuth, sendApiError } from '@/lib/auth';
import { hasAccess } from '@/lib/roles';

const RUIJIE_SERVER_URL =
  process.env.RUIJIE_SCRAPE_URL ||
  (process.env.SCRAPER_API_URL
    ? process.env.SCRAPER_API_URL.replace(/\/api\/?$/, '')
    : 'http://ruijie_scraper:5000');

export async function POST(request) {
  try {
    let user;
    try {
      user = await resolveAuth(request);
    } catch (e) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasAccess(user, 'monitoring-l2tp', 'read') && !hasAccess(user, 'sites', 'read')) {
      return NextResponse.json({ error: 'Akses Ditolak' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      type = 'l2tp',
      rangeType = '30days',
      startDate,
      endDate,
      forceRefresh = false,
    } = body;

    const payload = {
      type: type.toLowerCase(),
      rangeType,
      allSites: true,
      forceRefresh: Boolean(forceRefresh),
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
      console.error('[traffic/all] Ruijie scrape server tidak dapat dihubungi:', fetchErr.message);
      return NextResponse.json(
        { error: 'Ruijie scraper server tidak dapat dihubungi. Pastikan container ruijie_scraper aktif.' },
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
    return sendApiError(error);
  }
}
