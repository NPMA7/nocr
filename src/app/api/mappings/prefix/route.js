import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { autoLinkTopologyNode } from '@/lib/topologySiteLink';
import { resolveAuth, enforceTopologyMutation } from '@/lib/auth';

export async function PATCH(req) {
  try {
    const user = await resolveAuth(req);
    enforceTopologyMutation(user);

    const body = await req.json();
    const { ruijie_mac, new_prefix, old_prefix } = body;
    
    if (!ruijie_mac || !new_prefix || !old_prefix) {
      return NextResponse.json({ error: 'ruijie_mac, new_prefix, and old_prefix are required' }, { status: 400 });
    }

    // 1. Update device_mappings: set prefix and is_prefix_manual flag
    const { error: mappingError } = await supabase
      .from('device_mappings')
      .update({ 
        prefix: new_prefix,
        is_prefix_manual: true
      })
      .eq('ruijie_mac', ruijie_mac);
      
    if (mappingError) throw mappingError;

    // 2. Update topology_nodes: set linked_interface where it matches old_prefix
    // Note: We use case-insensitive check if possible, or exact match depending on DB config.
    // Assuming exact match since old_prefix was exactly what the UI displayed.
    const { error: topologyError } = await supabase
      .from('topology_nodes')
      .update({
        linked_interface: new_prefix,
        label: new_prefix
      })
      .eq('linked_interface', old_prefix);
      
    if (topologyError) throw topologyError;

    const { data: linkedNodes } = await supabase
      .from('topology_nodes')
      .select('*')
      .eq('linked_interface', new_prefix);
    for (const node of linkedNodes || []) {
      try {
        await autoLinkTopologyNode(supabase, node);
      } catch (linkErr) {
        console.warn('autoLink setelah ubah prefix:', linkErr.message);
      }
    }

    return NextResponse.json({ success: true, new_prefix });
  } catch (error) {
    console.error('Prefix Update Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
