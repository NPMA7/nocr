import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';

export async function GET() {
  try {
    const device = await getCoreDevice();

    // Ambil PPPoE ruijie devices
    const { data: ruijieDevices, error: ruijieErr } = await supabase
      .from('ruijie_devices')
      .select('*')
      .eq('connection_type', 'PPPOE');
    if (ruijieErr) throw ruijieErr;

    // Ambil PPPoE secrets, active dari MikroTik, dan mappings dari DB
    const [resSecrets, resActive, resMappings] = await Promise.all([
      supabase.from('pppoe_secrets').select('name, service, remote_address, last_logged_out'),
      supabase.from('pppoe_active').select('name'),
      supabase.from('device_mappings').select('*')
    ]);

    const secrets = resSecrets.data || [];
    const active = resActive.data || [];
    const dbMappings = resMappings.data || [];
    
    const activeNames = new Set(active.map(a => a.name));

    const normalizeName = (name) => name ? name.toLowerCase().replace(/[-_\s]/g, '') : '';

    const mappings = (ruijieDevices || []).map(ap => {
      const normAlias = normalizeName(ap.alias);
      
      // Check existing manual mapping
      const existing = dbMappings.find(m => m.ruijie_mac === ap.mac_address);
      let secretName = null;
      let isManual = false;
      let isPrefixManual = false;

      if (existing && existing.is_manual && existing.mikrotik_name) {
        secretName = existing.mikrotik_name;
        isManual = true;
      } else {
        const matched = secrets.find(s => normalizeName(s.name) === normAlias);
        if (matched) secretName = matched.name;
      }

      if (existing && existing.is_prefix_manual) {
        isPrefixManual = true;
      }

      const matchedSecret = secrets.find(s => s.name === secretName);
      const mikrotikName = secretName || '-';
      
      const isActive = matchedSecret ? activeNames.has(matchedSecret.name) : false;
      const remoteAddress = matchedSecret?.remote_address || null;
      const lastLoggedOut = matchedSecret?.last_logged_out || null;

      const apStatus = ap.status === 'ON' ? 'Online' : 'Offline';
      const mikrotikStatus = secretName ? (isActive ? 'Online' : 'Offline') : 'Unknown';

      let finalStatus = 'Unknown';
      let issue = null;
      finalStatus = apStatus;
      if (apStatus === 'Online' && mikrotikStatus === 'Offline') issue = 'Mikrotik Mati';
      else if (apStatus === 'Offline' && mikrotikStatus === 'Offline') issue = 'Semua Perangkat Mati';
      else if (apStatus === 'Offline' && mikrotikStatus === 'Online') issue = 'Access Point Mati / Kecabut';

      if (!secretName || secretName === '-') {
        issue = 'Belum ditautkan (Nama Tidak Cocok)';
      } else if (isManual && !matchedSecret) {
        issue = 'Akun Mikrotik tidak ditemukan (Manual Link Salah)';
      }

      const offlineSince = apStatus === 'Offline' ? ap.last_online
        : (mikrotikStatus === 'Offline' && lastLoggedOut ? lastLoggedOut : null);

      const prefixName = isPrefixManual ? existing.prefix : (secretName || ap.alias || ap.mac_address);

      return {
        ruijie_mac: ap.mac_address,
        mikrotik_name: mikrotikName,
        prefix: prefixName,
        ruijie_alias: ap.alias || ap.mac_address,
        mikrotik_alias: mikrotikName,
        status_ruijie: apStatus,
        status_mikrotik: mikrotikStatus,
        final_status: finalStatus,
        issue: issue || '',
        is_manual: isManual,
        is_prefix_manual: isPrefixManual,
        offline_since: offlineSince,
        remote_address: remoteAddress,
        connection_type: 'PPPOE',
      };
    }).sort((a, b) => (a.prefix || '').localeCompare(b.prefix || ''));

    return NextResponse.json(mappings);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function getCoreDevice() {
  const { data } = await supabase
    .from('mikrotik_devices')
    .select('id')
    .eq('is_core', true)
    .maybeSingle();
  return data;
}
