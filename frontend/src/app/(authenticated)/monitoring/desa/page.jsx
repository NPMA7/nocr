"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import axios from "axios";
import { API_URL, socket, useAppState } from "@/App";
import {
  Monitor,
  Wifi,
  WifiOff,
  RefreshCw,
  Search,
  AlertTriangle,
  CheckCircle2,
  Link as LinkIcon,
  Unlink,
  X,
  Save,
  Edit2,
  Clock,
  BarChart2,
  Users,
  Activity,
  ExternalLink,
  Copy,
  Check,
  Terminal,
} from "lucide-react";
import { getStoredUser, hasAccess } from "@/lib/roles";
import UptimeTimer from "@/components/UptimeTimer";
import { useToast } from "@/hooks/useToast";
import TelnetModal from "@/components/TelnetModal";

export default function MonitorDevice() {
  const [mappings, setMappings] = useState([]);
  const [mikrotikSecrets, setMikrotikSecrets] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [timeMode, setTimeMode] = useState("duration");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(30);
  const { setLastSyncTime } = useAppState();

  // Status Modal Edit Prefix & Tautan
  const [editingDevice, setEditingDevice] = useState(null);
  const [modalPrefixValue, setModalPrefixValue] = useState("");
  const [modalMikrotikName, setModalMikrotikName] = useState("");
  const [isSavingModal, setIsSavingModal] = useState(false);

  // Status Modal Ping Mikrotik
  const [pingModalDevice, setPingModalDevice] = useState(null);
  const [isPinging, setIsPinging] = useState(false);
  const [pingResult, setPingResult] = useState(null);

  // Status Modal Telnet Mikrotik
  const [telnetDevice, setTelnetDevice] = useState(null);

  // Role permissions
  const [canUpdate, setCanUpdate] = useState(false);
  const [canTelnet, setCanTelnet] = useState(false);
  const { showToast, ToastComponent } = useToast();

  const fetchData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    if (!isBackground) setError(null);
    try {
      const [resMappings, resMikrotik] = await Promise.all([
        axios.get("/api/mappings" + (isBackground ? "?force=true" : "")),
        axios.get("/api/monitor/mikrotik"),
      ]);
      const allMappings = resMappings.data || [];
      setMappings(allMappings.filter((m) => m.connection_type === "L2TP"));
      if (resMikrotik.data) {
        setMikrotikSecrets(resMikrotik.data.secrets || []);
      }
      setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
    } catch (e) {
      if (!isBackground)
        setError(e.message || "Gagal mengambil data sinkronisasi");
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const syncRoles = () => {
      const user = getStoredUser();
      setCanUpdate(hasAccess(user, "monitoring-l2tp", "update"));
      setCanTelnet(
        user?.role === "admin" ||
          user?.role === "editor" ||
          hasAccess(user, "monitoring-l2tp", "update") ||
          hasAccess(user, "devices-mikrotik", "update")
      );
      if (user && user.role && !hasAccess(user, "monitoring-l2tp", "read")) {
        window.location.href = "/dashboard";
      }
    };
    syncRoles();
    const handleRoleUpdate = () => syncRoles();
    window.addEventListener("nocr-role-updated", handleRoleUpdate);

    if (socket) {
      const handleUpdate = () => {
        fetchData(true);
      };

      socket.on("mappings_updated", handleUpdate);

      return () => {
        socket.off("mappings_updated", handleUpdate);
        window.removeEventListener("nocr-role-updated", handleRoleUpdate);
      };
    }
    return () =>
      window.removeEventListener("nocr-role-updated", handleRoleUpdate);
  }, []);

  const mergedDevices = mappings;

  const filteredDevices = mergedDevices
    .filter((d) => {
      const term = search.toLowerCase();
      const matchesSearch =
        !term ||
        (d.prefix && d.prefix.toLowerCase().includes(term)) ||
        (d.ruijie_alias && d.ruijie_alias.toLowerCase().includes(term)) ||
        (d.mikrotik_alias && d.mikrotik_alias.toLowerCase().includes(term)) ||
        (d.ruijie_mac && d.ruijie_mac.toLowerCase().includes(term)) ||
        (d.remote_address && d.remote_address.toLowerCase().includes(term));

      if (!matchesSearch) return false;

      if (filterStatus !== "all") {
        if (filterStatus === "ONLINE" && d.final_status !== "Online")
          return false;
        if (filterStatus === "OFFLINE" && d.final_status !== "Offline")
          return false;
        if (filterStatus === "ISSUE" && (!d.issue || d.issue === "Normal"))
          return false;
      }

      return true;
    })
    .sort((a, b) => {
      const prefixA = a.prefix || "";
      const prefixB = b.prefix || "";
      return prefixA.localeCompare(prefixB);
    });

  const totalPages =
    itemsPerPage === "all"
      ? 1
      : Math.ceil(filteredDevices.length / itemsPerPage) || 1;
  const paginatedDevices =
    itemsPerPage === "all"
      ? filteredDevices
      : filteredDevices.slice(
          (currentPage - 1) * itemsPerPage,
          currentPage * itemsPerPage,
        );

  const totalOnline = mergedDevices.filter(
    (d) => d.final_status === "Online",
  ).length;
  const totalOffline = mergedDevices.filter(
    (d) => d.final_status === "Offline",
  ).length;
  const totalTidakSinkron = mergedDevices.filter(
    (d) => d.status_mikrotik === "Online" && d.status_ruijie === "Offline",
  ).length;
  const totalIssues = mergedDevices.filter(
    (d) => d.issue && d.issue !== "Normal",
  ).length;
  const totalClients = mergedDevices.reduce(
    (acc, d) => acc + (Number(d.clients) || 0),
    0,
  );

  const handleOpenEditModal = (device) => {
    setEditingDevice(device);
    setModalPrefixValue(device.prefix || "");
    setModalMikrotikName(device.is_manual ? device.mikrotik_alias || "" : device.mikrotik_alias || "");
  };

  const handleSaveModal = async () => {
    if (!editingDevice) return;
    const trimmedPrefix = modalPrefixValue.trim();
    if (!trimmedPrefix) {
      showToast("Prefix tidak boleh kosong", "warning");
      return;
    }

    setIsSavingModal(true);
    try {
      let updatedDevice = { ...editingDevice };

      // 1. Simpan Prefix jika berubah
      if (trimmedPrefix !== (editingDevice.prefix || "")) {
        await axios.patch("/api/mappings/prefix", {
          ruijie_mac: editingDevice.ruijie_mac,
          new_prefix: trimmedPrefix,
          old_prefix: editingDevice.prefix,
        });
        updatedDevice.prefix = trimmedPrefix;
        updatedDevice.is_prefix_manual = true;
      }

      // 2. Simpan Tautan Mikrotik Manual jika dipilih/berubah
      if (
        canUpdate &&
        modalMikrotikName &&
        modalMikrotikName !== editingDevice.mikrotik_alias
      ) {
        const resMap = await axios.post("/api/mappings", {
          ruijie_mac: editingDevice.ruijie_mac,
          mikrotik_name: modalMikrotikName,
        });
        if (resMap.data) {
          updatedDevice = { ...updatedDevice, ...resMap.data };
        }
      }

      setMappings((prev) =>
        prev.map((m) =>
          m.ruijie_mac === editingDevice.ruijie_mac ? updatedDevice : m,
        ),
      );

      if (socket) socket.emit("force_sync_mappings");
      showToast("Pengaturan prefix & tautan berhasil disimpan", "success");
      setEditingDevice(null);
    } catch (e) {
      showToast(
        "Gagal menyimpan perubahan: " +
          (e.response?.data?.error || e.message),
        "error",
      );
    } finally {
      setIsSavingModal(false);
    }
  };

  const handleResetToAutoLink = async () => {
    if (!editingDevice) return;
    if (!confirm("Hapus tautan manual dan kembali ke sistem otomatis?")) return;

    setIsSavingModal(true);
    try {
      await axios.delete(`/api/mappings?ruijie_mac=${editingDevice.ruijie_mac}`);
      if (socket) socket.emit("force_sync_mappings");
      await fetchData(true);
      showToast("Tautan manual dihapus, kembali ke otomatis", "success");
      setEditingDevice(null);
    } catch (e) {
      showToast(
        "Gagal menghapus tautan manual: " +
          (e.response?.data?.error || e.message),
        "error",
      );
    } finally {
      setIsSavingModal(false);
    }
  };

  const runPing = async (ip) => {
    if (!ip) return;
    setIsPinging(true);
    setPingResult(null);
    try {
      const res = await axios.get(
        `/api/ping?ip=${encodeURIComponent(ip)}&count=4&timeout=2`,
      );
      setPingResult(res.data);
    } catch (err) {
      setPingResult({
        host: ip,
        alive: false,
        packetLoss: 100,
        output:
          err.response?.data?.error ||
          err.message ||
          "Gagal melakukan ping ke target",
      });
    } finally {
      setIsPinging(false);
    }
  };

  const handleOpenPingModal = (device) => {
    setPingModalDevice(device);
    if (device.remote_address) {
      runPing(device.remote_address);
    } else {
      setPingResult({
        host: "-",
        alive: false,
        packetLoss: 100,
        output: "IP address MikroTik belum tersedia untuk perangkat ini.",
      });
    }
  };

  const handleCopy = (text, type) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    showToast("Disalin ke clipboard: " + text, "success");
    setTimeout(() => setCopiedType(null), 2000);
  };

  const getStatusDisplay = (device) => {
    const isOnline = device.final_status === "Online";
    if (isOnline) {
      return (
        <div className="flex flex-col gap-1 items-start">
          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 w-max flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Online
          </span>
          {device.last_log_history && (
            <UptimeTimer dateString={device.last_log_history} mode={timeMode} />
          )}
        </div>
      );
    } else {
      return (
        <div className="flex flex-col gap-1 items-start">
          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 w-max flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            Offline
          </span>
          {device.offline_since && (
            <UptimeTimer dateString={device.offline_since} mode={timeMode} />
          )}
        </div>
      );
    }
  };

  const getSourceStatus = (status) => {
    if (status === "Online")
      return (
        <span className="text-[10px] font-mono font-bold text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
          UP
        </span>
      );
    if (status === "Offline")
      return (
        <span className="text-[10px] font-mono font-bold text-rose-400 px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20">
          DOWN
        </span>
      );
    return (
      <span className="text-[10px] font-mono font-bold text-slate-500 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">
        -
      </span>
    );
  };

  const getIssueBadge = (issue) => {
    if (!issue || issue === "Normal") {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 whitespace-nowrap">
          <CheckCircle2 size={11} /> Normal
        </span>
      );
    }
    if (issue === "Semua Perangkat Mati") {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20 whitespace-nowrap">
          <AlertTriangle size={11} /> {issue}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 whitespace-nowrap">
        <AlertTriangle size={11} /> {issue}
      </span>
    );
  };

  const dataPanelClass =
    "w-full flex flex-col bg-slate-900 border border-slate-800 rounded-xl min-w-0 shadow-sm overflow-hidden";
  const dataScrollClass =
    "w-full overflow-x-auto overflow-y-visible min-w-0 touch-auto relative";

  return (
    <div className="flex-1 w-full min-w-0 flex flex-col gap-3.5 pb-6 relative">
      {ToastComponent}

      {/* 1. TOP HEADER & SYNC ACTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 sm:py-3.5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <Monitor size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-slate-100">
                Monitor Wilayah Desa
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                L2TP / Mikrotik & Ruijie
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Status Sinkronisasi Access Point (Ruijie) & MikroTik Client Desa
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (socket) socket.emit("force_sync_mappings");
              fetchData();
            }}
            disabled={loading}
            className="cursor-pointer flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition shadow-sm bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 whitespace-nowrap"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span>Sync Sekarang</span>
          </button>
        </div>
      </div>

      {/* 2. STATS CARDS (INTERACTIVE) */}
      {!error && mergedDevices.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 flex-shrink-0">
          {/* Total Online */}
          <div
            onClick={() => {
              setFilterStatus(filterStatus === "ONLINE" ? "all" : "ONLINE");
              setCurrentPage(1);
            }}
            className={`p-3 sm:p-3.5 bg-slate-900 border rounded-xl shadow-sm flex items-center justify-between cursor-pointer transition ${
              filterStatus === "ONLINE"
                ? "border-emerald-500/50 bg-emerald-950/20 ring-1 ring-emerald-500/30"
                : "border-slate-800 hover:border-slate-700"
            }`}
            title="Klik untuk filter status Online"
          >
            <div>
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                Total Online
              </p>
              <p className="text-xl font-bold font-mono text-emerald-400 mt-0.5">
                {totalOnline}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                {mergedDevices.length > 0
                  ? ((totalOnline / mergedDevices.length) * 100).toFixed(1)
                  : 0}
                % terhubung
              </p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <Wifi size={15} />
            </div>
          </div>

          {/* Total Offline */}
          <div
            onClick={() => {
              setFilterStatus(filterStatus === "OFFLINE" ? "all" : "OFFLINE");
              setCurrentPage(1);
            }}
            className={`p-3 sm:p-3.5 bg-slate-900 border rounded-xl shadow-sm flex items-center justify-between cursor-pointer transition ${
              filterStatus === "OFFLINE"
                ? "border-rose-500/50 bg-rose-950/20 ring-1 ring-rose-500/30"
                : "border-slate-800 hover:border-slate-700"
            }`}
            title="Klik untuk filter status Offline"
          >
            <div>
              <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block" />
                Total Offline
              </p>
              <p className="text-xl font-bold font-mono text-rose-400 mt-0.5">
                {totalOffline}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                {totalOffline === 0 ? "Semua normal" : "Perlu pengecekan"}
              </p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
              <WifiOff size={15} />
            </div>
          </div>

          {/* Tidak Sinkron */}
          <div
            onClick={() => {
              setFilterStatus(filterStatus === "ISSUE" ? "all" : "ISSUE");
              setCurrentPage(1);
            }}
            className={`p-3 sm:p-3.5 bg-slate-900 border rounded-xl shadow-sm flex items-center justify-between cursor-pointer transition ${
              filterStatus === "ISSUE"
                ? "border-amber-500/50 bg-amber-950/20 ring-1 ring-amber-500/30"
                : "border-slate-800 hover:border-slate-700"
            }`}
            title="Klik untuk filter perangkat Tidak Sinkron / Bermasalah"
          >
            <div>
              <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                Tidak Sinkron
              </p>
              <p className="text-xl font-bold font-mono text-amber-400 mt-0.5">
                {totalTidakSinkron}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                {totalIssues > 0 ? `${totalIssues} bermasalah` : "Semua sinkron"}
              </p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <AlertTriangle size={15} />
            </div>
          </div>

          {/* Total Client */}
          <div className="p-3 sm:p-3.5 bg-slate-900 border border-slate-800 rounded-xl shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                Total Client
              </p>
              <p className="text-xl font-bold font-mono text-slate-100 mt-0.5">
                {totalClients}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                {mergedDevices.length} Wilayah Desa
              </p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-400 shrink-0">
              <Users size={15} />
            </div>
          </div>
        </div>
      )}

      {/* 3. TABLE AREA WITH INTEGRATED TOOLBAR */}
      <div className={dataPanelClass}>
        {/* Table Toolbar */}
        <div className="p-3 sm:p-4 border-b border-slate-800 flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            {[
              { id: "all", label: "Semua" },
              { id: "ONLINE", label: "Online" },
              { id: "OFFLINE", label: "Offline" },
            ].map((chip) => (
              <button
                key={chip.id}
                onClick={() => {
                  setFilterStatus(chip.id);
                  setCurrentPage(1);
                }}
                className={`cursor-pointer px-2.5 py-1 rounded text-xs font-semibold transition ${
                  filterStatus === chip.id
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              type="text"
              placeholder="Cari Prefix, Ruijie, Mikrotik, IP, MAC..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-8 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 font-mono transition"
            />
            {search && (
              <button
                onClick={() => {
                  setSearch("");
                  setCurrentPage(1);
                }}
                className="cursor-pointer absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Uptime Mode */}
          <select
            value={timeMode}
            onChange={(e) => setTimeMode(e.target.value)}
            className="cursor-pointer bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-8 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500 font-mono"
          >
            <option value="duration">Uptime (Durasi)</option>
            <option value="timestamp">Timestamp (Waktu)</option>
          </select>

          {/* Per Page */}
          <div className="flex items-center gap-1.5 ml-auto flex-wrap flex-shrink-0">
            <span className="text-xs text-slate-500 hidden sm:inline font-mono">Tampilkan:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                const val =
                  e.target.value === "all" ? "all" : Number(e.target.value);
                setItemsPerPage(val);
                setCurrentPage(1);
              }}
              className="cursor-pointer bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-8 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500 font-mono min-w-[120px]"
            >
              <option value={10}>10 Baris</option>
              <option value={30}>30 Baris</option>
              <option value={50}>50 Baris</option>
              <option value={100}>100 Baris</option>
              <option value="all">Semua ({filteredDevices.length})</option>
            </select>
          </div>
        </div>

        <div className={dataScrollClass}>
          {loading && mergedDevices.length === 0 ? (
            <div className="flex-1 flex flex-col gap-2 p-4 min-h-[300px]">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="w-full h-10 bg-slate-800/40 rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : error && mergedDevices.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-rose-400">
              <WifiOff size={28} />
              <p className="text-xs font-mono">{error}</p>
            </div>
          ) : (
            <>
              {/* Mobile Card View (HP) */}
              <div className="lg:hidden flex flex-col gap-2.5 p-2.5 sm:p-3 bg-slate-950/40">
                {filteredDevices.length === 0 ? (
                  <p className="text-center py-12 text-slate-500 text-xs font-mono">
                    Tidak ada data perangkat yang sesuai filter
                  </p>
                ) : (
                  paginatedDevices.map((d, i) => (
                    <div
                      key={i}
                      className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl flex flex-col gap-2.5 shadow-sm"
                    >
                      {/* Baris 1: Prefix & Tag Desa (Kiri) | Status Online/Offline (Rata Kanan) */}
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <span
                            className="font-bold text-slate-100 text-xs truncate font-mono"
                            title={d.prefix}
                          >
                            {d.prefix ? String(d.prefix).toUpperCase() : "-"}
                          </span>
                          <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded font-mono font-medium tag-desa">
                            Desa
                          </span>
                          {canUpdate && (
                            <button
                              onClick={() => handleOpenEditModal(d)}
                              className="cursor-pointer p-0.5 text-slate-500 hover:text-blue-400 transition shrink-0"
                              title="Edit Prefix & Tautan"
                            >
                              <Edit2 size={11} />
                            </button>
                          )}
                        </div>
                        {/* Status Online/Offline - Rata Kanan Presisi */}
                        <div className="shrink-0 ml-auto">
                          {getStatusDisplay(d)}
                        </div>
                      </div>

                      {/* Baris 2: Mini-Grid Ruijie & MikroTik */}
                      <div className="grid grid-cols-2 gap-2 bg-slate-950/60 p-2.5 rounded-lg text-[11px] border border-slate-800/80">
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <span className="text-slate-400 font-medium">Ruijie:</span>
                            {getSourceStatus(d.status_ruijie)}
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono block truncate">
                            MAC: {d.ruijie_mac || "-"}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <span className="text-slate-400 font-medium">Mikrotik:</span>
                            {getSourceStatus(d.status_mikrotik)}
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono block truncate">
                            IP: {d.remote_address || "-"}
                          </span>
                        </div>
                      </div>

                      {/* Baris 3: Diagnosa & Total Client (Kiri) | Tombol Aksi (Kanan) */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/60 flex-wrap">
                        <div className="flex items-center gap-2">
                          {getIssueBadge(d.issue)}
                          <span className="inline-flex items-center gap-1 font-mono text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded">
                            <Users size={11} /> {d.clients !== undefined && d.clients !== null ? d.clients : 0}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                          <Link
                            href={`/monitoring/desa/traffic/${encodeURIComponent(d.ruijie_mac)}`}
                            className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-md transition whitespace-nowrap"
                          >
                            <BarChart2 size={11} /> Traffic
                          </Link>
                          <button
                            onClick={() => handleOpenPingModal(d)}
                            disabled={!d.remote_address}
                            className={`cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md border transition whitespace-nowrap ${
                              d.remote_address
                                ? "text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20"
                                : "text-slate-600 bg-slate-900 border-slate-800 cursor-not-allowed opacity-50"
                            }`}
                          >
                            <Activity size={11} /> Ping
                          </button>
                          {canTelnet && (
                            <button
                              onClick={() => setTelnetDevice(d)}
                              disabled={!d.remote_address}
                              className={`cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md border transition whitespace-nowrap ${
                                d.remote_address
                                  ? "text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border-indigo-500/20"
                                  : "text-slate-600 bg-slate-900 border-slate-800 cursor-not-allowed opacity-50"
                              }`}
                            >
                              <Terminal size={11} /> Telnet
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop Table View */}
              <div className="hidden lg:block min-h-0 overflow-x-auto">
                <table className="w-full text-xs min-w-[950px] border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-slate-800 bg-slate-950/95 backdrop-blur">
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                        Final Status
                      </th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                        Prefix (Gabungan)
                      </th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                        Status Ruijie
                      </th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                        Status Mikrotik
                      </th>
                      <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                        Total Client
                      </th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                        Keterangan
                      </th>
                      <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredDevices.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="text-center py-12 text-slate-500 text-xs font-mono"
                        >
                          Tidak ada data perangkat yang sesuai filter
                        </td>
                      </tr>
                    ) : (
                      paginatedDevices.map((d, i) => (
                        <tr
                          key={i}
                          className="hover:bg-slate-800/40 transition-colors group"
                        >
                          <td className="px-4 py-3 w-36 align-middle">
                            {getStatusDisplay(d)}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-200 align-middle">
                            <div className="flex items-center gap-1.5 group/prefix">
                              <span className="font-semibold text-slate-100 font-mono">
                                {d.prefix ? String(d.prefix).toUpperCase() : "-"}
                              </span>
                              {canUpdate && (
                                <button
                                  onClick={() => handleOpenEditModal(d)}
                                  className="cursor-pointer opacity-0 group-hover/prefix:opacity-100 p-1 text-slate-500 hover:text-blue-400 transition"
                                  title="Edit Prefix & Tautan Manual"
                                >
                                  <Edit2 size={12} />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 align-middle">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-slate-300 text-[11px]">
                                MAC: {d.ruijie_mac || "-"}
                              </span>
                              <span className="text-slate-600 text-[10px]">-</span>
                              {getSourceStatus(d.status_ruijie)}
                            </div>
                          </td>
                          <td className="px-4 py-3 align-middle">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-slate-300 text-[11px]">
                                IP: {d.remote_address || "-"}
                              </span>
                              <span className="text-slate-600 text-[10px]">-</span>
                              {getSourceStatus(d.status_mikrotik)}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center align-middle">
                            <div className="inline-flex items-center gap-1 font-mono font-bold text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-md">
                              <Users size={12} />
                              <span>{d.clients !== undefined && d.clients !== null ? d.clients : 0}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 align-middle">
                            {getIssueBadge(d.issue)}
                          </td>
                          <td className="px-4 py-3 text-center align-middle">
                            <div className="flex items-center justify-center gap-1.5">
                              <Link
                                href={`/monitoring/desa/traffic/${encodeURIComponent(d.ruijie_mac)}`}
                                className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-md transition whitespace-nowrap"
                              >
                                <BarChart2 size={12} /> Traffic
                              </Link>
                              <button
                                onClick={() => handleOpenPingModal(d)}
                                disabled={!d.remote_address}
                                className={`cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md border transition whitespace-nowrap ${
                                  d.remote_address
                                    ? "text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20"
                                    : "text-slate-600 bg-slate-900 border-slate-800 cursor-not-allowed opacity-50"
                                }`}
                              >
                                <Activity size={12} /> Ping
                              </button>
                              {canTelnet && (
                                <button
                                  onClick={() => setTelnetDevice(d)}
                                  disabled={!d.remote_address}
                                  className={`cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md border transition whitespace-nowrap ${
                                    d.remote_address
                                      ? "text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border-indigo-500/20"
                                      : "text-slate-600 bg-slate-900 border-slate-800 cursor-not-allowed opacity-50"
                                  }`}
                                  title={
                                    d.remote_address
                                      ? `Buka Web Telnet Terminal CLI (${d.remote_address})`
                                      : "IP Mikrotik tidak tersedia"
                                  }
                                >
                                  <Terminal size={12} /> Telnet
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Pagination Footer */}
        {filteredDevices.length > 0 && (
          <div className="p-3 border-t border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs bg-slate-950/60">
            <span className="text-slate-400 text-[11px] font-mono">
              {itemsPerPage === "all"
                ? `Menampilkan ${filteredDevices.length} dari ${filteredDevices.length}`
                : `Menampilkan ${Math.min((currentPage - 1) * itemsPerPage + 1, filteredDevices.length)}-${Math.min(currentPage * itemsPerPage, filteredDevices.length)} dari ${filteredDevices.length}`}
            </span>
            {itemsPerPage !== "all" && totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-slate-300 border border-slate-800 transition text-[11px] font-mono cursor-pointer"
                >
                  Prev
                </button>
                <span className="text-slate-400 font-mono font-medium px-1.5 text-[11px]">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-slate-300 border border-slate-800 transition text-[11px] font-mono cursor-pointer"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Edit Prefix & Tautan Manual */}
      {editingDevice && (
        <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-800 shadow-2xl rounded-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <h3 className="font-bold text-slate-100 text-xs md:text-sm flex items-center gap-2">
                <Edit2 size={14} className="text-blue-400" />
                Edit Prefix & Tautan Desa
              </h3>
              <button
                onClick={() => setEditingDevice(null)}
                className="cursor-pointer text-slate-400 hover:text-white transition"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 flex flex-col gap-3.5">
              {/* Info Ruijie (Utama & Otomatis) */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block font-mono">
                  Perangkat Ruijie (Otomatis & Utama)
                </label>
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-200 text-xs truncate">
                      {editingDevice.ruijie_alias || "-"}
                    </p>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                      MAC: {editingDevice.ruijie_mac || "-"}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    {getSourceStatus(editingDevice.status_ruijie)}
                  </div>
                </div>
              </div>

              {/* Input Prefix (Gabungan) */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block font-mono">
                  Prefix (Gabungan)
                </label>
                <input
                  type="text"
                  value={modalPrefixValue}
                  onChange={(e) => setModalPrefixValue(e.target.value)}
                  placeholder="Masukkan nama prefix gabungan..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 font-mono focus:border-blue-500 outline-none transition"
                />
                <p className="text-[10px] text-slate-500 mt-1 font-mono">
                  Prefix ini menjadi identitas gabungan pada peta topologi & monitoring.
                </p>
              </div>

              {/* Akun Mikrotik (Tautan Manual) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                    Akun Mikrotik (Desa)
                  </label>
                  {editingDevice.is_manual ? (
                    <span className="text-[9px] font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded font-mono">
                      Tautan Manual Aktif
                    </span>
                  ) : (
                    <span className="text-[9px] font-semibold bg-slate-800 text-slate-400 border border-slate-700 px-1.5 py-0.5 rounded font-mono">
                      Otomatis
                    </span>
                  )}
                </div>

                <select
                  value={modalMikrotikName}
                  onChange={(e) => setModalMikrotikName(e.target.value)}
                  disabled={!canUpdate}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 font-mono focus:border-blue-500 outline-none disabled:opacity-50 cursor-pointer"
                >
                  <option value="" disabled>
                    -- Pilih Akun Mikrotik --
                  </option>
                  {mikrotikSecrets
                    .filter((s) => s.service !== "pppoe")
                    .map((s, i) => {
                      const isUsed =
                        mappings.some((m) => m.mikrotik_name === s.name) &&
                        s.name !== editingDevice.mikrotik_alias &&
                        s.name !== editingDevice.mikrotik_name;
                      return (
                        <option key={i} value={s.name} disabled={isUsed}>
                          {s.name} ({s.service || "any"}){" "}
                          {isUsed ? "(Sudah Digunakan)" : ""}
                        </option>
                      );
                    })}
                </select>

                {editingDevice.is_manual && canUpdate && (
                  <button
                    type="button"
                    onClick={handleResetToAutoLink}
                    disabled={isSavingModal}
                    className="cursor-pointer mt-2 text-[10px] text-rose-400 hover:text-rose-300 flex items-center gap-1 transition font-mono"
                  >
                    <Unlink size={11} /> Kembalikan ke Tautan Otomatis
                  </button>
                )}
              </div>
            </div>
            <div className="p-3.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setEditingDevice(null)}
                disabled={isSavingModal}
                className="cursor-pointer px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white transition"
              >
                Batal
              </button>
              <button
                onClick={handleSaveModal}
                disabled={isSavingModal || !modalPrefixValue.trim()}
                className="cursor-pointer px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {isSavingModal ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : (
                  <Save size={13} />
                )}
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ping MikroTik */}
      {pingModalDevice && (
        <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-800 shadow-2xl rounded-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <h3 className="font-bold text-slate-100 text-xs md:text-sm flex items-center gap-2">
                <Activity size={15} className="text-emerald-400" />
                Ping MikroTik ({pingModalDevice.prefix || pingModalDevice.mikrotik_alias})
              </h3>
              <button
                onClick={() => setPingModalDevice(null)}
                className="cursor-pointer text-slate-400 hover:text-white transition"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 flex flex-col gap-3.5">
              {/* Host & IP Info */}
              <div className="grid grid-cols-2 gap-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                    IP Target
                  </span>
                  <span className="font-mono text-emerald-400 font-semibold">
                    {pingModalDevice.remote_address || "Tidak ada IP"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                    Akun Mikrotik
                  </span>
                  <span className="font-mono text-slate-200 truncate block font-semibold">
                    {pingModalDevice.mikrotik_alias || "-"}
                  </span>
                </div>
              </div>

              {/* Quick metrics */}
              {pingResult && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg text-center">
                    <span className="text-[9px] text-slate-400 uppercase font-bold block font-mono">
                      Status
                    </span>
                    <span
                      className={`text-xs font-bold ${
                        pingResult.alive
                          ? "text-emerald-400"
                          : "text-rose-400"
                      }`}
                    >
                      {pingResult.alive ? "Online / Terhubung" : "RTO / Offline"}
                    </span>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg text-center">
                    <span className="text-[9px] text-slate-400 uppercase font-bold block font-mono">
                      Avg Latency
                    </span>
                    <span className="text-xs font-bold text-slate-100 font-mono">
                      {pingResult.avgTime !== null
                        ? `${pingResult.avgTime} ms`
                        : "-"}
                    </span>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg text-center">
                    <span className="text-[9px] text-slate-400 uppercase font-bold block font-mono">
                      Packet Loss
                    </span>
                    <span
                      className={`text-xs font-bold font-mono ${
                        pingResult.packetLoss === 0
                          ? "text-emerald-400"
                          : pingResult.packetLoss === 100
                          ? "text-rose-400"
                          : "text-amber-400"
                      }`}
                    >
                      {pingResult.packetLoss !== undefined
                        ? `${pingResult.packetLoss}%`
                        : "-"}
                    </span>
                  </div>
                </div>
              )}

              {/* Console terminal output */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block font-mono">
                  Output Ping Console
                </label>
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-[11px] text-slate-300 min-h-[120px] max-h-[180px] overflow-y-auto whitespace-pre-wrap leading-relaxed custom-scrollbar flex flex-col justify-center">
                  {isPinging ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-4 text-slate-400">
                      <RefreshCw size={18} className="animate-spin text-emerald-400" />
                      <span>Sedang mengirim ICMP echo packet ke {pingModalDevice.remote_address}...</span>
                    </div>
                  ) : pingResult ? (
                    <span className={pingResult.alive ? "text-emerald-300" : "text-rose-400"}>
                      {pingResult.output || (pingResult.alive ? `PING ${pingModalDevice.remote_address}: Host terhubung.` : `PING ${pingModalDevice.remote_address}: Request timed out (RTO).`)}
                    </span>
                  ) : (
                    <span className="text-slate-500">Klik "Ulangi Ping" untuk memulai test.</span>
                  )}
                </div>
              </div>
            </div>

            <div className="p-3.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setPingModalDevice(null)}
                className="cursor-pointer px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white transition"
              >
                Tutup
              </button>
              <button
                onClick={() => runPing(pingModalDevice.remote_address)}
                disabled={isPinging || !pingModalDevice.remote_address}
                className="cursor-pointer px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                <RefreshCw size={13} className={isPinging ? "animate-spin" : ""} />
                {isPinging ? "Sedang Ping..." : "Ulangi Ping"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Web Telnet CLI MikroTik */}
      {telnetDevice && (
        <TelnetModal
          device={telnetDevice}
          onClose={() => setTelnetDevice(null)}
        />
      )}
    </div>
  );
}
