import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { mergeMappingWithSite } from '@/lib/sitesApi';

export async function GET() {
  try {
    const { data: mappings, error } = await supabase.from('device_mappings').select('*');
    if (error) throw error;

    const { data: ruijieData } = await supabase.from('ruijie_devices').select('mac_address, last_online').eq('connection_type', 'L2TP');
    const { data: pppoeData } = await supabase.from('pppoe_secrets').select('name, last_logged_out, remote_address');

    const enrichedMappings = (mappings || []).map((m) => {
      let offlineTime = null;
      let remoteAddr = null;
      
      const sec = (pppoeData || []).find((s) => s.name === m.mikrotik_alias);
      if (sec) {
        remoteAddr = sec.remote_address;
      }

      if (m.status_ruijie === 'Offline') {
        const ap = (ruijieData || []).find((r) => r.mac_address === m.ruijie_mac);
        if (ap?.last_online) offlineTime = ap.last_online;
      } else if (m.status_mikrotik === 'Offline') {
        if (sec?.last_logged_out) offlineTime = sec.last_logged_out;
      }
      return { ...m, offline_since: offlineTime, remote_address: remoteAddr };
    });

    const macs = enrichedMappings.map((m) => m.ruijie_mac);
    let sites = [];
    let pics = [];
    if (macs.length > 0) {
      const { data: siteRows, error: siteErr } = await supabase.from('sites').select('*').in('ruijie_mac', macs);
      if (siteErr) throw siteErr;
      sites = siteRows || [];
    }
    const siteIds = sites.map((s) => s.id);
    if (siteIds.length > 0) {
      const { data: picRows } = await supabase
        .from('site_pics')
        .select('*')
        .in('site_id', siteIds)
        .order('sort_order', { ascending: true });
      pics = picRows || [];
    }

    const siteByMac = Object.fromEntries(sites.map((s) => [s.ruijie_mac, s]));
    const items = enrichedMappings
      .map((m) => mergeMappingWithSite(m, siteByMac[m.ruijie_mac], pics))
      .sort((a, b) => (a.prefix || '').localeCompare(b.prefix || ''));

    return NextResponse.json(items);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
