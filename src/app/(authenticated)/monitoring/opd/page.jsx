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
  Globe,
  ExternalLink,
  Copy,
  Check,
  Terminal,
} from "lucide-react";
import { getStoredUser, hasAccess } from "@/lib/roles";
import UptimeTimer from "@/components/UptimeTimer";
import { useToast } from "@/hooks/useToast";
import OntWebModal from "@/components/OntWebModal";

export default function MonitorOpd() {
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

  // Status Modal Web ONT (Reverse Proxy)
  const [ontWebDevice, setOntWebDevice] = useState(null);

  // Role permissions
  const [canUpdate, setCanUpdate] = useState(false);
  const [canTelnet, setCanTelnet] = useState(false);
  const { showToast, ToastComponent } = useToast();

  const handleOpenOntWeb = (d) => {
    if (!d?.remote_address) return;
    window.open(`/ont-proxy/${encodeURIComponent(d.remote_address)}/`, "_blank", "noopener,noreferrer");
  };

  const fetchData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    if (!isBackground) setError(null);
    try {
      const [resMappings, resMikrotik] = await Promise.all([
        axios.get("/api/mappings" + (isBackground ? "?force=true" : "")),
        axios.get("/api/monitor/mikrotik"),
      ]);
      const allMappings = resMappings.data || [];
      setMappings(allMappings.filter((m) => m.connection_type === "PPPOE"));
      if (resMikrotik.data) {
        setMikrotikSecrets(resMikrotik.data.secrets || []);
      }
      setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
    } catch (e) {
      if (!isBackground)
        setError(e.message || "Gagal mengambil data sinkronisasi OPD");
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const syncRoles = () => {
      const user = getStoredUser();
      setCanUpdate(hasAccess(user, "monitoring-pppoe", "update"));
      setCanTelnet(
        user?.role === "admin" ||
          user?.role === "editor" ||
          hasAccess(user, "monitoring-pppoe", "update") ||
          hasAccess(user, "devices-mikrotik", "update")
      );
      if (user && user.role && !hasAccess(user, "monitoring-pppoe", "read")) {
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

  const getStatusDisplay = (device) => {
    const isOnline = device.final_status === "Online";
    if (isOnline) {
      return (
        <div className="text-xs flex flex-col gap-1 items-end lg:items-start">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 w-max flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>{" "}
            Online
          </span>
          {device.last_log_history && (
            <UptimeTimer dateString={device.last_log_history} mode={timeMode} />
          )}
        </div>
      );
    } else {
      return (
        <div className="text-xs flex flex-col gap-1 items-end lg:items-start">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 w-max flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
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
        <span className="text-[10px] font-bold text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
          UP
        </span>
      );
    if (status === "Offline")
      return (
        <span className="text-[10px] font-bold text-red-400 px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20">
          DOWN
        </span>
      );
    return <span className="text-[10px] font-bold text-slate-500">-</span>;
  };

  const dataPanelClass =
    "w-full flex flex-col bg-slate-800/50 border border-slate-700/50 rounded-xl min-w-0";
  const dataScrollClass =
    "w-full overflow-x-auto overflow-y-visible min-w-0 touch-auto relative";

  return (
    <div className="flex-1 w-full min-w-0 flex flex-col gap-2.5 md:gap-3 pb-4 relative">
      {ToastComponent}
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Monitor size={20} className="text-blue-500 dark:text-blue-400" />
            Monitor Perangkat OPD
          </h1>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Status Access Point (Ruijie) & Mikrotik (OPD)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (socket) socket.emit("force_sync_mappings");
              fetchData();
            }}
            disabled={loading}
            className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition shadow-md bg-blue-600 hover:bg-blue-700 border border-blue-500 text-white shadow-blue-500/20"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Sync Sekarang
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {!error && mergedDevices.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-shrink-0">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-2.5 md:p-3 flex-1 min-w-[130px] flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <Wifi size={14} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Total Online
              </p>
              <p className="text-base md:text-lg font-bold text-slate-100">
                {totalOnline}
              </p>
            </div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-2.5 md:p-3 flex-1 min-w-[130px] flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-slate-700/50 flex items-center justify-center flex-shrink-0">
              <WifiOff size={14} className="text-slate-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Total Offline
              </p>
              <p className="text-base md:text-lg font-bold text-slate-100">
                {totalOffline}
              </p>
            </div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-2.5 md:p-3 flex-1 min-w-[130px] flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={14} className="text-red-400/80" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Tidak Sinkron
              </p>
              <p className="text-base md:text-lg font-bold text-red-400/80">
                {totalTidakSinkron}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Table Area */}
      <div className={dataPanelClass}>
        <div className="p-3 border-b border-slate-700/30 flex items-center gap-2.5 flex-shrink-0 flex-wrap">
          <h2 className="font-semibold text-slate-200 text-xs flex-shrink-0">
            Sinkronisasi
          </h2>

          <div className="relative flex-1 min-w-[180px]">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              type="text"
              placeholder="Cari Prefix, Ruijie, Mikrotik, IP, MAC..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 focus:border-blue-500 outline-none w-full"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-300 outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="all">Semua Data</option>
            <option value="ONLINE">Hanya Online</option>
            <option value="OFFLINE">Hanya Offline</option>
          </select>

          <select
            value={timeMode}
            onChange={(e) => setTimeMode(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-300 outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="duration">Uptime</option>
            <option value="timestamp">Timestamp</option>
          </select>

          <div className="flex items-center gap-1.5 ml-auto flex-wrap flex-shrink-0">
            <span className="text-[11px] text-slate-400">Tampilkan:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                const val =
                  e.target.value === "all" ? "all" : Number(e.target.value);
                setItemsPerPage(val);
                setCurrentPage(1);
              }}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value="all">Semua ({filteredDevices.length})</option>
            </select>
          </div>
        </div>

        <div className={dataScrollClass}>
          {loading && mergedDevices.length === 0 ? (
            <div className="flex-1 flex flex-col gap-2 p-3 min-h-[300px]">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="w-full h-10 bg-slate-700/30 rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : error && mergedDevices.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-red-400">
              <WifiOff size={24} />
              <p className="text-xs">{error}</p>
            </div>
          ) : (
            <>
              {/* Mobile card view */}
              <div className="lg:hidden divide-y divide-slate-700/30">
                {filteredDevices.length === 0 ? (
                  <p className="text-center py-12 text-slate-500 text-xs">
                    Tidak ada data
                  </p>
                ) : (
                  paginatedDevices.map((d, i) => (
                    <div
                      key={i}
                      className="p-3.5 flex flex-col gap-2.5 hover:bg-slate-700/20 transition"
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                            <span className="font-bold text-slate-100 text-xs">
                              {d.prefix ? String(d.prefix).toUpperCase() : "-"}
                            </span>
                            <span className="text-[9px] tag-opd px-1.5 py-0.5 rounded border font-semibold">
                              OPD
                            </span>
                            {canUpdate && (
                              <button
                                onClick={() => handleOpenEditModal(d)}
                                className="cursor-pointer p-1 text-slate-400 hover:text-blue-400 transition"
                                title="Edit Prefix & Tautan"
                              >
                                <Edit2 size={11} />
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                            <span className="flex items-center gap-1 text-blue-400 font-semibold">
                              <Users size={12} />
                              {d.clients !== undefined && d.clients !== null
                                ? d.clients
                                : 0}{" "}
                              Klien
                            </span>
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          {getStatusDisplay(d)}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 bg-slate-900/40 p-2 rounded-lg text-[11px] border border-slate-700/30">
                        <div>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-slate-400 font-medium">Ruijie:</span>
                            {getSourceStatus(d.status_ruijie)}
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono block truncate">
                            MAC: {d.ruijie_mac || "-"}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-slate-400 font-medium">Mikrotik:</span>
                            {getSourceStatus(d.status_mikrotik)}
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono block truncate">
                            IP: {d.remote_address || "-"}
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center gap-2 mt-0.5 flex-wrap">
                        <div>
                          {d.issue && d.issue !== "Normal" ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-400 bg-orange-400/10 px-1.5 py-0.5 rounded border border-orange-400/20">
                              <AlertTriangle size={11} /> {d.issue}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded border border-emerald-400/20">
                              <CheckCircle2 size={11} /> {d.issue || "Normal"}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <Link
                            href={`/monitoring/opd/traffic/${encodeURIComponent(d.ruijie_mac)}`}
                            className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded border border-blue-500/20 transition"
                          >
                            <BarChart2 size={11} /> Traffic
                          </Link>
                          <button
                            onClick={() => handleOpenPingModal(d)}
                            disabled={!d.remote_address}
                            className={`cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded border transition ${
                              d.remote_address
                                ? "text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20"
                                : "text-slate-500 bg-slate-800/40 border-slate-700/30 cursor-not-allowed opacity-50"
                            }`}
                          >
                            <Activity size={11} /> Ping
                          </button>
                          <button
                            onClick={() => handleOpenOntWeb(d)}
                            disabled={!d.remote_address}
                            className={`cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded border transition ${
                              d.remote_address
                                ? "text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/20"
                                : "text-slate-500 bg-slate-800/40 border-slate-700/30 cursor-not-allowed opacity-50"
                            }`}
                            title={
                              d.remote_address
                                ? `Buka Web Management ONT di Tab Baru (${d.remote_address})`
                                : "IP ONT tidak tersedia"
                            }
                          >
                            <Globe size={11} /> Web ONT
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop table view */}
              <div className="hidden lg:block min-h-0 overflow-x-auto">
                <table className="w-full text-xs min-w-[900px]">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-slate-700/30 bg-slate-800/95 backdrop-blur">
                      <th className="text-left px-3.5 py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Final Status
                      </th>
                      <th className="text-left px-3.5 py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Prefix (Gabungan)
                      </th>
                      <th className="text-left px-3.5 py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Status Ruijie
                      </th>
                      <th className="text-left px-3.5 py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Status Mikrotik
                      </th>
                      <th className="text-center px-3.5 py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Total Client
                      </th>
                      <th className="text-left px-3.5 py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Keterangan
                      </th>
                      <th className="text-center px-3.5 py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDevices.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="text-center py-10 text-slate-500 text-xs"
                        >
                          Tidak ada data
                        </td>
                      </tr>
                    ) : (
                      paginatedDevices.map((d, i) => (
                        <tr
                          key={i}
                          className="border-b border-slate-700/20 hover:bg-slate-700/20 transition group"
                        >
                          <td className="px-3.5 py-2.5 w-32">
                            {getStatusDisplay(d)}
                          </td>
                          <td className="px-3.5 py-2.5 font-medium text-slate-300">
                            <div className="flex items-center gap-1.5 group/prefix">
                              <span className="font-semibold text-slate-100">
                                {d.prefix
                                  ? String(d.prefix).toUpperCase()
                                  : "-"}
                              </span>
                              {canUpdate && (
                                <button
                                  onClick={() => handleOpenEditModal(d)}
                                  className="cursor-pointer opacity-0 group-hover/prefix:opacity-100 p-1 text-slate-400 hover:text-blue-400 transition"
                                  title="Edit Prefix & Tautan Manual"
                                >
                                  <Edit2 size={12} />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-3.5 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-slate-300 text-[11px]">
                                MAC: {d.ruijie_mac || "-"}
                              </span>
                              <span className="text-slate-500 text-[10px]">-</span>
                              {getSourceStatus(d.status_ruijie)}
                            </div>
                          </td>
                          <td className="px-3.5 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-slate-300 text-[11px]">
                                IP: {d.remote_address || "-"}
                              </span>
                              <span className="text-slate-500 text-[10px]">-</span>
                              {getSourceStatus(d.status_mikrotik)}
                            </div>
                          </td>
                          <td className="px-3.5 py-2.5 text-center">
                            <div className="inline-flex items-center gap-1 font-semibold text-slate-200 bg-slate-900/40 px-2 py-0.5 rounded border border-slate-700/30">
                              <Users size={12} className="text-blue-400" />
                              <span>
                                {d.clients !== undefined && d.clients !== null
                                  ? d.clients
                                  : 0}
                              </span>
                            </div>
                          </td>
                          <td className="px-3.5 py-2.5">
                            {d.issue && d.issue !== "Normal" ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-400 bg-orange-400/10 px-1.5 py-0.5 rounded border border-orange-400/20">
                                <AlertTriangle size={11} /> {d.issue}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded border border-emerald-400/20">
                                <CheckCircle2 size={11} />{" "}
                                {d.issue || "Normal"}
                              </span>
                            )}
                          </td>
                          <td className="px-3.5 py-2.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <Link
                                href={`/monitoring/opd/traffic/${encodeURIComponent(d.ruijie_mac)}`}
                                className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded border border-blue-500/20 transition"
                                title="Detail Traffic OPD"
                              >
                                <BarChart2 size={11} /> Traffic
                              </Link>
                              <button
                                onClick={() => handleOpenPingModal(d)}
                                disabled={!d.remote_address}
                                className={`cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded border transition ${
                                  d.remote_address
                                    ? "text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20"
                                    : "text-slate-500 bg-slate-800/40 border-slate-700/30 cursor-not-allowed opacity-50"
                                }`}
                                title={
                                  d.remote_address
                                    ? `Ping IP ${d.remote_address}`
                                    : "IP Mikrotik tidak tersedia"
                                }
                              >
                                <Activity size={11} /> Ping
                              </button>
                              <button
                                onClick={() => handleOpenOntWeb(d)}
                                disabled={!d.remote_address}
                                className={`cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded border transition ${
                                  d.remote_address
                                    ? "text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/20"
                                    : "text-slate-500 bg-slate-800/40 border-slate-700/30 cursor-not-allowed opacity-50"
                                }`}
                                title={
                                  d.remote_address
                                    ? `Buka Web Management ONT di Tab Baru (${d.remote_address})`
                                    : "IP ONT tidak tersedia"
                                }
                              >
                                <Globe size={11} /> Web ONT
                              </button>
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

        {filteredDevices.length > 0 && (
          <div className="p-2.5 border-t border-slate-700/30 flex items-center justify-between flex-wrap gap-2 text-xs bg-slate-800/40">
            <span className="text-slate-400 text-[11px]">
              {itemsPerPage === "all"
                ? `Menampilkan ${filteredDevices.length} dari ${filteredDevices.length}`
                : `Menampilkan ${Math.min((currentPage - 1) * itemsPerPage + 1, filteredDevices.length)}-${Math.min(currentPage * itemsPerPage, filteredDevices.length)} dari ${filteredDevices.length}`}
            </span>
            {itemsPerPage !== "all" && totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-slate-300 border border-slate-700 transition text-[11px] cursor-pointer"
                >
                  Prev
                </button>
                <span className="text-slate-400 font-medium px-1.5 text-[11px]">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-slate-300 border border-slate-700 transition text-[11px] cursor-pointer"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Edit Prefix & Tautan Manual OPD */}
      {editingDevice && (
        <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-slate-800 border border-slate-700 shadow-2xl rounded-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-3.5 border-b border-slate-700 flex items-center justify-between bg-slate-800/90">
              <h3 className="font-bold text-slate-100 text-xs md:text-sm flex items-center gap-2">
                <Edit2 size={14} className="text-blue-400" />
                Edit Prefix & Tautan OPD
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
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                  Perangkat Ruijie (Otomatis & Utama)
                </label>
                <div className="bg-slate-900/60 border border-slate-700/50 rounded-lg p-2.5 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-200 text-xs truncate">
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
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                  Prefix (Gabungan)
                </label>
                <input
                  type="text"
                  value={modalPrefixValue}
                  onChange={(e) => setModalPrefixValue(e.target.value)}
                  placeholder="Masukkan nama prefix gabungan..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 focus:border-blue-500 outline-none"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Prefix ini menjadi identitas gabungan pada peta topologi & monitoring.
                </p>
              </div>

              {/* Akun Mikrotik (Tautan Manual OPD) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Akun Mikrotik (OPD)
                  </label>
                  {editingDevice.is_manual ? (
                    <span className="text-[9px] font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded">
                      Tautan Manual Aktif
                    </span>
                  ) : (
                    <span className="text-[9px] font-semibold bg-slate-700/50 text-slate-400 border border-slate-600/30 px-1.5 py-0.5 rounded">
                      Otomatis
                    </span>
                  )}
                </div>

                <select
                  value={modalMikrotikName}
                  onChange={(e) => setModalMikrotikName(e.target.value)}
                  disabled={!canUpdate}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 focus:border-blue-500 outline-none disabled:opacity-50"
                >
                  <option value="" disabled>
                    -- Pilih Akun Mikrotik OPD --
                  </option>
                  {mikrotikSecrets
                    .filter((s) => s.service === "pppoe")
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
                    className="cursor-pointer mt-2 text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1 transition"
                  >
                    <Unlink size={11} /> Kembalikan ke Tautan Otomatis
                  </button>
                )}
              </div>
            </div>
            <div className="p-3.5 border-t border-slate-700 bg-slate-800/90 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setEditingDevice(null)}
                disabled={isSavingModal}
                className="cursor-pointer px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white transition"
              >
                Batal
              </button>
              <button
                onClick={handleSaveModal}
                disabled={isSavingModal || !modalPrefixValue.trim()}
                className="cursor-pointer px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Modal Ping MikroTik OPD */}
      {pingModalDevice && (
        <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-slate-800 border border-slate-700 shadow-2xl rounded-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col">
            <div className="p-3.5 border-b border-slate-700 flex items-center justify-between bg-slate-800/90">
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
              <div className="grid grid-cols-2 gap-2 bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/50 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    IP Target
                  </span>
                  <span className="font-mono text-emerald-400 font-semibold">
                    {pingModalDevice.remote_address || "Tidak ada IP"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Akun Mikrotik
                  </span>
                  <span className="font-mono text-slate-200 truncate block">
                    {pingModalDevice.mikrotik_alias || "-"}
                  </span>
                </div>
              </div>

              {/* Quick metrics */}
              {pingResult && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-slate-900/40 border border-slate-700/40 p-2 rounded-lg text-center">
                    <span className="text-[9px] text-slate-400 uppercase font-bold block">
                      Status
                    </span>
                    <span
                      className={`text-xs font-bold ${
                        pingResult.alive
                          ? "text-emerald-400"
                          : "text-red-400"
                      }`}
                    >
                      {pingResult.alive ? "Online / Terhubung" : "RTO / Offline"}
                    </span>
                  </div>
                  <div className="bg-slate-900/40 border border-slate-700/40 p-2 rounded-lg text-center">
                    <span className="text-[9px] text-slate-400 uppercase font-bold block">
                      Avg Latency
                    </span>
                    <span className="text-xs font-bold text-slate-100 font-mono">
                      {pingResult.avgTime !== null && pingResult.avgTime !== undefined
                        ? `${pingResult.avgTime} ms`
                        : "-"}
                    </span>
                  </div>
                  <div className="bg-slate-900/40 border border-slate-700/40 p-2 rounded-lg text-center">
                    <span className="text-[9px] text-slate-400 uppercase font-bold block">
                      Packet Loss
                    </span>
                    <span
                      className={`text-xs font-bold font-mono ${
                        pingResult.packetLoss === 0
                          ? "text-emerald-400"
                          : pingResult.packetLoss === 100
                          ? "text-red-400"
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
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                  Output Ping Console
                </label>
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-[11px] text-slate-300 min-h-[120px] max-h-[180px] overflow-y-auto whitespace-pre-wrap leading-relaxed custom-scrollbar flex flex-col justify-center">
                  {isPinging ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-4 text-slate-400">
                      <RefreshCw size={18} className="animate-spin text-emerald-400" />
                      <span>Sedang mengirim ICMP echo packet ke {pingModalDevice.remote_address}...</span>
                    </div>
                  ) : pingResult ? (
                    <span className={pingResult.alive ? "text-emerald-300" : "text-red-300"}>
                      {pingResult.output}
                    </span>
                  ) : (
                    <span className="text-slate-500">Klik "Ulangi Ping" untuk memulai test.</span>
                  )}
                </div>
              </div>
            </div>

            <div className="p-3.5 border-t border-slate-700 bg-slate-800/90 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setPingModalDevice(null)}
                className="cursor-pointer px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white transition"
              >
                Tutup
              </button>
              <button
                onClick={() => runPing(pingModalDevice.remote_address)}
                disabled={isPinging || !pingModalDevice.remote_address}
                className="cursor-pointer px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw size={13} className={isPinging ? "animate-spin" : ""} />
                {isPinging ? "Sedang Ping..." : "Ulangi Ping"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Web Management ONT (Reverse Proxy) */}
      {ontWebDevice && (
        <OntWebModal
          device={ontWebDevice}
          onClose={() => setOntWebDevice(null)}
        />
      )}
    </div>
  );
}
