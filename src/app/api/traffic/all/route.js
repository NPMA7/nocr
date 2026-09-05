import { NextResponse } from 'next/server';
import { resolveAuth, sendApiError } from '@/lib/auth';
import { hasAccess } from '@/lib/roles';
import db from '@/lib/dbClient';

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

    // Hanya role Super Admin yang dapat memicu sinkronisasi manual langsung ke cloud
    if (forceRefresh) {
      const isSuper = user?.role === 'superadmin' || user?.role === 'admin';
      if (!isSuper) {
        return NextResponse.json(
          { error: 'Akses Ditolak: Hanya Super Admin yang dapat melakukan sinkronisasi manual.' },
          { status: 403 }
        );
      }
    }

    // Jika bukan force refresh dan bukan custom range, baca langsung dari snapshot Database PostgreSQL
    if (!forceRefresh && rangeType !== 'custom') {
      try {
        const { data: snapshot } = await db
          .from('site_traffic_snapshots')
          .select('*')
          .eq('connection_type', type.toUpperCase())
          .eq('range_type', rangeType)
          .maybeSingle();

        if (snapshot && snapshot.sites_traffic && Array.isArray(snapshot.sites_traffic) && snapshot.sites_traffic.length > 0) {
          return NextResponse.json({
            sitesTraffic: snapshot.sites_traffic,
            summary: snapshot.summary,
            startDate: snapshot.start_date,
            endDate: snapshot.end_date,
            rangeType,
            lastSyncedAt: snapshot.updated_at,
            isFromDatabase: true,
          });
        }
      } catch (dbErr) {
        console.warn('[traffic/all] Gagal baca snapshot DB, fallback ke scraper:', dbErr.message);
      }
    }

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
        signal: AbortSignal.timeout(90000),
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

