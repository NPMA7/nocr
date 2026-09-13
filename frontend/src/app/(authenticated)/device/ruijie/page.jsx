"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";
import { API_URL, socket, useAppState } from "@/App";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Search,
  Clock,
  Users,
  Activity,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Globe,
  Edit,
  Power,
  Loader2,
  X,
  ExternalLink,
  ArrowRight,
  Server,
  Link
} from "lucide-react";
import { getStoredUser, hasAccess } from "@/lib/roles";
import RuijieEwebModal from "@/components/device/ruijie/RuijieEwebModal";
import RuijieRebootConfirmModal from "@/components/device/ruijie/RuijieRebootConfirmModal";

export default function Ruijie() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [sortConfig, setSortConfig] = useState({ key: null, dir: "asc" });
  const { setLastSyncTime, showToast } = useAppState();

  const [hasReadAccess, setHasReadAccess] = useState(true);
  const [canUpdate, setCanUpdate] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Action status/states
  const [actionLoading, setActionLoading] = useState({}); // { [sn]: { reboot: bool, eweb: bool } }
  const [editingDevice, setEditingDevice] = useState(null);
  const [newAlias, setNewAlias] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [ewebModalData, setEwebModalData] = useState(null);
  const [rebootConfirmDevice, setRebootConfirmDevice] = useState(null);
  // Menyimpan alias yg sudah direname optimistic tapi belum tersinkron oleh scraper
  const pendingRenames = useRef({}); // { [sn]: newAlias }

  const applyOptimisticState = (list) => {
    return (list || []).map((d) => {
      let item = { ...d };
      if (pendingRenames.current[item.sn]) {
        if (item.alias === pendingRenames.current[item.sn]) {
          delete pendingRenames.current[item.sn];
        } else {
          item.alias = pendingRenames.current[item.sn];
        }
      }
      return item;
    });
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(30);

  useEffect(() => {
    const user = getStoredUser();
    setCurrentUser(user);
    if (user && user.role) {
      setHasReadAccess(hasAccess(user, "devices-ruijie", "read"));
      setCanUpdate(hasAccess(user, "devices-ruijie", "update"));
      setCanDelete(hasAccess(user, "devices-ruijie", "delete"));
    }
  }, []);

  const fetchDevices = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_URL}/ruijie`);
      setDevices(applyOptimisticState(res.data || []));
      setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
    } catch (e) {
      setError(e.message || "Gagal mengambil data Ruijie");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();

    if (socket) {
      const handleUpdate = (data) => {
        setDevices(applyOptimisticState(data || []));
        setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
      };

      socket.on("ruijie_update", handleUpdate);

      return () => {
        socket.off("ruijie_update", handleUpdate);
      };
    }
  }, []);

  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      const term = search.toLowerCase();
      const matchesSearch =
        !term ||
        (d.alias && d.alias.toLowerCase().includes(term)) ||
        (d.mac_address && d.mac_address.toLowerCase().includes(term)) ||
        (d.sn && d.sn.toLowerCase().includes(term)) ||
        (d.ip_address && d.ip_address.includes(term));

      if (!matchesSearch) return false;

      if (filterStatus !== "all") {
        if (filterStatus === "ON" && d.status !== "ON") return false;
        if (filterStatus === "OFF" && d.status !== "OFF") return false;
      }

      if (filterType !== "all") {
        if (d.connection_type !== filterType) return false;
      }

      return true;
    });
  }, [devices, search, filterStatus, filterType]);

  const sortedDevices = useMemo(() => {
    return [...filteredDevices].sort((a, b) => {
      if (!sortConfig.key) return 0;
      let aVal = a[sortConfig.key] ?? "";
      let bVal = b[sortConfig.key] ?? "";
      if (sortConfig.key === "clients") {
        aVal = Number(aVal) || 0;
        bVal = Number(bVal) || 0;
        return sortConfig.dir === "asc" ? aVal - bVal : bVal - aVal;
      }
      aVal = String(aVal).toLowerCase();
      bVal = String(bVal).toLowerCase();
      if (aVal < bVal) return sortConfig.dir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.dir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredDevices, sortConfig]);

  const totalPages = useMemo(() => {
    if (itemsPerPage === "all") return 1;
    return Math.ceil(sortedDevices.length / itemsPerPage) || 1;
  }, [sortedDevices.length, itemsPerPage]);

  const paginatedDevices = useMemo(() => {
    if (itemsPerPage === "all") return sortedDevices;
    const start = (currentPage - 1) * itemsPerPage;
    return sortedDevices.slice(start, start + itemsPerPage);
  }, [sortedDevices, currentPage, itemsPerPage]);

  const SortIcon = ({ col }) => {
    if (sortConfig.key !== col)
      return <ChevronsUpDown size={12} className="opacity-40" />;
    return sortConfig.dir === "asc" ? (
      <ChevronUp size={12} className="text-blue-400" />
    ) : (
      <ChevronDown size={12} className="text-blue-400" />
    );
  };

  const handleReboot = (device) => {
    if (!canDelete) {
      showToast("Anda tidak memiliki izin (Delete) untuk me-reboot perangkat", "error");
      return;
    }
    setRebootConfirmDevice(device);
  };

  const confirmReboot = async () => {
    const device = rebootConfirmDevice;
    if (!device) return;
    const sn = device.sn;
    const type = (device.connection_type || "l2tp").toLowerCase();
    setActionLoading(prev => ({ ...prev, [sn]: { ...prev[sn], reboot: true } }));
    try {
      await axios.post(`${API_URL}/ruijie/action`, { action: 'reboot', sn, type });
      setRebootConfirmDevice(null);
      showToast(`Perintah reboot berhasil dikirim untuk ${device.alias || sn}`, "success");
    } catch (err) {
      showToast(err.response?.data?.error || err.message || "Gagal melakukan reboot", "error");
    } finally {
      setActionLoading(prev => ({ ...prev, [sn]: { ...prev[sn], reboot: false } }));
    }
  };

  const handleEweb = async (device) => {
    const sn = device.sn;
    const type = (device.connection_type || "l2tp").toLowerCase();

    if (!canUpdate) {
      showToast("Anda tidak memiliki izin (Update) untuk mengakses eWeb", "error");
      return;
    }

    setActionLoading(prev => ({ ...prev, [sn]: { ...prev[sn], eweb: true } }));
    try {
      const res = await axios.post(`${API_URL}/ruijie/action`, { action: 'eweb', sn, type });
      const urls = res.data?.urls;
      if (urls && (urls.useUrl || urls.domainUrl || urls.ipUrl)) {
        setEwebModalData({
          device,
          urls
        });
        showToast("Tunnel eWeb berhasil dibuat. Silakan pilih metode koneksi.", "success");
      } else {
        showToast("Tunnel eWeb berhasil dibuat, tetapi URL tidak ditemukan", "warning");
      }
    } catch (err) {
      showToast(err.response?.data?.error || err.message || "Gagal mengambil URL eWeb", "error");
    } finally {
      setActionLoading(prev => ({ ...prev, [sn]: { ...prev[sn], eweb: false } }));
    }
  };

  const handleRenameClick = (device) => {
    if (!canUpdate) {
      showToast("Anda tidak memiliki izin (Update) untuk mengubah nama alias", "error");
      return;
    }
    setEditingDevice(device);
    setNewAlias(device.alias || "");
  };

  const handleRenameSubmit = async (e) => {
    e.preventDefault();
    if (!editingDevice) return;
    if (!canUpdate) {
      showToast("Anda tidak memiliki izin (Update) untuk mengubah nama alias", "error");
      return;
    }
    if (!newAlias.trim()) {
      showToast("Nama alias baru tidak boleh kosong", "error");
      return;
    }

    setIsRenaming(true);
    const sn = editingDevice.sn;
    const type = (editingDevice.connection_type || "l2tp").toLowerCase();
    const trimmedAlias = newAlias.trim();
    try {
      await axios.post(`${API_URL}/ruijie/action`, {
        action: 'rename',
        sn,
        type,
        newAlias: trimmedAlias
      });
      // Optimistic update: langsung ganti nama di state lokal tanpa nunggu scraper
      pendingRenames.current[sn] = trimmedAlias;
      setDevices(prev => prev.map(d => d.sn === sn ? { ...d, alias: trimmedAlias } : d));
      showToast("Alias perangkat berhasil diperbarui", "success");
      setEditingDevice(null);
    } catch (err) {
      showToast(err.response?.data?.error || err.message || "Gagal mengubah alias", "error");
    } finally {
      setIsRenaming(false);
    }
  };

  const totalAp = filteredDevices.length;
  const totalOnline = filteredDevices.filter((d) => d.status === "ON").length;
  const totalOffline = filteredDevices.filter((d) => d.status === "OFF").length;
  const totalClients = filteredDevices.reduce(
    (sum, d) => sum + (Number(d.clients) || 0),
    0,
  );

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      dir: prev.key === key && prev.dir === "asc" ? "desc" : "asc",
    }));
  };

  const getStatusDisplay = (device) => {
    const isOnline = device.status === "ON";

    if (isOnline) {
      return (
        <div className="flex flex-col items-start">
          <span className="text-[11px] px-2 py-0.5 rounded-md font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 w-max flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Online
          </span>
          {device.last_log_history && (
            <span className="text-[10px] text-slate-500 mt-1 flex items-center gap-1 font-mono">
              <Clock size={10} className="text-slate-600" /> {device.last_log_history}
            </span>
          )}
        </div>
      );
    } else {
      return (
        <div className="flex flex-col items-start">
          <span className="text-[11px] px-2 py-0.5 rounded-md font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 w-max flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            Offline
          </span>
          {device.last_online && (
            <span className="text-[10px] text-rose-400/80 mt-1 flex items-center gap-1 font-mono">
              <Clock size={10} className="text-rose-500/50" /> {device.last_online}
            </span>
          )}
        </div>
      );
    }
  };

  if (!hasReadAccess) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4">
        <AlertTriangle size={48} className="text-rose-500/50" />
        <p className="text-sm font-medium text-slate-400">
          Akses Ditolak: Anda tidak memiliki izin (Read) ke Perangkat Jaringan (Ruijie).
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-3.5 min-w-0 pb-6 relative">
      {/* 1. TOP HEADER & SYNC ACTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <Wifi size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-slate-100">
                Perangkat Ruijie AP
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Reyee Cloud
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {devices.length} Unit
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Daftar perangkat Access Point Ruijie Reyee — sinkronisasi status, remote eWeb, manajemen alias, dan reboot
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={fetchDevices}
            disabled={loading}
            className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition disabled:opacity-50 shadow-sm"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-white" : "text-white"} />
            <span>{loading ? "Sinkron..." : "Sync Sekarang"}</span>
          </button>
        </div>
      </div>

      {/* 2. COMPACT KPI STAT CARDS (4 Columns) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total AP */}
        <div
          onClick={() => {
            setFilterStatus("all");
            setFilterType("all");
            setCurrentPage(1);
          }}
          className={`p-3 bg-slate-900 border rounded-xl shadow-sm flex items-center justify-between cursor-pointer transition ${
            filterStatus === "all" && filterType === "all"
              ? "border-blue-500/40 bg-slate-900"
              : "border-slate-800 hover:border-slate-700"
          }`}
          title="Klik untuk reset filter status"
        >
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
              Total AP
            </p>
            <p className="text-xl font-bold font-mono text-slate-100 mt-0.5">
              {devices.length}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
              Semua Ruijie Reyee
            </p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-400">
            <Activity size={15} />
          </div>
        </div>

        {/* Total Online */}
        <div
          onClick={() => {
            setFilterStatus(filterStatus === "ON" ? "all" : "ON");
            setCurrentPage(1);
          }}
          className={`p-3 bg-slate-900 border rounded-xl shadow-sm flex items-center justify-between cursor-pointer transition ${
            filterStatus === "ON"
              ? "border-emerald-500/50 bg-emerald-950/20"
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
              {devices.length > 0
                ? ((totalOnline / devices.length) * 100).toFixed(1)
                : 0}
              % terhubung
            </p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Wifi size={15} />
          </div>
        </div>

        {/* Total Offline */}
        <div
          onClick={() => {
            setFilterStatus(filterStatus === "OFF" ? "all" : "OFF");
            setCurrentPage(1);
          }}
          className={`p-3 bg-slate-900 border rounded-xl shadow-sm flex items-center justify-between cursor-pointer transition ${
            filterStatus === "OFF"
              ? "border-rose-500/50 bg-rose-950/20"
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
              {totalOffline === 0 ? "Semua terhubung" : "Perlu pengecekan"}
            </p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <WifiOff size={15} />
          </div>
        </div>

        {/* Total Client */}
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
              Total Client
            </p>
            <p className="text-xl font-bold font-mono text-slate-100 mt-0.5">
              {totalClients}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
              Pengguna aktif terhubung
            </p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-400">
            <Users size={15} />
          </div>
        </div>
      </div>

      {/* 3. TABLE SECTION WITH TOOLBAR & FILTERS */}
      <div className="flex flex-col min-w-0 bg-slate-900 border border-slate-800 rounded-xl shadow-sm overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-3 sm:p-4 border-b border-slate-800 flex items-center gap-2.5 flex-wrap">
          {/* Quick Filter Chips for Type */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            <button
              onClick={() => {
                setFilterType("all");
                setCurrentPage(1);
              }}
              className={`cursor-pointer px-2.5 py-1 rounded text-xs font-semibold transition ${
                filterType === "all"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Semua Tipe
            </button>
            <button
              onClick={() => {
                setFilterType("L2TP");
                setCurrentPage(1);
              }}
              className={`cursor-pointer px-2.5 py-1 rounded text-xs font-semibold transition flex items-center gap-1 ${
                filterType === "L2TP"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>Desa</span>
              <span className="text-[10px] opacity-75 font-mono">(L2TP)</span>
            </button>
            <button
              onClick={() => {
                setFilterType("PPPOE");
                setCurrentPage(1);
              }}
              className={`cursor-pointer px-2.5 py-1 rounded text-xs font-semibold transition flex items-center gap-1 ${
                filterType === "PPPOE"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>OPD</span>
              <span className="text-[10px] opacity-75 font-mono">(PPPoE)</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              type="text"
              placeholder="Cari Alias, MAC, SN, atau IP..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 outline-none transition"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status Dropdown */}
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="all">Semua Status</option>
            <option value="ON">Online Saja</option>
            <option value="OFF">Offline Saja</option>
          </select>

          {/* Per Page Select */}
          <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
            <span className="text-xs text-slate-500 hidden sm:inline">Tampilkan:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                const val =
                  e.target.value === "all" ? "all" : Number(e.target.value);
                setItemsPerPage(val);
                setCurrentPage(1);
              }}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-300 outline-none focus:border-blue-500 cursor-pointer font-mono"
            >
              <option value={10}>10</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value="all">Semua ({filteredDevices.length})</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto min-w-0">
          {loading && devices.length === 0 ? (
            <div className="flex-1 flex flex-col gap-2 p-4 min-h-[300px]">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="w-full h-10 bg-slate-800/40 rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-rose-400">
              <WifiOff size={28} className="text-rose-500/60" />
              <p className="text-xs">{error}</p>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="md:hidden flex flex-col gap-2.5 p-2.5 sm:p-3 bg-slate-950/40">
                {sortedDevices.length === 0 ? (
                  <p className="text-center py-12 text-slate-500 text-xs">
                    Tidak ada data AP yang sesuai
                  </p>
                ) : (
                  paginatedDevices.map((d, i) => (
                    <div
                      key={i}
                      className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl flex flex-col gap-2 shadow-sm"
                    >
                      {/* Baris 1: Identitas Site (Kiri) | Status Online/Offline (Rata Kanan) */}
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <span
                            className="font-semibold text-slate-100 text-xs truncate"
                            title={d.alias}
                          >
                            {d.alias || "-"}
                          </span>
                          {canUpdate && (
                            <button
                              onClick={() => handleRenameClick(d)}
                              title="Rename Alias"
                              className="text-slate-500 hover:text-blue-400 p-0.5 transition shrink-0 cursor-pointer"
                            >
                              <Edit size={11} />
                            </button>
                          )}
                          <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded font-mono font-medium bg-slate-800 text-slate-400 border border-slate-700">
                            {d.connection_type === "L2TP"
                              ? "Desa"
                              : d.connection_type === "PPPOE"
                              ? "OPD"
                              : d.connection_type || "-"}
                          </span>
                        </div>
                        {/* Status Online/Offline - Rata Kanan Presisi */}
                        <div className="shrink-0 ml-auto">
                          {d.status === "ON" ? (
                            <span className="text-[11px] px-2 py-0.5 rounded-md font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5 whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Online
                            </span>
                          ) : (
                            <span className="text-[11px] px-2 py-0.5 rounded-md font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1.5 whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                              Offline
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Baris 2: IP Address & MAC (Kiri) | Waktu Log / Online Terakhir (Rata Kanan) */}
                      <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                        <div className="text-slate-400 truncate flex items-center gap-1 min-w-0">
                          <span>{d.ip_address || "-"}</span>
                          <span className="text-slate-600">·</span>
                          <span className="text-slate-500">{d.mac_address}</span>
                        </div>
                        {(d.status === "ON" ? d.last_log_history : d.last_online) && (
                          <div className="shrink-0 text-[10px] text-slate-500 flex items-center gap-1 ml-auto whitespace-nowrap">
                            <Clock size={10} className="text-slate-600 shrink-0" />
                            <span>{d.status === "ON" ? d.last_log_history : d.last_online}</span>
                          </div>
                        )}
                      </div>

                      {/* Baris 3: Clients & Serial Number (Kiri) | Tombol eWeb & Reboot (Kanan) */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/60">
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 min-w-0">
                          <span className="inline-flex items-center gap-1 font-mono text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20 shrink-0">
                            <Users size={11} /> {d.clients || 0}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono truncate">
                            SN: {d.sn}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                          {canUpdate && (
                            <button
                              onClick={() => handleEweb(d)}
                              disabled={actionLoading[d.sn]?.eweb}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-medium transition cursor-pointer disabled:opacity-50 whitespace-nowrap"
                            >
                              {actionLoading[d.sn]?.eweb ? (
                                <Loader2 size={11} className="animate-spin" />
                              ) : (
                                <Globe size={11} className="text-blue-400" />
                              )}
                              eWeb
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleReboot(d)}
                              disabled={actionLoading[d.sn]?.reboot}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-950/30 hover:bg-rose-900/40 border border-rose-500/20 text-rose-400 text-[11px] font-medium transition cursor-pointer disabled:opacity-50 whitespace-nowrap"
                            >
                              {actionLoading[d.sn]?.reboot ? (
                                <Loader2 size={11} className="animate-spin" />
                              ) : (
                                <Power size={11} className="text-rose-400" />
                              )}
                              Reboot
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block min-h-0">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/60">
                      {[
                        { label: "Status", key: "status", width: "w-36" },
                        { label: "Alias & Lokasi", key: "alias" },
                        { label: "MAC Address", key: "mac_address", width: "w-36" },
                        { label: "MGMT IP", key: "ip_address", width: "w-32" },
                        { label: "Clients", key: "clients", width: "w-24" },
                        { label: "Serial Number", key: "sn", width: "w-36" },
                      ].map(({ label, key, width }) => (
                        <th
                          key={key}
                          onClick={() => handleSort(key)}
                          className={`px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono cursor-pointer select-none hover:text-slate-200 hover:bg-slate-800/40 transition-colors ${width || ""}`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span>{label}</span>
                            <SortIcon col={key} />
                          </div>
                        </th>
                      ))}
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono text-right w-36 select-none">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70 text-xs">
                    {sortedDevices.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="text-center py-12 text-slate-500 font-mono text-xs"
                        >
                          Tidak ada data AP yang cocok dengan filter pencarian
                        </td>
                      </tr>
                    ) : (
                      paginatedDevices.map((d, i) => (
                        <tr
                          key={i}
                          className="hover:bg-slate-800/30 transition-colors group"
                        >
                          <td className="px-4 py-3 align-middle">
                            {getStatusDisplay(d)}
                          </td>
                          <td className="px-4 py-3 align-middle font-medium text-slate-200">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-100 group-hover:text-blue-300 transition-colors">
                                {d.alias || "-"}
                              </span>
                              {canUpdate && (
                                <button
                                  onClick={() => handleRenameClick(d)}
                                  title="Ubah Alias Perangkat"
                                  className="text-slate-500 hover:text-blue-400 p-0.5 transition cursor-pointer"
                                >
                                  <Edit size={12} />
                                </button>
                              )}
                              <span className="flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                                {d.connection_type === "L2TP"
                                  ? "Desa"
                                  : d.connection_type === "PPPOE"
                                  ? "OPD"
                                  : d.connection_type || "Unknown"}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 align-middle text-slate-400 font-mono text-xs">
                            {d.mac_address || "-"}
                          </td>
                          <td className="px-4 py-3 align-middle text-slate-300 font-mono text-xs">
                            {d.ip_address || "-"}
                          </td>
                          <td className="px-4 py-3 align-middle">
                            <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                              <Users size={11} className="text-blue-400" />
                              {d.clients || 0}
                            </span>
                          </td>
                          <td className="px-4 py-3 align-middle text-slate-400 font-mono text-xs">
                            {d.sn}
                          </td>
                          <td className="px-4 py-3 align-middle text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {canUpdate && (
                                <button
                                  onClick={() => handleEweb(d)}
                                  title="Buka Web GUI Perangkat (eWeb)"
                                  disabled={actionLoading[d.sn]?.eweb}
                                  className="cursor-pointer flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition disabled:opacity-50"
                                >
                                  {actionLoading[d.sn]?.eweb ? (
                                    <Loader2 size={12} className="animate-spin text-blue-400" />
                                  ) : (
                                    <Globe size={12} className="text-blue-400" />
                                  )}
                                  <span>eWeb</span>
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  onClick={() => handleReboot(d)}
                                  title="Kirim Perintah Reboot Cloud"
                                  disabled={actionLoading[d.sn]?.reboot}
                                  className="cursor-pointer flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-950/30 hover:bg-rose-900/40 border border-rose-500/20 text-rose-400 hover:text-rose-300 text-xs font-medium transition disabled:opacity-50"
                                >
                                  {actionLoading[d.sn]?.reboot ? (
                                    <Loader2 size={12} className="animate-spin text-rose-400" />
                                  ) : (
                                    <Power size={12} className="text-rose-400" />
                                  )}
                                  <span>Reboot</span>
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
        {sortedDevices.length > 0 && (
          <div className="p-3 border-t border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs bg-slate-950/40">
            <span className="text-slate-400 font-mono">
              {itemsPerPage === "all"
                ? `Menampilkan ${sortedDevices.length} dari ${sortedDevices.length} perangkat`
                : `Menampilkan ${Math.min((currentPage - 1) * itemsPerPage + 1, sortedDevices.length)}-${Math.min(currentPage * itemsPerPage, sortedDevices.length)} dari ${sortedDevices.length} perangkat`}
            </span>
            {itemsPerPage !== "all" && totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-slate-300 border border-slate-800 transition cursor-pointer text-xs font-medium"
                >
                  Sebelumnya
                </button>
                <span className="text-slate-400 font-mono px-2">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-slate-300 border border-slate-800 transition cursor-pointer text-xs font-medium"
                >
                  Selanjutnya
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Rename Modal */}
      {editingDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
                <Edit size={15} className="text-blue-400" />
                Edit Alias Perangkat
              </h3>
              <button
                onClick={() => setEditingDevice(null)}
                className="cursor-pointer text-slate-400 hover:text-slate-200 transition"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleRenameSubmit} className="p-4 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-slate-400">Serial Number (SN)</label>
                <input
                  type="text"
                  disabled
                  value={editingDevice.sn}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-400 outline-none cursor-not-allowed"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-slate-300">Nama Alias Baru</label>
                <input
                  type="text"
                  required
                  value={newAlias}
                  onChange={(e) => setNewAlias(e.target.value)}
                  placeholder="Masukkan nama alias..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 outline-none transition"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingDevice(null)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 font-medium transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isRenaming}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs text-white font-semibold transition disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {isRenaming && <Loader2 size={13} className="animate-spin" />}
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* eWeb Tunnel Modal */}
      <RuijieEwebModal
        ewebModalData={ewebModalData}
        setEwebModalData={setEwebModalData}
      />

      {/* Reboot Confirmation Modal */}
      <RuijieRebootConfirmModal
        rebootConfirmDevice={rebootConfirmDevice}
        setRebootConfirmDevice={setRebootConfirmDevice}
        confirmReboot={confirmReboot}
        isLoading={Boolean(rebootConfirmDevice && actionLoading[rebootConfirmDevice.sn]?.reboot)}
      />
    </div>
  );
}