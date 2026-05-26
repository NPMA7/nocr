import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { mergeMappingWithSite } from '@/lib/sitesApi';

export async function GET() {
  try {
    // --- L2TP: dari device_mappings (sumber utama) ---
    const { data: mappings, error } = await supabase.from('device_mappings').select('*');
    if (error) throw error;

    // Ambil semua ruijie_devices (L2TP dan PPPoE)
    const { data: ruijieData } = await supabase
      .from('ruijie_devices')
      .select('mac_address, last_online, connection_type, alias, status');
    const { data: pppoeData } = await supabase
      .from('pppoe_secrets')
      .select('name, last_logged_out, remote_address');

    const ruijieByMac = Object.fromEntries((ruijieData || []).map((r) => [r.mac_address, r]));

    // Enrich L2TP mappings dengan connection_type dari ruijie_devices
    const enrichedMappings = (mappings || []).map((m) => {
      let offlineTime = null;
      let remoteAddr = null;

      const ap = ruijieByMac[m.ruijie_mac];
      const connectionType = ap?.connection_type || 'L2TP';

      const sec = (pppoeData || []).find((s) => s.name === m.mikrotik_alias);
      if (sec) remoteAddr = sec.remote_address;

      if (m.status_ruijie === 'Offline') {
        if (ap?.last_online) offlineTime = ap.last_online;
      } else if (m.status_mikrotik === 'Offline') {
        if (sec?.last_logged_out) offlineTime = sec.last_logged_out;
      }
      return { ...m, offline_since: offlineTime, remote_address: remoteAddr, connection_type: connectionType };
    });

    // Set MAC yang sudah ada di device_mappings (L2TP)
    const l2tpMacs = new Set(enrichedMappings.map((m) => m.ruijie_mac));

    // --- PPPoE: ruijie_devices yang TIDAK ada di device_mappings ---
    const pppoeDevices = (ruijieData || []).filter(
      (r) => r.connection_type === 'PPPOE' && !l2tpMacs.has(r.mac_address)
    );

    // Buat virtual mappings untuk PPPoE
    const pppoeVirtualMappings = pppoeDevices.map((ap) => ({
      ruijie_mac: ap.mac_address,
      mikrotik_name: '-',
      prefix: ap.alias || ap.mac_address,
      ruijie_alias: ap.alias || ap.mac_address,
      mikrotik_alias: '-',
      status_ruijie: ap.status === 'ON' ? 'Online' : 'Offline',
      status_mikrotik: 'Unknown',
      final_status: ap.status === 'ON' ? 'Online' : 'Offline',
      issue: 'PPPoE - Tidak ada mapping MikroTik',
      is_manual: false,
      is_prefix_manual: false,
      offline_since: ap.status !== 'ON' ? ap.last_online : null,
      remote_address: null,
      connection_type: 'PPPOE',
    }));

    // Gabungkan semua mappings
    const allMappings = [...enrichedMappings, ...pppoeVirtualMappings];

    // Ambil sites
    const allMacs = allMappings.map((m) => m.ruijie_mac);
    let sites = [];
    let pics = [];
    if (allMacs.length > 0) {
      const { data: siteRows, error: siteErr } = await supabase
        .from('sites')
        .select('*')
        .in('ruijie_mac', allMacs);
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
    const items = allMappings
      .map((m) => ({
        ...mergeMappingWithSite(m, siteByMac[m.ruijie_mac], pics),
        connection_type: m.connection_type,
      }))
      .sort((a, b) => (a.prefix || '').localeCompare(b.prefix || ''));

    return NextResponse.json(items);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
