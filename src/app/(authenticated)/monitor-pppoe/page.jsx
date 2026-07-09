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
  Link as LinkIcon,
  Unlink,
  X,
  Save,
  Edit2,
  Clock,
  MapPin,
} from "lucide-react";
import { getStoredUser, hasAccess } from "@/lib/roles";
import UptimeTimer from "@/components/UptimeTimer";
import { useToast } from "@/hooks/useToast";

/** Alias Mikrotik + tautan manual (admin) muncul saat hover di sel yang sama */
function MikrotikAliasCell({
  device,
  canUpdate,
  onLink,
  onUnlink,
  status,
  className = "",
}) {
  return (
    <div className={`flex flex-col group/mikrotik min-w-0 ${className}`}>
      <div className="flex items-center gap-2">
        <span
          className={`font-mono truncate  ${device.is_manual ? "text-purple-400" : "text-slate-200"}`}
          title={device.mikrotik_alias}
        >
          {device.mikrotik_alias}
        </span>
        {status}
        {device.is_manual && (
          <span
            title="Tautan manual aktif"
            className="flex-shrink-0 bg-purple-500/20 text-purple-400 p-1 rounded group-hover/mikrotik:opacity-0 transition-opacity"
          >
            <LinkIcon size={10} />
          </span>
        )}
        {canUpdate &&
          (device.is_manual ? (
            <button
              type="button"
              onClick={() => onUnlink(device.ruijie_mac)}
              className="cursor-pointer flex-shrink-0 opacity-0 group-hover/mikrotik:opacity-100 p-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition"
              title="Lepas tautan manual"
            >
              <Unlink size={10} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onLink(device)}
              className="cursor-pointer flex-shrink-0 opacity-0 group-hover/mikrotik:opacity-100 p-1 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 transition"
              title="Tautkan manual ke akun Mikrotik PPPoE"
            >
              <LinkIcon size={10} />
            </button>
          ))}
      </div>
      <span className="text-[13px] text-slate-500 font-mono mt-0.5">
        IP: {device.remote_address || "-"}
      </span>
    </div>
  );
}

export default function MonitorPppoe() {
  const [mappings, setMappings] = useState([]);
  const [mikrotikSecrets, setMikrotikSecrets] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [timeMode, setTimeMode] = useState("duration");
  const { setLastSyncTime } = useAppState();

  // Status Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAp, setSelectedAp] = useState(null);
  const [selectedMikrotikName, setSelectedMikrotikName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Status Edit Prefix
  const [editingPrefixMac, setEditingPrefixMac] = useState(null);
  const [editPrefixValue, setEditPrefixValue] = useState("");
  const [isSavingPrefix, setIsSavingPrefix] = useState(false);

  // Role: admin = tautan manual; admin/editor = edit prefix
  const [canUpdate, setCanUpdate] = useState(false);
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
      setMappings(allMappings.filter((m) => m.connection_type === "PPPOE"));
      if (resMikrotik.data) {
        setMikrotikSecrets(resMikrotik.data.secrets || []);
      }
      setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
    } catch (e) {
      if (!isBackground) setError(e.message || "Gagal mengambil data PPPoE");
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const syncRoles = () => {
      const user = getStoredUser();
      setCanUpdate(hasAccess(user, "monitoring-pppoe", "update"));
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
        (d.ruijie_alias && d.ruijie_alias.toLowerCase().includes(term)) ||
        (d.mikrotik_alias && d.mikrotik_alias.toLowerCase().includes(term)) ||
        (d.ruijie_mac && d.ruijie_mac.toLowerCase().includes(term));

      if (!matchesSearch) return false;

      if (filterStatus !== "all") {
        if (filterStatus === "ONLINE" && d.final_status !== "Online")
          return false;
        if (filterStatus === "OFFLINE" && d.final_status !== "Offline")
          return false;
        if (filterStatus === "ISSUE" && !d.issue) return false;
      }

      return true;
    })
    .sort((a, b) => {
      const prefixA = a.prefix || "";
      const prefixB = b.prefix || "";
      return prefixA.localeCompare(prefixB);
    });

  const totalOnline = mergedDevices.filter(
    (d) => d.final_status === "Online",
  ).length;
  const totalOffline = mergedDevices.filter(
    (d) => d.final_status === "Offline",
  ).length;
  const totalTidakSinkron = mergedDevices.filter(
    (d) => d.status_mikrotik === "Online" && d.status_ruijie === "Offline",
  ).length;
  const totalIssues = mergedDevices.filter((d) => d.issue).length;

  const handleOpenModal = (device) => {
    setSelectedAp({
      mac_address: device.ruijie_mac,
      alias: device.ruijie_alias,
      mikrotik_name: device.mikrotik_name,
    });
    setSelectedMikrotikName(device.is_manual ? device.mikrotik_alias : "");
    setIsModalOpen(true);
  };

  const handleSaveMapping = async () => {
    if (!selectedAp || !selectedMikrotikName) return;
    setIsSaving(true);
    try {
      // Untuk PPPoE, simpan mapping ke endpoint khusus atau gunakan ulang /api/mappings
      const res = await axios.post("/api/mappings", {
        ruijie_mac: selectedAp.mac_address,
        mikrotik_name: selectedMikrotikName,
      });
      const existing = mappings.find(
        (m) => m.ruijie_mac === res.data.ruijie_mac,
      );
      if (existing) {
        setMappings(
          mappings.map((m) =>
            m.ruijie_mac === res.data.ruijie_mac ? { ...m, ...res.data } : m,
          ),
        );
      } else {
        setMappings([...mappings, res.data]);
      }
      if (socket) socket.emit("force_sync_mappings");
      setIsModalOpen(false);
      fetchData(true);
    } catch (e) {
      showToast("Gagal menyimpan tautan manual: " + (e.response?.data?.error || e.message));
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveMapping = async (mac_address) => {
    if (!confirm("Hapus tautan manual dan kembali ke sistem otomatis?")) return;
    try {
      await axios.delete(`/api/mappings?ruijie_mac=${mac_address}`);
      if (socket) socket.emit("force_sync_mappings");
      fetchData(true);
    } catch (e) {
      showToast("Gagal menghapus tautan manual: " + (e.response?.data?.error || e.message));
    }
  };

  const handleSavePrefix = async (device) => {
    if (!editPrefixValue.trim()) {
      showToast("Prefix tidak boleh kosong", "warning");
      return;
    }
    setIsSavingPrefix(true);
    try {
      await axios.patch("/api/mappings/prefix", {
        ruijie_mac: device.ruijie_mac,
        new_prefix: editPrefixValue.trim(),
        old_prefix: device.prefix,
      });
      setMappings(
        mappings.map((m) =>
          m.ruijie_mac === device.ruijie_mac
            ? { ...m, prefix: editPrefixValue.trim(), is_prefix_manual: true }
            : m,
        ),
      );
      if (socket) socket.emit("force_sync_mappings");
      setEditingPrefixMac(null);
    } catch (e) {
      showToast("Gagal menyimpan prefix: " + (e.response?.data?.error || e.message));
    } finally {
      setIsSavingPrefix(false);
    }
  };

  const getStatusDisplay = (device) => {
    const isOnline = device.final_status === "Online";
    if (isOnline) {
      return (
        <div className="flex flex-col gap-1 items-end lg:items-start">
          <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-400 w-max flex items-center gap-1.5">
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
        <div className="flex flex-col gap-1 items-end lg:items-start">
          <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-slate-700 text-slate-400 w-max flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
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
      return <span className="text-xs font-bold text-emerald-400">UP</span>;
    if (status === "Offline")
      return <span className="text-xs font-bold text-red-500">DOWN</span>;
    return <span className="text-xs font-bold text-slate-500">-</span>;
  };

  const dataPanelClass =
    "flex-1 min-h-0 flex flex-col bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden";
  const dataScrollClass =
    "flex-1 min-h-0 overflow-y-auto overscroll-contain relative";

  return (
    <div className="h-full min-h-0 flex flex-col gap-4 overflow-hidden relative">
      {ToastComponent}
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-3">
            <Monitor size={24} className="text-purple-400" />
            Monitor Perangkat PPPoE
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Status Access Point (Ruijie) & Mikrotik (PPPoE)
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => fetchData()}
            disabled={loading}
            className="cursor-pointer flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition shadow-lg bg-purple-600 hover:bg-purple-700 border border-purple-500 text-white shadow-purple-500/20"
          >
            {" "}
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Sync Sekarang
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {!error && mergedDevices.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 flex-shrink-0">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 flex-1 min-w-[150px] flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <Wifi size={20} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Total Online
              </p>
              <p className="text-xl font-bold text-slate-100">{totalOnline}</p>
            </div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 flex-1 min-w-[150px] flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-slate-700/50 flex items-center justify-center flex-shrink-0">
              <WifiOff size={20} className="text-slate-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Total Offline
              </p>
              <p className="text-xl font-bold text-slate-100">{totalOffline}</p>
            </div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 flex-1 min-w-[150px] flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={20} className="text-red-400/80" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Tidak Sinkron
              </p>
              <p className="text-lg font-bold text-red-400/80">
                {totalTidakSinkron}
              </p>
            </div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 flex-1 min-w-[150px] flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={20} className="text-orange-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Issue
              </p>
              <p className="text-xl font-bold text-orange-400">{totalIssues}</p>
            </div>
          </div>
        </div>
      )}

      {/* Table Area */}
      <div className={dataPanelClass}>
        <div className="p-4 border-b border-slate-700/30 flex items-center gap-3 flex-shrink-0 flex-wrap">
          <h2 className="font-semibold text-slate-200 text-xs flex-shrink-0">
            Sinkronisasi
          </h2>

          <div className="relative flex-1 min-w-[200px]">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              type="text"
              placeholder="Cari Alias AP atau Mikrotik..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 focus:border-purple-500 outline-none w-full"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-300 outline-none focus:border-purple-500 cursor-pointer"
          >
            <option value="all">Semua Data</option>
            <option value="ONLINE">Hanya Online</option>
            <option value="OFFLINE">Hanya Offline</option>
            <option value="ISSUE">Hanya Issue</option>
          </select>

          <select
            value={timeMode}
            onChange={(e) => setTimeMode(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-300 outline-none focus:border-purple-500 cursor-pointer"
          >
            <option value="duration">Uptime</option>
            <option value="timestamp">Timestamp</option>
          </select>

          <div className="flex items-center gap-3 ml-auto flex-shrink-0">
            <span className="text-xs text-slate-500 font-medium">
              Menampilkan {filteredDevices.length} dari {mergedDevices.length}
            </span>
          </div>
        </div>

        <div className={dataScrollClass}>
          {loading && mergedDevices.length === 0 ? (
            <div className="flex-1 flex flex-col gap-2 p-3 min-h-[300px]">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="w-full h-12 bg-slate-700/30 rounded-lg animate-pulse"
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
                  <p className="text-center py-12 text-slate-500 text-sm">
                    Tidak ada data
                  </p>
                ) : (
                  filteredDevices.map((d, i) => (
                    <div
                      key={i}
                      className="px-5 py-4 flex flex-col gap-3 hover:bg-slate-700/20 transition"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-bold text-slate-100 text-sm truncate">
                              {d.prefix || "-"}
                            </span>
                            <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded border border-purple-500/20">
                              PPPoE
                            </span>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded min-w-[52px] text-center">
                                Ruijie
                              </span>
                              <span className="font-mono text-xs text-slate-300 truncate">
                                {d.ruijie_alias || "-"}
                              </span>{" "}
                              {getSourceStatus(d.status_ruijie)}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded min-w-[52px] text-center">
                                Mikrotik
                              </span>
                              <MikrotikAliasCell
                                device={d}
                                canUpdate={canUpdate}
                                onLink={handleOpenModal}
                                onUnlink={handleRemoveMapping}
                                status={getSourceStatus(d.status_mikrotik)}
                                className="flex-1 min-w-0 text-xs"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          {getStatusDisplay(d)}
                        </div>
                      </div>

                      <div className="flex justify-between items-center gap-2 mt-1">
                        <div className="flex flex-col gap-1.5">
                          {d.issue ? (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-orange-400 bg-orange-400/10 px-2 py-1 rounded-md border border-orange-400/20 w-max">
                              <AlertTriangle size={12} /> {d.issue}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md border border-emerald-400/20 w-max">
                              <Wifi size={12} /> Normal
                            </span>
                          )}
                        </div>

                        <Link
                          href={`/sites/${encodeURIComponent(d.ruijie_mac)}`}
                          className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-orange-400 bg-orange-500/10 rounded border border-orange-500/20 flex-shrink-0"
                        >
                          <MapPin size={12} /> Detail
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop table view */}
              <div className="hidden lg:block min-h-0 overflow-x-auto">
                <table className="w-full text-xs min-w-[1000px]">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-slate-700/30 bg-slate-800/95 backdrop-blur">
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Final Status
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Prefix (Gabungan)
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Alias (Ruijie)
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Alias (Mikrotik PPPoE)
                        {canUpdate && (
                          <span className="block text-[9px] font-normal text-slate-600 normal-case mt-0.5">
                            Hover untuk tautan manual
                          </span>
                        )}
                      </th>
                      <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Status Ruijie
                      </th>
                      <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Status Mikrotik
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Keterangan Issue
                      </th>
                      <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Detail Wilayah
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDevices.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="text-center py-12 text-slate-500"
                        >
                          Tidak ada data
                        </td>
                      </tr>
                    ) : (
                      filteredDevices.map((d, i) => (
                        <tr
                          key={i}
                          className="border-b border-slate-700/20 hover:bg-slate-700/20 transition group"
                        >
                          <td className="px-4 py-3 w-32">
                            {getStatusDisplay(d)}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-300">
                            {editingPrefixMac === d.ruijie_mac ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={editPrefixValue}
                                  onChange={(e) =>
                                    setEditPrefixValue(e.target.value)
                                  }
                                  className="cursor-pointer bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 outline-none focus:border-purple-500 w-full min-w-[150px]"
                                  autoFocus
                                  disabled={isSavingPrefix}
                                />
                                <button
                                  onClick={() => handleSavePrefix(d)}
                                  disabled={isSavingPrefix}
                                  className="cursor-pointer p-1.5 bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 rounded flex-shrink-0"
                                >
                                  <Save size={14} />
                                </button>
                                <button
                                  onClick={() => setEditingPrefixMac(null)}
                                  disabled={isSavingPrefix}
                                  className="cursor-pointer p-1.5 bg-slate-700/50 text-slate-400 hover:bg-slate-700 rounded flex-shrink-0"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 group/prefix">
                                <span>
                                  {d.prefix
                                    ? String(d.prefix).toUpperCase()
                                    : "-"}
                                </span>
                                {canUpdate && (
                                  <button
                                    onClick={() => {
                                      setEditingPrefixMac(d.ruijie_mac);
                                      setEditPrefixValue(d.prefix || "");
                                    }}
                                    className="cursor-pointer opacity-0 group-hover/prefix:opacity-100 p-1 text-slate-400 hover:text-purple-400 transition"
                                    title="Edit Prefix"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className="font-mono text-slate-200">
                                {d.ruijie_alias || "-"}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                                MAC: {d.ruijie_mac || "-"}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 max-w-[220px]">
                            <MikrotikAliasCell
                              device={d}
                              canUpdate={canUpdate}
                              onLink={handleOpenModal}
                              onUnlink={handleRemoveMapping}
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            {getSourceStatus(d.status_ruijie)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {getSourceStatus(d.status_mikrotik)}
                          </td>
                          <td className="px-4 py-3">
                            {d.issue ? (
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-orange-400 bg-orange-400/10 px-2 py-1 rounded-md border border-orange-400/20">
                                <AlertTriangle size={12} /> {d.issue}
                              </span>
                            ) : (
                              <span className="text-slate-500 text-xs">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Link
                              href={`/sites/${encodeURIComponent(d.ruijie_mac)}`}
                              className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 rounded border border-orange-500/20 transition"
                              title="Detail wilayah PPPoE"
                            >
                              <MapPin size={12} /> Detail
                            </Link>
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
      </div>

      {/* Modal Manual Link */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-700 shadow-2xl rounded-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between bg-slate-800/80">
              <h3 className="font-bold text-slate-100 flex items-center gap-2">
                <LinkIcon size={16} className="text-purple-400" />
                Tautkan Manual AP ke Mikrotik PPPoE
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="cursor-pointer text-slate-400 hover:text-white transition"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                  Ruijie Access Point (PPPoE)
                </label>
                <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-3">
                  <p className="font-medium text-slate-200">
                    {selectedAp?.alias}
                  </p>
                  <p className="text-[12px] text-slate-500 font-mono mt-0.5">
                    MAC: {selectedAp?.mac_address}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                  Pilih Akun Mikrotik (PPPoE)
                </label>
                <select
                  value={selectedMikrotikName}
                  onChange={(e) => setSelectedMikrotikName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-xs text-slate-100 focus:border-purple-500 outline-none"
                >
                  <option value="" disabled>
                    -- Pilih Akun --
                  </option>
                  {mikrotikSecrets
                    .filter((s) => s.service === "pppoe")
                    .map((s, i) => {
                      const isUsed =
                        mappings.some((m) => m.mikrotik_name === s.name) &&
                        s.name !== selectedAp?.mikrotik_name;
                      return (
                        <option key={i} value={s.name} disabled={isUsed}>
                          {s.name} ({s.service || "any"}){" "}
                          {isUsed ? "(Sudah Digunakan)" : ""}
                        </option>
                      );
                    })}
                </select>
                <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                  Pilih nama secret PPPoE yang benar dari Mikrotik. Pilihan ini
                  akan menimpa pencocokan nama otomatis.
                </p>
              </div>
            </div>
            <div className="p-4 border-t border-slate-700 bg-slate-800/80 flex items-center justify-end gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="cursor-pointer px-4 py-2 text-xs font-medium text-slate-300 hover:text-white transition"
              >
                Batal
              </button>
              <button
                onClick={handleSaveMapping}
                disabled={isSaving || !selectedMikrotikName}
                className="cursor-pointer px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-medium transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                Simpan Tautan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
