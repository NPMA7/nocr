/** Shared merge helpers for collaborative topology editing */

const NODE_COMPARE_KEYS = [
  'label', 'latitude', 'longitude', 'type', 'device_id', 'status',
  'linked_interface', 'vendor', 'pic_name', 'pic_phone', 'group_name', 'site_id'
];

const EDGE_COMPARE_KEYS = ['from_node', 'to_node', 'label', 'status'];

export function normalizeNode(n) {
  return {
    id: n.id,
    device_id: n.device_id || null,
    label: n.label,
    latitude: parseFloat(n.latitude ?? n.lat ?? 0),
    longitude: parseFloat(n.longitude ?? n.lng ?? 0),
    type: n.type || 'odp',
    group_name: n.group_name || 'unknown',
    status: n.status || 'unknown',
    linked_interface: n.linked_interface || null,
    vendor: n.vendor || null,
    pic_name: n.pic_name || null,
    pic_phone: n.pic_phone || null,
    site_id: n.site_id || null
  };
}

export function normalizeEdge(e) {
  return {
    id: e.id,
    from_node: e.from_node || e.from,
    to_node: e.to_node || e.to,
    label: e.label || '',
    status: e.status || 'up'
  };
}

export function buildBaselineMap(items) {
  const map = {};
  for (const item of items || []) {
    if (item?.id) map[item.id] = item;
  }
  return map;
}

export function isNodeDirty(node, baseline) {
  if (!baseline) return true;
  const n = normalizeNode(node);
  const b = normalizeNode(baseline);
  return NODE_COMPARE_KEYS.some((k) => n[k] !== b[k]);
}

export function isEdgeDirty(edge, baseline) {
  if (!baseline) return true;
  const e = normalizeEdge(edge);
  const b = normalizeEdge(baseline);
  return EDGE_COMPARE_KEYS.some((k) => e[k] !== b[k]);
}

/** Nodes/edges changed since last load or sync (sent on save, not the full stale map). */
export function getDeltaNodes(currentNodes, baselineMap) {
  return (currentNodes || []).filter((n) => isNodeDirty(n, baselineMap[n.id]));
}

export function getDeltaEdges(currentEdges, baselineMap) {
  return (currentEdges || []).filter((e) => isEdgeDirty(e, baselineMap[e.id]));
}

/**
 * Merge client delta into current database state.
 * Unchanged stale nodes on the client are NOT sent, so they are not resurrected.
 */
export function mergeTopologySave({
  dbNodes = [],
  dbEdges = [],
  upsertNodes = [],
  upsertEdges = [],
  deletedNodeIds = [],
  deletedEdgeIds = []
}) {
  const nodeMap = new Map(dbNodes.map((n) => [n.id, { ...n }]));
  const edgeMap = new Map(dbEdges.map((e) => [e.id, { ...e }]));

  for (const id of deletedNodeIds) {
    nodeMap.delete(id);
    for (const [eid, edge] of edgeMap) {
      const from = edge.from_node || edge.from;
      const to = edge.to_node || edge.to;
      if (from === id || to === id) edgeMap.delete(eid);
    }
  }

  for (const id of deletedEdgeIds) {
    edgeMap.delete(id);
  }

  for (const raw of upsertNodes) {
    const n = normalizeNode(raw);
    nodeMap.set(n.id, { ...nodeMap.get(n.id), ...raw, ...n });
  }

  for (const raw of upsertEdges) {
    const e = normalizeEdge(raw);
    edgeMap.set(e.id, { ...edgeMap.get(e.id), ...raw, ...e });
  }

  return {
    nodes: Array.from(nodeMap.values()),
    edges: Array.from(edgeMap.values())
  };
}

const toIdSet = (ids) => {
  if (!ids) return new Set();
  if (ids instanceof Set) return ids;
  return new Set(ids);
};

/**
 * Merge server state into local editor without overwriting in-progress edits.
 * protected*Ids: explicit session edits (drag, label, new node, etc.)
 * pendingDeleted*Ids: local deletes not yet saved — never resurrect from remote
 */
export function mergeRemoteIntoLocal({
  localNodes = [],
  localEdges = [],
  remoteNodes = [],
  remoteEdges = [],
  baselineNodeMap = {},
  baselineEdgeMap = {},
  protectedNodeIds = [],
  protectedEdgeIds = [],
  pendingDeletedNodeIds = [],
  pendingDeletedEdgeIds = []
}) {
  const protectedNodes = toIdSet(protectedNodeIds);
  const protectedEdges = toIdSet(protectedEdgeIds);
  const pendingDeletedNodes = toIdSet(pendingDeletedNodeIds);
  const pendingDeletedEdges = toIdSet(pendingDeletedEdgeIds);

  const nodeById = buildBaselineMap(localNodes);
  const edgeById = buildBaselineMap(localEdges);
  const remoteNodeById = buildBaselineMap(remoteNodes);
  const remoteEdgeById = buildBaselineMap(remoteEdges);

  for (const [id, remote] of Object.entries(remoteNodeById)) {
    if (pendingDeletedNodes.has(id)) continue;
    if (protectedNodes.has(id)) continue;

    const local = nodeById[id];
    if (!local) {
      nodeById[id] = remote;
      continue;
    }
    if (isNodeDirty(local, baselineNodeMap[id])) continue;
    nodeById[id] = remote;
  }

  for (const id of Object.keys(baselineNodeMap)) {
    if (!remoteNodeById[id]) {
      if (pendingDeletedNodes.has(id)) {
        delete nodeById[id];
        continue;
      }
      const local = nodeById[id];
      if (local && !isNodeDirty(local, baselineNodeMap[id]) && !protectedNodes.has(id)) {
        delete nodeById[id];
      }
    }
  }

  for (const [id, remote] of Object.entries(remoteEdgeById)) {
    if (pendingDeletedEdges.has(id)) continue;
    if (protectedEdges.has(id)) continue;

    const local = edgeById[id];
    if (!local) {
      edgeById[id] = remote;
      continue;
    }
    if (isEdgeDirty(local, baselineEdgeMap[id])) continue;
    edgeById[id] = remote;
  }

  for (const id of Object.keys(baselineEdgeMap)) {
    if (!remoteEdgeById[id]) {
      if (pendingDeletedEdges.has(id)) {
        delete edgeById[id];
        continue;
      }
      const local = edgeById[id];
      if (local && !isEdgeDirty(local, baselineEdgeMap[id]) && !protectedEdges.has(id)) {
        delete edgeById[id];
      }
    }
  }

  return {
    nodes: Object.values(nodeById),
    edges: Object.values(edgeById)
  };
}

/** Update baseline after remote merge without clearing pending local edits/deletes. */
export function syncBaselineAfterMerge(mergedNodes, mergedEdges, prevNodeBaseline, prevEdgeBaseline, protectedNodeIds, protectedEdgeIds) {
  const protectedNodes = toIdSet(protectedNodeIds);
  const protectedEdges = toIdSet(protectedEdgeIds);
  const nodeBaseline = { ...prevNodeBaseline };
  const edgeBaseline = { ...prevEdgeBaseline };

  const mergedNodeIds = new Set((mergedNodes || []).map((n) => n.id));
  const mergedEdgeIds = new Set((mergedEdges || []).map((e) => e.id));

  for (const n of mergedNodes || []) {
    if (!protectedNodes.has(n.id)) nodeBaseline[n.id] = n;
  }
  for (const id of Object.keys(nodeBaseline)) {
    if (!mergedNodeIds.has(id) && !protectedNodes.has(id)) delete nodeBaseline[id];
  }

  for (const e of mergedEdges || []) {
    if (!protectedEdges.has(e.id)) edgeBaseline[e.id] = e;
  }
  for (const id of Object.keys(edgeBaseline)) {
    if (!mergedEdgeIds.has(id) && !protectedEdges.has(id)) delete edgeBaseline[id];
  }

  return { nodeBaseline, edgeBaseline };
}

export function computeRevision(nodes, edges) {
  const sig = [...(nodes || []).map((n) => n.id), ...(edges || []).map((e) => e.id)].sort().join('|');
  return `${(nodes || []).length}-${(edges || []).length}-${sig.length}`;
}
