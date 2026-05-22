import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { verifyAuth, resolveAuth, enforceTopologyMutation } from '@/lib/auth';
import {
    mergeTopologySave,
    normalizeNode,
    normalizeEdge,
    computeRevision
} from '@/lib/topologyMerge';

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
        vendor: norm.vendor,
        pic_name: norm.pic_name,
        pic_phone: norm.pic_phone
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

export async function GET(req) {
    try {
        verifyAuth(req);

        const { data: nodesData, error: nodesError } = await supabase
            .from('topology_nodes')
            .select('*');
        if (nodesError) throw nodesError;

        const { data: edgesData, error: edgesError } = await supabase
            .from('topology_edges')
            .select('*');
        if (edgesError) throw edgesError;

        const nodes = nodesData || [];
        const edges = edgesData || [];

        return NextResponse.json({
            nodes,
            edges,
            revision: computeRevision(nodes, edges)
        });
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

        await persistMergedTopology(merged, oldNodes, oldEdges);

        const revision = computeRevision(merged.nodes, merged.edges);

        if (global.io) {
            global.io.emit('topology_updated', {
                nodes: merged.nodes,
                edges: merged.edges,
                revision
            });
            global.io.emit('dashboard_topology_refresh');
        }

        if (global.addActivityLog) {
            const newNodes = merged.nodes;
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

        return NextResponse.json({
            success: true,
            message: 'Topology saved successfully',
            nodes: merged.nodes,
            edges: merged.edges,
            revision
        });
    } catch (err) {
        console.error('Error saving topology:', err);
        return sendError(err);
    }
}
