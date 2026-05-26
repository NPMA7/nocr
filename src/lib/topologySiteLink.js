/**
 * Tautan topology_nodes.site_id ↔ sites / site_pics.
 * Vendor & PIC hanya disimpan di sites + site_pics; API topologi mengisi field virtual untuk UI.
 */

export function firstPicFromList(pics = []) {
  const sorted = [...pics].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const p = sorted.find((x) => x?.name?.trim());
  return p ? { name: p.name.trim(), phone: (p.phone || '').trim() || null } : { name: null, phone: null };
}

/** Ambil vendor/PIC dari payload node (UI) atau objek site terlampir */
export function siteFieldsFromTopologyNode(node) {
  const fromSite = node?.site;
  const picFromSite = fromSite?.pics?.[0];
  const pic = {
    name: (node?.pic_name || picFromSite?.name || '').trim() || null,
    phone: (node?.pic_phone || picFromSite?.phone || '').trim() || null,
  };
  return {
    vendor: (node?.vendor || fromSite?.vendor || '').trim() || null,
    latitude:
      fromSite?.latitude != null
        ? Number(fromSite.latitude)
        : node?.latitude != null
          ? Number(node.latitude)
          : null,
    longitude:
      fromSite?.longitude != null
        ? Number(fromSite.longitude)
        : node?.longitude != null
          ? Number(node.longitude)
          : null,
    pics: pic.name ? [{ name: pic.name, phone: pic.phone || '' }] : [],
  };
}

/** Field virtual untuk UI (tidak disimpan di topology_nodes) */
export function topologyFieldsFromSite(site, pics = []) {
  const first = firstPicFromList(pics);
  return {
    vendor: site?.vendor?.trim() || null,
    pic_name: first.name,
    pic_phone: first.phone,
  };
}

export async function findMappingByPrefix(supabase, prefix) {
  if (!prefix?.trim()) return null;
  const p = prefix.trim();
  const { data, error } = await supabase
    .from('device_mappings')
    .select('ruijie_mac, prefix')
    .ilike('prefix', p);
  if (error) throw error;
  const row = (data || []).find(
    (m) => m.prefix && m.prefix.trim().toLowerCase() === p.toLowerCase()
  );
  return row || null;
}

export async function findTopologyNodeForSite(supabase, site, mappingPrefix) {
  if (site?.topology_node_id) {
    const { data } = await supabase
      .from('topology_nodes')
      .select('*')
      .eq('id', site.topology_node_id)
      .maybeSingle();
    if (data) return data;
  }
  const prefix = mappingPrefix?.trim();
  if (!prefix) return null;
  const { data: nodes } = await supabase
    .from('topology_nodes')
    .select('*')
    .ilike('linked_interface', prefix);
  return (
    (nodes || []).find(
      (n) =>
        n.linked_interface &&
        n.linked_interface.trim().toLowerCase() === prefix.toLowerCase()
    ) || null
  );
}

export async function findSiteForTopologyNode(supabase, node) {
  if (node?.site_id) {
    const { data } = await supabase.from('sites').select('*').eq('id', node.site_id).maybeSingle();
    if (data) return data;
  }
  const mapping = await findMappingByPrefix(supabase, node?.linked_interface);
  if (!mapping) return null;
  const { data: site } = await supabase
    .from('sites')
    .select('*')
    .eq('ruijie_mac', mapping.ruijie_mac)
    .maybeSingle();
  return site || null;
}

export async function loadSitePics(supabase, siteId) {
  if (!siteId) return [];
  const { data, error } = await supabase
    .from('site_pics')
    .select('*')
    .eq('site_id', siteId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data || [];
}

/** Set site_id + topology_node_id (1:1 — lepaskan tautan lama yang bentrok) */
export async function bindTopologyNodeToSite(supabase, nodeId, siteId) {
  if (!nodeId || !siteId) return;

  await supabase
    .from('topology_nodes')
    .update({ site_id: null })
    .eq('site_id', siteId)
    .neq('id', nodeId);

  await supabase
    .from('sites')
    .update({ topology_node_id: null })
    .eq('topology_node_id', nodeId)
    .neq('id', siteId);

  await supabase.from('topology_nodes').update({ site_id: siteId }).eq('id', nodeId);
  await supabase.from('sites').update({ topology_node_id: nodeId }).eq('id', siteId);
}

/** Site → topology_nodes (hanya tautan site_id; vendor/PIC tetap di sites) */
export async function syncSiteToTopologyNode(supabase, site, pics, mappingPrefix) {
  const node = await findTopologyNodeForSite(supabase, site, mappingPrefix);
  if (!node) return null;

  await bindTopologyNodeToSite(supabase, node.id, site.id);
  const fields = topologyFieldsFromSite(site, pics);
  return { ...node, ...fields, site_id: site.id };
}

/** topology_nodes → sites + site_pics */
export async function syncTopologyNodeToSite(supabase, node) {
  const mapping = await findMappingByPrefix(supabase, node?.linked_interface);
  if (!mapping) return null;

  const fields = siteFieldsFromTopologyNode(node);
  let site = await findSiteForTopologyNode(supabase, node);

  const sitePayload = {
    ruijie_mac: mapping.ruijie_mac,
    connection_type: 'l2tp',
    latitude: node.latitude != null ? Number(node.latitude) : null,
    longitude: node.longitude != null ? Number(node.longitude) : null,
    topology_node_id: node.id,
    updated_at: new Date().toISOString(),
  };

  if (site?.id) {
    // Only update coords and link. Do not overwrite vendor/pics for existing sites 
    // to prevent accidental mass wipes from topology page.
    const { data: updated, error } = await supabase
      .from('sites')
      .update(sitePayload)
      .eq('id', site.id)
      .select()
      .single();
    if (error) throw error;
    site = updated;
  } else {
    // For new sites, insert with vendor
    sitePayload.vendor = fields.vendor;
    const { data: inserted, error } = await supabase
      .from('sites')
      .insert(sitePayload)
      .select()
      .single();
    if (error) throw error;
    site = inserted;

    // Only insert pics for completely new sites
    const validPics = fields.pics.map((p, i) => ({
      site_id: site.id,
      name: p.name,
      phone: p.phone || null,
      sort_order: i,
    }));
    if (validPics.length > 0) {
      const { error: picErr } = await supabase.from('site_pics').insert(validPics);
      if (picErr) throw picErr;
    }
  }

  await bindTopologyNodeToSite(supabase, node.id, site.id);
  return site;
}

/** Coba tautkan node ke site lewat prefix (linked_interface = prefix mapping) */
export async function autoLinkTopologyNode(supabase, node) {
  if (!node?.linked_interface?.trim()) return null;
  const mapping = await findMappingByPrefix(supabase, node.linked_interface);
  if (!mapping) return null;

  let { data: site } = await supabase
    .from('sites')
    .select('*')
    .eq('ruijie_mac', mapping.ruijie_mac)
    .maybeSingle();

  if (!site) {
    const fromNode = siteFieldsFromTopologyNode(node);
    const { data: inserted, error } = await supabase
      .from('sites')
      .insert({
        ruijie_mac: mapping.ruijie_mac,
        connection_type: 'l2tp',
        vendor: fromNode.vendor,
        latitude: fromNode.latitude,
        longitude: fromNode.longitude,
        topology_node_id: node.id,
      })
      .select()
      .single();
    if (error) throw error;
    site = inserted;

    if (fromNode.pics.length > 0) {
      await supabase.from('site_pics').insert(
        fromNode.pics.map((p, i) => ({
          site_id: site.id,
          name: p.name,
          phone: p.phone || null,
          sort_order: i,
        }))
      );
    }
  } else {
    await bindTopologyNodeToSite(supabase, node.id, site.id);
  }

  const pics = await loadSitePics(supabase, site.id);
  await syncSiteToTopologyNode(supabase, site, pics, mapping.prefix);
  return site;
}

/** Enrich node untuk response API: data sites + pic utama */
export async function enrichTopologyNodeWithSite(supabase, node) {
  if (!node) return node;
  let site = null;
  let pics = [];

  if (node.site_id) {
    const { data } = await supabase.from('sites').select('*').eq('id', node.site_id).maybeSingle();
    site = data;
  }
  if (!site) {
    site = await findSiteForTopologyNode(supabase, node);
  }
  if (site) {
    pics = await loadSitePics(supabase, site.id);
    const fields = topologyFieldsFromSite(site, pics);
    return {
      ...node,
      site_id: site.id,
      vendor: fields.vendor,
      pic_name: fields.pic_name,
      pic_phone: fields.pic_phone,
      site: {
        id: site.id,
        ruijie_mac: site.ruijie_mac,
        customer_id: site.customer_id,
        activation_date: site.activation_date,
        topology_node_id: site.topology_node_id,
        pics: pics.map((p) => ({ id: p.id, name: p.name, phone: p.phone, sort_order: p.sort_order })),
      },
    };
  }
  return { ...node, site: null };
}

export async function enrichTopologyNodes(supabase, nodes) {
  return Promise.all((nodes || []).map((n) => enrichTopologyNodeWithSite(supabase, n)));
}

/**
 * Versi batch dari enrichTopologyNodes — hanya 5-6 Supabase queries
 * untuk ratusan node (vs N×2 queries di versi lama).
 */
export async function enrichTopologyNodesBatch(supabase, nodes) {
  if (!nodes || nodes.length === 0) return [];

  // === Phase 1: Batch nodes yang sudah punya site_id ===
  const siteIds = [...new Set(nodes.filter((n) => n.site_id).map((n) => n.site_id))];

  let sitesById = {};
  let picsMap = {};

  if (siteIds.length > 0) {
    const [{ data: sitesData }, { data: picsData }] = await Promise.all([
      supabase.from('sites').select('*').in('id', siteIds),
      supabase
        .from('site_pics')
        .select('*')
        .in('site_id', siteIds)
        .order('sort_order', { ascending: true }),
    ]);
    for (const s of sitesData || []) sitesById[s.id] = s;
    for (const p of picsData || []) {
      if (!picsMap[p.site_id]) picsMap[p.site_id] = [];
      picsMap[p.site_id].push(p);
    }
  }

  // === Phase 2: Nodes tanpa site_id — lookup via linked_interface → device_mappings → sites ===
  const nodesNeedingLookup = nodes.filter((n) => !n.site_id && n.linked_interface?.trim());

  if (nodesNeedingLookup.length > 0) {
    // Fetch semua mappings (satu query), match prefix di memory
    const { data: allMappings } = await supabase
      .from('device_mappings')
      .select('ruijie_mac, prefix');

    const mappingsByPrefix = {};
    for (const m of allMappings || []) {
      if (m.prefix) mappingsByPrefix[m.prefix.trim().toLowerCase()] = m;
    }

    const nodeToMac = {};
    const macSet = new Set();
    for (const node of nodesNeedingLookup) {
      const mapping = mappingsByPrefix[node.linked_interface.trim().toLowerCase()];
      if (mapping) {
        nodeToMac[node.id] = mapping.ruijie_mac;
        macSet.add(mapping.ruijie_mac);
      }
    }

    if (macSet.size > 0) {
      const { data: extraSites } = await supabase
        .from('sites')
        .select('*')
        .in('ruijie_mac', [...macSet]);

      const siteByMac = {};
      const extraSiteIds = [];
      for (const s of extraSites || []) {
        siteByMac[s.ruijie_mac] = s;
        sitesById[s.id] = s;
        extraSiteIds.push(s.id);
      }

      if (extraSiteIds.length > 0) {
        const { data: extraPics } = await supabase
          .from('site_pics')
          .select('*')
          .in('site_id', extraSiteIds)
          .order('sort_order', { ascending: true });
        for (const p of extraPics || []) {
          if (!picsMap[p.site_id]) picsMap[p.site_id] = [];
          picsMap[p.site_id].push(p);
        }
      }

      // Map node → site via mac
      for (const node of nodesNeedingLookup) {
        const mac = nodeToMac[node.id];
        if (mac && siteByMac[mac] && !node.site_id) {
          // Patch site_id supaya Phase 3 bisa resolve
          node._resolvedSiteId = siteByMac[mac].id;
        }
      }
    }
  }

  // === Phase 3: Build enriched nodes di memory (tanpa query tambahan) ===
  return nodes.map((node) => {
    const siteId = node.site_id || node._resolvedSiteId;
    const site = siteId ? sitesById[siteId] : null;
    if (node._resolvedSiteId) delete node._resolvedSiteId; // cleanup temp field

    if (!site) return { ...node, site: null };

    const pics = picsMap[site.id] || [];
    const fields = topologyFieldsFromSite(site, pics);
    return {
      ...node,
      site_id: site.id,
      vendor: fields.vendor,
      pic_name: fields.pic_name,
      pic_phone: fields.pic_phone,
      site: {
        id: site.id,
        ruijie_mac: site.ruijie_mac,
        customer_id: site.customer_id,
        activation_date: site.activation_date,
        topology_node_id: site.topology_node_id,
        pics: pics.map((p) => ({ id: p.id, name: p.name, phone: p.phone, sort_order: p.sort_order })),
      },
    };
  });
}

export async function syncTopologyBatchToSites(supabase, nodes) {
  for (const node of nodes || []) {
    if (!node?.linked_interface?.trim() && !node?.site_id) continue;
    try {
      if (node.site_id || node.vendor || node.pic_name || node.pic_phone) {
        await syncTopologyNodeToSite(supabase, node);
      } else {
        await autoLinkTopologyNode(supabase, node);
      }
    } catch (e) {
      console.warn(`Sync topology→site gagal untuk node ${node.id}:`, e.message);
    }
  }
}

