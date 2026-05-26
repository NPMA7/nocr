import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { fetchSitesBundle, upsertSiteProfile } from '@/lib/sitesApi';
import { resolveAuth, enforceTopologyMutation } from '@/lib/auth';

function decodeMac(raw) {
  try {
    return decodeURIComponent(raw || '');
  } catch {
    return raw || '';
  }
}

export async function GET(_req, { params }) {
  try {
    const ruijie_mac = decodeMac(params.ruijie_mac);
    if (!ruijie_mac) {
      return NextResponse.json({ error: 'ruijie_mac wajib' }, { status: 400 });
    }

    const { data: mappings, error } = await supabase
      .from('device_mappings')
      .select('*')
      .eq('ruijie_mac', ruijie_mac);
    if (error) throw error;
    if (!mappings?.length) {
      return NextResponse.json({ error: 'Site / mapping tidak ditemukan' }, { status: 404 });
    }

    const mapping = mappings[0];
    const { data: ruijieData } = await supabase
      .from('ruijie_devices')
      .select('mac_address, last_online')
      .eq('mac_address', ruijie_mac)
      .maybeSingle();
    const { data: pppoeData } = await supabase
      .from('pppoe_secrets')
      .select('name, last_logged_out, remote_address')
      .eq('name', mapping.mikrotik_alias)
      .maybeSingle();

    let offline_since = null;
    let remote_address = pppoeData?.remote_address || null;

    if (mapping.status_ruijie === 'Offline' && ruijieData?.last_online) {
      offline_since = ruijieData.last_online;
    } else if (mapping.status_mikrotik === 'Offline' && pppoeData?.last_logged_out) {
      offline_since = pppoeData.last_logged_out;
    }

    const item = await fetchSitesBundle(supabase, { ruijieMac: ruijie_mac });
    if (!item) {
      return NextResponse.json({ error: 'Site tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ ...item, offline_since, remote_address });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    const user = await resolveAuth(req);
    enforceTopologyMutation(user);

    const ruijie_mac = decodeMac(params.ruijie_mac);
    if (!ruijie_mac) {
      return NextResponse.json({ error: 'ruijie_mac wajib' }, { status: 400 });
    }

    const body = await req.json();
    const item = await upsertSiteProfile(supabase, ruijie_mac, body);
    return NextResponse.json(item);
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
