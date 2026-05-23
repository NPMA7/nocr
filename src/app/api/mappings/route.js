import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';

export async function GET() {
  try {
    const { data, error } = await supabase.from('device_mappings').select('*');
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
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
    const url = new URL(req.url);
    const ruijie_mac = url.searchParams.get('ruijie_mac');
    
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
