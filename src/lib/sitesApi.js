/** Gabungkan device_mappings (L2TP) dengan sites + site_pics */

import {
  syncSiteToTopologyNode,
  autoLinkTopologyNode,
  findTopologyNodeForSite,
  loadSitePics,
} from '@/lib/topologySiteLink';

function mapSiteRow(site, pics = []) {
  if (!site) return null;
  return {
    id: site.id,
    ruijie_mac: site.ruijie_mac,
    connection_type: site.connection_type,
    vendor: site.vendor,
    customer_id: site.customer_id,
    activation_date: site.activation_date,
    full_address: site.full_address,
    latitude: site.latitude,
    longitude: site.longitude,
    coords_from_topology: site.coords_from_topology === true,
    topology_node_id: site.topology_node_id,
    pics: (pics || [])
      .filter((p) => p.site_id === site.id)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((p) => ({ id: p.id, name: p.name, phone: p.phone, sort_order: p.sort_order })),
  };
}

export function mergeMappingWithSite(mapping, site, pics = []) {
  const siteData = mapSiteRow(site, pics);
  return {
    ruijie_mac: mapping.ruijie_mac,
    prefix: mapping.prefix,
    ruijie_alias: mapping.ruijie_alias,
    mikrotik_alias: mapping.mikrotik_alias,
    status_ruijie: mapping.status_ruijie,
    status_mikrotik: mapping.status_mikrotik,
    final_status: mapping.final_status,
    issue: mapping.issue,
    is_manual: mapping.is_manual,
    is_prefix_manual: mapping.is_prefix_manual,
    offline_since: mapping.offline_since,
    site: siteData,
    has_site_profile: !!siteData,
  };
}

/** Koordinat tampilan: dari node topologi jika tertaut (sumber edit = Peta Topologi) */
export async function enrichSiteWithTopologyCoords(db, site) {
  if (!site) return site;
  if (site.topology_node_id) {
    const { data: node } = await db
      .from('topology_nodes')
      .select('latitude, longitude')
      .eq('id', site.topology_node_id)
      .maybeSingle();
    if (node) {
      return {
        ...site,
        latitude: node.latitude,
        longitude: node.longitude,
        coords_from_topology: true,
      };
    }
  }
  return { ...site, coords_from_topology: false };
}

export async function fetchSitesBundle(db, { ruijieMac = null } = {}) {
  let mappingsQuery = db.from('device_mappings').select('*');
  if (ruijieMac) mappingsQuery = mappingsQuery.eq('ruijie_mac', ruijieMac);

  const { data: mappings, error: mapErr } = await mappingsQuery;
  if (mapErr) throw mapErr;

  const macs = (mappings || []).map((m) => m.ruijie_mac);
  if (macs.length === 0) {
    return ruijieMac ? null : [];
  }

  const { data: sites, error: siteErr } = await db
    .from('sites')
    .select('*')
    .in('ruijie_mac', macs);
  if (siteErr) throw siteErr;

  const siteIds = (sites || []).map((s) => s.id);
  let pics = [];
  if (siteIds.length > 0) {
    const { data: picRows, error: picErr } = await db
      .from('site_pics')
      .select('*')
      .in('site_id', siteIds)
      .order('sort_order', { ascending: true });
    if (picErr) throw picErr;
    pics = picRows || [];
  }

  const siteByMac = Object.fromEntries((sites || []).map((s) => [s.ruijie_mac, s]));

  let merged = (mappings || []).map((m) =>
    mergeMappingWithSite(m, siteByMac[m.ruijie_mac], pics)
  );

  merged = await Promise.all(
    merged.map(async (row) => {
      const raw = siteByMac[row.ruijie_mac];
      if (!raw) return row;
      const enriched = await enrichSiteWithTopologyCoords(db, raw);
      return { ...row, site: mapSiteRow(enriched, pics) };
    })
  );

  if (ruijieMac) return merged[0] || null;
  return merged;
}

export async function upsertSiteProfile(db, ruijie_mac, payload) {
  const {
    vendor,
    customer_id,
    activation_date,
    full_address,
    pics = [],
    connection_type = 'l2tp',
  } = payload;

  const { data: mapping, error: mapCheck } = await db
    .from('device_mappings')
    .select('ruijie_mac, prefix')
    .eq('ruijie_mac', ruijie_mac)
    .maybeSingle();
  if (mapCheck) throw mapCheck;
  if (!mapping) {
    const err = new Error('Mapping L2TP tidak ditemukan untuk MAC ini');
    err.status = 404;
    throw err;
  }

  const siteRow = {
    ruijie_mac,
    connection_type,
    vendor: vendor?.trim() || null,
    customer_id: customer_id?.trim() || null,
    activation_date: activation_date || null,
    full_address: full_address?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await db
    .from('sites')
    .select('id')
    .eq('ruijie_mac', ruijie_mac)
    .maybeSingle();

  let siteId;
  if (existing?.id) {
    const { data: updated, error: updErr } = await db
      .from('sites')
      .update(siteRow)
      .eq('id', existing.id)
      .select()
      .single();
    if (updErr) throw updErr;
    siteId = updated.id;
  } else {
    const { data: inserted, error: insErr } = await db
      .from('sites')
      .insert(siteRow)
      .select()
      .single();
    if (insErr) throw insErr;
    siteId = inserted.id;
  }

  await db.from('site_pics').delete().eq('site_id', siteId);

  const validPics = (pics || [])
    .map((p, i) => ({
      site_id: siteId,
      name: (p.name || '').trim(),
      phone: (p.phone || '').trim() || null,
      sort_order: i,
    }))
    .filter((p) => p.name);

  if (validPics.length > 0) {
    const { error: picErr } = await db.from('site_pics').insert(validPics);
    if (picErr) throw picErr;
  }

  const { data: savedSite } = await db.from('sites').select('*').eq('id', siteId).single();
  const savedPics = await loadSitePics(db, siteId);

  await syncSiteToTopologyNode(db, savedSite, savedPics, mapping.prefix);

  let node = await findTopologyNodeForSite(db, savedSite, mapping.prefix);
  if (!node && mapping.prefix) {
    const { data: candidates } = await db
      .from('topology_nodes')
      .select('*')
      .ilike('linked_interface', mapping.prefix.trim());
    node =
      (candidates || []).find(
        (n) =>
          n.linked_interface &&
          n.linked_interface.trim().toLowerCase() === mapping.prefix.trim().toLowerCase()
      ) || null;
    if (node) await autoLinkTopologyNode(db, node);
  }

  return fetchSitesBundle(db, { ruijieMac: ruijie_mac });
}
