import { NextResponse } from 'next/server';
import db from '@/lib/dbClient';
import { resolveAuth, sendApiError } from '@/lib/auth';

export async function GET(req) {
  try {
    const user = await resolveAuth(req);

    const { searchParams } = new URL(req.url);
    const statusParam = (searchParams.get('status') || 'all').toLowerCase(); // all, online, offline
    const typeParam = (searchParams.get('type') || 'all').toLowerCase(); // all, desa, opd, l2tp, pppoe
    const searchParam = (searchParams.get('search') || '').toLowerCase().trim();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '100', 10)));

    // 1. Fetch sites & ruijie devices
    const { data: sitesList } = await db.from('sites').select('*');
    const { data: ruijieList } = await db.from('ruijie_devices').select('*');
    const { data: mappingsList } = await db.from('device_mappings').select('*');
    const { data: picsList } = await db.from('site_pics').select('*');

    const sites = sitesList || [];
    const ruijie = ruijieList || [];
    const mappings = mappingsList || [];
    const pics = picsList || [];

    const ruijieMap = Object.fromEntries(ruijie.map(r => [r.mac_address, r]));
    const mappingsMap = Object.fromEntries(mappings.map(m => [m.ruijie_mac, m]));
    const picsMap = {};
    pics.forEach(p => {
      if (!picsMap[p.site_id]) picsMap[p.site_id] = p;
    });

    let combined = [];

    // Combine data
    if (sites.length > 0) {
      combined = sites.map(s => {
        const rDev = ruijieMap[s.ruijie_mac] || {};
        const mapping = mappingsMap[s.ruijie_mac] || {};
        const pic = picsMap[s.id] || {};

        const connType = (rDev.connection_type || s.connection_type || 'l2tp').toUpperCase();
        const isDesa = connType === 'L2TP' || connType.includes('DESA');
        
        const rStatus = (rDev.status || '').toUpperCase();
        const isRuijieUp = rStatus === 'ON' || rStatus === 'ONLINE' || rStatus === 'UP';
        const isMappingUp = (mapping.final_status || '').toLowerCase() === 'online';
        const isOnline = isRuijieUp || isMappingUp;

        const name = mapping.prefix || mapping.ruijie_alias || rDev.alias || s.ruijie_mac;

        return {
          id: s.id,
          name: name,
          category: isDesa ? 'DESA' : 'OPD',
          connection_type: connType,
          ruijie_mac: s.ruijie_mac,
          status: isOnline ? 'online' : 'offline',
          ip_address: rDev.ip_address || mapping.cpe_ip || null,
          clients_connected: parseInt(rDev.clients || rDev.sta_nums || 0, 10),
          latitude: s.latitude || null,
          longitude: s.longitude || null,
          address: s.full_address || null,
          vendor: s.vendor || null,
          last_online: rDev.last_online || null,
          pic: {
            name: pic.name || null,
            phone: pic.phone || null
          }
        };
      });
    } else {
      combined = ruijie.map(r => {
        const mapping = mappingsMap[r.mac_address] || {};
        const connType = (r.connection_type || 'L2TP').toUpperCase();
        const isDesa = connType === 'L2TP';
        const rStatus = (r.status || '').toUpperCase();
        const isOnline = rStatus === 'ON' || rStatus === 'ONLINE' || rStatus === 'UP' || (mapping.final_status || '').toLowerCase() === 'online';

        return {
          id: r.id,
          name: mapping.prefix || r.alias || r.mac_address,
          category: isDesa ? 'DESA' : 'OPD',
          connection_type: connType,
          ruijie_mac: r.mac_address,
          status: isOnline ? 'online' : 'offline',
          ip_address: r.ip_address || null,
          clients_connected: parseInt(r.clients || r.sta_nums || 0, 10),
          latitude: null,
          longitude: null,
          address: null,
          vendor: null,
          last_online: r.last_online || null,
          pic: null
        };
      });
    }

    // Filter by status
    if (statusParam === 'online') {
      combined = combined.filter(s => s.status === 'online');
    } else if (statusParam === 'offline') {
      combined = combined.filter(s => s.status === 'offline');
    }

    // Filter by type
    if (typeParam === 'desa' || typeParam === 'l2tp') {
      combined = combined.filter(s => s.category === 'DESA' || s.connection_type === 'L2TP');
    } else if (typeParam === 'opd' || typeParam === 'pppoe') {
      combined = combined.filter(s => s.category === 'OPD' || s.connection_type === 'PPPOE');
    }

    // Filter by search
    if (searchParam) {
      combined = combined.filter(s => 
        (s.name || '').toLowerCase().includes(searchParam) ||
        (s.ruijie_mac || '').toLowerCase().includes(searchParam) ||
        (s.address || '').toLowerCase().includes(searchParam) ||
        (s.ip_address || '').toLowerCase().includes(searchParam)
      );
    }

    const totalFiltered = combined.length;
    const onlineCount = combined.filter(s => s.status === 'online').length;
    const offlineCount = combined.filter(s => s.status === 'offline').length;

    // Pagination
    const startIndex = (page - 1) * limit;
    const paginated = combined.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      success: true,
      meta: {
        total: totalFiltered,
        online_count: onlineCount,
        offline_count: offlineCount,
        page,
        limit,
        total_pages: Math.ceil(totalFiltered / limit)
      },
      data: paginated
    });

  } catch (error) {
    return sendApiError(error);
  }
}
