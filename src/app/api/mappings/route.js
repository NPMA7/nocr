import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { resolveAuth, enforceRoleForMutation } from '@/lib/auth';

export async function GET() {
  try {
    const { data, error } = await supabase.from('device_mappings').select('*');
    if (error) throw error;

    const { data: ruijieData } = await supabase.from('ruijie_devices').select('mac_address, last_online').eq('connection_type', 'L2TP');
    const { data: pppoeData } = await supabase.from('pppoe_secrets').select('name, last_logged_out, remote_address');
    
    const enrichedData = (data || []).map(m => {
      let offlineTime = null;
      let remoteAddr = null;

      const sec = (pppoeData || []).find(s => s.name === m.mikrotik_alias);
      if (sec) {
        remoteAddr = sec.remote_address;
      }

      if (m.status_ruijie === 'Offline') {
        const ap = (ruijieData || []).find(r => r.mac_address === m.ruijie_mac);
        if (ap && ap.last_online) offlineTime = ap.last_online;
      } else if (m.status_mikrotik === 'Offline') {
        if (sec && sec.last_logged_out) offlineTime = sec.last_logged_out;
      }
      return { ...m, offline_since: offlineTime, remote_address: remoteAddr };
    });

    return NextResponse.json(enrichedData);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const user = await resolveAuth(req);
    enforceRoleForMutation(req, user); // Only admin for manual link

    const body = await req.json();
    const { ruijie_mac, mikrotik_name } = body;
    
    if (!ruijie_mac || !mikrotik_name) {
      return NextResponse.json({ error: 'ruijie_mac and mikrotik_name are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('device_mappings')
      .upsert({ 
        ruijie_mac, 
        mikrotik_name, 
        mikrotik_alias: mikrotik_name,
        prefix: mikrotik_name,
        is_manual: true 
      }, { onConflict: 'ruijie_mac' })
      .select();
      
    if (error) throw error;
    return NextResponse.json(data[0]);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const user = await resolveAuth(req);
    enforceRoleForMutation(req, user);

    const { searchParams } = new URL(req.url);
    const ruijie_mac = searchParams.get('ruijie_mac');
    
    if (!ruijie_mac) {
      return NextResponse.json({ error: 'ruijie_mac is required' }, { status: 400 });
    }
    
    const { error } = await supabase
      .from('device_mappings')
      .delete()
      .eq('ruijie_mac', ruijie_mac);
      
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
