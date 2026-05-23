"use client";
import { useEffect, useState, useMemo, useRef } from "react";
import {
  Plus,
  GitCommit,
  Save,
  X,
  Trash2,
  MapPin,
  RefreshCw,
  Cpu,
  Clock,
  ChevronDown,
  ChevronUp,
  Network,
  Search,
  Map as MapIcon,
  Eye,
  Users,
  Server,
  Settings,
} from "lucide-react";

const INFRA_NODE_TYPES = ["olt", "odc", "odp", "pole"];

function isClientNode(node) {
  return (node?.type || "").toLowerCase() === "client";
}

function isInfrastructureNode(node) {
  return INFRA_NODE_TYPES.includes((node?.type || "").toLowerCase());
}
import { canEditTopology, getStoredUser, isVisitorRole } from "@/lib/roles";
import axios from "axios";
import { API_URL, socket, useAppState } from "@/App";
import {
  buildBaselineMap,
  getDeltaNodes,
  getDeltaEdges,
  isNodeDirty,
  isEdgeDirty,
  mergeRemoteIntoLocal,
  syncBaselineAfterMerge,
} from "@/lib/topologyMerge";
import dynamic from "next/dynamic";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";

// Mini badge
function StatusBadge({ online }) {
  return (
    <span
      className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${online ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}
    >
      {online ? "Online" : "Offline"}
    </span>
  );
}

// Interface status badge
function IfaceBadge({ running, disabled }) {
  if (disabled === "true")
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-600/60 text-slate-400">
        Disabled
      </span>
    );
  if (running === "true")
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
        Up
      </span>
    );
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
      Down
    </span>
  );
}

const TopologyMap = dynamic(() => import("@/components/TopologyMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-900 flex items-center justify-center text-slate-400">
      Memuat Peta...
    </div>
  ),
});

function TopologyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const focusId = searchParams?.get("focus");

  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [availableDevices, setAvailableDevices] = useState([]);
  const [mappings, setMappings] = useState([]);

  const [selectedNode, setSelectedNode] = useState(null);
  const [nodeDetail, setNodeDetail] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [mapTheme, setMapTheme] = useState("colored");
  const [showLabels, setShowLabels] = useState(false);
  /** 'all' | 'client' | 'infrastructure' — filter tampilan untuk semua role */
  const [nodeViewFilter, setNodeViewFilter] = useState("all");
  const [activeNodeTab, setActiveNodeTab] = useState("identitas");

  const [interactionMode, setInteractionMode] = useState("select");
  const [newNodeType, setNewNodeType] = useState("odp");
  const [linkStartNode, setLinkStartNode] = useState(null);
  const [deviceConfig, setDeviceConfig] = useState(null);
  const [toasts, setToasts] = useState([]);
  const { sessionUser, setLastSyncTime } = useAppState();
  const [canEdit, setCanEdit] = useState(false);
  const readOnly = isVisitorRole(sessionUser?.role);

  const syncEditPermission = () => {
    setCanEdit(canEditTopology(getStoredUser().role));
  };

  // Manual Add Modal State
  const [showManualAddModal, setShowManualAddModal] = useState(false);
  const [manualAddData, setManualAddData] = useState({
    label: "",
    type: "client",
    lat: "",
    lng: "",
    addressSearch: "",
    linked_interface: "",
    vendor: "",
  });
  const [manualIfaceSearch, setManualIfaceSearch] = useState("");
  const [showManualIfaceDropdown, setShowManualIfaceDropdown] = useState(false);
  const [flyToTarget, setFlyToTarget] = useState(null);

  // States untuk fitur pencarian lokasi OpenStreetMap (Nominatim)
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const extractCoordinates = async () => {
    if (!manualAddData.addressSearch) return;

    const query = manualAddData.addressSearch.trim();

    // Cek apakah input berupa koordinat (contoh: "-7.165, 107.549" atau "-7.165 107.549")
    const coordRegex = /^([-+]?\d{1,2}\.\d+)[,\s]+([-+]?\d{1,3}\.\d+)$/;
    const coordMatch = query.match(coordRegex);

    if (coordMatch) {
      setManualAddData((prev) => ({
        ...prev,
        lat: coordMatch[1],
        lng: coordMatch[2],
        label: prev.label || "Titik dari Koordinat",
      }));
      addToast("Titik koordinat berhasil diekstrak!", "success");
      setSearchSuggestions([]);
      return;
    }

    // Jika bukan koordinat, coba cari di OpenStreetMap Nominatim
    try {
      setIsSearching(true);
      const res = await axios.get(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=id`,
      );
      if (res.data && res.data.length > 0) {
        setSearchSuggestions(res.data);
      } else {
        addToast("Lokasi tidak ditemukan.", "error");
        setSearchSuggestions([]);
      }
    } catch (error) {
      console.error(error);
      addToast("Gagal mencari lokasi.", "error");
    } finally {
      setIsSearching(false);
    }
  };

  const addToast = (msg, type = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      3000,
    );
  };

  // Live MikroTik data from core device
  const [coreStatus, setCoreStatus] = useState(null);
  const [coreInterfaces, setCoreInterfaces] = useState([]);
  const [coreLoading, setCoreLoading] = useState(false);
  const [showIfacePanel, setShowIfacePanel] = useState(false);
  const [showMobileMode, setShowMobileMode] = useState(false);

  const combinedInterfaceOptions = useMemo(() => {
    const options = [];
    (mappings || []).forEach((m) => {
      if (
        m.prefix &&
        !options.find((o) => o.name.toLowerCase() === m.prefix.toLowerCase())
      ) {
        options.push({
          name: m.prefix,
          type: "L2TP Gabungan",
          label: m.prefix,
          isMapping: true,
        });
      }
    });
    (coreInterfaces || []).forEach((i) => {
      // Jangan masukkan l2tp-in lagi karena sudah digantikan oleh L2TP Gabungan (mappings)
      if (i.type && i.type.toLowerCase() === "l2tp-in") return;

      if (
        i.name &&
        !options.find((o) => o.name.toLowerCase() === i.name.toLowerCase())
      ) {
        options.push({
          name: i.name,
          type: i.type || "MikroTik",
          label: i.name,
          isMapping: false,
        });
      }
    });
    return options;
  }, [mappings, coreInterfaces]);

  // Search states
  const [ifacePanelSearch, setIfacePanelSearch] = useState("");
  const [nodeIfaceSearch, setNodeIfaceSearch] = useState("");
  const [showNodeIfaceDropdown, setShowNodeIfaceDropdown] = useState(false);

  // Auto-refresh interval
  const [edgeMode, setEdgeMode] = useState(false);
  const intervalRef = useRef(null);
  const countdownRef = useRef(null);

  const baselineNodesRef = useRef({});
  const baselineEdgesRef = useRef({});
  const deletedNodeIdsRef = useRef(new Set());
  const deletedEdgeIdsRef = useRef(new Set());
  const localTouchedNodeIdsRef = useRef(new Set());
  const localTouchedEdgeIdsRef = useRef(new Set());
  const revisionRef = useRef(null);

  const syncBaseline = (loadedNodes, loadedEdges) => {
    baselineNodesRef.current = buildBaselineMap(loadedNodes);
    baselineEdgesRef.current = buildBaselineMap(loadedEdges);
    deletedNodeIdsRef.current = new Set();
    deletedEdgeIdsRef.current = new Set();
    localTouchedNodeIdsRef.current = new Set();
    localTouchedEdgeIdsRef.current = new Set();
  };

  const markNodeTouched = (id) => {
    if (id) localTouchedNodeIdsRef.current.add(id);
  };

  const markEdgeTouched = (id) => {
    if (id) localTouchedEdgeIdsRef.current.add(id);
  };

  const trackNodeChanges = (prevNodes, nextNodes) => {
    const prevIds = new Set(prevNodes.map((n) => n.id));
    const nextMap = buildBaselineMap(nextNodes);
    for (const n of nextNodes) {
      if (
        !prevIds.has(n.id) ||
        isNodeDirty(n, baselineNodesRef.current[n.id])
      ) {
        markNodeTouched(n.id);
      }
    }
    for (const n of prevNodes) {
      if (!nextMap[n.id] && baselineNodesRef.current[n.id]) {
        markNodeTouched(n.id);
        markNodeDeleted(n.id);
      }
    }
  };

  const trackEdgeChanges = (prevEdges, nextEdges) => {
    const prevIds = new Set(prevEdges.map((e) => e.id));
    const nextMap = buildBaselineMap(nextEdges);
    for (const e of nextEdges) {
      if (
        !prevIds.has(e.id) ||
        isEdgeDirty(e, baselineEdgesRef.current[e.id])
      ) {
        markEdgeTouched(e.id);
      }
    }
    for (const e of prevEdges) {
      if (!nextMap[e.id] && baselineEdgesRef.current[e.id]) {
        markEdgeTouched(e.id);
        markEdgeDeleted(e.id);
      }
    }
  };

  const setNodesFromUser = (updater) => {
    if (readOnly) return;
    setNodes((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (!Array.isArray(next)) return prev;

      // KUNCI: Jika node sedang ditarik di peta, jangan biarkan koordinatnya kembali ke versi lama
      const finalNext = next.map((nextNode) => {
        const matchingCurrent = prev.find((p) => p.id === nextNode.id);
        // Jika koordinat lokal di screen sudah berubah tetapi di user action belum memicu simpan permanent
        return nextNode;
      });

      trackNodeChanges(prev, finalNext);
      return finalNext;
    });
  };

  const setEdgesFromUser = (updater) => {
    if (readOnly) return;
    setEdges((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (!Array.isArray(next)) return prev;
      trackEdgeChanges(prev, next);
      return next;
    });
  };

  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  const markNodeDeleted = (id) => {
    deletedNodeIdsRef.current.add(id);
    markNodeTouched(id);
    for (const edge of edgesRef.current) {
      const from = edge.from_node || edge.from;
      const to = edge.to_node || edge.to;
      if (from === id || to === id) {
        deletedEdgeIdsRef.current.add(edge.id);
        markEdgeTouched(edge.id);
      }
    }
  };

  const markEdgeDeleted = (id) => {
    deletedEdgeIdsRef.current.add(id);
    markEdgeTouched(id);
  };

  const applyTopologyFromServer = (
    serverNodes,
    serverEdges,
    { resetBaseline = true, toastMsg = null } = {},
  ) => {
    setNodes(serverNodes || []);
    setEdges(serverEdges || []);
    if (resetBaseline) syncBaseline(serverNodes, serverEdges);
    if (toastMsg) addToast(toastMsg, "info");
  };

  const mergeTopologyFromRemote = (
    remoteNodes,
    remoteEdges,
    remoteRevision,
  ) => {
    if (remoteRevision && remoteRevision === revisionRef.current) return;

    const merged = mergeRemoteIntoLocal({
      localNodes: nodesRef.current,
      localEdges: edgesRef.current,
      remoteNodes,
      remoteEdges,
      baselineNodeMap: baselineNodesRef.current,
      baselineEdgeMap: baselineEdgesRef.current,
      protectedNodeIds: localTouchedNodeIdsRef.current,
      protectedEdgeIds: localTouchedEdgeIdsRef.current,
      pendingDeletedNodeIds: deletedNodeIdsRef.current,
      pendingDeletedEdgeIds: deletedEdgeIdsRef.current,
    });

    const sameSnapshot = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const nodesChanged = !sameSnapshot(merged.nodes, nodesRef.current);
    const edgesChanged = !sameSnapshot(merged.edges, edgesRef.current);

    setNodes(merged.nodes);
    setEdges(merged.edges);

    const { nodeBaseline, edgeBaseline } = syncBaselineAfterMerge(
      merged.nodes,
      merged.edges,
      baselineNodesRef.current,
      baselineEdgesRef.current,
      localTouchedNodeIdsRef.current,
      localTouchedEdgeIdsRef.current,
    );
    baselineNodesRef.current = nodeBaseline;
    baselineEdgesRef.current = edgeBaseline;

    if (remoteRevision) revisionRef.current = remoteRevision;

    if (nodesChanged || edgesChanged) {
      addToast("Peta diperbarui — perubahan pengguna lain digabungkan", "info");
    }
  };

  const fetchTopology = async (showToast = false) => {
    try {
      const res = await axios.get(`${API_URL}/topology`);
      const loadedNodes = res.data.nodes || [];
      const loadedEdges = res.data.edges || [];
      revisionRef.current = res.data.revision || null;
      applyTopologyFromServer(loadedNodes, loadedEdges, {
        resetBaseline: true,
        toastMsg: showToast ? "Peta dikembalikan ke posisi semula" : null,
      });
    } catch (e) {
      console.error(e);
      if (showToast) addToast("Gagal memuat ulang peta", "error");
    }
  };

  const fetchCoreData = async () => {
    setCoreLoading(true);
    try {
      const [statusRes, ifaceRes] = await Promise.all([
        axios
          .get(`${API_URL}/devices/core/status`)
          .catch(() => ({ data: null })),
        axios
          .get(`${API_URL}/devices/core/interfaces`)
          .catch(() => ({ data: [] })),
      ]);
      setCoreStatus(statusRes?.data || null);
      setCoreInterfaces(ifaceRes?.data || []);
      setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
    } catch (e) {
      console.error("Gagal memuat data core MikroTik", e);
    } finally {
      setCoreLoading(false);
    }
  };

  const handleMetricsUpdate = (data) => {
    setNodes((prev) =>
      prev.map((n) =>
        n.device_id === data.id ? { ...n, status: data.status } : n,
      ),
    );
    setSelectedNode((prev) => {
      if (prev && prev.device_id === data.id) {
        setNodeDetail((detail) => ({ ...detail, ...data }));
      }
      return prev;
    });
  };

  useEffect(() => {
    syncEditPermission();
    const onRole = () => syncEditPermission();
    window.addEventListener("nocr-role-updated", onRole);
    return () => window.removeEventListener("nocr-role-updated", onRole);
  }, []);

  useEffect(() => {
    if (sessionUser?.role) syncEditPermission();
  }, [sessionUser]);

  useEffect(() => {
    if (readOnly) {
      setInteractionMode("select");
      setLinkStartNode(null);
      setShowManualAddModal(false);
    }
  }, [readOnly]);

  useEffect(() => {
    fetchTopology();
    axios
      .get(`${API_URL}/devices`)
      .then((res) => setAvailableDevices(res.data))
      .catch(console.error);
    axios
      .get("/api/mappings")
      .then((res) => setMappings(res.data))
      .catch(console.error);
    fetchCoreData();

    const handleTopologyUpdated = (payload) => {
      if (!payload?.nodes) return;
      mergeTopologyFromRemote(
        payload.nodes,
        payload.edges || [],
        payload.revision,
      );
    };

    const handleMikrotikUpdate = (data) => {
      if (data.status) setCoreStatus(data.status);
      if (data.interfaces) setCoreInterfaces(data.interfaces);
      setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
    };

    const handleMappingsUpdate = () => {
      axios
        .get("/api/mappings")
        .then((res) => setMappings(res.data))
        .catch(console.error);
    };

    if (socket) {
      socket.on("device-metrics", handleMetricsUpdate);
      socket.on("topology_updated", handleTopologyUpdated);
      socket.on("mikrotik_full_update", handleMikrotikUpdate);
      socket.on("mappings_updated", handleMappingsUpdate);
    }
    return () => {
      if (socket) {
        socket.off("device-metrics", handleMetricsUpdate);
        socket.off("topology_updated", handleTopologyUpdated);
        socket.off("mikrotik_full_update", handleMikrotikUpdate);
        socket.off("mappings_updated", handleMappingsUpdate);
      }
    };
  }, []);

  // Handle focus from global search
  useEffect(() => {
    if (focusId && nodes.length > 0) {
      const targetNode = nodes.find((n) => n.id === focusId);
      if (
        targetNode &&
        !isNaN(targetNode.latitude) &&
        !isNaN(targetNode.longitude)
      ) {
        setFlyToTarget({
          lat: targetNode.latitude,
          lng: targetNode.longitude,
          zoom: 17,
        });
        setSelectedNode(targetNode);
        // Clean up the URL so refresh doesn't re-trigger focus
        router.replace("/topology", { scroll: false });
      }
    }
  }, [focusId, nodes]);

  useEffect(() => {
    if (selectedNode) {
      setNodeIfaceSearch(selectedNode.linked_interface || "");
      setNodeDetail({ loading: true });
      if (selectedNode.device_id) {
        axios
          .get(`${API_URL}/monitor/${selectedNode.device_id}`)
          .then((res) => {
            setNodeDetail({ ...res.data, loading: false });
          })
          .catch(() => {
            setNodeDetail({ error: "Koneksi API Gagal", loading: false });
          });
        axios
          .get(`${API_URL}/devices/${selectedNode.device_id}`)
          .then((res) => {
            setDeviceConfig(res.data);
          })
          .catch(() => {
            setDeviceConfig(null);
          });
      } else {
        setNodeDetail({ loading: false });
        setDeviceConfig(null);
      }
    } else {
      setNodeDetail(null);
      setDeviceConfig(null);
      setNodeIfaceSearch("");
      setShowNodeIfaceDropdown(false);
    }
  }, [selectedNode?.id, selectedNode?.linked_interface]);

  const handleAddNode = (
    lat,
    lng,
    type,
    label = null,
    linkedInterface = null,
    vendor = null,
  ) => {
    if (readOnly) return;
    const newNode = {
      id: "node_" + Date.now(),
      label: label || `Node Baru (${type.toUpperCase()})`,
      latitude: parseFloat(lat),
      longitude: parseFloat(lng),
      type: type,
      device_id: null,
      status: "unknown",
      pic_name: null,
      pic_phone: null,
      ...(linkedInterface ? { linked_interface: linkedInterface } : {}),
      ...(vendor ? { vendor } : {}),
    };
    setNodesFromUser((prev) => [...prev, newNode]);
  };

  const handleNodeClick = (e, node) => {
    if (readOnly) {
      setSelectedEdge(null);
      setSelectedNode(node);
      return;
    }
    if (interactionMode === "add_edge") {
      if (!linkStartNode) {
        setLinkStartNode(node.id);
      } else {
        if (linkStartNode !== node.id) {
          const newEdge = {
            id: "edge_" + Date.now(),
            from_node: linkStartNode,
            to_node: node.id,
            label: "Kabel FO",
            status: "up",
          };
          setEdgesFromUser((prev) => [...prev, newEdge]);
        }
        setLinkStartNode(null);
      }
    } else if (interactionMode === "select") {
      setSelectedEdge(null);
      // Store only id so panel always reads fresh data from nodes array
      setSelectedNode(node);
    }
  };

  // Always read the freshest version of the selected node from the nodes array
  const currentSelectedNode = selectedNode
    ? nodes.find((n) => n.id === selectedNode.id) || selectedNode
    : null;

  const saveLayout = async () => {
    if (readOnly) {
      addToast("Readonly", "error");
      return;
    }
    try {
      const upsertNodes = getDeltaNodes(nodes, baselineNodesRef.current);
      const upsertEdges = getDeltaEdges(edges, baselineEdgesRef.current);
      const res = await axios.post(`${API_URL}/topology`, {
        nodes: upsertNodes,
        edges: upsertEdges,
        deletedNodeIds: Array.from(deletedNodeIdsRef.current),
        deletedEdgeIds: Array.from(deletedEdgeIdsRef.current),
        baseRevision: revisionRef.current,
      });
      const savedNodes = res.data.nodes || nodes;
      const savedEdges = res.data.edges || edges;
      revisionRef.current = res.data.revision || revisionRef.current;
      applyTopologyFromServer(savedNodes, savedEdges);
      addToast("Peta berhasil disimpan!", "success");
    } catch (e) {
      console.error(e);
      addToast(
        "Gagal menyimpan peta: " + (e.response?.data?.error || e.message),
        "error",
      );
    }
  };

  // Group interfaces by type for display
  const ifaceGroups = useMemo(() => {
    const groups = {};
    const filtered = coreInterfaces.filter(
      (i) =>
        !ifacePanelSearch ||
        (i.name &&
          i.name.toLowerCase().includes(ifacePanelSearch.toLowerCase())),
    );
    filtered.forEach((i) => {
      const t = i.type || "other";
      if (!groups[t]) groups[t] = [];
      groups[t].push(i);
    });
    return groups;
  }, [coreInterfaces, ifacePanelSearch]);

  const runningCount = coreInterfaces.filter(
    (i) => i.running === "true" && i.disabled !== "true",
  ).length;
  const downCount = coreInterfaces.filter(
    (i) => i.running !== "true" && i.disabled !== "true",
  ).length;

  const mapNodes = useMemo(() => {
    if (nodeViewFilter === "client") return nodes.filter(isClientNode);
    if (nodeViewFilter === "infrastructure")
      return nodes.filter(isInfrastructureNode);
    return nodes;
  }, [nodes, nodeViewFilter]);

  const mapNodeIds = useMemo(
    () => new Set(mapNodes.map((n) => n.id)),
    [mapNodes],
  );

  const mapEdges = useMemo(() => {
    return edges.filter((e) => {
      const fromId = e.from_node ?? e.from;
      const toId = e.to_node ?? e.to;
      return mapNodeIds.has(fromId) && mapNodeIds.has(toId);
    });
  }, [edges, mapNodeIds]);

  useEffect(() => {
    if (selectedNode && !mapNodeIds.has(selectedNode.id)) {
      setSelectedNode(null);
      setNodeDetail(null);
    }
    if (selectedEdge) {
      const fromId = selectedEdge.from_node ?? selectedEdge.from;
      const toId = selectedEdge.to_node ?? selectedEdge.to;
      if (!mapNodeIds.has(fromId) || !mapNodeIds.has(toId)) {
        setSelectedEdge(null);
      }
    }
  }, [nodeViewFilter, mapNodeIds, selectedNode, selectedEdge]);

  return (
    <div className="flex flex-col h-full min-h-0 -m-4 md:-m-6 relative overflow-hidden bg-slate-950">
      {/* Map Control Toolbar */}
      <div className="flex-shrink-0 bg-slate-800 border-b border-slate-700/50 px-3 py-2 md:px-6 md:py-3 flex flex-col md:flex-row justify-between items-start md:items-center z-[1000] gap-3 md:gap-4 overflow-visible relative">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-3 w-full md:w-auto">
          {/* Main Buttons */}
          <div className="w-full md:w-auto pb-1 md:pb-0 flex-shrink-0 min-md:flex">
            {readOnly && isVisitorRole(getStoredUser().role) ? (
              <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-1.5">
                <Eye size={14} className="text-amber-400" />
                <span className="text-xs font-semibold text-amber-300">
                  Readonly (Visitor)
                </span>
              </div>
            ) : canEdit ? (
              <div className="flex flex-wrap bg-slate-900 rounded-lg p-1 border border-slate-700">
                <button
                  onClick={() => {
                    setInteractionMode("select");
                    setLinkStartNode(null);
                  }}
                  className={`cursor-pointer flex-1 min-w-fit px-3 py-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition ${interactionMode === "select" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}
                >
                  <MapPin size={14} /> Geser & Pilih
                </button>
                <button
                  onClick={() => {
                    setInteractionMode("add_node");
                    setLinkStartNode(null);
                  }}
                  className={`cursor-pointer flex-1 min-w-fit px-3 py-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition ${interactionMode === "add_node" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}
                >
                  <Plus size={14} /> + Node
                </button>
                <button
                  onClick={() => {
                    setShowManualAddModal(true);
                    setManualIfaceSearch("");
                    setShowManualIfaceDropdown(false);
                  }}
                  className={`cursor-pointer flex-1 min-w-fit px-3 py-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition ${interactionMode === "node" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}
                >
                  <MapPin size={14} /> Titik Lokasi
                </button>
                <button
                  onClick={() => {
                    setInteractionMode("add_edge");
                    setLinkStartNode(null);
                  }}
                  className={`cursor-pointer flex-1 min-w-fit px-3 py-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition ${interactionMode === "add_edge" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}
                >
                  <GitCommit size={14} /> + Kabel FO
                </button>
                <button
                  onClick={() => {
                    setInteractionMode("delete_edge");
                    setLinkStartNode(null);
                  }}
                  className={`cursor-pointer flex-1 min-w-fit px-3 py-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition ${interactionMode === "delete_edge" ? "bg-red-600 text-white" : "text-slate-400 hover:text-white hover:bg-red-500/10"}`}
                >
                  <Trash2 size={14} /> Hapus Kabel
                </button>
                <div className="w-px bg-slate-700/50 mx-1 hidden sm:block"></div>
              </div>
            ) : null}
            <div className="cursor-pointer flex flex-wrap bg-slate-900 rounded-lg p-1 border border-slate-700">
              <div className="w-px bg-slate-700/50 mx-1 hidden sm:block"></div>
              <button
                onClick={() =>
                  setFlyToTarget({ lat: -7.0225, lng: 107.527, zoom: 16.5 })
                }
                className="cursor-pointer flex-1 min-w-fit px-3 py-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <Search size={14} /> Zoom OPD
              </button>
              <button
                onClick={() =>
                  setFlyToTarget({ lat: -7.065, lng: 107.55, zoom: 11 })
                }
                className="cursor-pointer flex-1 min-w-fit px-3 py-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <MapPin size={14} /> Zoom All
              </button>
              <button
                onClick={() => setShowMobileMode((prev) => !prev)}
                className={`cursor-pointer md:hidden flex-1 min-w-fit px-3 py-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition ${showMobileMode ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"}`}
              >
                <Settings size={14} /> Mode
              </button>
            </div>
          </div>

          {/* Node Type Selector (Floating) */}
          {!readOnly && interactionMode === "add_node" && (
            <div className="absolute top-full left-3 md:left-6 mt-2 z-[1001] shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-1.5 bg-slate-900 border border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.15)] rounded-lg p-1.5 w-max">
                <span className="text-[10px] text-slate-400 uppercase font-bold px-2 whitespace-nowrap">
                  PILIH TIPE:
                </span>
                {["olt", "odc", "odp", "pole", "client"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setNewNodeType(t)}
                    className={`cursor-pointer px-3 py-1.5 rounded-md text-xs uppercase font-medium whitespace-nowrap transition ${newNodeType === t ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" : "text-slate-400 hover:text-white hover:bg-slate-800"}`}
                  >
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}
          {!readOnly && linkStartNode && (
            <span className="text-xs text-amber-400 animate-pulse font-medium whitespace-nowrap flex-shrink-0">
              Klik node tujuan...
            </span>
          )}
          {!readOnly && interactionMode === "delete_edge" && (
            <span className="text-xs text-red-400 font-medium bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/20 whitespace-nowrap flex-shrink-0">
              Klik kabel untuk menghapus
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          <button
            onClick={() => fetchTopology(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition shadow-lg 'bg-blue-600 hover:bg-blue-700 border border-blue-500 text-white shadow-blue-500/20 cursor-pointer"
          >
            <RefreshCw size={13} /> Refresh Peta
          </button>
          <button
            onClick={fetchCoreData}
            disabled={coreLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition shadow-lg 'bg-blue-600 hover:bg-blue-700 border border-blue-500 text-white shadow-blue-500/20 cursor-pointer"
          >
            <RefreshCw
              size={13}
              className={coreLoading ? "animate-spin" : ""}
            />{" "}
            Sync Sekarang
          </button>
          {!readOnly && (
            <button
              onClick={saveLayout}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition shadow-lg 'bg-blue-600 hover:bg-blue-700 border border-blue-500 text-white shadow-blue-500/20 cursor-pointer"
            >
              <Save size={16} /> Simpan
            </button>
          )}
          {/* Cable Color Legend — removed, moved to floating panel */}
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 min-h-0 flex relative">
        {/* Toasts */}
        <div className="absolute top-4 right-4 z-[9999] flex flex-col items-end gap-2 pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`px-4 py-3 max-w-md break-words rounded-xl shadow-2xl backdrop-blur-md font-medium text-sm animate-fade-in ${t.type === "error" ? "bg-red-500/90 text-white border border-red-400/50" : "bg-emerald-500/90 text-white border border-emerald-400/50"}`}
            >
              {t.msg}
            </div>
          ))}
        </div>

        {/* Manual Add Modal */}
        {!readOnly && showManualAddModal && (
          <div className="absolute inset-0 z-[3000] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md max-h-[min(90dvh,100%)] my-auto flex flex-col overflow-hidden animate-fade-in-up">
              <div className="flex-shrink-0 p-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/50">
                <h3 className="font-bold text-slate-100 flex items-center gap-2">
                  <MapPin size={18} className="text-emerald-400" /> Tambah Titik
                  Node Manual
                </h3>
                <button
                  onClick={() => setShowManualAddModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5 border-b border-slate-700/50 pb-4 mb-2 relative">
                  <label className="text-xs font-semibold text-slate-400">
                    Pencarian Lokasi & Koordinat
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ketik nama tempat atau paste koordinat..."
                      value={manualAddData.addressSearch || ""}
                      onChange={(e) => {
                        setManualAddData({
                          ...manualAddData,
                          addressSearch: e.target.value,
                        });
                        if (e.target.value === "") setSearchSuggestions([]);
                      }}
                      onKeyDown={(e) =>
                        e.key === "Enter" && extractCoordinates()
                      }
                      className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 flex-1"
                    />
                    <button
                      onClick={extractCoordinates}
                      disabled={isSearching}
                      className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 rounded-lg flex items-center justify-center gap-1.5 transition text-xs font-semibold whitespace-nowrap disabled:opacity-50"
                    >
                      {isSearching ? (
                        <RefreshCw size={16} className="animate-spin" />
                      ) : (
                        <Search size={16} />
                      )}
                      Cari
                    </button>
                  </div>

                  {/* Suggestions Dropdown */}
                  {searchSuggestions.length > 0 && (
                    <div className="absolute top-[68px] left-0 right-0 z-[5000] bg-slate-800 border border-slate-700 rounded-lg shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
                      {searchSuggestions.map((place, idx) => (
                        <div
                          key={idx}
                          className="px-3 py-2 text-xs border-b border-slate-700/50 hover:bg-slate-700 cursor-pointer text-slate-200"
                          onClick={() => {
                            setManualAddData((prev) => ({
                              ...prev,
                              lat: place.lat,
                              lng: place.lon,
                              label: place.display_name.split(",")[0],
                              addressSearch: place.display_name,
                            }));
                            setSearchSuggestions([]);
                            addToast("Lokasi berhasil dipilih", "success");
                          }}
                        >
                          <p className="font-semibold text-emerald-400">
                            {place.display_name.split(",")[0]}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {place.display_name}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-[10px] text-slate-500 leading-tight">
                    Tekan Enter atau klik Cari untuk mencari lokasi atau paste
                    koordinat.
                  </p>
                </div>

                <div className="flex flex-col gap-1.5 relative">
                  <label className="text-xs font-semibold text-slate-400">
                    Prefix (Gabungan) / Interface MikroTik
                  </label>
                  <input
                    type="text"
                    placeholder="Ketik untuk mencari prefix/interface..."
                    value={manualIfaceSearch}
                    onChange={(e) => {
                      setManualIfaceSearch(e.target.value);
                      setManualAddData((prev) => ({
                        ...prev,
                        label: e.target.value,
                        linked_interface: "",
                      }));
                      setShowManualIfaceDropdown(true);
                    }}
                    onFocus={() => setShowManualIfaceDropdown(true)}
                    onBlur={() =>
                      setTimeout(() => setShowManualIfaceDropdown(false), 200)
                    }
                    className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 w-full"
                  />
                  {showManualIfaceDropdown &&
                    combinedInterfaceOptions.length > 0 && (
                      <div className="absolute top-[64px] left-0 right-0 z-[4000] bg-slate-800 border border-slate-700 rounded-lg shadow-2xl max-h-52 overflow-auto">
                        <div
                          className="px-3 py-2.5 text-xs text-slate-400 hover:bg-slate-700 cursor-pointer"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setManualAddData((prev) => ({
                              ...prev,
                              label: "",
                              linked_interface: "",
                            }));
                            setManualIfaceSearch("");
                            setShowManualIfaceDropdown(false);
                          }}
                        >
                          -- Tidak ada (manual) --
                        </div>
                        {combinedInterfaceOptions
                          .filter(
                            (i) =>
                              !manualIfaceSearch ||
                              i.name
                                .toLowerCase()
                                .includes(manualIfaceSearch.toLowerCase()),
                          )
                          .map((iface, idx) => {
                            const isUsed = nodes.some(
                              (n) => n.linked_interface === iface.name,
                            );
                            return (
                              <div
                                key={idx}
                                className={`px-3 py-2.5 text-xs border-t border-slate-700/30 flex justify-between items-center ${isUsed ? "text-slate-500 bg-slate-800/50 cursor-not-allowed" : "text-slate-200 hover:bg-slate-700 cursor-pointer"}`}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  if (isUsed) return;
                                  setManualAddData((prev) => ({
                                    ...prev,
                                    label: iface.name,
                                    linked_interface: iface.name,
                                  }));
                                  setManualIfaceSearch(iface.name);
                                  setShowManualIfaceDropdown(false);
                                }}
                              >
                                <span className="font-medium flex items-center gap-1.5">
                                  {iface.name}
                                  {isUsed && (
                                    <span className="text-[9px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">
                                      Terpakai
                                    </span>
                                  )}
                                </span>
                                <div className="flex items-center gap-2">
                                  {!iface.isMapping && (
                                    <IfaceBadge
                                      running={iface.running}
                                      disabled={iface.disabled}
                                    />
                                  )}
                                  <span className="text-[10px] text-slate-500 uppercase">
                                    {iface.type}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        {manualIfaceSearch &&
                          combinedInterfaceOptions.filter((i) =>
                            i.name
                              .toLowerCase()
                              .includes(manualIfaceSearch.toLowerCase()),
                          ).length === 0 && (
                            <div className="px-3 py-3 text-xs text-slate-500 text-center">
                              Tidak ditemukan
                            </div>
                          )}
                      </div>
                    )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400">
                    Tipe Node
                  </label>
                  <select
                    value={manualAddData.type}
                    onChange={(e) =>
                      setManualAddData({
                        ...manualAddData,
                        type: e.target.value,
                      })
                    }
                    className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 w-full appearance-none"
                  >
                    <option value="client">Client (Rumah)</option>
                    <option value="odp">ODP (Kotak Distribusi)</option>
                    <option value="odc">ODC (Kabinet)</option>
                    <option value="pole">Tiang (Pole)</option>
                    <option value="olt">OLT (Pusat)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400">
                    Vendor / Merek ISP (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Indibiz, Megavision, etc.."
                    value={manualAddData.vendor}
                    onChange={(e) =>
                      setManualAddData({
                        ...manualAddData,
                        vendor: e.target.value,
                      })
                    }
                    className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 w-full"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-400">
                      Latitude
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="-7.02222"
                      value={manualAddData.lat}
                      onChange={(e) =>
                        setManualAddData({
                          ...manualAddData,
                          lat: e.target.value,
                        })
                      }
                      className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 w-full"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-400">
                      Longitude
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="107.5274"
                      value={manualAddData.lng}
                      onChange={(e) =>
                        setManualAddData({
                          ...manualAddData,
                          lng: e.target.value,
                        })
                      }
                      className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 w-full"
                    />
                  </div>
                </div>
              </div>
              <div className="flex-shrink-0 p-4 border-t border-slate-700/50 bg-slate-800/50 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowManualAddModal(false);
                    setManualIfaceSearch("");
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                    if (!manualAddData.lat || !manualAddData.lng) {
                      addToast("Latitude dan Longitude harus diisi", "error");
                      return;
                    }
                    handleAddNode(
                      manualAddData.lat,
                      manualAddData.lng,
                      manualAddData.type,
                      manualAddData.label ||
                        manualIfaceSearch ||
                        "Titik Manual",
                      manualAddData.linked_interface || null,
                      manualAddData.vendor || null,
                    );
                    setFlyToTarget({
                      lat: parseFloat(manualAddData.lat),
                      lng: parseFloat(manualAddData.lng),
                    });
                    setShowManualAddModal(false);
                    setManualAddData({
                      label: "",
                      type: "client",
                      lat: "",
                      lng: "",
                      addressSearch: "",
                      linked_interface: "",
                      vendor: "",
                    });
                    setManualIfaceSearch("");
                    addToast("Titik berhasil ditambahkan!", "success");
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-lg shadow-emerald-500/20"
                >
                  Tambah Titik
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 w-full relative z-0 flex flex-col">
          {/* Left Panel — MikroTik Core Live Status */}
          <div className="hidden md:flex absolute top-3 left-3 z-[1000] w-72 flex-col gap-2 pointer-events-none">
            {/* Core Status Card */}
            {coreStatus && (
              <div
                className={`rounded-xl border p-3.5 shadow-xl backdrop-blur-sm pointer-events-auto ${coreStatus.connected ? "bg-slate-900/95 border-emerald-500/30" : "bg-slate-900/95 border-red-500/30"}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${coreStatus.connected ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`}
                    />
                    <span className="text-xs font-bold text-slate-200">
                      {coreStatus.device_name || "MikroTik Pusat"}
                    </span>
                  </div>
                  <StatusBadge online={coreStatus.connected} />
                </div>
                {coreStatus.connected ? (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="bg-slate-800/80 rounded-lg p-2 flex items-center gap-2 min-w-0">
                      <Cpu size={13} className="text-blue-400 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] text-slate-500">CPU</p>
                        <p className="text-xs font-bold text-slate-200">
                          {coreStatus.cpu}%
                        </p>
                      </div>
                    </div>
                    <div className="bg-slate-800/80 rounded-lg p-2 flex items-center gap-2 min-w-0">
                      <Network
                        size={13}
                        className="text-emerald-400 flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] text-slate-500">
                          Active Pelanggan
                        </p>
                        <p className="text-xs font-bold text-emerald-400">
                          {coreStatus.l2tp_active + coreStatus.pppoe_active}
                        </p>
                      </div>
                    </div>
                    <div className="bg-slate-800/80 rounded-lg p-2 flex items-center gap-2 min-w-0">
                      <Clock
                        size={13}
                        className="text-amber-400 flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] text-slate-500">Uptime</p>
                        <p className="text-xs font-bold text-slate-200 truncate">
                          {coreStatus.uptime}
                        </p>
                      </div>
                    </div>
                    <div className="bg-slate-800/80 rounded-lg p-2 flex items-center gap-2 min-w-0">
                      <RefreshCw
                        size={13}
                        className="text-purple-400 flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] text-slate-500">Board</p>
                        <p className="text-xs font-bold text-slate-200 truncate">
                          {coreStatus.board}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-red-400 mt-1">
                    {coreStatus.error}
                  </p>
                )}
              </div>
            )}

            {/* Interface Summary Card */}
            {coreInterfaces.length > 0 && (
              <div className="rounded-xl border border-slate-700/50 bg-slate-900/95 shadow-xl backdrop-blur-sm pointer-events-auto">
                <button
                  onClick={() => setShowIfacePanel((v) => !v)}
                  className="w-full p-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Network size={13} className="text-blue-400" />
                    <span className="text-xs font-bold text-slate-200">
                      Interfaces ({coreInterfaces.length})
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                      {runningCount} UP
                    </span>
                    {downCount > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-bold">
                        {downCount} DOWN
                      </span>
                    )}
                  </div>
                  {showIfacePanel ? (
                    <ChevronUp
                      size={14}
                      className="cursor-pointer text-slate-400"
                    />
                  ) : (
                    <ChevronDown
                      size={14}
                      className="cursor-pointer text-slate-400"
                    />
                  )}
                </button>
                {showIfacePanel && (
                  <div className="border-t border-slate-700/50 max-h-64 flex flex-col">
                    <div className="p-2 border-b border-slate-700/50">
                      <input
                        type="text"
                        placeholder="Cari interface..."
                        value={ifacePanelSearch}
                        onChange={(e) => setIfacePanelSearch(e.target.value)}
                        className="bg-slate-800 border border-slate-700 rounded-md p-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500 w-full"
                      />
                    </div>
                    <div className="overflow-auto flex-1">
                      {Object.entries(ifaceGroups).length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-500">
                          Tidak ada interface
                        </div>
                      ) : (
                        Object.entries(ifaceGroups).map(([type, ifaces]) => (
                          <div key={type}>
                            <div className="px-3 py-1.5 bg-slate-800/50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                              {type}
                            </div>
                            {ifaces.map((iface, i) => (
                              <div
                                key={i}
                                className="px-3 py-2 flex items-center justify-between border-b border-slate-800/80 hover:bg-slate-800/40 transition"
                              >
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`w-1.5 h-1.5 rounded-full ${iface.running === "true" && iface.disabled !== "true" ? "bg-emerald-400" : iface.disabled === "true" ? "bg-slate-500" : "bg-red-400"}`}
                                  />
                                  <span className="text-xs text-slate-200 font-medium">
                                    {iface.name}
                                  </span>
                                </div>
                                <IfaceBadge
                                  running={iface.running}
                                  disabled={iface.disabled}
                                />
                              </div>
                            ))}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Floating Panel — Legend & Theme Toggle */}
          <div
            className={`${showMobileMode ? "flex" : "hidden"} md:flex absolute bottom-8 left-3 md:bottom-auto md:top-3 md:left-auto md:right-3 z-[1000] flex-col gap-2 pointer-events-none max-h-[calc(100%-24px)] overflow-y-auto hide-scrollbar`}
          >
            {/* Cable Color Legend */}
            <div className="hidden md:block rounded-xl border border-slate-700/50 bg-slate-900/95 shadow-xl backdrop-blur-sm pointer-events-auto p-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Legenda Warna Kabel dan Node
              </p>
              <div className="flex flex-col gap-1.5 text-[10px] text-slate-400">
                <span className="flex items-center gap-2">
                  <span className="w-6 h-1 bg-green-500 rounded inline-block" />{" "}
                  UP
                </span>
                <span className="flex items-center gap-2">
                  <span
                    className="w-6 h-1 rounded inline-block"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(90deg,#ef4444 0,#ef4444 4px,transparent 4px,transparent 10px)",
                    }}
                  />{" "}
                  DOWN
                </span>
                <span className="flex items-center gap-2">
                  <span
                    className="w-6 h-1 rounded inline-block"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(90deg,#475569 0,#475569 3px,transparent 3px,transparent 7px)",
                    }}
                  />{" "}
                  Disabled
                </span>
              </div>
            </div>
            {/* Mode Panel (Tema Peta jadi toggle di sini) */}
            <div className="rounded-xl border border-slate-700/50 bg-slate-900/95 shadow-xl backdrop-blur-sm pointer-events-auto p-3 min-w-[200px]">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Mode
              </p>
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setMapTheme(mapTheme === "dark" ? "colored" : "dark")
                  }
                  className={`cursor-pointer w-full px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition flex items-center justify-center gap-1.5
                ${mapTheme === "dark" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}
                  title="Toggle Tema Peta"
                >
                  <span
                    className={`fa ${mapTheme === "dark" ? "fa-moon" : "fa-sun"} text-[10px]`}
                  />
                  Tema Peta
                </button>
                <button
                  type="button"
                  onClick={() => setShowLabels(!showLabels)}
                  className={`cursor-pointer w-full px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition flex items-center justify-center gap-1.5
                ${showLabels ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}
                >
                  <span
                    className={`fa ${showLabels ? "fa-eye" : "fa-eye-slash"} text-[9px]`}
                  />
                  Label Node
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setNodeViewFilter((f) =>
                      f === "client" ? "all" : "client",
                    )
                  }
                  className={`cursor-pointer w-full px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition flex items-center justify-center gap-1.5
                ${nodeViewFilter === "client" ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}
                >
                  <Users size={12} />
                  Hanya Client
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setNodeViewFilter((f) =>
                      f === "infrastructure" ? "all" : "infrastructure",
                    )
                  }
                  className={`cursor-pointer w-full px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition flex items-center justify-center gap-1.5
                ${nodeViewFilter === "infrastructure" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}
                >
                  <Server size={12} />
                  Hanya OLT/ODC/ODP
                </button>
              </div>
            </div>
          </div>

          <TopologyMap
            mapTheme={mapTheme}
            showLabels={showLabels}
            nodes={mapNodes}
            edges={mapEdges}
            mappings={mappings}
            interactionMode={interactionMode}
            newNodeType={newNodeType}
            selectedNode={currentSelectedNode}
            selectedEdge={selectedEdge}
            coreInterfaces={coreInterfaces}
            linkStartNode={linkStartNode}
            handleAddNode={handleAddNode}
            handleNodeClick={handleNodeClick}
            setNodes={setNodesFromUser}
            setEdges={setEdgesFromUser}
            setSelectedNode={setSelectedNode}
            setSelectedEdge={setSelectedEdge}
            setLinkStartNode={setLinkStartNode}
            flyToTarget={flyToTarget}
            onFlyToComplete={() => setFlyToTarget(null)}
            onEdgeDelete={markEdgeDeleted}
            readOnly={readOnly}
          />
        </div>

        {/* Node Sidebar */}
        <div
          className={`absolute top-0 right-0 bottom-0 w-80 bg-slate-800/95 backdrop-blur-md border-l border-slate-700/50 flex flex-col z-[1000] shadow-2xl transition-transform duration-300 ease-out ${currentSelectedNode ? "translate-x-0" : "translate-x-full"}`}
        >
          <div className="p-4 border-b border-slate-700/50 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <h3 className="font-bold text-slate-100">Properties Node</h3>
              {currentSelectedNode && (
                <button
                  onClick={() =>
                    setFlyToTarget({
                      lat: currentSelectedNode.latitude,
                      lng: currentSelectedNode.longitude,
                      zoom: 17,
                    })
                  }
                  className="bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 p-1.5 rounded-md transition-colors flex items-center justify-center"
                  title="Zoom ke Lokasi"
                >
                  <MapPin size={14} />{" "}
                  <span className="font-bold text-xs text-slate-100 ml-1 cursor-pointer">
                    Zoom Location
                  </span>
                </button>
              )}
            </div>
            <button
              className="text-slate-400 hover:text-white"
              onClick={() => setSelectedNode(null)}
            >
              <X size={20} />
            </button>
          </div>

          {currentSelectedNode && (
            <div className="flex border-b border-slate-700/50 bg-slate-850/40">
              <button
                onClick={() => setActiveNodeTab("identitas")}
                className={`cursor-pointer flex-1 py-2.5 text-xs font-bold uppercase tracking-wider text-center border-b-2 transition-all ${
                  activeNodeTab === "identitas"
                    ? "border-blue-500 text-blue-400 bg-blue-500/5"
                    : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-700/20"
                }`}
              >
                Identitas
              </button>
              <button
                onClick={() => setActiveNodeTab("detail")}
                className={`cursor-pointer flex-1 py-2.5 text-xs font-bold uppercase tracking-wider text-center border-b-2 transition-all ${
                  activeNodeTab === "detail"
                    ? "border-blue-500 text-blue-400 bg-blue-500/5"
                    : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-700/20"
                }`}
              >
                Detail
              </button>
            </div>
          )}

          <div className="p-5 flex-1 overflow-auto flex flex-col gap-4">
            {currentSelectedNode && (
              <>
                {activeNodeTab === "identitas" ? (
                  <>
                    <div className="flex justify-between items-center border-b border-slate-700/30">
                      <span className="text-xs text-slate-400">Tipe Node</span>
                      <span className="text-xs font-semibold text-blue-400 uppercase">
                        {currentSelectedNode.type}
                      </span>
                    </div>

                    {/* Link node to core MikroTik interface */}
                    {combinedInterfaceOptions.length > 0 && (
                      <div className="flex flex-col gap-1.5 relative">
                        {currentSelectedNode.linked_interface &&
                          (() => {
                            const linked = combinedInterfaceOptions.find(
                              (i) =>
                                i.name === currentSelectedNode.linked_interface,
                            );
                            if (!linked) return null;

                            let isUp = false;
                            let isDown = false;
                            let statusText = "Unknown";
                            let offlineSince = null;

                            if (linked.isMapping) {
                              const m = mappings.find(
                                (x) => x.prefix === linked.name,
                              );
                              if (m) {
                                isUp = m.final_status === "Online";
                                isDown = m.final_status === "Offline";
                                statusText = m.final_status;
                                offlineSince = m.offline_since;
                              }
                            } else {
                              const c = coreInterfaces.find(
                                (x) => x.name === linked.name,
                              );
                              if (c) {
                                isUp = c.running === "true";
                                isDown = c.running !== "true";
                                statusText =
                                  c.disabled === "true"
                                    ? "Disabled"
                                    : isUp
                                      ? "Up"
                                      : "Down";
                              }
                            }

                            return (
                              <div
                                className={`flex flex-col gap-1.5 p-2.5 rounded-lg text-xs border ${isUp ? "bg-emerald-500/10 border-emerald-500/30" : "bg-red-500/10 border-red-500/30"}`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-400">
                                    Status Interface
                                  </span>
                                  <span
                                    className={`font-bold px-2 py-0.5 rounded ${isUp ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}
                                  >
                                    {statusText}
                                  </span>
                                </div>
                                {isDown && offlineSince && (
                                  <div className="text-[10px] text-red-400 flex items-center justify-end gap-1">
                                    <Clock size={10} /> Sejak {offlineSince}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                      </div>
                    )}

                    {/* Link node to core MikroTik interface */}
                    {combinedInterfaceOptions.length > 0 && (
                      <div className="flex flex-col gap-1.5 relative">
                        <label className="text-xs font-semibold text-slate-400">
                          Interface / Prefix
                        </label>
                        <input
                          type="text"
                          readOnly={readOnly}
                          placeholder="Ketik untuk mencari prefix/interface..."
                          value={nodeIfaceSearch}
                          onChange={(e) => {
                            setNodeIfaceSearch(e.target.value);
                            setShowNodeIfaceDropdown(true);
                          }}
                          onFocus={() =>
                            !readOnly && setShowNodeIfaceDropdown(true)
                          }
                          onBlur={() =>
                            setTimeout(
                              () => setShowNodeIfaceDropdown(false),
                              200,
                            )
                          }
                          className={`bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500 w-full ${readOnly ? "opacity-70 cursor-default" : ""}`}
                        />

                        {!readOnly && showNodeIfaceDropdown && (
                          <div className="absolute top-[64px] left-0 right-0 z-[2000] bg-slate-800 border border-slate-700 rounded-lg shadow-2xl max-h-52 overflow-auto">
                            <div
                              className="px-3 py-2.5 text-xs text-slate-400 hover:bg-slate-700 cursor-pointer"
                              onClick={() => {
                                setNodesFromUser((prev) =>
                                  prev.map((n) =>
                                    n.id === currentSelectedNode.id
                                      ? { ...n, linked_interface: "" }
                                      : n,
                                  ),
                                );
                                setNodeIfaceSearch("");
                                setShowNodeIfaceDropdown(false);
                              }}
                            >
                              -- Tidak ada (manual) --
                            </div>
                            {combinedInterfaceOptions
                              .filter(
                                (i) =>
                                  !nodeIfaceSearch ||
                                  i.name
                                    .toLowerCase()
                                    .includes(nodeIfaceSearch.toLowerCase()) ||
                                  (currentSelectedNode.linked_interface &&
                                    nodeIfaceSearch ===
                                      currentSelectedNode.linked_interface),
                              )
                              .map((iface, i) => {
                                const isUsedByOther = nodes.some(
                                  (n) =>
                                    n.id !== currentSelectedNode.id &&
                                    n.linked_interface === iface.name,
                                );
                                return (
                                  <div
                                    key={i}
                                    className={`px-3 py-2.5 text-xs border-t border-slate-700/30 flex justify-between items-center ${isUsedByOther ? "text-slate-500 bg-slate-800/50 cursor-not-allowed" : "text-slate-200 hover:bg-slate-700 cursor-pointer"}`}
                                    onClick={() => {
                                      if (isUsedByOther) return;
                                      setNodesFromUser((prev) =>
                                        prev.map((n) =>
                                          n.id === currentSelectedNode.id
                                            ? {
                                                ...n,
                                                linked_interface: iface.name,
                                                label: iface.name,
                                              }
                                            : n,
                                        ),
                                      );
                                      setNodeIfaceSearch(iface.name);
                                      setShowNodeIfaceDropdown(false);
                                    }}
                                  >
                                    <span className="font-medium flex items-center gap-1.5">
                                      {iface.name}
                                      {isUsedByOther && (
                                        <span className="text-[9px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">
                                          Terpakai
                                        </span>
                                      )}
                                    </span>
                                    <span className="text-[10px] text-slate-500 uppercase">
                                      {iface.type}
                                    </span>
                                  </div>
                                );
                              })}
                            {combinedInterfaceOptions.filter(
                              (i) =>
                                nodeIfaceSearch &&
                                i.name
                                  .toLowerCase()
                                  .includes(nodeIfaceSearch.toLowerCase()),
                            ).length === 0 && (
                              <div className="px-3 py-3 text-xs text-slate-500 text-center">
                                Tidak ditemukan
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-400">
                        Vendor / Merek ISP
                      </label>
                      <input
                        type="text"
                        readOnly={readOnly}
                        placeholder="Contoh: Telkom, Biznet, Iconnet..."
                        value={currentSelectedNode.vendor || ""}
                        onChange={(e) =>
                          setNodesFromUser((prev) =>
                            prev.map((n) =>
                              n.id === currentSelectedNode.id
                                ? { ...n, vendor: e.target.value }
                                : n,
                            ),
                          )
                        }
                        className={`bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500 w-full ${readOnly ? "opacity-70 cursor-default" : ""}`}
                      />
                    </div>
                    {/* Metrics if linked to device */}
                    {currentSelectedNode.device_id &&
                      nodeDetail &&
                      !nodeDetail.loading &&
                      !nodeDetail.error && (
                        <div className="flex flex-col gap-3 mt-1 bg-slate-900/40 p-3 rounded-lg border border-slate-700/40">
                          <p className="text-[10px] text-slate-500 uppercase font-bold">
                            Live Metrics
                          </p>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-400">Uptime</span>
                            <span className="text-slate-200">
                              {nodeDetail?.uptime || "-"}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-400">PPPoE Aktif</span>
                            <span className="text-emerald-400 font-semibold">
                              {nodeDetail?.pppoe_active || 0} user
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-400">CPU</span>
                            <span className="text-slate-200">
                              {nodeDetail?.cpu || 0}%
                            </span>
                          </div>
                        </div>
                      )}
                    {currentSelectedNode.device_id && nodeDetail?.loading && (
                      <p className="text-xs text-slate-500">
                        Memuat status perangkat...
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-400">
                        Lat, Long (Lintang, Bujur)
                      </label>
                      <input
                        type="text"
                        readOnly={readOnly}
                        placeholder="-7.154376768491, 107.69818606047"
                        value={`${currentSelectedNode.latitude ?? ""}${currentSelectedNode.latitude && currentSelectedNode.longitude ? ", " : ""}${currentSelectedNode.longitude ?? ""}`}
                        onChange={(e) => {
                          const [lat = "", lng = ""] = e.target.value
                            .split(",")
                            .map((v) => v.trim());
                          setNodesFromUser((prev) =>
                            prev.map((n) =>
                              n.id === currentSelectedNode.id
                                ? { ...n, latitude: lat, longitude: lng }
                                : n,
                            ),
                          );
                        }}
                        className={`bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500 w-full ${readOnly ? "opacity-70 cursor-default" : ""}`}
                        style={{ minWidth: 0 }}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-400">
                        Nama PIC
                      </label>
                      <input
                        type="text"
                        readOnly={readOnly}
                        placeholder="Nama penanggung jawab titik"
                        value={currentSelectedNode.pic_name || ""}
                        onChange={(e) =>
                          setNodesFromUser((prev) =>
                            prev.map((n) =>
                              n.id === currentSelectedNode.id
                                ? { ...n, pic_name: e.target.value }
                                : n,
                            ),
                          )
                        }
                        className={`bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500 w-full ${readOnly ? "opacity-70 cursor-default" : ""}`}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-400">
                        Nomor PIC
                      </label>
                      <input
                        type="text"
                        readOnly={readOnly}
                        placeholder="Contoh: 08123456789"
                        value={currentSelectedNode.pic_phone || ""}
                        onChange={(e) =>
                          setNodesFromUser((prev) =>
                            prev.map((n) =>
                              n.id === currentSelectedNode.id
                                ? { ...n, pic_phone: e.target.value }
                                : n,
                            ),
                          )
                        }
                        className={`bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500 w-full ${readOnly ? "opacity-70 cursor-default" : ""}`}
                      />
                    </div>
                  </>
                )}

                {!readOnly && (
                  <button
                    onClick={() => {
                      markNodeDeleted(selectedNode.id);
                      setNodesFromUser((prev) =>
                        prev.filter((n) => n.id !== selectedNode.id),
                      );
                      setEdgesFromUser((prev) =>
                        prev.filter(
                          (e) =>
                            e.from_node !== selectedNode.id &&
                            e.to_node !== selectedNode.id &&
                            e.from !== selectedNode.id &&
                            e.to !== selectedNode.id,
                        ),
                      );
                      setSelectedNode(null);
                    }}
                    className="cursor-pointer mt-4 flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white py-2.5 rounded-lg text-sm font-semibold transition"
                  >
                    <Trash2 size={16} /> Hapus Node
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Edge Sidebar */}
        <div
          className={`absolute top-0 right-0 bottom-0 w-80 bg-slate-800/95 backdrop-blur-md border-l border-slate-700/50 flex flex-col z-[1000] shadow-2xl transition-transform duration-300 ease-out ${selectedEdge ? "translate-x-0" : "translate-x-full"}`}
        >
          <div className="p-4 border-b border-slate-700/50 flex justify-between items-center">
            <h3 className="font-bold text-slate-100">Koneksi FO</h3>
            <button
              className="text-slate-400 hover:text-white"
              onClick={() => setSelectedEdge(null)}
            >
              <X size={20} />
            </button>
          </div>
          <div className="p-5 flex-1 flex flex-col gap-4">
            {selectedEdge && (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400">
                    Nama Kabel / Interface
                  </label>
                  <input
                    type="text"
                    readOnly={readOnly}
                    value={selectedEdge.label || ""}
                    onChange={(e) =>
                      setEdgesFromUser((prev) =>
                        prev.map((ed) =>
                          ed.id === selectedEdge.id
                            ? { ...ed, label: e.target.value }
                            : ed,
                        ),
                      )
                    }
                    className={`bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500 w-full ${readOnly ? "opacity-70 cursor-default" : ""}`}
                  />
                  <p className="text-[10px] text-slate-500">
                    Jika nama cocok dengan interface MikroTik, warna kabel akan
                    mengikuti status interface secara otomatis.
                  </p>
                </div>

                {/* Show matched interface status */}
                {selectedEdge.label &&
                  (() => {
                    const matched = coreInterfaces.find(
                      (i) =>
                        i.name &&
                        selectedEdge.label &&
                        i.name.toLowerCase() ===
                          selectedEdge.label.toLowerCase(),
                    );
                    if (!matched)
                      return (
                        <div className="bg-slate-900/40 rounded-lg p-3 border border-slate-700/40 text-xs text-slate-500">
                          Tidak ada interface MikroTik yang cocok dengan nama{" "}
                          <strong className="text-slate-400">
                            "{selectedEdge.label}"
                          </strong>
                        </div>
                      );
                    return (
                      <div
                        className={`flex items-center justify-between p-3 rounded-lg border text-xs ${matched.running === "true" ? "bg-emerald-500/10 border-emerald-500/30" : "bg-red-500/10 border-red-500/30"}`}
                      >
                        <div>
                          <p className="text-slate-400">
                            Interface:{" "}
                            <span className="text-slate-200 font-medium">
                              {matched.name}
                            </span>
                          </p>
                          <p className="text-slate-500 mt-0.5">
                            MAC: {matched["mac-address"] || "-"} · MTU:{" "}
                            {matched.mtu || "-"}
                          </p>
                        </div>
                        <IfaceBadge
                          running={matched.running}
                          disabled={matched.disabled}
                        />
                      </div>
                    );
                  })()}

                {/* Manual override status */}
                {!coreInterfaces.find(
                  (i) =>
                    i.name?.toLowerCase() === selectedEdge.label?.toLowerCase(),
                ) && (
                  <div className="flex justify-between items-center py-2.5 border-b border-slate-700/30">
                    <span className="text-xs text-slate-400">
                      Status Manual
                    </span>
                    <select
                      disabled={readOnly}
                      value={selectedEdge.status || "up"}
                      onChange={(e) =>
                        setEdgesFromUser((prev) =>
                          prev.map((ed) =>
                            ed.id === selectedEdge.id
                              ? { ...ed, status: e.target.value }
                              : ed,
                          ),
                        )
                      }
                      className="bg-slate-900 border border-slate-700 rounded-md p-1.5 text-xs text-slate-200 disabled:opacity-70"
                    >
                      <option value="up">Aktif (UP)</option>
                      <option value="down">Putus (DOWN)</option>
                    </select>
                  </div>
                )}

                {!readOnly && (
                  <button
                    onClick={() => {
                      markEdgeDeleted(selectedEdge.id);
                      setEdgesFromUser((prev) =>
                        prev.filter((e) => e.id !== selectedEdge.id),
                      );
                      setSelectedEdge(null);
                    }}
                    className="mt-auto flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white py-2.5 rounded-lg text-sm font-semibold transition"
                  >
                    <Trash2 size={16} /> Potong Kabel
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Topology() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full min-h-[200px] bg-slate-950 text-slate-400">
          Memuat Peta...
        </div>
      }
    >
      <TopologyContent />
    </Suspense>
  );
}
