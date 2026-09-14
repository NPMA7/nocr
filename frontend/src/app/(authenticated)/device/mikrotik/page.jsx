"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";
import { API_URL, socket, useAppState } from "@/App";
import {
  Activity,
  Wifi,
  WifiOff,
  Users,
  RefreshCw,
  Settings,
  AlertTriangle,
  UserPlus,
  X,
  Plus,
  Edit2,
  Trash2,
  Check,
  Eye,
  EyeOff,
  Timer,
  Server,
  Search,
} from "lucide-react";
import {
  hasAccess,
  getStoredUser,
  getRoleLabel,
  isEditorRole,
} from "@/lib/roles";
import MikrotikStatCards from "@/components/device/mikrotik/MikrotikStatCards";
import PPPoEUserModal from "@/components/device/mikrotik/PPPoEUserModal";

const statusColor = (running, disabled) => {
  if (disabled === "true") return "bg-slate-800 text-slate-400 border border-slate-700";
  if (running === "true") return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
  return "bg-rose-500/10 text-rose-400 border border-rose-500/20";
};

// Komponen Toast
function Toast({ toasts }) {
  return (
    <div className="fixed top-4 right-4 z-[2000] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border text-xs font-medium backdrop-blur-sm pointer-events-auto transition-all duration-300
          ${
            t.type === "success"
              ? "bg-emerald-900/90 border-emerald-500/40 text-emerald-200"
              : t.type === "error"
                ? "bg-red-900/90 border-red-500/40 text-red-200"
                : "bg-slate-800/90 border-slate-600/40 text-slate-200"
          }`}
        >
          {t.type === "success" ? (
            <Check size={16} className="text-emerald-400 flex-shrink-0" />
          ) : t.type === "error" ? (
            <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />
          ) : null}
          {t.message}
        </div>
      ))}
    </div>
  );
}

// Dialog Konfirmasi
function ConfirmDialog({
  show,
  title,
  message,
  onConfirm,
  onCancel,
  danger = true,
}) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[1500] p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-sm shadow-2xl p-6 flex flex-col gap-5">
        <div className="flex items-start gap-4">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${danger ? "bg-red-500/20" : "bg-blue-500/20"}`}
          >
            {danger ? (
              <Trash2 size={18} className="text-red-400" />
            ) : (
              <AlertTriangle size={18} className="text-blue-400" />
            )}
          </div>
          <div>
            <h3 className="font-bold text-slate-100">{title}</h3>
            <p className="text-xs text-slate-400 mt-1">{message}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="cursor-pointer bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2 rounded-lg text-xs font-semibold transition"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            className={`cursor-pointer text-white px-4 py-2 rounded-lg text-xs font-semibold transition ${danger ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}
          >
            {danger ? "Ya, Hapus" : "Konfirmasi"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Mikrotik() {
  const { sessionUser } = useAppState();
  const [canCreate, setCanCreate] = useState(false);
  const [canUpdate, setCanUpdate] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [canShowPassword, setCanShowPassword] = useState(false);

  const syncRoleFlags = () => {
    const userData = getStoredUser();
    if (
      userData &&
      userData.role &&
      !hasAccess(userData, "devices-mikrotik", "read")
    ) {
      window.location.href = "/dashboard";
      return;
    }
    setCanCreate(hasAccess(userData, "devices-mikrotik", "create"));
    setCanUpdate(hasAccess(userData, "devices-mikrotik", "update"));
    setCanDelete(hasAccess(userData, "devices-mikrotik", "delete"));
    setCanShowPassword(hasAccess(userData, "devices-mikrotik", "update"));
  };
  const [tab, setTab] = useState("interfaces");
  const [coreStatus, setCoreStatus] = useState(null);
  const [interfaces, setInterfaces] = useState([]);
  const [pppoe, setPppoe] = useState([]);
  const [pppoeSecrets, setPppoeSecrets] = useState([]);
  const [pppProfiles, setPppProfiles] = useState([]);
  const [isCustomProfile, setIsCustomProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [interfaceSearch, setInterfaceSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [pppoeSearch, setPppoeSearch] = useState("");
  const [sessionFilterService, setSessionFilterService] = useState("all");
  const [secretSearch, setSecretSearch] = useState("");
  const [toasts, setToasts] = useState([]);

  // Status Tambah/Edit Secret
  const [showAddSecret, setShowAddSecret] = useState(false);
  const [editingSecret, setEditingSecret] = useState(null);
  const [secretForm, setSecretForm] = useState({
    name: "",
    password: "",
    profile: "default",
    service: "pppoe",
    localAddress: "",
    remoteAddress: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showListPasswords, setShowListPasswords] = useState({});
  const toggleListPassword = (name) =>
    setShowListPasswords((prev) => ({ ...prev, [name]: !prev[name] }));

  // Status Tambah/Edit Interface
  const [showAddInterface, setShowAddInterface] = useState(false);
  const [editingInterface, setEditingInterface] = useState(null);
  const [interfaceForm, setInterfaceForm] = useState({
    name: "",
    type: "vlan",
    mtu: 1500,
    vlanId: "",
    parentInterface: "",
    user: "",
    service: "",
    disabled: "false",
  });

  // Status Konfirmasi hapus
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    syncRoleFlags();
    const onRole = () => syncRoleFlags();
    window.addEventListener("nocr-role-updated", onRole);
    return () => window.removeEventListener("nocr-role-updated", onRole);
  }, []);

  useEffect(() => {
    if (sessionUser?.role) syncRoleFlags();
  }, [sessionUser]);

  const addToast = (message, type = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      4000,
    );
  };

  const [syncStatus, setSyncStatus] = useState({
    interfaces: null,
    secrets: null,
    pppoe: null,
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(30);

  const fetchAll = async (forceRefresh = false, lazy = false) => {
    if (!lazy) setLoading(true);
    else setSyncing(true);
    setError(null);
    try {
      const queryParams = forceRefresh ? "?force=true" : "";

      // Fetch berurutan untuk mencegah bentrok koneksi (race condition) ke RouterOS
      const statusRes = await axios
        .get(`${API_URL}/devices/core/status${queryParams}`)
        .catch((e) => ({
          data: {
            connected: false,
            error: e.response?.data?.error || e.message,
          },
        }));
      const ifaceRes = await axios
        .get(`${API_URL}/devices/core/interfaces${queryParams}`)
        .catch(() => ({ data: [] }));
      const pppoeRes = await axios
        .get(`${API_URL}/devices/core/pppoe${queryParams}`)
        .catch(() => ({ data: [] }));
      const secretsRes = await axios
        .get(`${API_URL}/devices/core/pppoe-secrets${queryParams}`)
        .catch(() => ({ data: [] }));
      const profilesRes = await axios
        .get(`${API_URL}/devices/core/ppp-profiles${queryParams}`)
        .catch(() => ({ data: [] }));

      setCoreStatus(statusRes.data);
      const ifaces = ifaceRes.data || [];
      const pppoeData = pppoeRes.data || [];
      const secretsData = secretsRes.data || [];
      const profilesData = (profilesRes.data || []).map((p) => p.name).filter(Boolean);
      setInterfaces(ifaces);
      setPppoe(pppoeData);
      setPppoeSecrets(secretsData);
      setPppProfiles(profilesData);
      setSyncStatus({
        interfaces: ifaces[0]?._fromCache ? "cache" : "live",
        pppoe: pppoeData[0]?._fromCache ? "cache" : "live",
        secrets: secretsData[0]?._fromCache ? "cache" : "live",
        syncedAt: new Date().toLocaleTimeString("id-ID"),
      });
      if (forceRefresh && !lazy)
        addToast("Data berhasil disinkronkan dari MikroTik!", "success");
    } catch (e) {
      if (!lazy) setError(e.message);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchAll();

    if (socket) {
      const handleMikrotikUpdate = (data) => {
        if (!data) return;
        setInterfaces(data.interfaces || []);
        setPppoe(data.pppoe || []);
        setPppoeSecrets(data.secrets || []);
        setSyncStatus({
          interfaces: "live",
          pppoe: "live",
          secrets: "live",
          syncedAt: new Date(data.timestamp || new Date()).toLocaleTimeString(
            "id-ID",
          ),
        });
      };

      socket.on("mikrotik_full_update", handleMikrotikUpdate);
      return () => {
        socket.off("mikrotik_full_update", handleMikrotikUpdate);
      };
    }
  }, []);

  const handleDisconnectPPPoE = async (session) => {
    try {
      const id = session[".id"];
      await axios.delete(
        `${API_URL}/devices/core/pppoe/${encodeURIComponent(id)}`,
      );
      addToast(`Sesi "${session.name}" berhasil diputus!`, "success");
      setConfirmDelete(null);
      fetchAll();
    } catch (err) {
      addToast(
        "Gagal memutus sesi: " + (err.response?.data?.error || err.message),
        "error",
      );
      setConfirmDelete(null);
    }
  };

  const availableProfilesList = Array.from(
    new Set([
      "default",
      ...pppProfiles,
      ...pppoeSecrets.map((s) => s.profile).filter(Boolean),
    ]),
  ).sort();

  const openAddSecret = () => {
    setEditingSecret(null);
    const defaultProf = availableProfilesList[0] || "default";
    setSecretForm({
      name: "",
      password: "",
      profile: defaultProf,
      service: "pppoe",
      localAddress: "",
      remoteAddress: "",
    });
    setIsCustomProfile(false);
    setShowPassword(false);
    setShowAddSecret(true);
  };

  const openEditSecret = (s) => {
    setEditingSecret(s);
    const currentProf = s.profile || "default";
    const exists = availableProfilesList.includes(currentProf);
    setSecretForm({
      name: s.name,
      password: s.password || "",
      profile: currentProf,
      service: s.service || "pppoe",
      localAddress: s["local-address"] || s.local_address || s.localAddress || "",
      remoteAddress: s["remote-address"] || s.remote_address || s.remoteAddress || "",
    });
    setIsCustomProfile(!exists);
    setShowPassword(false);
    setShowAddSecret(true);
  };

  const handleSaveSecret = async (e) => {
    e.preventDefault();
    try {
      if (editingSecret) {
        const id = editingSecret[".id"];
        await axios.put(
          `${API_URL}/devices/core/pppoe-secrets/${encodeURIComponent(id)}`,
          {
            ...secretForm,
            oldName: editingSecret.name,
          },
        );
        addToast("Pelanggan berhasil diubah!", "success");
      } else {
        await axios.post(`${API_URL}/devices/core/pppoe-secrets`, secretForm);
        addToast(
          "Pelanggan berhasil ditambahkan ke MikroTik & database!",
          "success",
        );
      }
      setShowAddSecret(false);
      fetchAll();
    } catch (err) {
      addToast("Gagal: " + (err.response?.data?.error || err.message), "error");
    }
  };

  const handleDeleteSecret = async (s) => {
    try {
      const id = s[".id"];
      await axios.delete(
        `${API_URL}/devices/core/pppoe-secrets/${encodeURIComponent(id)}?name=${encodeURIComponent(s.name)}`,
      );
      addToast(`Pelanggan "${s.name}" berhasil dihapus!`, "success");
      setConfirmDelete(null);
      fetchAll(true);
    } catch (err) {
      addToast(
        "Gagal menghapus: " + (err.response?.data?.error || err.message),
        "error",
      );
      setConfirmDelete(null);
    }
  };

  const openAddInterface = () => {
    setEditingInterface(null);
    setInterfaceForm({
      name: "",
      type: "vlan",
      mtu: 1500,
      vlanId: "",
      parentInterface: "",
      user: "",
      service: "",
      disabled: "false",
    });
    setShowAddInterface(true);
  };

  const openEditInterface = (iface) => {
    setEditingInterface(iface);
    setInterfaceForm({
      name: iface.name,
      type: iface.type,
      mtu: iface.mtu || 1500,
      vlanId: iface["vlan-id"] || "",
      parentInterface: iface.interface || "",
      user: iface.user || "",
      service: iface.service || "",
      disabled: iface.disabled || "false",
    });
    setShowAddInterface(true);
  };

  const handleSaveInterface = async (e) => {
    e.preventDefault();
    try {
      if (editingInterface) {
        const id = editingInterface[".id"];
        await axios.put(
          `${API_URL}/devices/core/interfaces/${encodeURIComponent(id)}`,
          interfaceForm,
        );
        addToast("Interface berhasil diubah!", "success");
      } else {
        const payload = {
          name: interfaceForm.name,
          type: interfaceForm.type,
        };
        if (interfaceForm.type === "vlan" || interfaceForm.type === "bridge") {
          payload.mtu = interfaceForm.mtu;
        }
        if (interfaceForm.type === "vlan") {
          payload.vlanId = interfaceForm.vlanId;
          payload.parentInterface = interfaceForm.parentInterface;
        } else if (interfaceForm.type === "l2tp-in" || interfaceForm.type === "pppoe-in") {
          payload.user = interfaceForm.user;
          if (interfaceForm.type === "pppoe-in") {
            payload.service = interfaceForm.service;
          }
        }
        await axios.post(`${API_URL}/devices/core/interfaces`, payload);
        addToast("Interface berhasil ditambahkan ke MikroTik!", "success");
      }
      setShowAddInterface(false);
      fetchAll();
    } catch (err) {
      addToast("Gagal: " + (err.response?.data?.error || err.message), "error");
    }
  };

  const handleDeleteInterface = async (iface) => {
    try {
      const id = iface[".id"];
      await axios.delete(
        `${API_URL}/devices/core/interfaces/${encodeURIComponent(id)}?type=${iface.type}`,
      );
      addToast(`Interface "${iface.name}" berhasil dihapus!`, "success");
      setConfirmDelete(null);
      fetchAll(true);
    } catch (err) {
      addToast(
        "Gagal menghapus: " + (err.response?.data?.error || err.message),
        "error",
      );
      setConfirmDelete(null);
    }
  };

  const filteredInterfaces = interfaces.filter((i) => {
    const matchesSearch =
      !interfaceSearch ||
      (i.name &&
        i.name.toLowerCase().includes(interfaceSearch.toLowerCase())) ||
      (i.type &&
        i.type.toLowerCase().includes(interfaceSearch.toLowerCase())) ||
      (i["mac-address"] &&
        i["mac-address"].toLowerCase().includes(interfaceSearch.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterStatus !== "all") {
      if (filterStatus === "running" && i.running !== "true") return false;
      if (filterStatus === "down" && i.running === "true") return false;
    }

    if (filterType !== "all") {
      const typeStr = i.type ? i.type.toLowerCase() : "";
      const isL2tp = typeStr.includes("l2tp");
      const isPppoe = typeStr.includes("pppoe");

      if (filterType === "l2tp" && !isL2tp) return false;
      if (filterType === "pppoe" && !isPppoe) return false;
      if (filterType === "sistem" && (isL2tp || isPppoe)) return false;
    }

    return true;
  });

  const filteredSessions = pppoe.filter((p) => {
    const matchesSearch =
      !pppoeSearch ||
      (p.name && p.name.toLowerCase().includes(pppoeSearch.toLowerCase())) ||
      (p.address && p.address.includes(pppoeSearch));
    if (!matchesSearch) return false;

    const svc = p.service ? p.service.toLowerCase() : "";
    if (sessionFilterService === "pppoe" && !svc.includes("pppoe"))
      return false;
    if (sessionFilterService === "l2tp" && !svc.includes("l2tp")) return false;

    return true;
  });

  const filteredSecrets = pppoeSecrets.filter(
    (s) =>
      !secretSearch ||
      (s.name && s.name.toLowerCase().includes(secretSearch.toLowerCase())) ||
      (s.profile &&
        s.profile.toLowerCase().includes(secretSearch.toLowerCase())),
  );

  const paginatedInterfaces = useMemo(() => {
    if (itemsPerPage === "all") return filteredInterfaces;
    const start = (currentPage - 1) * itemsPerPage;
    return filteredInterfaces.slice(start, start + itemsPerPage);
  }, [filteredInterfaces, currentPage, itemsPerPage]);

  const totalInterfacePages = useMemo(() => {
    if (itemsPerPage === "all") return 1;
    return Math.ceil(filteredInterfaces.length / itemsPerPage) || 1;
  }, [filteredInterfaces.length, itemsPerPage]);

  const paginatedSessions = useMemo(() => {
    if (itemsPerPage === "all") return filteredSessions;
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSessions.slice(start, start + itemsPerPage);
  }, [filteredSessions, currentPage, itemsPerPage]);

  const totalSessionPages = useMemo(() => {
    if (itemsPerPage === "all") return 1;
    return Math.ceil(filteredSessions.length / itemsPerPage) || 1;
  }, [filteredSessions.length, itemsPerPage]);

  const paginatedSecrets = useMemo(() => {
    if (itemsPerPage === "all") return filteredSecrets;
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSecrets.slice(start, start + itemsPerPage);
  }, [filteredSecrets, currentPage, itemsPerPage]);

  const totalSecretPages = useMemo(() => {
    if (itemsPerPage === "all") return 1;
    return Math.ceil(filteredSecrets.length / itemsPerPage) || 1;
  }, [filteredSecrets.length, itemsPerPage]);

  const notConfigured =
    coreStatus &&
    !coreStatus.connected &&
    coreStatus.error?.includes("dikonfigurasi");
  const actionBtnClass =
    "cursor-pointer p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition";

  const dataPanelClass =
    "flex flex-col min-w-0 bg-slate-900 border border-slate-800 rounded-xl shadow-sm overflow-hidden";
  const dataScrollClass = "overflow-x-auto min-w-0";

  return (
    <div className="flex-1 flex flex-col gap-3.5 min-w-0 pb-6 relative">
      <Toast toasts={toasts} />

      {/* 1. TOP HEADER & SYNC ACTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <Server size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-slate-100">
                Core Gateway MikroTik
              </h1>
              {syncStatus?.syncedAt && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-md font-mono font-bold uppercase tracking-wider border ${
                    (tab === "interfaces"
                      ? syncStatus.interfaces
                      : tab === "pppoe"
                        ? syncStatus.pppoe
                        : syncStatus.secrets) === "cache"
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  }`}
                >
                  {(tab === "interfaces"
                    ? syncStatus.interfaces
                    : tab === "pppoe"
                      ? syncStatus.pppoe
                      : syncStatus.secrets) === "cache"
                    ? "Cached DB"
                    : "Live Router"}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[11px] text-slate-400">
                Pantau dan kelola resource MikroTik Pusat secara langsung — interface, sesi aktif, dan manajemen secret
              </p>
              {syncing && !loading && (
                <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-slate-800 text-slate-400 flex items-center gap-1 border border-slate-700">
                  <RefreshCw size={10} className="animate-spin text-blue-400" /> Sinkron...
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => fetchAll(true)}
            disabled={loading}
            className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition disabled:opacity-50 shadow-sm"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-white" : "text-white"} />
            <span>{loading ? "Sinkron..." : "Sync Sekarang"}</span>
          </button>
        </div>
      </div>

      {/* 2. CORE GATEWAY STATUS CARD */}
      <MikrotikStatCards
        coreStatus={coreStatus}
        notConfigured={notConfigured}
      />

      {/* 3. MODERN TAB NAVIGATION BAR */}
      <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl shadow-sm overflow-x-auto">
        <button
          id="tab-interfaces"
          onClick={() => {
            setTab("interfaces");
            setCurrentPage(1);
          }}
          className={`cursor-pointer flex-1 min-w-[140px] flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition ${
            tab === "interfaces"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
          }`}
        >
          <Activity size={14} className={tab === "interfaces" ? "text-white" : "text-slate-400"} />
          <span>Interfaces</span>
          <span
            className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-md ${
              tab === "interfaces" ? "bg-blue-700/60 text-white" : "bg-slate-800 text-slate-400 border border-slate-700"
            }`}
          >
            {interfaces.length}
          </span>
        </button>

        <button
          id="tab-pppoe"
          onClick={() => {
            setTab("pppoe");
            setCurrentPage(1);
          }}
          className={`cursor-pointer flex-1 min-w-[140px] flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition ${
            tab === "pppoe"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
          }`}
        >
          <Users size={14} className={tab === "pppoe" ? "text-white" : "text-slate-400"} />
          <span>Sesi Aktif</span>
          <span
            className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-md ${
              tab === "pppoe" ? "bg-blue-700/60 text-white" : "bg-slate-800 text-slate-400 border border-slate-700"
            }`}
          >
            {filteredSessions.length}
          </span>
        </button>

        <button
          id="tab-secrets"
          onClick={() => {
            setTab("secrets");
            setCurrentPage(1);
          }}
          className={`cursor-pointer flex-1 min-w-[140px] flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition ${
            tab === "secrets"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
          }`}
        >
          <Server size={14} className={tab === "secrets" ? "text-white" : "text-slate-400"} />
          <span>Pelanggan</span>
          <span
            className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-md ${
              tab === "secrets" ? "bg-blue-700/60 text-white" : "bg-slate-800 text-slate-400 border border-slate-700"
            }`}
          >
            {pppoeSecrets.length}
          </span>
        </button>
      </div>

      {loading && interfaces.length === 0 ? (
        <div className="flex-1 flex flex-col gap-2 p-4 min-h-[300px] bg-slate-900 border border-slate-800 rounded-xl">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="w-full h-10 bg-slate-800/40 rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center min-h-[240px] bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex flex-col items-center gap-3 text-center py-12 text-rose-400">
            <AlertTriangle size={32} className="text-rose-500/60" />
            <p className="text-slate-200 font-semibold text-sm">Terjadi Kesalahan</p>
            <p className="text-slate-400 text-xs">{error}</p>
          </div>
        </div>
      ) : tab === "interfaces" ? (
        <div className={dataPanelClass}>
          {/* Table Toolbar */}
          <div className="p-3 sm:p-4 border-b border-slate-800 flex items-center gap-2.5 flex-wrap">
            {/* Search Box */}
            <div className="relative flex-1 min-w-[200px]">
              <Search
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                type="text"
                placeholder="Cari nama, tipe, MAC interface..."
                value={interfaceSearch}
                onChange={(e) => {
                  setInterfaceSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 outline-none transition"
              />
              {interfaceSearch && (
                <button
                  onClick={() => setInterfaceSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Tipe */}
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-blue-500 cursor-pointer font-medium"
            >
              <option value="all">Semua Tipe</option>
              <option value="pppoe">OPD (PPPoE)</option>
              <option value="l2tp">Desa (L2TP)</option>
              <option value="sistem">Sistem (Ether/Bridge)</option>
            </select>

            {/* Filter Status */}
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-blue-500 cursor-pointer font-medium"
            >
              <option value="all">Semua Status</option>
              <option value="running">Running</option>
              <option value="down">Down</option>
            </select>

            {/* Per Page & Add Interface Button */}
            <div className="flex items-center gap-2 ml-auto flex-wrap flex-shrink-0">
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
                <option value="all">Semua ({filteredInterfaces.length})</option>
              </select>

              {canCreate && (
                <button
                  id="btn-tambah-interface"
                  onClick={openAddInterface}
                  className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                >
                  <Plus size={13} /> <span>Tambah</span>
                </button>
              )}
            </div>
          </div>

          <div className={dataScrollClass}>
            {/* Mobile card view */}
            <div className="md:hidden divide-y divide-slate-800">
              {filteredInterfaces.length === 0 ? (
                <p className="text-center py-12 text-slate-500 text-xs font-mono">
                  Tidak ada data interface yang cocok
                </p>
              ) : (
                paginatedInterfaces.map((iface, i) => (
                  <div
                    key={i}
                    className="p-4 flex flex-col gap-2 hover:bg-slate-800/30 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-100 text-xs truncate">
                          {iface.name}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {iface.type} · MTU {iface.mtu || "-"}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                          {iface["mac-address"] || "-"}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-md font-mono font-bold ${statusColor(iface.running, iface.disabled)}`}
                        >
                          {iface.disabled === "true"
                            ? "Disabled"
                            : iface.running === "true"
                              ? "Running"
                              : "Down"}
                        </span>
                      </div>
                    </div>
                    {(canUpdate || canDelete) && (
                      <div className="flex items-center justify-end gap-1 pt-2 border-t border-slate-800/60">
                        {canUpdate && (
                          <button
                            title="Edit"
                            onClick={() => openEditInterface(iface)}
                            className="p-1 text-slate-400 hover:text-slate-100 rounded hover:bg-slate-800 transition cursor-pointer"
                          >
                            <Edit2 size={13} />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            title="Hapus Interface"
                            onClick={() =>
                              setConfirmDelete({
                                type: "interface",
                                item: iface,
                              })
                            }
                            className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-rose-500/10 transition cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Desktop table view */}
            <div className="hidden md:block min-h-0">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60">
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                      Nama Interface
                    </th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono w-28">
                      Tipe
                    </th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono w-40">
                      MAC Address
                    </th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono w-20">
                      MTU
                    </th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono w-28">
                      Status
                    </th>
                    {(canUpdate || canDelete) && (
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono text-right w-24">
                        Aksi
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-xs">
                  {filteredInterfaces.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="text-center py-12 text-slate-500"
                      >
                        Tidak ada data interface
                      </td>
                    </tr>
                  ) : (
                    paginatedInterfaces.map((iface, i) => (
                      <tr
                        key={i}
                        className="border-b border-slate-700/20 hover:bg-slate-700/20 transition"
                      >
                        <td className="px-4 py-3 font-medium text-slate-200">
                          {iface.name}
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {iface.type}
                        </td>
                        <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                          {iface["mac-address"] || "-"}
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {iface.mtu || "-"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs px-2 py-1 rounded-full font-semibold ${statusColor(iface.running, iface.disabled)}`}
                          >
                            {iface.disabled === "true"
                              ? "Disabled"
                              : iface.running === "true"
                                ? "Running"
                                : "Down"}
                          </span>
                        </td>
                        {(canUpdate || canDelete) && (
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 justify-end">
                              {canUpdate && (
                                <button
                                  title="Edit Interface"
                                  onClick={() => openEditInterface(iface)}
                                  className={actionBtnClass}
                                >
                                  <Edit2 size={14} />
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  title="Hapus Interface"
                                  onClick={() =>
                                    setConfirmDelete({
                                      type: "interface",
                                      item: iface,
                                    })
                                  }
                                  className={`${actionBtnClass} hover:text-red-400 hover:bg-red-500/10`}
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {filteredInterfaces.length > 0 && (
            <div className="p-3 border-t border-slate-700/30 flex items-center justify-between flex-wrap gap-2 text-xs bg-slate-800/40">
              <span className="text-slate-400">
                {itemsPerPage === "all"
                  ? `Menampilkan ${filteredInterfaces.length} dari ${filteredInterfaces.length}`
                  : `Menampilkan ${Math.min((currentPage - 1) * itemsPerPage + 1, filteredInterfaces.length)}-${Math.min(currentPage * itemsPerPage, filteredInterfaces.length)} dari ${filteredInterfaces.length}`}
              </span>
              {itemsPerPage !== "all" && totalInterfacePages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-slate-300 border border-slate-700 transition cursor-pointer"
                  >
                    Prev
                  </button>
                  <span className="text-slate-400 font-medium px-2">
                    {currentPage} / {totalInterfacePages}
                  </span>
                  <button
                    onClick={() =>
                      setCurrentPage((p) =>
                        Math.min(totalInterfacePages, p + 1),
                      )
                    }
                    disabled={currentPage === totalInterfacePages}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-slate-300 border border-slate-700 transition cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : tab === "pppoe" ? (
        <div className={dataPanelClass}>
          {/* Table Toolbar */}
          <div className="p-3 sm:p-4 border-b border-slate-800 flex items-center gap-2.5 flex-wrap">
            {/* Search Box */}
            <div className="relative flex-1 min-w-[200px]">
              <Search
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                type="text"
                placeholder="Cari nama user atau IP remote..."
                value={pppoeSearch}
                onChange={(e) => {
                  setPppoeSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 outline-none transition"
              />
              {pppoeSearch && (
                <button
                  onClick={() => setPppoeSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Service */}
            <select
              value={sessionFilterService}
              onChange={(e) => {
                setSessionFilterService(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-blue-500 cursor-pointer font-medium"
            >
              <option value="all">Semua Service</option>
              <option value="pppoe">OPD (PPPoE)</option>
              <option value="l2tp">Desa (L2TP)</option>
            </select>

            {/* Per Page */}
            <div className="flex items-center gap-2 ml-auto flex-wrap flex-shrink-0">
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
                <option value="all">Semua ({filteredSessions.length})</option>
              </select>
            </div>
          </div>

          <div className={dataScrollClass}>
            {/* Mobile card view */}
            <div className="md:hidden divide-y divide-slate-800">
              {filteredSessions.length === 0 ? (
                <p className="text-center py-12 text-slate-500 text-xs font-mono">
                  Tidak ada sesi aktif yang cocok
                </p>
              ) : (
                paginatedSessions.map((p, i) => (
                  <div
                    key={i}
                    className="p-4 flex flex-col gap-2 hover:bg-slate-800/30 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-100 text-xs truncate">
                          {p.name || "-"}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                          {p.address || "-"} ·{" "}
                          <span
                            className={
                              p.service?.toLowerCase().includes("l2tp")
                                ? "text-amber-400 font-semibold"
                                : "text-blue-400 font-semibold"
                            }
                          >
                            {p.service?.toLowerCase().includes("l2tp")
                              ? "Desa (L2TP)"
                              : p.service?.toLowerCase().includes("pppoe")
                              ? "OPD (PPPoE)"
                              : p.service || "pppoe"}
                          </span>
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                          Uptime: {p.uptime || "-"} · Caller: {p["caller-id"] || "-"}
                        </p>
                      </div>
                      {canDelete && (
                        <button
                          onClick={() =>
                            setConfirmDelete({ type: "pppoe", item: p })
                          }
                          className="cursor-pointer flex items-center gap-1 px-2.5 py-1 rounded-md text-xs bg-rose-950/30 text-rose-400 hover:bg-rose-900/40 border border-rose-500/20 transition font-medium flex-shrink-0"
                        >
                          <WifiOff size={11} /> Putus
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop table view */}
            <div className="hidden md:block min-h-0">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60">
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                      Username
                    </th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono w-40">
                      IP Remote
                    </th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono w-28">
                      Service
                    </th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono w-32">
                      Uptime
                    </th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono w-44">
                      Caller ID
                    </th>
                    {canDelete && (
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono text-right w-24">
                        Aksi
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-xs">
                  {filteredSessions.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="text-center py-12 text-slate-500 font-mono text-xs"
                      >
                        Tidak ada sesi aktif terhubung
                      </td>
                    </tr>
                  ) : (
                    paginatedSessions.map((p, i) => (
                      <tr
                        key={i}
                        className="hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="px-4 py-3 font-semibold text-slate-200">
                          {p.name || "-"}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-blue-400">
                          {p.address || "-"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold ${
                              p.service?.toLowerCase().includes("l2tp")
                                ? "tag-desa"
                                : "tag-opd"
                            }`}
                          >
                            {p.service?.toLowerCase().includes("l2tp")
                              ? "Desa"
                              : p.service?.toLowerCase().includes("pppoe")
                              ? "OPD"
                              : p.service || "pppoe"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                          {p.uptime || "-"}
                        </td>
                        <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                          {p["caller-id"] || "-"}
                        </td>
                        {canDelete && (
                          <td className="px-4 py-3 text-right">
                            <button
                              title="Putuskan Sesi"
                              onClick={() =>
                                setConfirmDelete({ type: "pppoe", item: p })
                              }
                              className="cursor-pointer inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-rose-950/30 text-rose-400 hover:bg-rose-900/40 border border-rose-500/20 transition font-medium"
                            >
                              <WifiOff size={11} /> Putuskan
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {filteredSessions.length > 0 && (
            <div className="p-3 border-t border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs bg-slate-950/40">
              <span className="text-slate-400 font-mono">
                {itemsPerPage === "all"
                  ? `Menampilkan ${filteredSessions.length} dari ${filteredSessions.length} sesi`
                  : `Menampilkan ${Math.min((currentPage - 1) * itemsPerPage + 1, filteredSessions.length)}-${Math.min(currentPage * itemsPerPage, filteredSessions.length)} dari ${filteredSessions.length} sesi`}
              </span>
              {itemsPerPage !== "all" && totalSessionPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-slate-300 border border-slate-800 transition cursor-pointer text-xs font-medium"
                  >
                    Sebelumnya
                  </button>
                  <span className="text-slate-400 font-mono px-2">
                    {currentPage} / {totalSessionPages}
                  </span>
                  <button
                    onClick={() =>
                      setCurrentPage((p) =>
                        Math.min(totalSessionPages, p + 1),
                      )
                    }
                    disabled={currentPage === totalSessionPages}
                    className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-slate-300 border border-slate-800 transition cursor-pointer text-xs font-medium"
                  >
                    Selanjutnya
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className={dataPanelClass}>
          {/* Pelanggan Toolbar */}
          <div className="p-3 sm:p-4 border-b border-slate-800 flex items-center gap-2.5 flex-wrap">
            {/* Search Box */}
            <div className="relative flex-1 min-w-[200px]">
              <Search
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                type="text"
                placeholder="Cari nama pelanggan atau profile..."
                value={secretSearch}
                onChange={(e) => {
                  setSecretSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 outline-none transition"
              />
              {secretSearch && (
                <button
                  onClick={() => setSecretSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Per Page & Add Secret Button */}
            <div className="flex items-center gap-2 ml-auto flex-wrap flex-shrink-0">
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
                <option value="all">Semua ({filteredSecrets.length})</option>
              </select>

              {canCreate && (
                <button
                  id="btn-tambah-pelanggan"
                  onClick={openAddSecret}
                  className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                >
                  <Plus size={13} /> <span>Tambah</span>
                </button>
              )}
            </div>
          </div>

          <div className={dataScrollClass}>
            {/* Mobile card view */}
            <div className="md:hidden divide-y divide-slate-800">
              {filteredSecrets.length === 0 ? (
                <p className="text-center py-12 text-slate-500 text-xs font-mono">
                  Tidak ada pelanggan terdaftar yang cocok
                </p>
              ) : (
                paginatedSecrets.map((s, i) => {
                  const activeSess = pppoe.find((p) => p.name === s.name);
                  const isOnline = !!activeSess;
                  return (
                    <div
                      key={i}
                      className="p-4 flex flex-col gap-2 hover:bg-slate-800/30 transition"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-100 text-xs truncate">
                            {s.name || "-"}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {s.profile || "-"} · {s.service || "pppoe"}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                            Remote: {s["remote-address"] || "-"}
                          </p>
                        </div>
                        <div className="flex-shrink-0">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-md font-mono font-bold border ${
                              isOnline
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : "bg-slate-800 text-slate-400 border-slate-700"
                            }`}
                          >
                            {isOnline ? "● Online" : "○ Offline"}
                          </span>
                        </div>
                      </div>
                      {(canUpdate || canDelete) && (
                        <div className="flex items-center justify-end gap-1 pt-2 border-t border-slate-800/60">
                          {canUpdate && (
                            <button
                              onClick={() => openEditSecret(s)}
                              className="p-1 text-slate-400 hover:text-slate-100 rounded hover:bg-slate-800 transition cursor-pointer"
                            >
                              <Edit2 size={13} />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() =>
                                setConfirmDelete({ type: "secret", item: s })
                              }
                              className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-rose-500/10 transition cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop table view */}
            <div className="hidden md:block min-h-0">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60">
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                      Username
                    </th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono w-32">
                      Password
                    </th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono w-28">
                      Profile
                    </th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono w-24">
                      Service
                    </th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono w-36">
                      Local Addr
                    </th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono w-36">
                      Remote Addr
                    </th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono w-24">
                      Status
                    </th>
                    {(canUpdate || canDelete) && (
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono text-right w-24">
                        Aksi
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-xs">
                  {filteredSecrets.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="text-center py-12 text-slate-500 font-mono text-xs"
                      >
                        Tidak ada pelanggan PPPoE terdaftar
                      </td>
                    </tr>
                  ) : (
                    paginatedSecrets.map((s, i) => {
                      const activeSess = pppoe.find((p) => p.name === s.name);
                      const isOnline = !!activeSess;
                      return (
                        <tr
                          key={i}
                          className="hover:bg-slate-800/30 transition-colors"
                        >
                          <td className="px-4 py-3 font-semibold text-slate-200">
                            {s.name || "-"}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-400">
                            {canShowPassword ? (
                              <div className="flex items-center gap-1.5">
                                <span className="max-w-[140px] truncate">
                                  {showListPasswords[s.name]
                                    ? s.password
                                    : "••••••"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => toggleListPassword(s.name)}
                                  className="cursor-pointer text-slate-500 hover:text-slate-300"
                                >
                                  {showListPasswords[s.name] ? (
                                    <EyeOff size={13} />
                                  ) : (
                                    <Eye size={13} />
                                  )}
                                </button>
                              </div>
                            ) : (
                              "••••••"
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                            {s.profile || "-"}
                          </td>
                          <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                            {s.service || "-"}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-blue-400">
                            {isOnline
                              ? activeSess["local-address"] || s["local-address"] || "-"
                              : s["local-address"] || "-"}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-emerald-400">
                            {isOnline
                              ? activeSess.address || s["remote-address"] || "-"
                              : s["remote-address"] || "-"}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold border ${
                                s.disabled === "true"
                                  ? "bg-slate-800 text-slate-400 border-slate-700"
                                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              }`}
                            >
                              {s.disabled === "true" ? "Disabled" : "Enabled"}
                            </span>
                          </td>
                          {(canUpdate || canDelete) && (
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center gap-1 justify-end">
                                {canUpdate && (
                                  <button
                                    title="Edit Pelanggan"
                                    onClick={() => openEditSecret(s)}
                                    className={actionBtnClass}
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    title="Hapus Pelanggan"
                                    onClick={() =>
                                      setConfirmDelete({
                                        type: "secret",
                                        item: s,
                                      })
                                    }
                                    className={`${actionBtnClass} hover:text-rose-400 hover:bg-rose-500/10`}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {filteredSecrets.length > 0 && (
            <div className="p-3 border-t border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs bg-slate-950/40">
              <span className="text-slate-400 font-mono">
                {itemsPerPage === "all"
                  ? `Menampilkan ${filteredSecrets.length} dari ${filteredSecrets.length} pelanggan`
                  : `Menampilkan ${Math.min((currentPage - 1) * itemsPerPage + 1, filteredSecrets.length)}-${Math.min(currentPage * itemsPerPage, filteredSecrets.length)} dari ${filteredSecrets.length} pelanggan`}
              </span>
              {itemsPerPage !== "all" && totalSecretPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-slate-300 border border-slate-800 transition cursor-pointer text-xs font-medium"
                  >
                    Sebelumnya
                  </button>
                  <span className="text-slate-400 font-mono px-2">
                    {currentPage} / {totalSecretPages}
                  </span>
                  <button
                    onClick={() =>
                      setCurrentPage((p) =>
                        Math.min(totalSecretPages, p + 1),
                      )
                    }
                    disabled={currentPage === totalSecretPages}
                    className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-slate-300 border border-slate-800 transition cursor-pointer text-xs font-medium"
                  >
                    Selanjutnya
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===== Modal: Add/Edit Secret ===== */}
      <PPPoEUserModal
        showAddSecret={showAddSecret}
        setShowAddSecret={setShowAddSecret}
        editingSecret={editingSecret}
        secretForm={secretForm}
        setSecretForm={setSecretForm}
        showPassword={showPassword}
        setShowPassword={setShowPassword}
        availableProfilesList={availableProfilesList}
        isCustomProfile={isCustomProfile}
        setIsCustomProfile={setIsCustomProfile}
        handleSaveSecret={handleSaveSecret}
      />

      {/* ===== Modal: Add/Edit Interface ===== */}
      {showAddInterface && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[1001] p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md max-h-[min(90dvh,100%)] my-auto flex flex-col overflow-hidden shadow-2xl">
            <div className="flex-shrink-0 p-4 border-b border-slate-700/50 flex justify-between items-center">
              <h3 className="cursor-pointer font-bold text-slate-100 flex items-center gap-2">
                <Activity size={18} className="text-blue-400" />
                {editingInterface
                  ? `Edit Interface: ${editingInterface.name}`
                  : "Tambah Interface"}
              </h3>
              <button
                onClick={() => setShowAddInterface(false)}
                className="cursor-pointer text-slate-400 hover:text-white transition"
              >
                <X size={18} />
              </button>
            </div>
            <form
              onSubmit={handleSaveInterface}
              className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4"
            >
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400">
                  Nama Interface
                </label>
                <input
                  type="text"
                  required
                  value={interfaceForm.name}
                  onChange={(e) =>
                    setInterfaceForm({ ...interfaceForm, name: e.target.value })
                  }
                  placeholder="Contoh: vlan200 atau bridge-lan"
                  className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:border-blue-500 outline-none w-full"
                />
              </div>

              {!editingInterface && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400">
                    Tipe
                  </label>
                  <select
                    value={interfaceForm.type}
                    onChange={(e) => {
                      const newType = e.target.value;
                      let defaultMtu = 1500;
                      if (newType === "l2tp-in") defaultMtu = 1450;
                      if (newType === "pppoe-in") defaultMtu = 1492;
                      setInterfaceForm({
                        ...interfaceForm,
                        type: newType,
                        mtu: defaultMtu,
                      });
                    }}
                    className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:border-blue-500 outline-none w-full cursor-pointer"
                  >
                    <option value="vlan">VLAN</option>
                    <option value="bridge">Bridge</option>
                    <option value="l2tp-in">L2TP Server Binding</option>
                    <option value="pppoe-in">PPPoE Server Binding</option>
                  </select>
                </div>
              )}

              {(interfaceForm.type === "l2tp-in" || interfaceForm.type === "pppoe-in") && !editingInterface && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-400">
                      User (PPP Username)
                    </label>
                    <input
                      type="text"
                      required
                      value={interfaceForm.user}
                      onChange={(e) =>
                        setInterfaceForm({ ...interfaceForm, user: e.target.value })
                      }
                      placeholder="Contoh: baperinda_pakabid"
                      className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:border-blue-500 outline-none w-full"
                    />
                  </div>
                  {interfaceForm.type === "pppoe-in" && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-400">
                        Service (Opsional)
                      </label>
                      <input
                        type="text"
                        value={interfaceForm.service}
                        onChange={(e) =>
                          setInterfaceForm({ ...interfaceForm, service: e.target.value })
                        }
                        placeholder="Contoh: pppoe (opsional)"
                        className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:border-blue-500 outline-none w-full"
                      />
                    </div>
                  )}
                </>
              )}

              {interfaceForm.type === "vlan" && !editingInterface && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-400">
                      VLAN ID (1-4094)
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={4094}
                      value={interfaceForm.vlanId}
                      onChange={(e) =>
                        setInterfaceForm({
                          ...interfaceForm,
                          vlanId: parseInt(e.target.value) || "",
                        })
                      }
                      placeholder="Contoh: 100"
                      className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:border-blue-500 outline-none w-full"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-400">
                      Parent Interface (Interface Induk)
                    </label>
                    <select
                      value={interfaceForm.parentInterface}
                      onChange={(e) =>
                        setInterfaceForm({
                          ...interfaceForm,
                          parentInterface: e.target.value,
                        })
                      }
                      required
                      className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:border-blue-500 outline-none w-full"
                    >
                      <option value="">-- Pilih Interface --</option>
                      {interfaces
                        .filter(
                          (i) =>
                            i.type === "ether" ||
                            i.type === "bridge" ||
                            i.type === "wlan",
                        )
                        .map((i, idx) => (
                          <option key={idx} value={i.name}>
                            {i.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </>
              )}

              {(interfaceForm.type === "vlan" ||
                interfaceForm.type === "bridge" ||
                editingInterface) && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400">
                    MTU
                  </label>
                  <input
                    type="number"
                    required
                    value={interfaceForm.mtu}
                    onChange={(e) =>
                      setInterfaceForm({
                        ...interfaceForm,
                        mtu: parseInt(e.target.value) || 1500,
                      })
                    }
                    className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:border-blue-500 outline-none w-full"
                  />
                </div>
              )}

              {editingInterface && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400">
                    Status
                  </label>
                  <select
                    value={interfaceForm.disabled}
                    onChange={(e) =>
                      setInterfaceForm({
                        ...interfaceForm,
                        disabled: e.target.value,
                      })
                    }
                    className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:border-blue-500 outline-none w-full"
                  >
                    <option value="false">Enabled (Aktif)</option>
                    <option value="true">Disabled (Non-aktif)</option>
                  </select>
                </div>
              )}

              <div className="flex gap-3 justify-end mt-2">
                <button
                  type="button"
                  onClick={() => setShowAddInterface(false)}
                  className="cursor-pointer bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2 rounded-lg text-xs font-semibold transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2"
                >
                  <Check size={15} />{" "}
                  {editingInterface ? "Simpan Perubahan" : "Tambah Interface"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== Confirm Delete Dialog ===== */}
      <ConfirmDialog
        show={!!confirmDelete}
        title={
          confirmDelete?.type === "pppoe"
            ? `Putuskan Sesi "${confirmDelete?.item?.name}"?`
            : confirmDelete?.type === "secret"
              ? `Hapus Pelanggan "${confirmDelete?.item?.name}"?`
              : `Hapus Interface "${confirmDelete?.item?.name}"?`
        }
        message={
          confirmDelete?.type === "pppoe"
            ? `Sesi aktif "${confirmDelete?.item?.name}" (${confirmDelete?.item?.address || "-"}) akan segera diputus dari MikroTik. Pelanggan harus melakukan koneksi ulang.`
            : confirmDelete?.type === "secret"
              ? "Pelanggan ini akan dihapus permanen dari MikroTik dan database. Tindakan ini tidak dapat dibatalkan."
              : "Interface ini akan dihapus permanen dari MikroTik. Tindakan ini tidak dapat dibatalkan."
        }
        onConfirm={() => {
          if (confirmDelete?.type === "pppoe")
            handleDisconnectPPPoE(confirmDelete.item);
          else if (confirmDelete?.type === "secret")
            handleDeleteSecret(confirmDelete.item);
          else if (confirmDelete?.type === "interface")
            handleDeleteInterface(confirmDelete.item);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}