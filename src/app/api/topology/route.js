import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { verifyAuth, resolveAuth, enforceTopologyMutation } from '@/lib/auth';
import {
    mergeTopologySave,
    normalizeNode,
    normalizeEdge,
    computeRevision
} from '@/lib/topologyMerge';
import {
    enrichTopologyNodes,
    enrichTopologyNodesBatch,
    syncTopologyBatchToSites
} from '@/lib/topologySiteLink';

const sendError = (err, defaultStatus = 500) => {
    return NextResponse.json(
        { error: err.message || 'Kesalahan Server Internal', detail: err.detail },
        { status: err.status || defaultStatus }
    );
};

function nodeToRow(n) {
    const norm = normalizeNode(n);
    return {
        id: norm.id,
        device_id: norm.device_id,
        label: norm.label,
        latitude: norm.latitude,
        longitude: norm.longitude,
        type: norm.type,
        group_name: norm.group_name,
        status: norm.status,
        linked_interface: norm.linked_interface,
        site_id: norm.site_id || null,
        last_modified_at: norm.last_modified_at || new Date().toISOString(),
    };
}

function edgeToRow(e) {
    const norm = normalizeEdge(e);
    return {
        id: norm.id,
        from_node: norm.from_node,
        to_node: norm.to_node,
        label: norm.label,
        status: norm.status
    };
}

async function persistMergedTopology(merged, dbNodes, dbEdges) {
    const mergedNodeIds = new Set(merged.nodes.map((n) => n.id));
    const mergedEdgeIds = new Set(merged.edges.map((e) => e.id));

    const edgeIdsToDelete = dbEdges.filter((e) => !mergedEdgeIds.has(e.id)).map((e) => e.id);
    if (edgeIdsToDelete.length > 0) {
        const { error } = await supabase.from('topology_edges').delete().in('id', edgeIdsToDelete);
        if (error) throw error;
    }

    const nodeIdsToDelete = dbNodes.filter((n) => !mergedNodeIds.has(n.id)).map((n) => n.id);
    if (nodeIdsToDelete.length > 0) {
        const { error } = await supabase.from('topology_nodes').delete().in('id', nodeIdsToDelete);
        if (error) throw error;
    }

    if (merged.nodes.length > 0) {
        const { error: nodeErr } = await supabase
            .from('topology_nodes')
            .upsert(merged.nodes.map(nodeToRow), { onConflict: 'id' });
        if (nodeErr) throw nodeErr;
    }

    if (merged.edges.length > 0) {
        const { error: edgeErr } = await supabase
            .from('topology_edges')
            .upsert(merged.edges.map(edgeToRow), { onConflict: 'id' });
        if (edgeErr) throw edgeErr;
    }
}

let cachedTopology = null;
let lastTopologyFetchTime = 0;
const TOPOLOGY_CACHE_TTL = 15000; // 15 seconds

export async function GET(req) {
    try {
        verifyAuth(req);

        const now = Date.now();
        if (cachedTopology && now - lastTopologyFetchTime < TOPOLOGY_CACHE_TTL) {
            return NextResponse.json(cachedTopology);
        }

        const { data: nodesData, error: nodesError } = await supabase
            .from('topology_nodes')
            .select('*');
        if (nodesError) throw nodesError;

        const { data: edgesData, error: edgesError } = await supabase
            .from('topology_edges')
            .select('*');
        if (edgesError) throw edgesError;

        // Batch enrichment: 5-6 queries total (vs N×2 queries sebelumnya)
        const nodes = await enrichTopologyNodesBatch(supabase, nodesData || []);
        const edges = edgesData || [];

        const responseData = {
            nodes,
            edges,
            revision: computeRevision(nodes, edges)
        };

        cachedTopology = responseData;
        lastTopologyFetchTime = now;

        return NextResponse.json(responseData);
    } catch (err) {
        return sendError(err);
    }
}

export async function POST(req) {
    try {
        const user = await resolveAuth(req);
        enforceTopologyMutation(user);

        const body = await req.json();
        const {
            nodes: upsertNodes = [],
            edges: upsertEdges = [],
            deletedNodeIds = [],
            deletedEdgeIds = [],
            baseRevision = null
        } = body;

        const { data: dbNodes, error: nodesFetchErr } = await supabase
            .from('topology_nodes')
            .select('*');
        if (nodesFetchErr) throw nodesFetchErr;

        const { data: dbEdges, error: edgesFetchErr } = await supabase
            .from('topology_edges')
            .select('*');
        if (edgesFetchErr) throw edgesFetchErr;

        const oldNodes = dbNodes || [];
        const oldEdges = dbEdges || [];
        const currentRevision = computeRevision(oldNodes, oldEdges);

        // Empty save after refresh cannot wipe DB when another user may be editing
        const isNoOpSave =
            upsertNodes.length === 0 &&
            upsertEdges.length === 0 &&
            deletedNodeIds.length === 0 &&
            deletedEdgeIds.length === 0;

        if (isNoOpSave) {
            return NextResponse.json({
                success: true,
                message: 'No topology changes to save',
                nodes: oldNodes,
                edges: oldEdges,
                revision: currentRevision
            });
        }

        // Reject mass-delete from stale session (e.g. refresh mismatch)
        if (deletedNodeIds.length > 0 && deletedNodeIds.length >= oldNodes.length && upsertNodes.length === 0) {
            return NextResponse.json(
                { error: 'Penyimpanan ditolak: terlalu banyak penghapusan sekaligus. Muat ulang halaman lalu coba lagi.' },
                { status: 409 }
            );
        }

        if (baseRevision && baseRevision !== currentRevision) {
            console.warn(
                `Topology save revision drift (client ${baseRevision}, server ${currentRevision}) — merge delta tetap dilanjutkan`
            );
        }

        const merged = mergeTopologySave({
            dbNodes: oldNodes,
            dbEdges: oldEdges,
            upsertNodes,
            upsertEdges,
            deletedNodeIds,
            deletedEdgeIds
        });

        // --- Conflict Detection per-node ---
        // Node dianggap konflik jika last_modified_at di DB lebih baru dari yang dikirim client
        const dbNodeMap = new Map(oldNodes.map((n) => [n.id, n]));
        const conflicts = [];
        const safeUpsertNodes = [];

        for (const clientNode of upsertNodes) {
            const dbNode = dbNodeMap.get(clientNode.id);
            if (!dbNode) {
                // Node baru, tidak ada konflik
                safeUpsertNodes.push(clientNode);
                continue;
            }
            const dbTs = dbNode.last_modified_at ? new Date(dbNode.last_modified_at).getTime() : 0;
            const clientTs = clientNode.last_modified_at ? new Date(clientNode.last_modified_at).getTime() : 0;
            // Jika DB punya timestamp yang lebih baru dari versi client → konflik
            if (dbTs > 0 && clientTs > 0 && dbTs > clientTs) {
                conflicts.push({
                    id: clientNode.id,
                    label: clientNode.label || dbNode.label,
                    clientVersion: clientNode,
                    dbVersion: dbNode,
                });
            } else {
                safeUpsertNodes.push(clientNode);
            }
        }

        // Stamp last_modified_at pada node yang aman sebelum disimpan
        const now = new Date().toISOString();
        const stampedUpsertNodes = safeUpsertNodes.map((n) => ({ ...n, last_modified_at: now }));

        // Merge hanya dengan node yang tidak konflik
        const mergedSafe = mergeTopologySave({
            dbNodes: oldNodes,
            dbEdges: oldEdges,
            upsertNodes: stampedUpsertNodes,
            upsertEdges,
            deletedNodeIds,
            deletedEdgeIds
        });

        await persistMergedTopology(mergedSafe, oldNodes, oldEdges);

        // Sync hanya node yang benar-benar berubah (bukan semua node!)
        await syncTopologyBatchToSites(supabase, stampedUpsertNodes);

        // Batch enrichment: 5-6 queries total untuk semua node
        const enrichedNodes = await enrichTopologyNodesBatch(supabase, mergedSafe.nodes);
        const revision = computeRevision(enrichedNodes, mergedSafe.edges);

        if (global.io) {
            global.io.emit('topology_updated', {
                nodes: enrichedNodes,
                edges: mergedSafe.edges,
                revision
            });
            global.io.emit('dashboard_topology_refresh');
        }

        if (global.addActivityLog) {
            const newNodes = mergedSafe.nodes;
            const oldNodeIds = new Set(oldNodes.map((n) => n.id));
            const newNodeIds = new Set(newNodes.map((n) => n.id));

            const addedNodes = newNodes.filter((n) => !oldNodeIds.has(n.id));
            const deletedNodes = oldNodes.filter((n) => !newNodeIds.has(n.id));

            let hasNodeChanges = false;

            for (const n of addedNodes) {
                hasNodeChanges = true;
                if (n.type === 'client' || n.type === 'pppoe-client') {
                    global.addActivityLog(`Pelanggan baru ditambahkan ke peta topologi: ${n.label}`);
                } else {
                    const nodeTypeUpper = (n.type || 'odp').toUpperCase();
                    global.addActivityLog(`Node topologi ditambahkan: ${n.label} (${nodeTypeUpper})`);
                }
            }

            for (const n of deletedNodes) {
                hasNodeChanges = true;
                if (n.type === 'client' || n.type === 'pppoe-client') {
                    global.addActivityLog(`Pelanggan dihapus dari peta topologi: ${n.label}`);
                } else {
                    global.addActivityLog(`Node topologi dihapus: ${n.label}`);
                }
            }

            if (!hasNodeChanges && oldNodes.length > 0 && newNodes.length > 0) {
                let coordinatesChanged = false;
                for (const n of newNodes) {
                    const oldN = oldNodes.find((o) => o.id === n.id);
                    if (oldN) {
                        const newLat = parseFloat(n.latitude || 0);
                        const newLng = parseFloat(n.longitude || 0);
                        const oldLat = parseFloat(oldN.latitude || 0);
                        const oldLng = parseFloat(oldN.longitude || 0);
                        if (Math.abs(newLat - oldLat) > 0.00001 || Math.abs(newLng - oldLng) > 0.00001) {
                            coordinatesChanged = true;
                            break;
                        }
                    }
                }
                if (coordinatesChanged) {
                    global.addActivityLog('Tata letak topologi jaringan diperbarui');
                }
            }
        }

        // Invalidate cache
        lastTopologyFetchTime = 0;

        return NextResponse.json({
            success: true,
            message: 'Topology saved successfully',
            nodes: enrichedNodes,
            edges: mergedSafe.edges,
            revision,
            conflicts,
        });
    } catch (err) {
        console.error('Error saving topology:', err);
        return sendError(err);
    }
}
