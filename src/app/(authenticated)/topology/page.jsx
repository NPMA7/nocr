"use client";
import { useEffect, useState, useMemo, useRef } from "react";
import {
  Wifi,
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

import { hasAccess, getStoredUser } from "@/lib/roles";
import axios from "axios";
import {
  fetchTopologyCached,
  updateTopologyCacheLocally,
} from "@/lib/globalCache";
import TopologyToolbar from "@/components/topology/TopologyToolbar";
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

const INFRA_NODE_TYPES = ["olt", "odc", "odp"];

function isClientNode(node) {
  return (node?.type || "").toLowerCase() === "client";
}

function isInfrastructureNode(node) {
  return INFRA_NODE_TYPES.includes((node?.type || "").toLowerCase());
}

function checkIsPPPoENode(node, mappings = []) {
  if (!node) return false;
  if (node.type === "pppoe-client") return true;

  const iface = (node.linked_interface || node.label || "").toLowerCase();
  if (iface.includes("pppoe")) return true;

  if (node.linked_interface) {
    const m = mappings.find(
      (map) =>
        map.prefix &&
        map.prefix.toLowerCase() === node.linked_interface.toLowerCase(),
    );
    if (m && m.connection_type === "PPPOE") return true;
    if (m && m.connection_type === "L2TP") return false;
  }

  if (
    iface.includes("-opd") ||
    iface.includes("opd") ||
    iface.includes("dinas") ||
    iface.includes("badan") ||
    iface.includes("kantor") ||
    iface.includes("bag-") ||
    iface.includes("bagian") ||
    iface.includes("setda") ||
    iface.includes("diskominfo") ||
    iface.includes("satpol") ||
    iface.includes("bapperida") ||
    iface.includes("bkpsdm") ||
    iface.includes("kesbangpol") ||
    iface.includes("inspektorat") ||
    iface.includes("sekwan") ||
    iface.includes("dishub") ||
    iface.includes("disperindag") ||
    iface.includes("dispar") ||
    iface.includes("dispakan") ||
    iface.includes("distan") ||
    iface.includes("dinkes") ||
    iface.includes("disdik") ||
    iface.includes("disdukcapil") ||
    iface.includes("dinsos") ||
    iface.includes("dpmd") ||
    iface.includes("putr") ||
    iface.includes("bapenda") ||
    iface.includes("bkad")
  ) {
    return true;
  }

  return false;
}

const TopologyMap = dynamic(() => import("@/components/TopologyMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-900 flex items-center justify-center text-slate-400">
      Memuat Peta...
    </div>
  ),
});

import ConflictModal from "@/components/topology/ConflictModal";
import ManualAddNodeModal from "@/components/topology/ManualAddNodeModal";
import NodeDetailsSidebar from "@/components/topology/NodeDetailsSidebar";
import EdgeDetailsSidebar from "@/components/topology/EdgeDetailsSidebar";
import CoreInterfacePanel from "@/components/topology/CoreInterfacePanel";
import { StatusBadge, IfaceBadge } from "@/components/topology/StatusBadge";

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
  const [activeNodeTab, setActiveNodeTab] = useState("informasi");
  const [networkMode, setNetworkMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("nocr_topology_network_mode") || "l2tp";
    }
    return "l2tp";
  });
  const [splitMode, setSplitMode] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("nocr_topology_split_mode");
      return saved === "horizontal" ? "horizontal" : null;
    }
    return null;
  });

  // Simpan preferensi mode jaringan ke localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && networkMode) {
      localStorage.setItem("nocr_topology_network_mode", networkMode);
    }
  }, [networkMode]);

  // Simpan preferensi split mode ke localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (splitMode) {
        localStorage.setItem("nocr_topology_split_mode", splitMode);
      } else {
        localStorage.removeItem("nocr_topology_split_mode");
      }
    }
  }, [splitMode]);

  const [interactionMode, setInteractionMode] = useState("select");
  const [newNodeType, setNewNodeType] = useState("odp");
  const [linkStartNode, setLinkStartNode] = useState(null);
  const [deviceConfig, setDeviceConfig] = useState(null);
  const [toasts, setToasts] = useState([]);
  const { sessionUser, setLastSyncTime } = useAppState();
  const [canCreate, setCanCreate] = useState(false);
  const [canUpdate, setCanUpdate] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const canEdit = canCreate || canUpdate || canDelete;
  const readOnly = !canEdit;
  const [saving, setSaving] = useState(false);

  // Presence & conflict states
  const [nodePresenceMap, setNodePresenceMap] = useState({}); // { nodeId: { username, userId } }
  const [conflictQueue, setConflictQueue] = useState([]); // array of conflict objects to resolve
  const [forceSaveQueue, setForceSaveQueue] = useState([]); // nodes user pilih untuk force-save

  const syncEditPermission = () => {
    const userData = getStoredUser();
    setCanCreate(hasAccess(userData, "topology", "create"));
    setCanUpdate(hasAccess(userData, "topology", "update"));
    setCanDelete(hasAccess(userData, "topology", "delete"));
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
  const [flyToTargetOPD, setFlyToTargetOPD] = useState(null);

  // States untuk fitur pencarian lokasi OpenStreetMap (Nominatim)
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const extractCoordinates = async () => {
    if (!manualAddData.addressSearch) return;

    const query = manualAddData.addressSearch.trim();

    try {
      setIsSearching(true);
      const res = await axios.get(
        `/api/topology/geocode?q=${encodeURIComponent(query)}`,
      );

      if (res.data?.extracted) {
        const { lat, lng, label, type, plusCode } = res.data.extracted;
        setManualAddData((prev) => ({
          ...prev,
          lat,
          lng,
          addressSearch: query,
          label: prev.label || label,
        }));
        const toastMsg =
          type === "pluscode"
            ? `Plus Code ${plusCode || ""} berhasil diekstrak! (${lat}, ${lng})`
            : `Titik koordinat berhasil diekstrak! (${lat}, ${lng})`;
        addToast(toastMsg, "success");
        setSearchSuggestions([]);
        return;
      }

      if (res.data?.results && res.data.results.length > 0) {
        setSearchSuggestions(res.data.results);
      } else {
        addToast(
          "Lokasi tidak ditemukan. Coba ketik nama tempat / desa / kecamatan.",
          "error",
        );
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
  const [showIfacePanel, setShowIfacePanel] = useState(true);
  const [liveLogs, setLiveLogs] = useState([]);
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
          type:
            m.connection_type === "PPPOE" ? "PPPoE Gabungan" : "L2TP Gabungan",
          label: m.prefix,
          isMapping: true,
        });
      }
    });
    (coreInterfaces || []).forEach((i) => {
      // Jangan masukkan l2tp-in atau pppoe-in lagi karena sudah digantikan oleh Gabungan (mappings)
      if (
        i.type &&
        (i.type.toLowerCase() === "l2tp-in" ||
          i.type.toLowerCase() === "pppoe-in")
      )
        return;

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
  const isFirstRender = useRef(true);

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

  const fetchTopology = async (showToast = false, forceRefresh = false) => {
    try {
      const data = await fetchTopologyCached(forceRefresh);
      const loadedNodes = data.nodes || [];
      const loadedEdges = data.edges || [];
      revisionRef.current = data.revision || null;
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
      // Fetch berurutan untuk mencegah bentrok koneksi (race condition) ke RouterOS
      const statusRes = await axios
        .get(`${API_URL}/devices/core/status`)
        .catch(() => ({ data: null }));
      const ifaceRes = await axios
        .get(`${API_URL}/devices/core/interfaces`)
        .catch(() => ({ data: [] }));

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
      updateTopologyCacheLocally({
        nodes: payload.nodes,
        edges: payload.edges || [],
        revision: payload.revision,
      });
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

    const handleActivityLog = (data) => {
      const msg = data?.message || data?.msg || "";
      if (msg.toLowerCase().includes("berubah menjadi")) {
        setLiveLogs((prev) =>
          [
            { time: data.time ? new Date(data.time) : new Date(), msg },
            ...prev,
          ].slice(0, 30),
        );
      }
    };

    if (socket) {
      socket.on("device-status", handleMetricsUpdate);
      socket.on("topology_updated", handleTopologyUpdated);
      socket.on("mikrotik_full_update", handleMikrotikUpdate);
      socket.on("mappings_updated", handleMappingsUpdate);
      socket.on("activity_log_updated", handleActivityLog);
      socket.on("status", handleActivityLog);
      socket.on("node_presence", (presenceMap) => {
        setNodePresenceMap(presenceMap || {});
      });
    }
    // Load initial logs
    axios
      .get(`${API_URL}/activity-logs`)
      .then((res) => {
        if (Array.isArray(res.data)) {
          const filtered = res.data
            .filter((l) =>
              (l.message || "").toLowerCase().includes("berubah menjadi"),
            )
            .slice(0, 30)
            .map((l) => ({ time: new Date(l.time), msg: l.message }));
          setLiveLogs(filtered);
        }
      })
      .catch(() => {});

    return () => {
      if (socket) {
        socket.off("device-status", handleMetricsUpdate);
        socket.off("topology_updated", handleTopologyUpdated);
        socket.off("mikrotik_full_update", handleMikrotikUpdate);
        socket.off("mappings_updated", handleMappingsUpdate);
        socket.off("activity_log_updated", handleActivityLog);
        socket.off("status", handleActivityLog);
        socket.off("node_presence");
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
        const isPPPoE = checkIsPPPoENode(targetNode, mappings);
        const requiredMode = isPPPoE ? "pppoe" : "l2tp";
        if (networkMode !== requiredMode) {
          setNetworkMode(requiredMode);
        }

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
  }, [focusId, nodes, mappings, networkMode]);

  useEffect(() => {
    if (selectedNode) {
      // Emit lock ke server — hanya jika canEdit
      if (canEdit && socket && selectedNode.id) {
        socket.emit("node_lock", {
          nodeId: selectedNode.id,
          userId: sessionUser?.id || sessionUser?.username || "unknown",
          username: sessionUser?.username || sessionUser?.name || "Editor",
        });
      }
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
      // Deselect: lepas lock
      if (canEdit && socket) {
        const prevId = nodesRef.current; // we track via selectedNode prev
        // Unlock semua lock milik kita saat tidak ada node terpilih
        socket.emit("node_unlock", { nodeId: "__all__" });
      }
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
    if (!canCreate) return;
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
      if (!canCreate) return;
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

  const saveLayout = async (forceNodes = []) => {
    if (readOnly) {
      addToast("Readonly", "error");
      return;
    }

    if (saving) return;

    try {
      setSaving(true);

      const upsertNodes = getDeltaNodes(nodes, baselineNodesRef.current);
      const upsertEdges = getDeltaEdges(edges, baselineEdgesRef.current);

      // Gabungkan force-save nodes (dari conflict resolution "Pakai versimu")
      const forceSaveIds = new Set(forceNodes.map((n) => n.id));
      const mergedUpsert = [
        ...upsertNodes.filter((n) => !forceSaveIds.has(n.id)),
        ...forceNodes,
      ];

      const res = await axios.post(`${API_URL}/topology`, {
        nodes: mergedUpsert,
        edges: upsertEdges,
        deletedNodeIds: Array.from(deletedNodeIdsRef.current),
        deletedEdgeIds: Array.from(deletedEdgeIdsRef.current),
        baseRevision: revisionRef.current,
      });

      const savedNodes = res.data.nodes || nodes;
      const savedEdges = res.data.edges || edges;

      revisionRef.current = res.data.revision || revisionRef.current;

      applyTopologyFromServer(savedNodes, savedEdges);
      updateTopologyCacheLocally(res.data);

      // Handle konflik dari server
      const serverConflicts = res.data.conflicts || [];
      if (serverConflicts.length > 0) {
        setConflictQueue(serverConflicts);
        addToast(
          `${serverConflicts.length} node berkonflik dengan perubahan user lain`,
          "error",
        );
      } else {
        addToast("Peta berhasil disimpan!", "success");
      }

      // Unlock semua node setelah save
      if (socket) {
        socket.emit("node_unlock", { nodeId: "__all__" });
      }
    } catch (e) {
      console.error(e);

      addToast(
        "Gagal menyimpan peta: " + (e.response?.data?.error || e.message),
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  /** User memilih "Pakai versimu" untuk semua konflik yang dicentang */
  const resolveConflictsForce = (selectedIds) => {
    const forcedNodes = conflictQueue
      .filter((c) => selectedIds.has(c.id))
      .map((c) => ({
        ...c.clientVersion,
        last_modified_at: null, // reset supaya server stamps ulang
      }));
    setConflictQueue([]);
    if (forcedNodes.length > 0) {
      saveLayout(forcedNodes);
    }
  };

  /** User memilih "Pakai versi server" — update local nodes ke versi DB */
  const resolveConflictsAcceptServer = (selectedIds) => {
    const serverNodes = conflictQueue
      .filter((c) => selectedIds.has(c.id))
      .map((c) => c.dbVersion);
    setConflictQueue([]);
    if (serverNodes.length > 0) {
      setNodes((prev) =>
        prev.map((n) => {
          const sv = serverNodes.find((s) => s.id === n.id);
          return sv ? { ...n, ...sv } : n;
        }),
      );
      addToast("Versi server diterapkan ke node yang konflik", "info");
    }
  };

  // Group interfaces by type for display
  // Group interfaces by type for display
  const ifaceGroups = useMemo(() => {
    const groups = {};
    const filteredCore = coreInterfaces.filter(
      (i) =>
        (!ifacePanelSearch ||
          (i.name &&
            i.name.toLowerCase().includes(ifacePanelSearch.toLowerCase()))) &&
        i.type !== "l2tp-in" &&
        i.type !== "pppoe-in",
    );

    filteredCore.forEach((i) => {
      const t = i.type || "other";
      if (!groups[t]) groups[t] = [];
      groups[t].push(i);
    });

    const filteredMappings = mappings.filter(
      (m) =>
        !ifacePanelSearch ||
        (m.prefix &&
          m.prefix.toLowerCase().includes(ifacePanelSearch.toLowerCase())) ||
        (m.mikrotik_alias &&
          m.mikrotik_alias
            .toLowerCase()
            .includes(ifacePanelSearch.toLowerCase())),
    );

    if (filteredMappings.length > 0) {
      const l2tpMappings = filteredMappings.filter(
        (m) => m.connection_type !== "PPPOE",
      );
      const pppoeMappings = filteredMappings.filter(
        (m) => m.connection_type === "PPPOE",
      );

      if (l2tpMappings.length > 0) {
        groups["l2tp-in (gabungan)"] = l2tpMappings.map((m) => ({
          name: m.prefix || m.mikrotik_alias || m.ruijie_mac,
          running: m.final_status === "Online" ? "true" : "false",
          disabled: "false",
        }));
      }
      if (pppoeMappings.length > 0) {
        groups["pppoe-in (gabungan)"] = pppoeMappings.map((m) => ({
          name: m.prefix || m.mikrotik_alias || m.ruijie_mac,
          running: m.final_status === "Online" ? "true" : "false",
          disabled: "false",
        }));
      }
    }

    return groups;
  }, [coreInterfaces, ifacePanelSearch, mappings]);

  const { runningCount, downCount, l2tpOnlineGabungan } = useMemo(() => {
    let up = 0,
      down = 0,
      l2tpOnline = 0;
    coreInterfaces.forEach((i) => {
      if (i.type === "l2tp-in" || i.type === "pppoe-in") return; // exclude raw interfaces
      if (i.running === "true" && i.disabled !== "true") up++;
      else if (i.disabled !== "true") down++;
    });
    mappings.forEach((m) => {
      if (m.final_status === "Online") {
        up++;
        if (m.connection_type !== "PPPOE") l2tpOnline++;
      } else down++;
    });
    return {
      runningCount: up,
      downCount: down,
      l2tpOnlineGabungan: l2tpOnline,
    };
  }, [coreInterfaces, mappings]);

  const { totalWilayah, desaOffline, opdOffline, siteAktif } = useMemo(() => {
    const total = mappings.length;
    const dOffline = mappings.filter(
      (m) => m.connection_type !== "PPPOE" && m.final_status !== "Online",
    ).length;
    const oOffline = mappings.filter(
      (m) => m.connection_type === "PPPOE" && m.final_status !== "Online",
    ).length;
    return {
      totalWilayah: total,
      desaOffline: dOffline,
      opdOffline: oOffline,
      siteAktif: Math.max(0, total - dOffline - oOffline),
    };
  }, [mappings]);

  const mapNodes = useMemo(() => {
    let filtered = nodes;

    // 1. Build strict directed tree outward from OLTs (ignores how user drew the edges)
    const undirectedAdj = {};
    const nodeMap = new Map();
    nodes.forEach((n) => {
      undirectedAdj[n.id] = [];
      nodeMap.set(n.id, n);
    });
    edges.forEach((e) => {
      const from = e.from_node ?? e.from;
      const to = e.to_node ?? e.to;
      if (undirectedAdj[from] && undirectedAdj[to]) {
        undirectedAdj[from].push(to);
        undirectedAdj[to].push(from);
      }
    });

    const directedAdj = {};
    nodes.forEach((n) => (directedAdj[n.id] = []));

    const visitedBFS = new Set();
    const queue = [];

    // Prioritas 1: OLT sebagai Root
    nodes
      .filter((n) => n.type === "olt")
      .forEach((n) => {
        visitedBFS.add(n.id);
        queue.push(n.id);
      });

    // Prioritas 2 & 3: ODC dan ODP jika ada komponen yang terputus dari OLT
    const processQueue = () => {
      while (queue.length > 0) {
        const curr = queue.shift();
        for (const neighbor of undirectedAdj[curr]) {
          if (!visitedBFS.has(neighbor)) {
            visitedBFS.add(neighbor);
            directedAdj[curr].push(neighbor); // Arahkan Edge dari Root ke Child
            queue.push(neighbor);
          }
        }
      }
    };

    processQueue();

    nodes
      .filter((n) => n.type === "odc" && !visitedBFS.has(n.id))
      .forEach((n) => {
        visitedBFS.add(n.id);
        queue.push(n.id);
      });
    processQueue();

    nodes
      .filter((n) => n.type === "odp" && !visitedBFS.has(n.id))
      .forEach((n) => {
        visitedBFS.add(n.id);
        queue.push(n.id);
      });
    processQueue();

    // 2. Count downstream clients for each node
    const counts = {}; // id -> { l2tp: 0, pppoe: 0 }
    const visiting = new Set();

    const getCounts = (id) => {
      if (counts[id]) return counts[id];
      if (visiting.has(id)) return { l2tp: 0, pppoe: 0 }; // Cycle detection
      visiting.add(id);

      const res = { l2tp: 0, pppoe: 0 };
      const node = nodeMap.get(id);

      if (node) {
        if (node.type === "client" || node.type === "pppoe-client") {
          let isPPPoE =
            node.linked_interface?.toLowerCase().includes("pppoe") ||
            node.type === "pppoe-client";

          if (!isPPPoE && node.linked_interface) {
            const m = mappings.find(
              (map) =>
                map.prefix &&
                map.prefix.toLowerCase() ===
                  node.linked_interface.toLowerCase(),
            );
            if (m && m.connection_type === "PPPOE") isPPPoE = true;
          }
          if (isPPPoE) res.pppoe++;
          else res.l2tp++;
        }
      }

      for (const child of directedAdj[id] || []) {
        const childCounts = getCounts(child);
        res.l2tp += childCounts.l2tp;
        res.pppoe += childCounts.pppoe;
      }

      counts[id] = res;
      visiting.delete(id);
      return res;
    };

    nodes.forEach((n) => getCounts(n.id));

    // 3. Filter nodes
    filtered = filtered.filter((n) => {
      if (n.type === "client" || n.type === "pppoe-client") {
        let isPPPoE =
          n.linked_interface?.toLowerCase().includes("pppoe") ||
          n.type === "pppoe-client";

        if (!isPPPoE && n.linked_interface) {
          const m = mappings.find(
            (map) =>
              map.prefix &&
              map.prefix.toLowerCase() === n.linked_interface.toLowerCase(),
          );
          if (m && m.connection_type === "PPPOE") isPPPoE = true;
        }

        if (!n.linked_interface && n.type === "client") return true; // Selalu tampilkan node baru yang belum ditautkan

        if (networkMode === "l2tp") return !isPPPoE;
        if (networkMode === "pppoe") return isPPPoE;
      } else {
        // Infrastructure nodes
        const c = counts[n.id] || { l2tp: 0, pppoe: 0 };

        if (networkMode === "l2tp") {
          // Hide ONLY if it strictly serves PPPoE clients (no L2TP clients)
          if (c.pppoe > 0 && c.l2tp === 0) return false;
          return true; // Keep if shared or empty
        }
        if (networkMode === "pppoe") {
          // Hide ONLY if it strictly serves L2TP clients (no PPPoE clients)
          if (c.l2tp > 0 && c.pppoe === 0) return false;
          return true; // Keep if shared or empty
        }
      }
      return true;
    });

    if (nodeViewFilter === "client") return filtered.filter(isClientNode);
    if (nodeViewFilter === "infrastructure")
      return filtered.filter(isInfrastructureNode);
    return filtered;
  }, [nodes, edges, nodeViewFilter, networkMode]);

  // Shared BFS topology counts — reused by mapNodes, mapNodesOPD, mapNodesDesa
  const nodeTopoData = useMemo(() => {
    const undirectedAdj = {};
    const nodeMap = new Map();
    nodes.forEach((n) => {
      undirectedAdj[n.id] = [];
      nodeMap.set(n.id, n);
    });
    edges.forEach((e) => {
      const from = e.from_node ?? e.from;
      const to = e.to_node ?? e.to;
      if (undirectedAdj[from] && undirectedAdj[to]) {
        undirectedAdj[from].push(to);
        undirectedAdj[to].push(from);
      }
    });

    const directedAdj = {};
    nodes.forEach((n) => (directedAdj[n.id] = []));

    const visitedBFS = new Set();
    const queue = [];

    nodes
      .filter((n) => n.type === "olt")
      .forEach((n) => {
        visitedBFS.add(n.id);
        queue.push(n.id);
      });

    const processQueue = () => {
      while (queue.length > 0) {
        const curr = queue.shift();
        for (const neighbor of undirectedAdj[curr]) {
          if (!visitedBFS.has(neighbor)) {
            visitedBFS.add(neighbor);
            directedAdj[curr].push(neighbor);
            queue.push(neighbor);
          }
        }
      }
    };

    processQueue();
    nodes
      .filter((n) => n.type === "odc" && !visitedBFS.has(n.id))
      .forEach((n) => {
        visitedBFS.add(n.id);
        queue.push(n.id);
      });
    processQueue();
    nodes
      .filter(
        (n) => (n.type === "odp" || n.type === "pole") && !visitedBFS.has(n.id),
      )
      .forEach((n) => {
        visitedBFS.add(n.id);
        queue.push(n.id);
      });
    processQueue();

    const counts = {};
    const visiting = new Set();

    const getCounts = (id) => {
      if (counts[id]) return counts[id];
      if (visiting.has(id)) return { l2tp: 0, pppoe: 0 };
      visiting.add(id);

      const res = { l2tp: 0, pppoe: 0 };
      const node = nodeMap.get(id);
      if (node && (node.type === "client" || node.type === "pppoe-client")) {
        let isPPPoE =
          node.linked_interface?.toLowerCase().includes("pppoe") ||
          node.type === "pppoe-client";
        if (!isPPPoE && node.linked_interface) {
          const m = mappings.find(
            (map) =>
              map.prefix &&
              map.prefix.toLowerCase() === node.linked_interface.toLowerCase(),
          );
          if (m && m.connection_type === "PPPOE") isPPPoE = true;
        }
        if (isPPPoE) res.pppoe++;
        else res.l2tp++;
      }

      for (const child of directedAdj[id] || []) {
        const childCounts = getCounts(child);
        res.l2tp += childCounts.l2tp;
        res.pppoe += childCounts.pppoe;
      }

      counts[id] = res;
      visiting.delete(id);
      return res;
    };

    nodes.forEach((n) => getCounts(n.id));
    return { counts, nodeMap };
  }, [nodes, edges, mappings]);

  // Split mode: nodes OPD (pppoe) — infrastructure difilter berdasarkan BFS counts
  const mapNodesOPD = useMemo(() => {
    const { counts } = nodeTopoData;
    return nodes
      .filter((n) => {
        if (n.type === "client" || n.type === "pppoe-client") {
          let isPPPoE =
            n.linked_interface?.toLowerCase().includes("pppoe") ||
            n.type === "pppoe-client";
          if (!isPPPoE && n.linked_interface) {
            const m = mappings.find(
              (map) =>
                map.prefix &&
                map.prefix.toLowerCase() === n.linked_interface.toLowerCase(),
            );
            if (m && m.connection_type === "PPPOE") isPPPoE = true;
          }
          if (!n.linked_interface && n.type === "client") return true;
          return isPPPoE;
        }
        // Infrastructure: sembunyikan jika hanya melayani desa (l2tp)
        const c = counts[n.id] || { l2tp: 0, pppoe: 0 };
        if (c.l2tp > 0 && c.pppoe === 0) return false;
        return true;
      })
      .filter((n) => {
        if (nodeViewFilter === "client") return isClientNode(n);
        if (nodeViewFilter === "infrastructure") return isInfrastructureNode(n);
        return true;
      });
  }, [nodeTopoData, nodes, nodeViewFilter, mappings]);

  // Split mode: nodes Desa (l2tp) — infrastructure difilter berdasarkan BFS counts
  const mapNodesDesa = useMemo(() => {
    const { counts } = nodeTopoData;
    return nodes
      .filter((n) => {
        if (n.type === "client" || n.type === "pppoe-client") {
          let isPPPoE =
            n.linked_interface?.toLowerCase().includes("pppoe") ||
            n.type === "pppoe-client";
          if (!isPPPoE && n.linked_interface) {
            const m = mappings.find(
              (map) =>
                map.prefix &&
                map.prefix.toLowerCase() === n.linked_interface.toLowerCase(),
            );
            if (m && m.connection_type === "PPPOE") isPPPoE = true;
          }
          if (!n.linked_interface && n.type === "client") return true;
          return !isPPPoE;
        }
        // Infrastructure: sembunyikan jika hanya melayani OPD (pppoe)
        const c = counts[n.id] || { l2tp: 0, pppoe: 0 };
        if (c.pppoe > 0 && c.l2tp === 0) return false;
        return true;
      })
      .filter((n) => {
        if (nodeViewFilter === "client") return isClientNode(n);
        if (nodeViewFilter === "infrastructure") return isInfrastructureNode(n);
        return true;
      });
  }, [nodeTopoData, nodes, nodeViewFilter, mappings]);

  const mapNodeIdsOPD = useMemo(
    () => new Set(mapNodesOPD.map((n) => n.id)),
    [mapNodesOPD],
  );
  const mapNodeIdsDesa = useMemo(
    () => new Set(mapNodesDesa.map((n) => n.id)),
    [mapNodesDesa],
  );

  const mapEdgesOPD = useMemo(() => {
    return edges.filter((e) => {
      const fromId = e.from_node ?? e.from;
      const toId = e.to_node ?? e.to;
      return mapNodeIdsOPD.has(fromId) && mapNodeIdsOPD.has(toId);
    });
  }, [edges, mapNodeIdsOPD]);

  const mapEdgesDesa = useMemo(() => {
    return edges.filter((e) => {
      const fromId = e.from_node ?? e.from;
      const toId = e.to_node ?? e.to;
      return mapNodeIdsDesa.has(fromId) && mapNodeIdsDesa.has(toId);
    });
  }, [edges, mapNodeIdsDesa]);

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

  const activeVisibleNodeIds = useMemo(() => {
    if (splitMode) {
      return new Set([...mapNodeIdsOPD, ...mapNodeIdsDesa]);
    }
    return mapNodeIds;
  }, [splitMode, mapNodeIdsOPD, mapNodeIdsDesa, mapNodeIds]);

  const activeVisibleEdgeIds = useMemo(() => {
    if (splitMode) {
      const allEdges = [...mapEdgesOPD, ...mapEdgesDesa];
      return new Set(allEdges.map((e) => e.id));
    }
    return new Set(mapEdges.map((e) => e.id));
  }, [splitMode, mapEdgesOPD, mapEdgesDesa, mapEdges]);

  useEffect(() => {
    if (selectedNode && !activeVisibleNodeIds.has(selectedNode.id)) {
      setSelectedNode(null);
      setNodeDetail(null);
    }
    if (selectedEdge && !activeVisibleEdgeIds.has(selectedEdge.id)) {
      setSelectedEdge(null);
    }
  }, [nodeViewFilter, activeVisibleNodeIds, activeVisibleEdgeIds, selectedNode, selectedEdge]);

  // Auto-zoom panel OPD saat split mode diaktifkan
  useEffect(() => {
    if (splitMode === "horizontal") {
      // Delay 700ms agar Leaflet map OPD sempat fully initialize
      const timer = setTimeout(() => {
        const validNodes = mapNodesOPD.filter(
          (n) => !isNaN(parseFloat(n.latitude)) && !isNaN(parseFloat(n.longitude))
        );
        if (validNodes.length > 0) {
          // Gunakan reduce (bukan spread) agar aman untuk array besar
          const lats = validNodes.map((n) => parseFloat(n.latitude));
          const lngs = validNodes.map((n) => parseFloat(n.longitude));
          const minLat = lats.reduce((a, b) => Math.min(a, b), Infinity);
          const maxLat = lats.reduce((a, b) => Math.max(a, b), -Infinity);
          const minLng = lngs.reduce((a, b) => Math.min(a, b), Infinity);
          const maxLng = lngs.reduce((a, b) => Math.max(a, b), -Infinity);
          setFlyToTargetOPD({
            bounds: [[minLat, minLng], [maxLat, maxLng]],
          });
        }
      }, 700);
      return () => clearTimeout(timer);
    } else {
      setFlyToTargetOPD(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splitMode]);

  return (
    <div className="flex flex-col h-full min-h-0 -m-4 md:-m-6 relative overflow-hidden bg-slate-950">
      {/* Map Control Toolbar */}
      <TopologyToolbar
        readOnly={readOnly}
        canEdit={canEdit}
        canCreate={canCreate}
        canUpdate={canUpdate}
        canDelete={canDelete}
        interactionMode={interactionMode}
        setInteractionMode={setInteractionMode}
        setLinkStartNode={setLinkStartNode}
        setShowManualAddModal={setShowManualAddModal}
        setManualIfaceSearch={setManualIfaceSearch}
        setShowManualIfaceDropdown={setShowManualIfaceDropdown}
        networkMode={networkMode}
        setNetworkMode={setNetworkMode}
        setFlyToTarget={setFlyToTarget}
        showMobileMode={showMobileMode}
        setShowMobileMode={setShowMobileMode}
        newNodeType={newNodeType}
        setNewNodeType={setNewNodeType}
        linkStartNode={linkStartNode}
        fetchTopology={fetchTopology}
        fetchCoreData={fetchCoreData}
        coreLoading={coreLoading}
        saveLayout={saveLayout}
        saving={saving}
      />

      {/* Map Container */}
      <div className="flex-1 min-h-0 flex relative">
        {/* Toasts */}
        <div className="absolute top-4 right-4 z-[9999] flex flex-col items-end gap-2 pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`px-4 py-3 max-w-md break-words rounded-xl shadow-2xl backdrop-blur-md font-medium text-xs animate-fade-in ${t.type === "error" ? "bg-red-500/90 text-white border border-red-400/50" : "bg-emerald-500/90 text-white border border-emerald-400/50"}`}
            >
              {t.msg}
            </div>
          ))}
        </div>

        <ManualAddNodeModal
          canCreate={canCreate}
          showManualAddModal={showManualAddModal}
          setShowManualAddModal={setShowManualAddModal}
          manualAddData={manualAddData}
          setManualAddData={setManualAddData}
          manualIfaceSearch={manualIfaceSearch}
          setManualIfaceSearch={setManualIfaceSearch}
          showManualIfaceDropdown={showManualIfaceDropdown}
          setShowManualIfaceDropdown={setShowManualIfaceDropdown}
          searchSuggestions={searchSuggestions}
          setSearchSuggestions={setSearchSuggestions}
          isSearching={isSearching}
          extractCoordinates={extractCoordinates}
          handleAddNode={handleAddNode}
          setFlyToTarget={setFlyToTarget}
          addToast={addToast}
          combinedInterfaceOptions={combinedInterfaceOptions}
          nodes={nodes}
        />

        {/* Conflict Resolution Modal */}
        {conflictQueue.length > 0 && (
          <ConflictModal
            conflicts={conflictQueue}
            onForce={resolveConflictsForce}
            onAcceptServer={resolveConflictsAcceptServer}
            onDismiss={() => setConflictQueue([])}
          />
        )}

        <div className="flex-1 w-full relative z-0 flex flex-col">
          {/* Left Panel — MikroTik Core Live Status & Floating Panels */}
          <CoreInterfacePanel
            coreStatus={coreStatus}
            siteAktif={siteAktif}
            siteOffline={desaOffline + opdOffline}
            showIfacePanel={showIfacePanel}
            setShowIfacePanel={setShowIfacePanel}
            liveLogs={liveLogs}
            showMobileMode={showMobileMode}
            networkMode={networkMode}
            setNetworkMode={setNetworkMode}
            setFlyToTarget={setFlyToTarget}
            mapTheme={mapTheme}
            setMapTheme={setMapTheme}
            showLabels={showLabels}
            setShowLabels={setShowLabels}
            nodeViewFilter={nodeViewFilter}
            setNodeViewFilter={setNodeViewFilter}
            splitMode={splitMode}
            setSplitMode={setSplitMode}
          />

          {splitMode ? (
            // Split View: Desa (kiri) | OPD (kanan)
            <div className="flex-1 min-h-0 flex flex-row">
              {/* Panel Desa (L2TP) */}
              <div className="flex-1 min-h-0 min-w-0 relative">
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[900] pointer-events-none">
                  <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-blue-600 text-white shadow-lg backdrop-blur-sm tracking-wide">
                    Jaringan Desa
                  </span>
                </div>
                <TopologyMap
                  center={[-7.065, 107.55]}
                  zoom={11}
                  mapTheme={mapTheme}
                  showLabels={showLabels}
                  nodes={mapNodesDesa}
                  edges={mapEdgesDesa}
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
                  flyToTarget={networkMode === "l2tp" ? flyToTarget : null}
                  onFlyToComplete={() => setFlyToTarget(null)}
                  onEdgeDelete={markEdgeDeleted}
                  readOnly={readOnly}
                />
              </div>

              {/* Divider vertikal */}
              <div className="flex-shrink-0 w-0.5 bg-slate-700" />

              {/* Panel OPD (PPPoE) */}
              <div className="flex-1 min-h-0 min-w-0 relative">
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[900] pointer-events-none">
                  <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-blue-600 text-white shadow-lg backdrop-blur-sm tracking-wide">
                    Jaringan OPD
                  </span>
                </div>
                <TopologyMap
                  center={[-7.0225, 107.527]}
                  zoom={16}
                  mapTheme={mapTheme}
                  showLabels={showLabels}
                  nodes={mapNodesOPD}
                  edges={mapEdgesOPD}
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
                  flyToTarget={flyToTargetOPD ?? (networkMode === "pppoe" ? flyToTarget : null)}
                  onFlyToComplete={() => { setFlyToTargetOPD(null); setFlyToTarget(null); }}
                  onEdgeDelete={markEdgeDeleted}
                  readOnly={readOnly}
                />
              </div>
            </div>
          ) : (
            // Normal single map
            <TopologyMap
              center={
                networkMode === "pppoe" ? [-7.0225, 107.527] : [-7.065, 107.55]
              }
              zoom={networkMode === "pppoe" ? 16 : 11}
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
          )}
        </div>

        {/* Node Sidebar */}
        <NodeDetailsSidebar
          currentSelectedNode={currentSelectedNode}
          setSelectedNode={setSelectedNode}
          setFlyToTarget={setFlyToTarget}
          readOnly={readOnly}
          canDelete={canDelete}
          nodePresenceMap={nodePresenceMap}
          sessionUser={sessionUser}
          combinedInterfaceOptions={combinedInterfaceOptions}
          mappings={mappings}
          coreInterfaces={coreInterfaces}
          nodeIfaceSearch={nodeIfaceSearch}
          setNodeIfaceSearch={setNodeIfaceSearch}
          showNodeIfaceDropdown={showNodeIfaceDropdown}
          setShowNodeIfaceDropdown={setShowNodeIfaceDropdown}
          setNodesFromUser={setNodesFromUser}
          setEdgesFromUser={setEdgesFromUser}
          nodeDetail={nodeDetail}
          markNodeDeleted={markNodeDeleted}
          nodes={nodes}
        />

        {/* Edge Sidebar */}
        <EdgeDetailsSidebar
          selectedEdge={selectedEdge}
          setSelectedEdge={setSelectedEdge}
          readOnly={readOnly}
          canDelete={canDelete}
          setEdgesFromUser={setEdgesFromUser}
          coreInterfaces={coreInterfaces}
          markEdgeDeleted={markEdgeDeleted}
        />
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
