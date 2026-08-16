"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Router,
  ArrowUpRight,
  AlertTriangle,
  Users,
  Map as MapIcon,
  Cpu,
  Clock,
  HardDrive,
  Server,
  CheckCircle2,
  AlertCircle,
  Info,
  Settings,
} from "lucide-react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { fetchTopologyCached } from "@/lib/globalCache";
import { API_URL, socket, useAppState } from "@/App";
import { getStoredUser, hasAccess, getDefaultAccessibleRoute } from "@/lib/roles";
import dynamic from "next/dynamic";
import CoreResourceCard from "@/components/dashboard/CoreResourceCard";
import StatCard from "@/components/dashboard/StatCard";
import ActivityLogList from "@/components/dashboard/ActivityLogList";

const DashboardMap = dynamic(() => import("@/components/DashboardMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-800 flex items-center justify-center text-slate-400">
      Memuat Peta...
    </div>
  ),
});

const POLL_INTERVAL_MS = 300000; // Ditingkatkan ke 5m (Realtime ditangani oleh WebSockets)

export default function Dashboard() {
  const router = useRouter();
  const { isConnected, setLastSyncTime, sessionUser } = useAppState();

  const [coreStatus, setCoreStatus] = useState(null);
  const [coreInterfaces, setCoreInterfaces] = useState([]);
  const [edges, setEdges] = useState([]);
  const [topologyNodes, setTopologyNodes] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [ruijieDevices, setRuijieDevices] = useState([]);
  const [mapTheme, setMapTheme] = useState("colored");
  const [networkMode, setNetworkMode] = useState("pppoe");
  const [dbLogs, setDbLogs] = useState([]); // State penampung log aktivitas dari database
  const mountedRef = useRef(true);

  const [hasReadAccess, setHasReadAccess] = useState(true);

  useEffect(() => {
    const user = sessionUser?.role ? sessionUser : getStoredUser();
    if (user && user.role) {
      if (!hasAccess(user, "dashboard", "read")) {
        setHasReadAccess(false);
        const target = getDefaultAccessibleRoute(user);
        if (target && target !== "/dashboard") {
          router.replace(target);
        }
      } else {
        setHasReadAccess(true);
      }
    }
  }, [sessionUser, router]);

  const getLogStyle = (msg) => {
    if (!msg)
      return {
        bgColor: "bg-blue-950/10 border-blue-500/20 text-slate-300",
        icon: "info",
      };
    const lowercaseMsg = msg.toLowerCase();
    if (lowercaseMsg.includes("berhasil") || lowercaseMsg.includes("online")) {
      return {
        bgColor: "bg-emerald-950/10 border-emerald-500/20 text-slate-300",
        icon: "check",
      };
    }
    if (
      lowercaseMsg.includes("gagal") ||
      lowercaseMsg.includes("offline") ||
      lowercaseMsg.includes("dihapus")
    ) {
      return {
        bgColor: "bg-rose-950/10 border-rose-500/20 text-slate-300",
        icon: "alert",
      };
    }
    if (
      lowercaseMsg.includes("simpan") ||
      lowercaseMsg.includes("diperbarui") ||
      lowercaseMsg.includes("ditambahkan")
    ) {
      return {
        bgColor: "bg-amber-950/10 border-amber-500/20 text-slate-300",
        icon: "settings",
      };
    }
    return {
      bgColor: "bg-blue-950/10 border-blue-500/20 text-slate-300",
      icon: "info",
    };
  };

  const fetchCoreStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/devices/core/status?max_age=12`);
      if (mountedRef.current) {
        setCoreStatus(res.data);
        setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
      }
    } catch {
      if (mountedRef.current) setCoreStatus(null);
    }
  }, [setLastSyncTime]);

  const fetchInterfaces = useCallback(async () => {
    try {
      const res = await axios.get(
        `${API_URL}/devices/core/interfaces?max_age=12`,
      );
      if (mountedRef.current) setCoreInterfaces(res.data || []);
    } catch {
      if (mountedRef.current) setCoreInterfaces([]);
    }
  }, []);

  const fetchTopology = useCallback(
    async (force = false) => {
      try {
        const data = await fetchTopologyCached(force);
        if (mountedRef.current) {
          setEdges(data.edges || []);
          setTopologyNodes(data.nodes || []);
          setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
        }
      } catch (e) {
        console.error(e);
      }
    },
    [setLastSyncTime],
  );

  // Mengambil data log langsung dari database melalui API backend
  const fetchLogs = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/activity-logs`);
      if (mountedRef.current) setDbLogs(res.data || []);
    } catch (e) {
      console.error("Gagal memuat log aktivitas dari database", e);
    }
  }, []);

  const fetchMappings = useCallback(async () => {
    try {
      const res = await axios.get("/api/mappings");
      if (mountedRef.current) setMappings(res.data || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchRuijie = useCallback(async () => {
    try {
      const res = await axios.get("/api/ruijie");
      if (mountedRef.current) setRuijieDevices(res.data || []);
    } catch (e) {
      console.error("Gagal memuat data Ruijie", e);
    }
  }, []);

  const fetchAllDashboardData = useCallback(async () => {
    // Jalankan secara sekuensial (berurutan) khusus untuk MikroTik untuk menghindari
    // bentrokan koneksi / race condition di API RouterOS yang membuat data hilang timbul
    await fetchCoreStatus();
    await fetchInterfaces();

    // Sisanya bisa paralel karena dari Supabase / backend lain
    await Promise.all([
      fetchTopology(),
      fetchLogs(),
      fetchMappings(),
      fetchRuijie(),
    ]);
  }, [
    fetchCoreStatus,
    fetchInterfaces,
    fetchTopology,
    fetchLogs,
    fetchMappings,
    fetchRuijie,
  ]);

  const applyTopologyPayload = useCallback(
    (nodes, edgesPayload) => {
      if (nodes) setTopologyNodes(nodes);
      if (edgesPayload) setEdges(edgesPayload);
      setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
    },
    [setLastSyncTime],
  );

  useEffect(() => {
    mountedRef.current = true;
    fetchAllDashboardData();

    const pollId = setInterval(fetchAllDashboardData, POLL_INTERVAL_MS);

    const handleCoreUpdate = (data) => {
      if (data) {
        setCoreStatus(data);
        setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
      }
    };

    const handleTopologyUpdated = (payload) => {
      if (payload?.nodes)
        applyTopologyPayload(payload.nodes, payload.edges || []);
    };

    const handleTopologyRefresh = () => fetchTopology(true);
    const handleInterfaceUpdate = () => fetchInterfaces();
    const handlePppoeUpdate = () => fetchCoreStatus();

    // Refresh log aktivitas otomatis ketika ada broadcast event log baru dari socket
    const handleNewActivityLog = () => fetchLogs();

    const handleDeviceStatus = ({ id, status }) => {
      if (!id || !status) return;
      setTopologyNodes((prev) =>
        prev.map((n) =>
          n.id === id || n.device_id === id ? { ...n, status } : n,
        ),
      );
    };

    const handleMikrotikFull = (data) => {
      if (data && data.interfaces) {
        setCoreInterfaces(data.interfaces);
      }
    };

    const handleMappingsUpdated = () => fetchMappings();

    if (socket) {
      socket.on("dashboard_core_update", handleCoreUpdate);
      socket.on("topology_updated", handleTopologyUpdated);
      socket.on("topology_refresh", handleTopologyRefresh);
      socket.on("interfaces_updated", handleInterfaceUpdate);
      socket.on("pppoe_updated", handlePppoeUpdate);
      socket.on("device-status", handleDeviceStatus);
      socket.on("mikrotik_full_update", handleMikrotikFull);
      socket.on("activity_log_updated", handleNewActivityLog);
      socket.on("mappings_updated", handleMappingsUpdated);
    }

    return () => {
      clearInterval(pollId);
      mountedRef.current = false;
      if (socket) {
        socket.off("dashboard_core_update", handleCoreUpdate);
        socket.off("topology_updated", handleTopologyUpdated);
        socket.off("topology_refresh", handleTopologyRefresh);
        socket.off("interfaces_updated", handleInterfaceUpdate);
        socket.off("pppoe_updated", handlePppoeUpdate);
        socket.off("device-status", handleDeviceStatus);
        socket.off("mikrotik_full_update", handleMikrotikFull);
        socket.off("activity_log_updated", handleNewActivityLog);
        socket.off("mappings_updated", handleMappingsUpdated);
      }
    };
  }, [
    fetchAllDashboardData,
    applyTopologyPayload,
    fetchTopology,
    fetchInterfaces,
    fetchCoreStatus,
    fetchLogs,
    fetchMappings,
  ]);

  const totalNodes = topologyNodes.length;
  const oltCount = topologyNodes.filter((n) => n.type === "olt").length;
  const odcCount = topologyNodes.filter((n) => n.type === "odc").length;
  const odpCount = topologyNodes.filter((n) => n.type === "odp").length;
  const infrasCount = oltCount + odcCount + odpCount;
  const clientCount = topologyNodes.filter((n) => n.type === "client").length;

  const totalL2tpRuijie = ruijieDevices.length;
  const offlineL2tpRuijie = ruijieDevices.filter(
    (d) => d.status === "OFF" && d.connection_type === "L2TP",
  ).length;
  const offlinePppoeRuijie = ruijieDevices.filter(
    (d) => d.status === "OFF" && d.connection_type === "PPPOE",
  ).length;
  const activeRuijieClients = ruijieDevices.reduce(
    (sum, d) => sum + (Number(d.clients) || 0),
    0,
  );

  const offlineCount = useMemo(() => {
    return topologyNodes.filter((node) => {
      if (node.type?.toLowerCase() === "core") return false;

      let isDown = false;
      let isDisabled = false;

      if (node.linked_interface) {
        const matchedIface = coreInterfaces.find(
          (i) =>
            i.name &&
            i.name.toLowerCase() === node.linked_interface.toLowerCase(),
        );
        if (matchedIface) {
          if (matchedIface.disabled === "true") isDisabled = true;
          else if (matchedIface.running !== "true") isDown = true;
        }
      } else {
        const connectedEdges = edges.filter(
          (e) =>
            e.from_node === node.id ||
            e.to_node === node.id ||
            e.from === node.id ||
            e.to === node.id,
        );
        if (connectedEdges.length === 0) isDisabled = true;
      }

      if (isDisabled) return false;
      if (isDown) return true;
      if (node.status === "offline") return true;
      return false;
    }).length;
  }, [topologyNodes, edges, coreInterfaces]);

  if (!hasReadAccess) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        <p className="text-xs text-slate-400">Mengarahkan ke halaman yang diizinkan...</p>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col gap-3 md:gap-4 overflow-y-auto lg:overflow-hidden p-1">
      <div className="flex-shrink-0 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Dashboard Utama</h1>
          <p className="text-xs text-slate-400">
            Ringkasan status jaringan & resource MikroTik Pusat
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold bg-slate-800/80 border border-slate-700/50 px-2.5 py-1.5 rounded-full select-none">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isConnected
                  ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)] animate-pulse"
                  : "bg-rose-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]"
              }`}
            />
            <span className="text-slate-400 uppercase tracking-wider">
              {isConnected ? "Live" : "Terputus"}
            </span>
          </span>
        </div>
      </div>

      {/* Core Router Resources */}
      <div className="flex-shrink-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <CoreResourceCard
          icon={Cpu}
          iconColorClass="text-blue-500"
          title="CPU Load"
          value={coreStatus ? `${coreStatus.cpu}%` : "--"}
        />
        <CoreResourceCard
          icon={HardDrive}
          iconColorClass="text-emerald-500"
          title="Memory Free"
          value={
            coreStatus
              ? `${(coreStatus.free_memory / 1024 / 1024).toFixed(1)} MB`
              : "--"
          }
        />
        <CoreResourceCard
          icon={Clock}
          iconColorClass="text-amber-500"
          title="Uptime"
          value={coreStatus ? coreStatus.uptime : "--"}
        />
        <CoreResourceCard
          icon={Server}
          iconColorClass="text-purple-500"
          title="Versi RouterOS"
          value={
            coreStatus ? `${coreStatus.board} (v${coreStatus.version})` : "--"
          }
        />
      </div>

      {/* Network Metrics Cards */}
      <div className="flex-shrink-0 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-2 md:gap-3">
        <StatCard
          icon={Router}
          iconColorClass="text-blue-500"
          title="Total Interfaces"
          value={totalNodes}
        />
        <StatCard
          icon={Users}
          iconColorClass="text-amber-500"
          title="Node Client Terpasang"
          value={clientCount}
        />
        <StatCard
          icon={Server}
          iconColorClass="text-purple-500"
          title="Infrastruktur (OLT,ODC,ODP)"
          value={infrasCount}
        />
        <StatCard
          icon={AlertTriangle}
          iconColorClass="text-red-500"
          title="Mikrotik Offline"
          value={offlineCount}
          isAlert={true}
        />
        <StatCard
          icon={Router}
          iconColorClass="text-cyan-500"
          title="Total Wilayah"
          value={totalL2tpRuijie}
        />
        <StatCard
          icon={ArrowUpRight}
          iconColorClass="text-orange-500"
          title="Client Aktif"
          value={activeRuijieClients}
        />
        <StatCard
          icon={AlertTriangle}
          iconColorClass="text-red-500"
          title="Desa Offline"
          value={offlineL2tpRuijie}
          isAlert={true}
        />
        <StatCard
          icon={AlertTriangle}
          iconColorClass="text-red-500"
          title="OPD Offline"
          value={offlinePppoeRuijie}
          isAlert={true}
        />
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
        <div className="lg:col-span-2 bg-slate-800 border border-slate-700/50 rounded-xl p-4 md:p-5 flex flex-col min-h-[300px] lg:min-h-0 relative overflow-hidden group">
          <h3 className="flex-shrink-0 text-sm font-semibold border-b border-slate-700/30 pb-3 mb-3 text-slate-200 flex justify-between items-center gap-2">
            Pratinjau Jaringan
            <div className="flex items-center gap-2 z-10">
              <button
                onClick={() =>
                  setMapTheme((t) => (t === "dark" ? "colored" : "dark"))
                }
                className="cursor-pointer text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1 rounded flex items-center gap-1 transition"
              >
                {mapTheme === "dark" ? (
                  <>
                    <span className="fa fa-sun" /> Mode Terang
                  </>
                ) : (
                  <>
                    <span className="fa fa-moon" /> Mode Gelap
                  </>
                )}
              </button>
              <button
                onClick={() => router.push("/topology")}
                className="cursor-pointer text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded flex items-center gap-1 transition"
              >
                <MapIcon size={12} /> Buka Peta Lengkap
              </button>
            </div>
          </h3>
          <div className="flex-1 min-h-0 rounded-lg overflow-hidden border border-slate-700 relative">
            <DashboardMap
              topologyNodes={topologyNodes}
              edges={edges}
              coreInterfaces={coreInterfaces}
              mappings={mappings}
              mapTheme={mapTheme}
              networkMode={networkMode}
            />
          </div>
        </div>

        {/* Right Column: Activity Log Panel */}
        <ActivityLogList logs={dbLogs} isConnected={isConnected} />
      </div>
    </div>
  );
}
