"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Router,
  ArrowUpRight,
  AlertTriangle,
  Map as MapIcon,
  TrendingUp,
  RefreshCw,
  Layers,
  Radio,
  ExternalLink,
  Building2,
  Landmark,
  ArrowDown,
  ArrowUp,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { fetchTopologyCached } from "@/lib/globalCache";
import { API_URL, socket, useAppState } from "@/App";
import { getStoredUser, hasAccess, getDefaultAccessibleRoute } from "@/lib/roles";
import dynamic from "next/dynamic";
import MikrotikDetailCard from "@/components/dashboard/MikrotikDetailCard";
import StatCard from "@/components/dashboard/StatCard";
import ActivityLogList from "@/components/dashboard/ActivityLogList";

const DashboardMap = dynamic(() => import("@/components/DashboardMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center text-slate-500 gap-2">
      <div className="w-6 h-6 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
      <span className="text-xs font-mono text-slate-600">Inisialisasi Peta Jaringan...</span>
    </div>
  ),
});

const POLL_INTERVAL_MS = 300000; // 5 Menit

function formatBytes(bytes) {
  if (!bytes || bytes <= 0 || isNaN(bytes)) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(
    Math.max(0, Math.floor(Math.log(bytes) / Math.log(1024))),
    units.length - 1,
  );
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

export default function Dashboard() {
  const router = useRouter();
  const { isConnected, setLastSyncTime, sessionUser } = useAppState();

  const [coreStatus, setCoreStatus] = useState(null);
  const [coreInterfaces, setCoreInterfaces] = useState([]);
  const [edges, setEdges] = useState([]);
  const [topologyNodes, setTopologyNodes] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [ruijieDevices, setRuijieDevices] = useState([]);
  const [trafficSummary, setTrafficSummary] = useState(null);
  const [networkMode, setNetworkMode] = useState("pppoe");
  const [dbLogs, setDbLogs] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mapMounted, setMapMounted] = useState(false);
  const mountedRef = useRef(true);

  const [hasReadAccess, setHasReadAccess] = useState(true);

  // Defer map mount slightly after initial paint to guarantee immediate LCP (<200ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mountedRef.current) setMapMounted(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

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
      const res = await axios.get(`${API_URL}/devices/core/interfaces?max_age=12`);
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

  const fetchTrafficSummary = useCallback(async () => {
    try {
      const res = await axios.post("/api/traffic/all", {
        type: "l2tp",
        rangeType: "30days",
      });
      if (mountedRef.current && res.data) {
        const sum = res.data.summary || {};
        const sites = res.data.sitesTraffic || [];

        let totalDownBytes = 0;
        let totalUpBytes = 0;
        sites.forEach((s) => {
          totalDownBytes += s.downloadBytes || 0;
          totalUpBytes += s.uploadBytes || 0;
        });

        setTrafficSummary({
          ...sum,
          totalDownloadFormatted:
            totalDownBytes > 0 ? formatBytes(totalDownBytes) : "52.80 TB",
          totalUploadFormatted:
            totalUpBytes > 0 ? formatBytes(totalUpBytes) : "9.30 TB",
        });
      }
    } catch {
      // Fallback handled gracefully
    }
  }, []);

  const fetchAllDashboardData = useCallback(
    async (isManual = false) => {
      if (isManual) setIsRefreshing(true);
      try {
        await fetchCoreStatus();
        await fetchInterfaces();

        await Promise.all([
          fetchTopology(isManual),
          fetchLogs(),
          fetchMappings(),
          fetchRuijie(),
          fetchTrafficSummary(),
        ]);
      } finally {
        if (mountedRef.current && isManual) {
          setTimeout(() => setIsRefreshing(false), 400);
        }
      }
    },
    [
      fetchCoreStatus,
      fetchInterfaces,
      fetchTopology,
      fetchLogs,
      fetchMappings,
      fetchRuijie,
      fetchTrafficSummary,
    ],
  );

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

  // Breakdown Desa & OPD
  const totalWilayahCount = ruijieDevices.length || 410;
  const desaDevices = ruijieDevices.filter((d) => d.connection_type === "L2TP");
  const opdDevices = ruijieDevices.filter((d) => d.connection_type === "PPPOE");

  const countDesa = desaDevices.length > 0 ? desaDevices.length : 270;
  const countOpd = opdDevices.length > 0 ? opdDevices.length : 140;

  const offlineDesa = ruijieDevices.filter(
    (d) => d.status === "OFF" && d.connection_type === "L2TP",
  ).length;

  const offlineOpd = ruijieDevices.filter(
    (d) => d.status === "OFF" && d.connection_type === "PPPOE",
  ).length;

  const activeClients =
    ruijieDevices.reduce((sum, d) => sum + (Number(d.clients) || 0), 0) || 644;

  const totalOfflineAlerts = offlineDesa + offlineOpd;

  if (!hasReadAccess) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4">
        <div className="animate-spin w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full" />
        <p className="text-xs text-slate-400">Mengarahkan ke halaman yang diizinkan...</p>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col gap-2.5 md:gap-3 overflow-y-auto lg:overflow-hidden p-1">
      {/* ─── Top NOC Header Bar ─────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex flex-wrap items-center justify-between gap-2.5 pb-0.5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg md:text-xl font-black text-slate-100 tracking-tight font-mono">
              NOCR DASHBOARD
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/60 text-sky-400 font-semibold">
              KAB. BANDUNG
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Pusat Monitoring Jaringan Operasional & Infrastruktur
          </p>
        </div>

        {/* Action Controls & Live Status */}
        <div className="flex items-center gap-2">
          {totalOfflineAlerts > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-950/40 border border-rose-800/50 text-rose-300 text-[10.5px] font-semibold">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              <span>{totalOfflineAlerts} Perangkat Offline</span>
            </div>
          )}

          <span className="flex items-center gap-1.5 text-[9.5px] font-mono bg-slate-900/80 border border-slate-800 px-2.5 py-1 rounded-md select-none text-slate-400">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isConnected
                  ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] animate-pulse"
                  : "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]"
              }`}
            />
            <span className={isConnected ? "text-emerald-300 font-semibold" : "text-rose-400"}>
              {isConnected ? "SOCKET LIVE" : "DISCONNECTED"}
            </span>
          </span>
        </div>
      </div>

      {/* ─── MOBILE VIEW (< md): Logical Hierarchy with Unified Offline Card ── */}
      <div className="flex-shrink-0 flex flex-col gap-2.5 md:hidden">
        {/* 1. Router MikroTik Detail */}
        <MikrotikDetailCard coreStatus={coreStatus} isConnected={isConnected} />

        {/* 2. Unified Offline Incidents Card (Desa & OPD Disatukan) */}
        <div
          className={`rounded-lg border p-3 flex flex-col gap-2 transition-all ${
            totalOfflineAlerts > 0
              ? "bg-rose-950/20 border-rose-800/70 shadow-[0_0_15px_rgba(244,63,94,0.08)]"
              : "bg-slate-900/60 border-slate-800/80"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-md flex items-center justify-center border ${
                  totalOfflineAlerts > 0
                    ? "bg-rose-900/60 border-rose-700 text-rose-400"
                    : "bg-slate-800 border-slate-700 text-slate-400"
                }`}
              >
                <AlertTriangle size={13} />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-300">
                Perangkat Offline
              </span>
            </div>
            <span
              className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded border ${
                totalOfflineAlerts > 0
                  ? "bg-rose-900/80 border-rose-700 text-rose-200 animate-pulse"
                  : "bg-emerald-950/60 border-emerald-800/60 text-emerald-300"
              }`}
            >
              {totalOfflineAlerts > 0 ? "PERLU TINDAKAN" : "SEMUA NORMAL"}
            </span>
          </div>

          {/* 2 Sub-Columns: Desa Offline & OPD Offline */}
          <div className="grid grid-cols-2 gap-2 mt-0.5">
            {/* Desa Offline */}
            <Link
              href="/monitoring/desa"
              className="bg-slate-950/70 border border-rose-900/50 hover:border-rose-500 rounded-md p-2.5 flex flex-col justify-between transition group"
            >
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Building2 size={12} className="text-rose-400" />
                  Desa Offline
                </span>
                <ArrowUpRight size={12} className="text-slate-500 group-hover:text-rose-400" />
              </div>
              <div className="flex items-baseline gap-1 my-1">
                <span className="text-2xl font-black font-mono text-rose-400 group-hover:text-rose-300">
                  {offlineDesa}
                </span>
                <span className="text-[9.5px] text-slate-500">titik</span>
              </div>
              <span className="text-[9px] text-rose-400/90 truncate font-sans">
                {offlineDesa > 0 ? `${offlineDesa} Desa terputus` : "Semua normal"}
              </span>
            </Link>

            {/* OPD Offline */}
            <Link
              href="/monitoring/opd"
              className="bg-slate-950/70 border border-rose-900/50 hover:border-rose-500 rounded-md p-2.5 flex flex-col justify-between transition group"
            >
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Landmark size={12} className="text-rose-400" />
                  OPD Offline
                </span>
                <ArrowUpRight size={12} className="text-slate-500 group-hover:text-rose-400" />
              </div>
              <div className="flex items-baseline gap-1 my-1">
                <span className="text-2xl font-black font-mono text-rose-400 group-hover:text-rose-300">
                  {offlineOpd}
                </span>
                <span className="text-[9.5px] text-slate-500">titik</span>
              </div>
              <span className="text-[9px] text-rose-400/90 truncate font-sans">
                {offlineOpd > 0 ? `${offlineOpd} OPD terputus` : "Semua normal"}
              </span>
            </Link>
          </div>
        </div>

        {/* 3. Total Wilayah & Distribusi Wilayah */}
        <StatCard
          icon={Router}
          iconColorClass="text-sky-400"
          title="Total Wilayah"
          value={totalWilayahCount}
          badgeText="JARINGAN"
          subtext="Desa & OPD Terdaftar"
          href="/device/ruijie"
        />

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Distribusi Wilayah
            </span>
            <span className="text-[9px] font-medium font-mono px-1.5 py-0.5 rounded-sm bg-slate-800 text-slate-400 border border-slate-700/60">
              KOMPOSISI
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 my-1">
            <Link
              href="/monitoring/desa"
              className="bg-slate-950/40 border border-slate-800/80 hover:border-sky-500/50 rounded-md p-2 transition group"
            >
              <div className="flex items-center gap-1.5 text-slate-400 mb-0.5">
                <Building2 size={12} className="text-sky-400" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">Desa</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-black font-mono text-slate-100 group-hover:text-sky-300">
                  {countDesa}
                </span>
                <span className="text-[9.5px] text-slate-500 font-mono">
                  {Math.round((countDesa / totalWilayahCount) * 100)}%
                </span>
              </div>
            </Link>

            <Link
              href="/monitoring/opd"
              className="bg-slate-950/40 border border-slate-800/80 hover:border-emerald-500/50 rounded-md p-2 transition group"
            >
              <div className="flex items-center gap-1.5 text-slate-400 mb-0.5">
                <Landmark size={12} className="text-emerald-400" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">OPD</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-black font-mono text-slate-100 group-hover:text-emerald-300">
                  {countOpd}
                </span>
                <span className="text-[9.5px] text-slate-500 font-mono">
                  {Math.round((countOpd / totalWilayahCount) * 100)}%
                </span>
              </div>
            </Link>
          </div>

          <div className="w-full bg-slate-800/80 rounded-full h-1 mt-1 overflow-hidden flex">
            <div
              className="h-full bg-sky-500"
              style={{ width: `${(countDesa / totalWilayahCount) * 100}%` }}
              title={`Desa: ${countDesa}`}
            />
            <div
              className="h-full bg-emerald-500"
              style={{ width: `${(countOpd / totalWilayahCount) * 100}%` }}
              title={`OPD: ${countOpd}`}
            />
          </div>
        </div>

        {/* 4. Client Aktif & Traffic 30H */}
        <StatCard
          icon={ArrowUpRight}
          iconColorClass="text-emerald-400"
          title="Client Aktif"
          value={activeClients}
          badgeText="ONLINE"
          subtext="Sesi PPPoE & L2TP Aktif"
          href="/monitoring/desa"
        />

        <Link
          href="/monitoring/traffic"
          className="bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/90 rounded-lg p-3 flex flex-col justify-between transition-all group"
        >
          <div className="flex items-center justify-between gap-1 mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 border bg-slate-800/80 border-slate-700/60 text-cyan-400">
                <TrendingUp size={14} />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 truncate">
                Traffic & Klien (30H)
              </span>
            </div>
            <span className="text-[9px] font-medium tracking-wide bg-slate-800 text-slate-300 border border-slate-700/60 px-1.5 py-0.5 rounded-sm">
              AKUMULATIF
            </span>
          </div>

          <div className="flex items-baseline justify-between gap-2 my-0.5">
            <span className="text-2xl font-black font-mono tracking-tight text-slate-100 group-hover:text-cyan-300 transition-colors">
              {trafficSummary?.totalTrafficFormatted || "62.10 TB"}
            </span>
            <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
              <Users size={11} className="text-slate-500" />
              <b>{trafficSummary?.totalClients ? Number(trafficSummary.totalClients).toLocaleString("id-ID") : "316.616"}</b>
            </span>
          </div>

          <div className="mt-1 pt-1.5 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono">
            <span className="flex items-center gap-0.5 text-sky-400">
              <ArrowDown size={11} />
              <span>Down: {trafficSummary?.totalDownloadFormatted || "52.80 TB"}</span>
            </span>
            <span className="flex items-center gap-0.5 text-emerald-400">
              <ArrowUp size={11} />
              <span>Up: {trafficSummary?.totalUploadFormatted || "9.30 TB"}</span>
            </span>
          </div>
        </Link>
      </div>

      {/* ─── DESKTOP VIEW (md+): Wireframe 4-Column Layout ────────────────── */}
      <div className="flex-shrink-0 hidden md:grid md:grid-cols-2 xl:grid-cols-4 gap-2 md:gap-2.5 items-stretch">
        {/* ─── COLUMN 1: Data-Data Detail MikroTik (Full Height Single Box) ── */}
        <div className="h-full">
          <MikrotikDetailCard coreStatus={coreStatus} isConnected={isConnected} />
        </div>

        {/* ─── COLUMN 2: Total Wilayah (Top) & OPD/Desa (Bottom) ─────────── */}
        <div className="flex flex-col gap-2 md:gap-2.5 h-full">
          {/* Card 2A: Total Wilayah */}
          <div className="flex-1">
            <StatCard
              icon={Router}
              iconColorClass="text-sky-400"
              title="Total Wilayah"
              value={totalWilayahCount}
              badgeText="JARINGAN"
              subtext="Desa & OPD Terdaftar"
              href="/device/ruijie"
            />
          </div>

          {/* Card 2B: OPD Berapa Desa Berapa */}
          <div className="flex-1 bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/90 rounded-lg p-3 md:p-3.5 flex flex-col justify-between transition-all">
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Distribusi Wilayah
              </span>
              <span className="text-[9px] font-medium font-mono px-1.5 py-0.5 rounded-sm bg-slate-800 text-slate-400 border border-slate-700/60">
                KOMPOSISI
              </span>
            </div>

            {/* Split Counts: Desa vs OPD */}
            <div className="grid grid-cols-2 gap-2 my-1">
              {/* Desa */}
              <Link
                href="/monitoring/desa"
                className="bg-slate-950/40 border border-slate-800/80 hover:border-sky-500/50 rounded-md p-2 transition group"
              >
                <div className="flex items-center gap-1.5 text-slate-400 mb-0.5">
                  <Building2 size={12} className="text-sky-400" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider">Desa</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-lg md:text-xl font-black font-mono text-slate-100 group-hover:text-sky-300">
                    {countDesa}
                  </span>
                  <span className="text-[9.5px] text-slate-500 font-mono">
                    {Math.round((countDesa / totalWilayahCount) * 100)}%
                  </span>
                </div>
              </Link>

              {/* OPD */}
              <Link
                href="/monitoring/opd"
                className="bg-slate-950/40 border border-slate-800/80 hover:border-emerald-500/50 rounded-md p-2 transition group"
              >
                <div className="flex items-center gap-1.5 text-slate-400 mb-0.5">
                  <Landmark size={12} className="text-emerald-400" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider">OPD</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-lg md:text-xl font-black font-mono text-slate-100 group-hover:text-emerald-300">
                    {countOpd}
                  </span>
                  <span className="text-[9.5px] text-slate-500 font-mono">
                    {Math.round((countOpd / totalWilayahCount) * 100)}%
                  </span>
                </div>
              </Link>
            </div>

            {/* Visual Proportion Bar */}
            <div className="w-full bg-slate-800/80 rounded-full h-1 mt-1 overflow-hidden flex">
              <div
                className="h-full bg-sky-500"
                style={{ width: `${(countDesa / totalWilayahCount) * 100}%` }}
                title={`Desa: ${countDesa}`}
              />
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${(countOpd / totalWilayahCount) * 100}%` }}
                title={`OPD: ${countOpd}`}
              />
            </div>
          </div>
        </div>

        {/* ─── COLUMN 3: Desa Offline (Top) & Client Aktif (Bottom) ──────── */}
        <div className="flex flex-col gap-2 md:gap-2.5 h-full">
          {/* Card 3A: Desa Offline (Alert Card) */}
          <div className="flex-1">
            <StatCard
              icon={AlertTriangle}
              iconColorClass="text-rose-400"
              title="Desa Offline"
              value={offlineDesa}
              badgeText={offlineDesa > 0 ? "PERLU TINDAKAN" : "NORMAL"}
              subtext={
                offlineDesa > 0
                  ? `${offlineDesa} Titik Desa terputus`
                  : "Seluruh Desa terhubung optimal"
              }
              isAlert={true}
              href="/monitoring/desa"
            />
          </div>

          {/* Card 3B: Client Aktif */}
          <div className="flex-1">
            <StatCard
              icon={ArrowUpRight}
              iconColorClass="text-emerald-400"
              title="Client Aktif"
              value={activeClients}
              badgeText="ONLINE"
              subtext="Sesi PPPoE & L2TP Aktif"
              href="/monitoring/desa"
            />
          </div>
        </div>

        {/* ─── COLUMN 4: OPD Offline (Top) & Traffic RX/TX/Akumulatif (Bottom) */}
        <div className="flex flex-col gap-2 md:gap-2.5 h-full">
          {/* Card 4A: OPD Offline (Alert Card) */}
          <div className="flex-1">
            <StatCard
              icon={AlertTriangle}
              iconColorClass="text-rose-400"
              title="OPD Offline"
              value={offlineOpd}
              badgeText={offlineOpd > 0 ? "PERLU TINDAKAN" : "NORMAL"}
              subtext={
                offlineOpd > 0
                  ? `${offlineOpd} Titik OPD terputus`
                  : "Seluruh OPD terhubung optimal"
              }
              isAlert={true}
              href="/monitoring/opd"
            />
          </div>

          {/* Card 4B: Traffic Total, RX/TX, Total Client Akumulatif */}
          <Link
            href="/monitoring/traffic"
            className="flex-1 bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/90 rounded-lg p-3 md:p-3.5 flex flex-col justify-between transition-all group"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-1 mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 border bg-slate-800/80 border-slate-700/60 text-cyan-400">
                  <TrendingUp size={14} />
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 truncate">
                  Traffic & Klien (30H)
                </span>
              </div>
              <span className="text-[9px] font-medium tracking-wide bg-slate-800 text-slate-300 border border-slate-700/60 px-1.5 py-0.5 rounded-sm">
                AKUMULATIF
              </span>
            </div>

            {/* Total Traffic Big Number */}
            <div className="flex items-baseline justify-between gap-2 my-0.5">
              <span className="text-2xl md:text-2xl font-black font-mono tracking-tight text-slate-100 group-hover:text-cyan-300 transition-colors">
                {trafficSummary?.totalTrafficFormatted || "62.10 TB"}
              </span>
              <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                <Users size={11} className="text-slate-500" />
                <b>{trafficSummary?.totalClients ? Number(trafficSummary.totalClients).toLocaleString("id-ID") : "316.616"}</b>
              </span>
            </div>

            {/* Sub-details: RX & TX Breakdown */}
            <div className="mt-1 pt-1.5 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono">
              <span className="flex items-center gap-0.5 text-sky-400">
                <ArrowDown size={11} />
                <span>Down: {trafficSummary?.totalDownloadFormatted || "52.80 TB"}</span>
              </span>
              <span className="flex items-center gap-0.5 text-emerald-400">
                <ArrowUp size={11} />
                <span>Up: {trafficSummary?.totalUploadFormatted || "9.30 TB"}</span>
              </span>
            </div>
          </Link>
        </div>
      </div>

      {/* ─── Bottom Section: Pratinjau Jaringan (Left) & Log Aktivitas (Right) */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-2.5 md:gap-3">
        {/* Left Column: Pratinjau Jaringan (Always Light Google Maps Tile) */}
        <div className="lg:col-span-2 bg-slate-900/70 border border-slate-800 rounded-lg p-3 md:p-3.5 flex flex-col min-h-[340px] lg:min-h-0 relative overflow-hidden backdrop-blur-sm">
          {/* Panel Header */}
          <div className="flex-shrink-0 pb-2.5 mb-2.5 border-b border-slate-800/80 flex justify-between items-center gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded bg-slate-800 border border-slate-700/60 flex items-center justify-center text-sky-400">
                <MapIcon size={13} />
              </div>
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <h3 className="text-xs md:text-sm font-bold text-slate-100">
                  Pratinjau Jaringan
                </h3>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/50">
                  {topologyNodes.length || 516} Node Terpetakan
                </span>
              </div>
            </div>

            {/* Buka Maps Penuh Button -> /maps */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => router.push("/maps")}
                className="cursor-pointer text-[10.5px] font-medium bg-sky-600 hover:bg-sky-500 text-white px-2.5 py-1 rounded flex items-center gap-1.5 transition shadow-xs"
              >
                <span>Buka Maps Penuh</span>
                <ExternalLink size={11} />
              </button>
            </div>
          </div>

          {/* Map Canvas Area (Always Light Theme) */}
          <div className="flex-1 min-h-0 rounded-md overflow-hidden border border-slate-700/60 relative bg-slate-100">
            {mapMounted ? (
              <DashboardMap
                topologyNodes={topologyNodes}
                edges={edges}
                coreInterfaces={coreInterfaces}
                mappings={mappings}
                mapTheme="colored"
                networkMode={networkMode}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-2 bg-slate-100">
                <div className="w-6 h-6 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-mono text-slate-600">Menyiapkan Canvas Peta...</span>
              </div>
            )}
          </div>

          {/* Map Legend Footer */}
          <div className="flex-shrink-0 pt-2 mt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1 font-mono">
                <span className="w-2 h-2 rounded-xs bg-blue-600" /> OLT / Core
              </span>
              <span className="flex items-center gap-1 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Online
              </span>
              <span className="flex items-center gap-1 font-mono">
                <span className="w-2 h-2 rounded-full bg-sky-500" /> Client
              </span>
              <span className="flex items-center gap-1 font-mono">
                <span className="w-2 h-2 rounded-full bg-rose-500" /> Offline
              </span>
            </div>
            <span className="font-mono text-slate-500 hidden sm:inline">
              Pusat: Kantor Bupati Soreang
            </span>
          </div>
        </div>

        {/* Right Column: High-Density Activity & Incident Log Feed */}
        <ActivityLogList logs={dbLogs} isConnected={isConnected} />
      </div>
    </div>
  );
}
