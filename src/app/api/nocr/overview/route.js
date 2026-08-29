import { NextResponse } from 'next/server';
import db from '@/lib/dbClient';
import { resolveAuth, sendApiError } from '@/lib/auth';

export async function GET(req) {
  try {
    // Authenticate via API Key or JWT session
    const user = await resolveAuth(req);

    // 1. Fetch Ruijie Devices
    const { data: ruijieList } = await db.from('ruijie_devices').select('*');
    const ruijie = ruijieList || [];

    // 2. Fetch Sites & Mappings
    const { data: sitesList } = await db.from('sites').select('*');
    const { data: mappingsList } = await db.from('device_mappings').select('*');
    const sites = sitesList || [];
    const mappings = mappingsList || [];

    // 3. Fetch MikroTik Devices & Active Sessions
    const { data: devicesList } = await db.from('devices').select('*');
    const { data: pppoeActiveList } = await db.from('pppoe_active').select('*');
    const mikrotikDevices = (devicesList || []).filter(d => (d.type || 'mikrotik').toLowerCase().includes('mikrotik'));
    const activeSessions = pppoeActiveList || [];

    // 4. Fetch Today's Daily Reports
    const today = new Date();
    const todayStr = today.toLocaleDateString('sv', { timeZone: 'Asia/Jakarta' });
    const { data: reportsList } = await db.from('daily_reports').select('*');
    const allReports = reportsList || [];
    const todayReports = allReports.filter(r => {
      if (!r.report_date) return false;
      const rDate = new Date(r.report_date).toLocaleDateString('sv', { timeZone: 'Asia/Jakarta' });
      return rDate === todayStr;
    });

    // Compute Ruijie metrics
    let ruijieOnline = 0;
    let ruijieOffline = 0;
    let totalConnectedClients = 0;

    const ruijieStatusMap = {};

    ruijie.forEach(d => {
      const st = (d.status || '').toUpperCase();
      const isOnline = st === 'ON' || st === 'ONLINE' || st === 'UP';
      if (isOnline) {
        ruijieOnline++;
      } else {
        ruijieOffline++;
      }
      ruijieStatusMap[d.mac_address] = isOnline;

      const clientCount = parseInt(d.clients || d.sta_nums || 0, 10);
      if (!isNaN(clientCount) && clientCount > 0) {
        totalConnectedClients += clientCount;
      }
    });

    const ruijieMap = Object.fromEntries(ruijie.map(r => [r.mac_address, r]));
    const mappingsMap = Object.fromEntries(mappings.map(m => [m.ruijie_mac, m]));

    // Compute Sites breakdown (Desa vs OPD)
    let desaTotal = 0;
    let desaOnline = 0;
    let desaOffline = 0;

    let opdTotal = 0;
    let opdOnline = 0;
    let opdOffline = 0;

    // Map sites
    sites.forEach(s => {
      const rDev = ruijieMap[s.ruijie_mac];
      const connType = ((rDev && rDev.connection_type) || s.connection_type || 'l2tp').toLowerCase();
      const mapping = mappingsMap[s.ruijie_mac] || {};
      const isOnline = ruijieStatusMap[s.ruijie_mac] !== undefined 
        ? ruijieStatusMap[s.ruijie_mac] 
        : (mapping.final_status || '').toLowerCase() === 'online';

      if (connType.includes('pppoe') || connType.includes('opd')) {
        opdTotal++;
        if (isOnline) opdOnline++;
        else opdOffline++;
      } else {
        desaTotal++;
        if (isOnline) desaOnline++;
        else desaOffline++;
      }
    });

    const totalSites = sites.length > 0 ? sites.length : ruijie.length;
    const totalOnlineSites = desaOnline + opdOnline;
    const totalOfflineSites = totalSites - totalOnlineSites;
    const onlinePercentage = totalSites > 0 
      ? parseFloat(((totalOnlineSites / totalSites) * 100).toFixed(2)) 
      : 100.0;

    // Active incidents from TODAY's reports
    const activeIncidentsToday = todayReports.filter(r => (r.status_progress || 'Progress').toLowerCase() === 'progress');
    const solvedTodayCount = todayReports.filter(r => (r.status_progress || '').toLowerCase() === 'selesai' || (r.status_progress || '').toLowerCase() === 'solved').length;

    // Network status health index based on SLA & Availability
    let healthStatus = 'HEALTHY';
    if (onlinePercentage < 75 || activeIncidentsToday.length > 25) {
      healthStatus = 'CRITICAL';
    } else if (onlinePercentage < 90 || activeIncidentsToday.length > 10) {
      healthStatus = 'WARNING';
    }

    // Response object
    return NextResponse.json({
      success: true,
      status: healthStatus,
      health_score: `${onlinePercentage}%`,
      timestamp: new Date().toISOString(),
      server_time: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
      summary: {
        total_sites: totalSites,
        online_sites: totalOnlineSites,
        offline_sites: totalOfflineSites,
        online_percentage: onlinePercentage,
        desa: {
          total: desaTotal,
          online: desaOnline,
          offline: desaOffline,
          percentage: desaTotal > 0 ? parseFloat(((desaOnline / desaTotal) * 100).toFixed(2)) : 0
        },
        opd: {
          total: opdTotal,
          online: opdOnline,
          offline: opdOffline,
          percentage: opdTotal > 0 ? parseFloat(((opdOnline / opdTotal) * 100).toFixed(2)) : 0
        }
      }
    });

  } catch (error) {
    return sendApiError(error);
  }
}
