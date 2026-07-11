"use client";
import { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
import {
  hasAccess,
  getStoredUser,
  getRoleLabel,
  isEditorRole,
} from "@/lib/roles";

const statusColor = (running, disabled) => {
  if (disabled === "true") return "bg-slate-600 text-slate-300";
  if (running === "true") return "bg-emerald-500/20 text-emerald-400";
  return "bg-red-500/20 text-red-400";
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

      setCoreStatus(statusRes.data);
      const ifaces = ifaceRes.data || [];
      const pppoeData = pppoeRes.data || [];
      const secretsData = secretsRes.data || [];
      setInterfaces(ifaces);
      setPppoe(pppoeData);
      setPppoeSecrets(secretsData);
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

  const openAddSecret = () => {
    setEditingSecret(null);
    setSecretForm({
      name: "",
      password: "",
      profile: "default",
      service: "pppoe",
    });
    setShowPassword(false);
    setShowAddSecret(true);
  };

  const openEditSecret = (s) => {
    setEditingSecret(s);
    setSecretForm({
      name: s.name,
      password: s.password || "",
      profile: s.profile || "default",
      service: s.service || "pppoe",
    });
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
          mtu: interfaceForm.mtu,
        };
        if (interfaceForm.type === "vlan") {
          payload.vlanId = interfaceForm.vlanId;
          payload.parentInterface = interfaceForm.parentInterface;
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

  const notConfigured =
    coreStatus &&
    !coreStatus.connected &&
    coreStatus.error?.includes("dikonfigurasi");
  const actionBtnClass =
    "cursor-pointer p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition";

  const dataPanelClass =
    "flex-1 min-h-0 flex flex-col bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden";
  const dataScrollClass = "flex-1 min-h-0 overflow-y-auto overscroll-contain";

  return (
    <div className="h-full min-h-0 flex flex-col gap-4 overflow-hidden relative">
      <Toast toasts={toasts} />

      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold flex items-center text-slate-100 gap-3">
              <Server size={24} className="text-emerald-400" /> Mikrotik RO
            </h1>
            {syncStatus?.syncedAt && (
              <span
                className={`text-[10px] px-2 py-1 rounded-lg font-bold uppercase tracking-wider ${
                  (tab === "interfaces"
                    ? syncStatus.interfaces
                    : tab === "pppoe"
                      ? syncStatus.pppoe
                      : syncStatus.secrets) === "cache"
                    ? "text-amber-400"
                    : "text-emerald-400"
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
          <div className="flex items-center gap-3 mt-0.5">
            <p className="text-xs text-slate-400">
              Pantau dan kelola resource MikroTik Pusat secara langsung
            </p>

            {syncing && !loading && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-400 flex items-center gap-1">
                <RefreshCw size={10} className="animate-spin" /> Memperbarui...
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => fetchAll(true)}
            disabled={loading}
            className="cursor-pointer flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition shadow-lg 'bg-blue-600 hover:bg-blue-700 border border-blue-500 text-white shadow-blue-500/20 cursor-pointer"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />{" "}
            Sync Sekarang
          </button>
        </div>
      </div>

      {/* Core Status Card */}
      {coreStatus && (
        <div
          className={`flex-shrink-0 rounded-xl border p-5 flex items-center gap-5 ${coreStatus.connected ? "bg-emerald-500/5 border-emerald-500/20" : "bg-red-500/5 border-red-500/20"}`}
        >
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${coreStatus.connected ? "bg-emerald-500/20" : "bg-red-500/20"}`}
          >
            {coreStatus.connected ? (
              <Wifi size={22} className="text-emerald-400" />
            ) : (
              <WifiOff size={22} className="text-red-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <span className="font-bold text-slate-100">
                {coreStatus.device_name || "MikroTik Pusat"}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-semibold ${coreStatus.connected ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}
              >
                {coreStatus.connected ? "Connected" : "Disconnected"}
              </span>
            </div>
            {coreStatus.connected ? (
              <div className="flex gap-6 mt-1.5 text-xs text-slate-400 flex-wrap">
                <span>
                  IP:{" "}
                  <span className="text-slate-200">
                    {coreStatus.ip_address}
                  </span>
                </span>
                <span>
                  Uptime:{" "}
                  <span className="text-slate-200">{coreStatus.uptime}</span>
                </span>
                <span>
                  CPU: <span className="text-slate-200">{coreStatus.cpu}%</span>
                </span>
                <span>
                  Board:{" "}
                  <span className="text-slate-200">{coreStatus.board}</span>
                </span>
                <span>
                  RouterOS:{" "}
                  <span className="text-slate-200">{coreStatus.version}</span>
                </span>
              </div>
            ) : (
              <p className="text-xs text-slate-400 mt-1">{coreStatus.error}</p>
            )}
          </div>
          {notConfigured && (
            <a
              href="/settings"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-semibold transition flex-shrink-0"
            >
              <Settings size={15} /> Konfigurasi
            </a>
          )}
        </div>
      )}

      {/* Tab Switcher */}
      <div className="flex-shrink-0 flex flex-wrap gap-1.5 w-full">
        <button
          id="tab-interfaces"
          onClick={() => setTab("interfaces")}
          className={`cursor-pointer flex-1 min-w-[140px] flex items-center justify-center gap-1.5 px-2 py-1 rounded-xl text-xs font-semibold transition border ${tab === "interfaces" ? "bg-blue-600 text-white border-blue-500 shadow-md" : "bg-slate-800/60 text-slate-400 border-slate-700/50 hover:text-white hover:bg-slate-700/60"}`}
        >
          <Activity size={16} />
          <span>Interfaces</span>
          <span
            className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${tab === "interfaces" ? "bg-blue-500/40 text-blue-100" : "bg-slate-700 text-slate-400"}`}
          >
            {interfaces.length}
          </span>
        </button>
        <button
          id="tab-pppoe"
          onClick={() => setTab("pppoe")}
          className={`cursor-pointer flex-1 min-w-[140px] flex items-center justify-center gap-1.5 px-2 py-1 rounded-xl text-xs font-semibold transition border ${tab === "pppoe" ? "bg-blue-600 text-white border-blue-500 shadow-md" : "bg-slate-800/60 text-slate-400 border-slate-700/50 hover:text-white hover:bg-slate-700/60"}`}
        >
          <Users size={16} />
          <span>Sesi Aktif</span>
          <span
            className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${tab === "pppoe" ? "bg-blue-500/40 text-blue-100" : "bg-slate-700 text-slate-400"}`}
          >
            {filteredSessions.length}
          </span>
        </button>
        <button
          id="tab-secrets"
          onClick={() => setTab("secrets")}
          className={`cursor-pointer flex-1 min-w-[140px] flex items-center justify-center gap-1.5 px-2 py-1 rounded-xl text-xs font-semibold transition border ${tab === "secrets" ? "bg-blue-600 text-white border-blue-500 shadow-md" : "bg-slate-800/60 text-slate-400 border-slate-700/50 hover:text-white hover:bg-slate-700/60"}`}
        >
          <Users size={16} />
          <span>Pelanggan</span>
          <span
            className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${tab === "secrets" ? "bg-blue-500/40 text-blue-100" : "bg-slate-700 text-slate-400"}`}
          >
            {pppoeSecrets.length}
          </span>
        </button>
      </div>

      {loading && interfaces.length === 0 ? (
        <div className="flex-1 flex flex-col gap-2 p-3 min-h-[300px]">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="w-full h-12 bg-slate-700/30 rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center min-h-[200px]">
          <div className="flex flex-col items-center gap-3 text-center">
            <AlertTriangle size={36} className="text-red-400" />
            <p className="text-slate-200 font-semibold">Terjadi kesalahan</p>
            <p className="text-slate-400 text-xs">{error}</p>
          </div>
        </div>
      ) : tab === "interfaces" ? (
        <div className={dataPanelClass}>
          <div className="p-4 border-b border-slate-700/30 flex items-center gap-3 flex-shrink-0 flex-wrap">
            <h2 className="font-semibold text-slate-200 text-xs flex-shrink-0">
              Interface
            </h2>
            <input
              type="text"
              placeholder="Cari nama, tipe, MAC..."
              value={interfaceSearch}
              onChange={(e) => setInterfaceSearch(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:border-blue-500 outline-none flex-1 min-w-[140px]"
            />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-300 outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">Semua Tipe</option>
              <option value="pppoe">PPPoE</option>
              <option value="l2tp">L2TP</option>
              <option value="sistem">Sistem</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-300 outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">Semua Status</option>
              <option value="running">Running</option>
              <option value="down">Down</option>
            </select>
            <div className="flex items-center gap-3 ml-auto flex-shrink-0">
              <span className="text-xs text-slate-500">
                {filteredInterfaces.length} / {interfaces.length}
              </span>
              {canCreate && (
                <button
                  id="btn-tambah-interface"
                  onClick={openAddInterface}
                  className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Plus size={14} /> Tambah
                </button>
              )}
            </div>
          </div>
          <div className={dataScrollClass}>
            {/* Mobile card view */}
            <div className="md:hidden divide-y divide-slate-700/30">
              {filteredInterfaces.length === 0 ? (
                <p className="text-center py-12 text-slate-500 text-sm">
                  Tidak ada data interface
                </p>
              ) : (
                filteredInterfaces.map((iface, i) => (
                  <div
                    key={i}
                    className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-slate-700/20 active:bg-slate-700/40 transition"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-100 text-sm truncate">
                        {iface.name}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {iface.type} · MTU {iface.mtu || "-"}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 font-mono">
                        {iface["mac-address"] || "-"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className={`text-xs px-3 py-1.5 rounded-full font-bold ${statusColor(iface.running, iface.disabled)}`}
                      >
                        {iface.disabled === "true"
                          ? "Disabled"
                          : iface.running === "true"
                            ? "Running"
                            : "Down"}
                      </span>
                      {canUpdate && (
                        <button
                          title="Edit"
                          onClick={() => openEditInterface(iface)}
                          className="cursor-pointer p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-600 transition"
                        >
                          <Edit2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            {/* Desktop table view */}
            <div className="hidden md:block min-h-0">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-slate-700/30 bg-slate-800/95 backdrop-blur">
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Nama
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Tipe
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      MAC Address
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      MTU
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Status
                    </th>
                    {(canUpdate || canDelete) && (
                      <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Aksi
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
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
                    filteredInterfaces.map((iface, i) => (
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
                              {canDelete && (iface.type === "vlan" ||
                                iface.type === "bridge") && (
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
        </div>
      ) : tab === "pppoe" ? (
        <div className={dataPanelClass}>
          <div className="p-4 border-b border-slate-700/30 flex items-center gap-3 flex-shrink-0 flex-wrap">
            <h2 className="font-semibold text-slate-200 text-xs flex-shrink-0">
              Sesi Aktif
            </h2>
            <input
              type="text"
              placeholder="Cari nama user atau IP..."
              value={pppoeSearch}
              onChange={(e) => setPppoeSearch(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:border-blue-500 outline-none flex-1 min-w-[140px]"
            />
            <select
              value={sessionFilterService}
              onChange={(e) => setSessionFilterService(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-300 outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">Semua Service</option>
              <option value="pppoe">PPPoE</option>
              <option value="l2tp">L2TP</option>
            </select>
            <span className="text-xs text-slate-500 ml-auto flex-shrink-0">
              {filteredSessions.length} sesi aktif
            </span>
          </div>
          <div className={dataScrollClass}>
            {/* Mobile card view */}
            <div className="md:hidden divide-y divide-slate-700/30">
              {filteredSessions.length === 0 ? (
                <p className="text-center py-12 text-slate-500 text-sm">
                  Tidak ada sesi aktif
                </p>
              ) : (
                filteredSessions.map((p, i) => (
                  <div
                    key={i}
                    className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-slate-700/20 active:bg-slate-700/40 transition"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-100 text-sm truncate">
                        {p.name || "-"}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {p.address || "-"} ·{" "}
                        <span
                          className={
                            p.service?.toLowerCase().includes("l2tp")
                              ? "text-orange-400"
                              : "text-blue-400"
                          }
                        >
                          {p.service || "pppoe"}
                        </span>
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Uptime: {p.uptime || "-"}
                      </p>
                    </div>
                    {canDelete && (
                      <button
                        onClick={() =>
                          setConfirmDelete({ type: "pppoe", item: p })
                        }
                        className="cursor-pointer flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition font-semibold flex-shrink-0"
                      >
                        <WifiOff size={15} /> Putus
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
            {/* Desktop table view */}
            <div className="hidden md:block min-h-0">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-slate-700/30 bg-slate-800/95 backdrop-blur">
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Username
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      IP (Remote)
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Service
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Uptime
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Caller ID
                    </th>
                    {canDelete && (
                      <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Aksi
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="text-center py-12 text-slate-500"
                      >
                        Tidak ada sesi aktif
                      </td>
                    </tr>
                  ) : (
                    filteredSessions.map((p, i) => (
                      <tr
                        key={i}
                        className="border-b border-slate-700/20 hover:bg-slate-700/20 transition"
                      >
                        <td className="px-4 py-3 font-medium text-slate-200">
                          {p.name || "-"}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-300">
                          {p.address || "-"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs px-2 py-0.5 rounded font-mono ${p.service?.toLowerCase().includes("l2tp") ? "bg-orange-500/20 text-orange-400" : "bg-blue-500/20 text-blue-400"}`}
                          >
                            {p.service || "pppoe"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {p.uptime || "-"}
                        </td>
                        <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                          {p["caller-id"] || "-"}
                        </td>
                        {canDelete && (
                          <td className="px-4 py-3">
                            <div className="flex justify-end">
                              <button
                                title="Putuskan Sesi"
                                onClick={() =>
                                  setConfirmDelete({ type: "pppoe", item: p })
                                }
                                className="cursor-pointer flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition font-semibold"
                              >
                                <WifiOff size={12} /> Putuskan
                              </button>
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
        </div>
      ) : (
        <div className={dataPanelClass}>
          <div className="p-4 border-b border-slate-700/30 flex items-center gap-3 flex-shrink-0 flex-wrap">
            <h2 className="font-semibold text-slate-200 text-xs flex-shrink-0">
              Secrets
            </h2>
            <input
              type="text"
              placeholder="Cari nama atau profile..."
              value={secretSearch}
              onChange={(e) => setSecretSearch(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:border-blue-500 outline-none flex-1 min-w-[140px]"
            />
            {canCreate && (
              <button
                id="btn-tambah-pelanggan"
                onClick={openAddSecret}
                className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ml-auto flex-shrink-0"
              >
                <Plus size={14} /> Tambah
              </button>
            )}
          </div>
          <div className={dataScrollClass}>
            {/* Mobile card view */}
            <div className="md:hidden divide-y divide-slate-700/30">
              {filteredSecrets.length === 0 ? (
                <p className="text-center py-12 text-slate-500 text-sm">
                  Tidak ada pelanggan terdaftar
                </p>
              ) : (
                filteredSecrets.map((s, i) => {
                  const activeSess = pppoe.find((p) => p.name === s.name);
                  const isOnline = !!activeSess;
                  return (
                    <div
                      key={i}
                      className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-slate-700/20 active:bg-slate-700/40 transition"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-bold text-slate-100 text-sm truncate">
                            {s.name || "-"}
                          </p>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${isOnline ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-700 text-slate-400"}`}
                          >
                            {isOnline ? "● Online" : "○ Offline"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          {s.profile || "-"} · {s.service || "pppoe"}
                        </p>
                      </div>
                      {(canUpdate || canDelete) && (
                        <div className="flex gap-2 flex-shrink-0">
                          {canUpdate && (
                            <button
                              onClick={() => openEditSecret(s)}
                              className="cursor-pointer p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-600 transition"
                            >
                              <Edit2 size={18} />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() =>
                                setConfirmDelete({ type: "secret", item: s })
                              }
                              className="cursor-pointer p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition"
                            >
                              <Trash2 size={18} />
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
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-slate-700/30 bg-slate-800/95 backdrop-blur">
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Username
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Password
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Profile
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Service
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Local Addr
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Remote Addr
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Status
                    </th>
                    {(canUpdate || canDelete) && (
                      <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Aksi
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredSecrets.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="text-center py-12 text-slate-500"
                      >
                        Tidak ada pelanggan PPPoE terdaftar
                      </td>
                    </tr>
                  ) : (
                    filteredSecrets.map((s, i) => {
                      const activeSess = pppoe.find((p) => p.name === s.name);
                      const isOnline = !!activeSess;
                      return (
                        <tr
                          key={i}
                          className="border-b border-slate-700/20 hover:bg-slate-700/20 transition"
                        >
                          <td className="px-4 py-3 font-medium text-slate-200">
                            {s.name || "-"}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-400">
                            {canShowPassword ? (
                              <div className="flex items-center gap-2">
                                <span className="max-w-[200px] break-all">
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
                                    <EyeOff size={14} />
                                  ) : (
                                    <Eye size={14} />
                                  )}
                                </button>
                              </div>
                            ) : (
                              "••••••"
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-400">
                            {s.profile || "-"}
                          </td>
                          <td className="px-4 py-3 text-slate-400">
                            {s.service || "-"}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">
                            <span
                              className={
                                isOnline ? "text-blue-400" : "text-slate-400"
                              }
                            >
                              {isOnline
                                ? activeSess["local-address"] ||
                                  s["local-address"] ||
                                  "-"
                                : s["local-address"] || "-"}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">
                            <span
                              className={
                                isOnline ? "text-emerald-400" : "text-slate-400"
                              }
                            >
                              {isOnline
                                ? activeSess.address ||
                                  s["remote-address"] ||
                                  "-"
                                : s["remote-address"] || "-"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${s.disabled === "true" ? "bg-red-500/20 text-red-400" : "bg-emerald-500/20 text-emerald-400"}`}
                            >
                              {s.disabled === "true" ? "Disabled" : "Enabled"}
                            </span>
                          </td>
                          {(canUpdate || canDelete) && (
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1 justify-end">
                                {canUpdate && (
                                  <button
                                    title="Edit Pelanggan"
                                    onClick={() => openEditSecret(s)}
                                    className={actionBtnClass}
                                  >
                                    <Edit2 size={14} />
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
                                    className={`${actionBtnClass} hover:text-red-400 hover:bg-red-500/10`}
                                  >
                                    <Trash2 size={14} />
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
        </div>
      )}

      {/* ===== Modal: Add/Edit Secret ===== */}
      {showAddSecret && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[1001] p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md max-h-[min(90dvh,100%)] my-auto flex flex-col overflow-hidden shadow-2xl">
            <div className="flex-shrink-0 p-4 border-b border-slate-700/50 flex justify-between items-center">
              <h3 className="cursor-pointer font-bold text-slate-100 flex items-center gap-2">
                <UserPlus size={18} className="text-blue-400" />
                {editingSecret
                  ? `Edit Pelanggan: ${editingSecret.name}`
                  : "Tambah PPPoE Pelanggan"}
              </h3>
              <button
                onClick={() => setShowAddSecret(false)}
                className="cursor-pointer text-slate-400 hover:text-white transition"
              >
                <X size={18} />
              </button>
            </div>
            <form
              onSubmit={handleSaveSecret}
              className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4"
            >
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400">
                  Username PPPoE
                </label>
                <input
                  type="text"
                  required
                  value={secretForm.name}
                  onChange={(e) =>
                    setSecretForm({ ...secretForm, name: e.target.value })
                  }
                  placeholder="Contoh: pelanggan_budi"
                  className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:border-blue-500 outline-none w-full"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required={!editingSecret}
                    value={secretForm.password}
                    onChange={(e) =>
                      setSecretForm({ ...secretForm, password: e.target.value })
                    }
                    placeholder={
                      editingSecret
                        ? "Kosongkan jika tidak diubah"
                        : "Masukkan password pelanggan"
                    }
                    className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 pr-10 text-xs text-slate-100 focus:border-blue-500 outline-none w-full"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400">
                  Profile
                </label>
                <input
                  type="text"
                  required
                  value={secretForm.profile}
                  onChange={(e) =>
                    setSecretForm({ ...secretForm, profile: e.target.value })
                  }
                  placeholder="Contoh: default atau 10Mbps"
                  className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:border-blue-500 outline-none w-full"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400">
                  Service
                </label>
                <select
                  value={secretForm.service}
                  onChange={(e) =>
                    setSecretForm({ ...secretForm, service: e.target.value })
                  }
                  className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:border-blue-500 outline-none w-full"
                >
                  <option value="pppoe">pppoe</option>
                  <option value="any">any</option>
                </select>
              </div>
              <div className="flex gap-3 justify-end mt-2">
                <button
                  type="button"
                  onClick={() => setShowAddSecret(false)}
                  className="cursor-pointer bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2 rounded-lg text-xs font-semibold transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2"
                >
                  <Check size={15} />{" "}
                  {editingSecret ? "Simpan Perubahan" : "Tambah Pelanggan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                    onChange={(e) =>
                      setInterfaceForm({
                        ...interfaceForm,
                        type: e.target.value,
                      })
                    }
                    className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:border-blue-500 outline-none w-full"
                  >
                    <option value="vlan">VLAN</option>
                    <option value="bridge">Bridge</option>
                  </select>
                </div>
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
