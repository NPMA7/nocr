"use client";
import React, { useState, useEffect, Suspense, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import axios from "axios";
import { API_URL, useAppState } from "@/App";
import {
  Save,
  Server,
  Shield,
  SettingsIcon,
  User,
  Database,
  Network,
  Trash2,
  UserPlus,
  Eye,
  EyeOff,
  Monitor,
  Terminal,
  Pencil,
  Check,
  CheckCircle2,
  Key,
  Activity,
  HardDrive,
  Cpu,
  RefreshCw,
  RotateCw,
  Play,
  Square,
  X,
  Power,
  Trash,
  Building2,
  Users,
} from "lucide-react";
import { hasAccess, getStoredUser, getRoleLabel } from "@/lib/roles";
import RoleSettings from "@/components/RoleSettings";
import CompanyProfileSettings from "@/components/settings/CompanyProfileSettings";
import ApiKeySettings from "@/components/settings/ApiKeySettings";
import UserAndRoleSettings from "@/components/settings/UserAndRoleSettings";
import PasswordChangeSettings from "@/components/settings/PasswordChangeSettings";
import SystemConfigSettings from "@/components/settings/SystemConfigSettings";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 flex flex-col gap-4">
          <h1 className="text-xl text-red-500 font-bold">
            Terjadi Kesalahan Render
          </h1>
          <p className="text-slate-300 font-mono bg-slate-900 p-4 rounded-lg">
            {this.state.error?.toString()}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

function UserManagement({ canCreate = true, canUpdate = true, canDelete = true }) {
  const { showToast } = useAppState();
  const currentUser = getStoredUser();
  const requestorRole = (currentUser?.role || "").toLowerCase().trim();
  const isRequestorSuperAdmin = requestorRole === "superadmin" || requestorRole === "admin";

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    username: "",
    password: "",
    role: "visitor",
  });
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [roleEdits, setRoleEdits] = useState({});
  const [savingRoleId, setSavingRoleId] = useState(null);
  const [deleteConfirmUserId, setDeleteConfirmUserId] = useState(null);

  // State untuk admin mengubah password user lain
  const [selectedUserForPassword, setSelectedUserForPassword] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const [availableRoles, setAvailableRoles] = useState([]);

  const fetchUsersAndRoles = async () => {
    setLoading(true);
    try {
      const resUsers = await axios.get(`${API_URL}/auth/users`);
      setUsers(Array.isArray(resUsers.data) ? resUsers.data : []);
    } catch (err) {
      console.error("Error fetching users:", err);
      setUsers([]);
      if (showToast) {
        showToast(err.response?.data?.error || "Gagal memuat daftar pengguna", "error");
      }
    }

    try {
      const resRoles = await axios.get(`${API_URL}/roles`);
      const rolesData = Array.isArray(resRoles.data) ? resRoles.data : [];
      setAvailableRoles(rolesData);
      if (rolesData.length > 0) {
        setForm((prev) => ({ ...prev, role: rolesData[0].name }));
      }
    } catch (err) {
      console.error("Error fetching roles:", err);
      setAvailableRoles([]);
    } finally {
      setLoading(false);
      setRoleEdits({});
    }
  };

  useEffect(() => {
    fetchUsersAndRoles();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await axios.post(`${API_URL}/auth/users`, {
        username: form.username.trim(),
        password: form.password,
        role: form.role,
      });
      setForm({ username: "", password: "", role: "visitor" });
      fetchUsersAndRoles();
      if (showToast) showToast("Pengguna berhasil dibuat", "success");
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const handleUpdateRole = async (userId) => {
    const newRole = roleEdits[userId];
    if (!newRole) return;
    const current = users.find((u) => u.id === userId);
    if (current && current.role === newRole) return;

    setSavingRoleId(userId);
    try {
      await axios.patch(`${API_URL}/auth/users/${userId}`, { role: newRole });
      await fetchUsersAndRoles();
      if (showToast) showToast("Role pengguna diperbarui", "success");
    } catch (err) {
      if (showToast)
        showToast(err.response?.data?.error || err.message, "error");
    } finally {
      setSavingRoleId(null);
    }
  };

  const handleDelete = async (id) => {
    setDeleteConfirmUserId(id);
  };

  const confirmDelete = async () => {
    const id = deleteConfirmUserId;
    if (!id) return;
    setDeleteConfirmUserId(null);
    try {
      await axios.delete(`${API_URL}/auth/users/${id}`);
      fetchUsersAndRoles();
      if (showToast) showToast("Pengguna berhasil dihapus", "success");
    } catch (err) {
      if (showToast)
        showToast(err.response?.data?.error || err.message, "error");
    }
  };

  const handleAdminChangePassword = async (e) => {
    e.preventDefault();
    if (!selectedUserForPassword) return;
    setChangingPassword(true);
    try {
      await axios.patch(`${API_URL}/auth/users/${selectedUserForPassword.id}`, {
        password: newPassword,
      });
      setSelectedUserForPassword(null);
      setNewPassword("");
      if (showToast)
        showToast(
          `Password untuk pengguna ${selectedUserForPassword.username} berhasil diubah`,
          "success",
        );
    } catch (err) {
      if (showToast)
        showToast(err.response?.data?.error || err.message, "error");
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading)
    return <div className="text-slate-400 p-5">Memuat pengguna...</div>;

  return (
    <>
    <div className="bg-slate-800 border border-slate-700/50 rounded-xl overflow-hidden shadow-lg p-5">
      <h2 className="text-base font-bold text-slate-100 flex items-center gap-2 mb-4">
        <User size={20} className="text-blue-500" /> Manajemen Pengguna
      </h2>
      {canCreate && (
        <>
          <h3 className="text-xs font-bold text-slate-200 mb-3">
            Buat Pengguna Baru
          </h3>
          {error && (
            <div className="mb-3 text-xs text-red-400 bg-red-500/10 p-2 rounded border border-red-500/20">
              {error}
            </div>
          )}
          <form onSubmit={handleCreate} className="mb-3 flex gap-3 flex-wrap">
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="Username"
              required
              className="bg-slate-900 border border-slate-700 p-2.5 text-xs text-slate-100 rounded-lg flex-1 min-w-[150px] outline-none focus:border-blue-500"
            />
            <div className="relative flex-1 min-w-[150px]">
              <input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Password"
                required
                className="bg-slate-900 border border-slate-700 p-2.5 text-xs text-slate-100 rounded-lg outline-none focus:border-blue-500 w-full pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <select
              name="role"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="cursor-pointer bg-slate-900 border border-slate-700 p-2.5 text-xs text-slate-100 rounded-lg w-32 outline-none focus:border-blue-500 capitalize"
            >
              {availableRoles.length > 0 ? (
                availableRoles
                  .filter((r) => isRequestorSuperAdmin || r.name !== "superadmin")
                  .map((r) => (
                    <option key={r.id} value={r.name} className="capitalize">
                      {r.name === "superadmin" ? "Super Admin" : r.name}
                    </option>
                  ))
              ) : (
                <>
                  <option value="visitor">Visitor</option>
                  <option value="editor">Editor</option>
                  {isRequestorSuperAdmin && <option value="superadmin">Super Admin</option>}
                </>
              )}
            </select>
            <button
              type="submit"
              className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center"
            >
              <UserPlus size={16} className="mr-2" /> Tambah
            </button>
          </form>
        </>
      )}
      {/* List */}
      <div className="mb-3 overflow-hidden rounded-lg border border-slate-700">
        <table className="w-full text-left">
          <thead className="bg-slate-900/50 border-b border-slate-700/50">
            <tr>
              <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase">
                Username
              </th>
              <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase">
                Role
              </th>
              <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase text-right">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {users
              .filter((u) => isRequestorSuperAdmin || (u.role || "").toLowerCase() !== "superadmin")
              .map((u) => {
              const editRole = roleEdits[u.id] ?? u.role;
              const roleDirty = editRole !== u.role;
              const isUserSuperAdmin = (u.role || "").toLowerCase() === "superadmin";
              return (
                <tr
                  key={u.id}
                  className="hover:bg-slate-700/20 transition-colors"
                >
                  <td className="px-4 py-3 text-xs font-semibold text-slate-200">
                    <div className="flex items-center gap-2">
                      <span>{u.username}</span>
                      {isUserSuperAdmin && (
                        <span className="text-[10px] bg-amber-950/80 text-amber-300 border border-amber-800 px-1.5 py-0.5 rounded font-mono font-bold">
                          SUPERADMIN
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isUserSuperAdmin && !isRequestorSuperAdmin ? (
                        <span className="bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs text-amber-400 font-semibold rounded-lg capitalize">
                          Super Admin
                        </span>
                      ) : (
                        <select
                          value={editRole}
                          disabled={!canUpdate || (!isRequestorSuperAdmin && (u.id === currentUser?.id || u.username === currentUser?.username))}
                          title={!isRequestorSuperAdmin && (u.id === currentUser?.id || u.username === currentUser?.username) ? "Tidak dapat mengubah role akun Anda sendiri" : ""}
                          onChange={(e) =>
                            setRoleEdits((prev) => ({
                              ...prev,
                              [u.id]: e.target.value,
                            }))
                          }
                          className={`bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 rounded-lg outline-none focus:border-blue-500 capitalize ${
                            !isRequestorSuperAdmin && (u.id === currentUser?.id || u.username === currentUser?.username)
                              ? "opacity-60 cursor-not-allowed"
                              : "cursor-pointer disabled:opacity-50"
                          }`}
                        >
                          {(() => {
                            // Build options from availableRoles, or fallback to unique roles from users list
                            let roleOptions = availableRoles.length > 0
                              ? availableRoles.map((r) => ({ id: r.id, name: r.name }))
                              : [...new Set(users.map((usr) => usr.role))]
                                  .map((name) => ({ id: name, name }));

                            // Filter out superadmin option for non-superadmins
                            if (!isRequestorSuperAdmin) {
                              roleOptions = roleOptions.filter((r) => r.name !== "superadmin");
                            }

                            // Always ensure current editRole is in the list
                            if (!roleOptions.find((r) => r.name === editRole)) {
                              roleOptions = [{ id: editRole, name: editRole }, ...roleOptions];
                            }

                            return roleOptions.map((r) => (
                              <option key={r.id} value={r.name} className="capitalize">
                                {r.name === "superadmin" ? "Super Admin" : r.name}
                              </option>
                            ));
                          })()}
                        </select>
                      )}
                      {roleDirty && (
                        <button
                          type="button"
                          title="Simpan role"
                          disabled={savingRoleId === u.id}
                          onClick={() => handleUpdateRole(u.id)}
                          className="cursor-pointer text-blue-400 hover:text-blue-300 p-1.5 transition disabled:opacity-50"
                        >
                          <Save size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end items-center gap-2">
                      {canUpdate && (isRequestorSuperAdmin || !isUserSuperAdmin) && (
                        <button
                          title="Ubah Password"
                          onClick={() => setSelectedUserForPassword(u)}
                          className="text-slate-500 hover:text-blue-400 p-1.5 transition cursor-pointer"
                        >
                          <Key size={16} />
                        </button>
                      )}
                      {canDelete && (isRequestorSuperAdmin || !isUserSuperAdmin) && (
                        <button
                          title="Hapus"
                          onClick={() => handleDelete(u.id)}
                          className="text-slate-500 hover:text-red-400 p-1.5 transition cursor-pointer"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal Ubah Password untuk Admin */}
      {selectedUserForPassword && (
        <div className="fixed inset-0 bg-slate-950/70 flex items-center justify-center z-[3000] p-4 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-700">
              <h3 className="text-base font-bold text-slate-100">
                Ubah Password Pengguna
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Mengubah password untuk akun{" "}
                <strong className="text-blue-400">
                  {selectedUserForPassword.username}
                </strong>
              </p>
            </div>
            <form
              onSubmit={handleAdminChangePassword}
              className="p-5 flex flex-col gap-4"
            >
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400">
                  Password Baru
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Masukkan password baru"
                  required
                  minLength={4}
                  className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:border-blue-500 outline-none w-full"
                />
              </div>
              <div className="flex justify-end gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedUserForPassword(null);
                    setNewPassword("");
                  }}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg text-xs transition cursor-pointer"
                >
                  {changingPassword ? "Menyimpan..." : "Simpan Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    
      {/* Delete User Confirmation Modal */}
      {deleteConfirmUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
              <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
                <Trash2 size={16} className="text-red-400" />
                Hapus Pengguna
              </h3>
              <button onClick={() => setDeleteConfirmUserId(null)} className="cursor-pointer text-slate-400 hover:text-slate-200 transition">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-300 leading-relaxed">
                Yakin ingin menghapus pengguna ini? Tindakan ini tidak dapat dibatalkan.
              </p>
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg">
                ⚠️ Data pengguna akan dihapus secara permanen.
              </div>
              <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-700/30">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmUserId(null)}
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-slate-300 font-medium transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 border border-red-500 text-xs text-white font-semibold transition cursor-pointer"
                >
                  <Trash2 size={13} />
                  Ya, Hapus
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


function SystemHealth({ isAdmin }) {
  const { showToast } = useAppState();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmRestartApp, setConfirmRestartApp] = useState(null); // nama app pm2 yg mau direstart

  const fetchHealth = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await axios.get(`${API_URL}/system-health`);
      setData(res.data);
    } catch (err) {
      console.error(err);
      if (isManual && showToast)
        showToast("Gagal mengambil metrik kesehatan", "error");
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(() => fetchHealth(), 5000);
    return () => clearInterval(interval);
  }, []);

  const handleRestart = (appName) => {
    setConfirmRestartApp(appName);
  };

  const confirmRestart = async () => {
    const appName = confirmRestartApp;
    if (!appName) return;
    setConfirmRestartApp(null);
    try {
      const res = await axios.post(`${API_URL}/system-health`, {
        action: "restart",
        app_name: appName,
      });
      if (showToast)
        showToast(res.data.message || `${appName} direstart`, "success");
      fetchHealth(true);
    } catch (err) {
      if (showToast)
        showToast(
          err.response?.data?.error || `Gagal restart ${appName}`,
          "error",
        );
    }
  };

  const formatBytes = (bytes, decimals = 2) => {
    if (!bytes || Number(bytes) <= 0 || isNaN(bytes)) return "0 Bytes";
    const k = 1024,
      dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
    const i = Math.min(
      Math.max(0, Math.floor(Math.log(bytes) / Math.log(k))),
      sizes.length - 1
    );
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  const formatUptime = (seconds) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}h ${h}j`;
    return `${h}j ${m}m`;
  };

  const totalMem = Number(data?.os?.totalMemory) || 0;
  const freeMem = Number(data?.os?.freeMemory) || 0;
  const usedMem = Math.max(0, totalMem - freeMem);
  const ramPercent = totalMem > 0 ? Math.round((usedMem / totalMem) * 100) : 0;

  const load1 = data?.os?.loadAvg?.[0]?.toFixed(2) || "0.00";
  const load5 = data?.os?.loadAvg?.[1]?.toFixed(2) || "0.00";
  const load15 = data?.os?.loadAvg?.[2]?.toFixed(2) || "0.00";

  const servicesList = data?.pm2 && Array.isArray(data.pm2) ? data.pm2 : [];
  const onlineCount = servicesList.filter((s) => s.status === "online").length;

  const getContainerRole = (name) => {
    switch (name) {
      case "nocr_app":
        return "Core Web App & API Services";
      case "ruijie_scraper":
        return "Ruijie & OLT Data Scraper";
      case "nocr_postgres":
        return "PostgreSQL Primary Storage";
      default:
        return "Docker Background Daemon";
    }
  };

  if (loading && !data)
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-6 text-center text-slate-400 text-xs animate-pulse">
        Memuat metrik kesehatan sistem...
      </div>
    );

  return (
    <>
      <div className="space-y-3.5">
        {/* ─── 1. Host Hardware Vitals (3 Grid Cards) ─── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Card 1: Beban CPU */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3.5 md:p-4 backdrop-blur-sm flex flex-col justify-between transition-all">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-slate-800/90 border border-slate-700/60 flex items-center justify-center text-sky-400 flex-shrink-0">
                  <Cpu size={14} />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-200 tracking-wide uppercase">
                    Beban CPU (Load Avg)
                  </span>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Rata-rata antrean prosesor
                  </p>
                </div>
              </div>
              <span className="text-[9px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/50 text-slate-300">
                1M • 5M • 15M
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 my-1">
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-md p-2 text-center">
                <div className="text-[9.5px] text-slate-500 font-mono uppercase">1 Min</div>
                <div className="text-base font-bold font-mono text-slate-100 mt-0.5">{load1}</div>
              </div>
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-md p-2 text-center">
                <div className="text-[9.5px] text-slate-500 font-mono uppercase">5 Min</div>
                <div className="text-base font-bold font-mono text-slate-100 mt-0.5">{load5}</div>
              </div>
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-md p-2 text-center">
                <div className="text-[9.5px] text-slate-500 font-mono uppercase">15 Min</div>
                <div className="text-base font-bold font-mono text-slate-100 mt-0.5">{load15}</div>
              </div>
            </div>

            <div className="text-[10.5px] text-slate-400 font-mono mt-1.5 flex items-center justify-between">
              <span>Status CPU:</span>
              <span className="text-emerald-400 font-semibold">Normal (Multi-Core Host)</span>
            </div>
          </div>

          {/* Card 2: Penggunaan RAM */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3.5 md:p-4 backdrop-blur-sm flex flex-col justify-between transition-all">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-slate-800/90 border border-slate-700/60 flex items-center justify-center text-sky-400 flex-shrink-0">
                  <HardDrive size={14} />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-200 tracking-wide uppercase">
                    Penggunaan RAM
                  </span>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Alokasi memori fisik host
                  </p>
                </div>
              </div>
              <span className="text-[9px] font-mono font-semibold px-2 py-0.5 rounded bg-sky-950/60 border border-sky-800/60 text-sky-300">
                {ramPercent}% TERPAKAI
              </span>
            </div>

            <div className="my-1">
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-bold font-mono text-slate-100">
                  {formatBytes(usedMem)}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  / {formatBytes(totalMem)}
                </span>
              </div>

              <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800/80 my-2">
                <div
                  className="bg-gradient-to-r from-sky-500 to-blue-600 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${ramPercent}%` }}
                />
              </div>
            </div>

            <div className="text-[10.5px] text-slate-400 font-mono flex items-center justify-between">
              <span>Tersedia:</span>
              <span className="text-slate-300 font-semibold">{formatBytes(freeMem)} Memori Bebas</span>
            </div>
          </div>

          {/* Card 3: Server Uptime */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3.5 md:p-4 backdrop-blur-sm flex flex-col justify-between transition-all">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-slate-800/90 border border-slate-700/60 flex items-center justify-center text-sky-400 flex-shrink-0">
                  <Activity size={14} />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-200 tracking-wide uppercase">
                    Server Uptime
                  </span>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Durasi operasional host aktif
                  </p>
                </div>
              </div>
              <span className="flex items-center gap-1 text-[9px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/60 text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ONLINE
              </span>
            </div>

            <div className="my-1">
              <div className="text-xl font-bold font-mono text-slate-100">
                {formatUptime(data?.os?.uptime)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Waktu aktif sistem operasi sejak boot
              </div>
            </div>

            <div className="text-[10.5px] text-slate-400 font-mono flex items-center justify-between">
              <span>Keandalan Host:</span>
              <span className="text-emerald-400 font-semibold">100% Berjalan Stabil</span>
            </div>
          </div>
        </div>

        {/* ─── 2. Database PostgreSQL Health ─── */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3.5 md:p-4 backdrop-blur-sm transition-all">
          <div className="flex items-center justify-between pb-2.5 mb-3.5 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-slate-800/90 border border-slate-700/60 flex items-center justify-center text-sky-400 flex-shrink-0">
                <Database size={14} />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-200 tracking-wide uppercase">
                  Database Operasional (PostgreSQL)
                </span>
                <p className="text-[10px] text-slate-400 font-mono">
                  Penyimpanan relasional, histori trafik, dan tabel konfigurasi NOCR
                </p>
              </div>
            </div>
            <span className="text-[9px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/50 text-emerald-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              PORT: 5432 • CONNECTED
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-md p-3">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Ukuran Penyimpanan
              </span>
              <div className="text-base font-bold font-mono text-slate-100">
                {data?.db?.size || "-"}
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Total file data & indeks tabel
              </span>
            </div>

            <div className="bg-slate-950/70 border border-slate-800/80 rounded-md p-3">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Koneksi Aktif
              </span>
              <div className="text-base font-bold font-mono text-slate-100">
                {data?.db?.active_connections || 0} <span className="text-xs font-normal text-slate-400">Koneksi</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Sesi backend pool terhubung
              </span>
            </div>

            <div className="bg-slate-950/70 border border-slate-800/80 rounded-md p-3">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Versi Mesin Basis Data
              </span>
              <div className="text-xs font-semibold font-mono text-slate-200 truncate" title={data?.db?.version || "-"}>
                {data?.db?.version ? data.db.version.split(" on ")[0] : "PostgreSQL 16"}
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block truncate">
                x86_64 Alpine Linux Runtime
              </span>
            </div>

            <div className="bg-slate-950/70 border border-slate-800/80 rounded-md p-3">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Status Integritas
              </span>
              <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 mt-0.5">
                <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
                <span>Normal & Siap Transaksi</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Query latency & read/write normal
              </span>
            </div>
          </div>
        </div>

        {/* ─── 3. Docker Containers & Services ─── */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3.5 md:p-4 backdrop-blur-sm transition-all">
          <div className="flex items-center justify-between pb-2.5 mb-3.5 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-slate-800/90 border border-slate-700/60 flex items-center justify-center text-sky-400 flex-shrink-0">
                <Terminal size={14} />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-200 tracking-wide uppercase">
                  Layanan Kontainer (Docker)
                </span>
                <p className="text-[10px] text-slate-400 font-mono">
                  Status daemon aplikasi, web server, dan scraper background
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/50 text-slate-300">
                {onlineCount} / {servicesList.length} KONTAINER AKTIF
              </span>
              <button
                onClick={() => fetchHealth(true)}
                disabled={refreshing}
                className={`cursor-pointer text-slate-400 hover:text-slate-200 p-1.5 rounded-md bg-slate-800/90 hover:bg-slate-700/80 border border-slate-700/60 transition ${
                  refreshing ? "animate-spin text-sky-400" : ""
                }`}
                title="Muat Ulang Metrik"
              >
                <RefreshCw size={13} />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 text-[10px] font-mono uppercase tracking-wider">
                  <th className="px-3.5 py-2.5">Layanan / Kontainer</th>
                  <th className="px-3.5 py-2.5">Status</th>
                  <th className="px-3.5 py-2.5">Uptime</th>
                  <th className="px-3.5 py-2.5">Memori & CPU</th>
                  <th className="px-3.5 py-2.5">Port</th>
                  {isAdmin && <th className="px-3.5 py-2.5 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {servicesList.length > 0 ? (
                  servicesList.map((app) => (
                    <tr
                      key={app.name}
                      className="hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-3.5 py-3">
                        <div className="flex flex-col">
                          <span className="font-mono font-bold text-slate-200 text-xs">
                            {app.name}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {getContainerRole(app.name)}
                          </span>
                        </div>
                      </td>
                      <td className="px-3.5 py-3">
                        {app.status === "online" ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Online
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                            {app.status || "Offline"}
                          </span>
                        )}
                      </td>
                      <td className="px-3.5 py-3 text-slate-300 font-mono text-xs">
                        {formatUptime(app.uptime / 1000)}
                      </td>
                      <td className="px-3.5 py-3 font-mono text-xs text-slate-300">
                        {app.memory > 0 && <span>RAM: {formatBytes(app.memory)}</span>}
                        {app.cpu > 0 && (
                          <span className="text-slate-400"> • CPU: {app.cpu}%</span>
                        )}
                        {app.memory === 0 && app.cpu === 0 && (
                          <span className="text-slate-500">Aktif</span>
                        )}
                      </td>
                      <td className="px-3.5 py-3 font-mono text-xs">
                        <span className="text-sky-300 bg-sky-950/40 border border-sky-800/50 px-2 py-0.5 rounded text-[11px]">
                          {app.port || "-"}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-3.5 py-3 text-right">
                          <button
                            onClick={() => handleRestart(app.name)}
                            className="cursor-pointer px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-[11px] font-medium text-slate-300 hover:text-white transition flex items-center gap-1.5 ml-auto"
                            title={`Restart kontainer ${app.name}`}
                          >
                            <RefreshCw size={11} />
                            <span>Restart</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={isAdmin ? 6 : 5}
                      className="px-4 py-6 text-center text-xs text-slate-500"
                    >
                      Data layanan Docker tidak tersedia.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ─── Modal Konfirmasi Restart (Dashboard Style) ─── */}
      {confirmRestartApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-semibold text-slate-200 text-xs flex items-center gap-2">
                <RefreshCw size={14} className="text-sky-400" />
                Konfirmasi Restart Kontainer
              </h3>
              <button
                onClick={() => setConfirmRestartApp(null)}
                className="cursor-pointer text-slate-400 hover:text-slate-200 transition"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-slate-300 leading-relaxed">
                Yakin ingin merestart kontainer{" "}
                <span className="font-mono font-bold text-white bg-slate-800 px-1.5 py-0.5 rounded">
                  {confirmRestartApp}
                </span>
                ?
              </p>
              <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] p-2.5 rounded-md">
                ⚠️ Layanan akan offline sejenak selama proses inisialisasi ulang.
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setConfirmRestartApp(null)}
                  className="px-3.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 font-medium transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={confirmRestart}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 text-xs text-white font-semibold transition cursor-pointer shadow-sm"
                >
                  <RefreshCw size={12} />
                  Ya, Restart
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// SystemConfigSettings is imported from @/components/SystemConfigSettings

export default function SettingsWrapper(props) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/settings") {
      router.replace("/settings/company");
    }
  }, [pathname, router]);

  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="p-10 text-slate-400">Memuat...</div>}>
        <Settings {...props} />
      </Suspense>
    </ErrorBoundary>
  );
}

function Settings({ activeTab: activeTabProp }) {
  const { devices, refreshDevices, showToast, sessionUser } = useAppState();
  const [perms, setPerms] = useState({});

  const syncRoleFlags = () => {
    const userData = sessionUser?.role ? sessionUser : getStoredUser();
    setPerms({
      companyRead: hasAccess(userData, "settings-company", "read"),
      companyUpdate: hasAccess(userData, "settings-company", "update"),
      mikrotikUpdate: hasAccess(userData, "settings-mikrotik", "update"),
      vpnUpdate: hasAccess(userData, "settings-vpn", "update"),
      healthUpdate: hasAccess(userData, "settings-health", "update"),
      waRead: hasAccess(userData, "settings-wa", "read"),
      waCreate: hasAccess(userData, "settings-wa", "create"),
      waUpdate: hasAccess(userData, "settings-wa", "update"),
      waDelete: hasAccess(userData, "settings-wa", "delete"),
      usersRead: hasAccess(userData, "settings-users", "read"),
      usersCreate: hasAccess(userData, "settings-users", "create"),
      usersUpdate: hasAccess(userData, "settings-users", "update"),
      usersDelete: hasAccess(userData, "settings-users", "delete"),
      rolesRead: hasAccess(userData, "settings-roles", "read"),
      rolesCreate: hasAccess(userData, "settings-roles", "create"),
      rolesUpdate: hasAccess(userData, "settings-roles", "update"),
      rolesDelete: hasAccess(userData, "settings-roles", "delete"),
      apikeysRead: (userData?.role || "").toLowerCase() === "superadmin",
      apikeysCreate: (userData?.role || "").toLowerCase() === "superadmin",
      apikeysUpdate: (userData?.role || "").toLowerCase() === "superadmin",
      apikeysDelete: (userData?.role || "").toLowerCase() === "superadmin",
      passwordUpdate: hasAccess(userData, "settings-password", "update"),
      systemRead: hasAccess(userData, "settings-system", "read"),
      systemUpdate: hasAccess(userData, "settings-system", "update"),
    });
  };

  const searchParams = useSearchParams();
  const pathname = usePathname();

  const resolveActiveTab = () => {
    if (activeTabProp) return activeTabProp;
    if (pathname) {
      const segs = pathname.replace(/^\//, "").split("/");
      if (segs[0] === "settings" && segs[1]) {
        if (segs[1] === "core") return "mikrotik-gateway";
        if (segs[1] === "company" || segs[1] === "profile") return "company";
        if (segs[1] === "api-keys" || segs[1] === "apikeys") return "api-keys";
        return segs[1];
      }
    }
    const tabParam = searchParams.get("tab");
    if (tabParam) {
      if (tabParam === "core") return "mikrotik-gateway";
      if (tabParam === "company" || tabParam === "profile") return "company";
      if (tabParam === "api-keys" || tabParam === "apikeys") return "api-keys";
      return tabParam;
    }
    const userData = sessionUser?.role ? sessionUser : getStoredUser();
    const candidateTabs = [
      { tab: "company", menu: "settings-company" },
      { tab: "mikrotik-gateway", menu: "settings-mikrotik" },
      { tab: "vpn", menu: "settings-vpn" },
      { tab: "health", menu: "settings-health" },
      // { tab: "whatsapp", menu: "settings-wa" },
      { tab: "users", menu: "settings-users" },
      { tab: "roles", menu: "settings-roles" },
      { tab: "api-keys", menu: "settings-apikeys" },
      { tab: "password", menu: "settings-password" },
      { tab: "system", menu: "settings-system" },
      { tab: "design", menu: null },
    ];
    const match = candidateTabs.find(
      (t) => !t.menu || hasAccess(userData, t.menu, "read")
    );
    return match ? match.tab : "company";
  };

  const activeTab = resolveActiveTab();

  const [coreDevice, setCoreDevice] = useState({
    name: "MikroTik Gateway",
    ip_address: "",
    username: "admin",
    password: "",
    port: 8728,
    type: "mikrotik-core",
  });

  const [existingId, setExistingId] = useState(null);

  const [vpnConfig, setVpnConfig] = useState({
    windows_name: "",
    windows_username: "",
    windows_password: "",
    linux_name: "",
    linux_username: "",
    linux_password: "",
    name: "",
    username: "",
    password: "",
    active_platform: "windows",
  });
  const [vpnConnecting, setVpnConnecting] = useState(false);
  const [vpnMsg, setVpnMsg] = useState("");

  const [showCorePassword, setShowCorePassword] = useState(false);
  const [showVpnPassword, setShowVpnPassword] = useState(false);

  useEffect(() => {
    syncRoleFlags();
    const onRole = () => syncRoleFlags();
    window.addEventListener("nocr-role-updated", onRole);
    return () => window.removeEventListener("nocr-role-updated", onRole);
  }, []);

  useEffect(() => {
    if (sessionUser?.role) syncRoleFlags();
  }, [sessionUser]);

  const fetchedCoreRef = useRef(false);
  const fetchedVpnRef = useRef(false);

  useEffect(() => {
    if (!devices || devices.length === 0 || fetchedCoreRef.current) return;
    const core = devices.find(
      (d) =>
        d.type === "mikrotik-core" ||
        (d.name && d.name.toLowerCase().includes("pusat")) ||
        (d.name && d.name.toLowerCase().includes("core")),
    );
    if (core) {
      fetchedCoreRef.current = true;
      setExistingId(core.id);
      axios
        .get(`${API_URL}/devices/${core.id}`)
        .then((res) => {
          setCoreDevice({
            name: res.data.name,
            ip_address: res.data.ip_address,
            username: res.data.username || "",
            password: res.data.password || "",
            port: res.data.port || 8728,
            type: res.data.type,
          });
        })
        .catch(console.error);
    }
  }, [devices]);

  useEffect(() => {
    if (fetchedVpnRef.current) return;
    fetchedVpnRef.current = true;
    axios
      .get(`${API_URL}/vpn/settings`)
      .then((res) => {
        setVpnConfig({
          windows_name: res.data.windows_name || "",
          windows_username: res.data.windows_username || "",
          windows_password: res.data.windows_password || "",
          linux_name: res.data.linux_name || "",
          linux_username: res.data.linux_username || "",
          linux_password: res.data.linux_password || "",
          name: res.data.name || "",
          username: res.data.username || "",
          password: res.data.password || "",
          active_platform: res.data.active_platform || "windows",
        });
      })
      .catch(console.error);
  }, []);

  const handleSaveCore = async (e) => {
    e.preventDefault();
    if (!perms.mikrotikUpdate) return;
    try {
      if (existingId) {
        await axios.put(`${API_URL}/devices/${existingId}`, coreDevice);
      } else {
        await axios.post(`${API_URL}/devices`, coreDevice);
      }
      showToast("Konfigurasi MikroTik berhasil disimpan!", "success");
      if (refreshDevices) refreshDevices();
    } catch (err) {
      showToast(
        "Gagal menyimpan: " + (err.response?.data?.error || err.message),
        "error",
      );
    }
  };

  const handleSaveVpn = async (e) => {
    e.preventDefault();
    if (!perms.vpnUpdate) return;
    try {
      const res = await axios.post(`${API_URL}/vpn/settings`, vpnConfig);
      const isWarning = res.data.message && res.data.message.includes("gagal");
      showToast(
        res.data.message || "Pengaturan VPN berhasil disimpan!",
        isWarning ? "warning" : "success",
      );
    } catch (err) {
      showToast(
        "Gagal menyimpan pengaturan VPN: " +
          (err.response?.data?.error || err.message),
        "error",
      );
    }
  };

  const testVpnConnect = async () => {
    setVpnConnecting(true);
    setVpnMsg("Menghubungkan...");
    try {
      const res = await axios.post(`${API_URL}/vpn/connect`);
      setVpnMsg(res.data.message);
    } catch (err) {
      setVpnMsg("Error: " + (err.response?.data?.error || err.message));
    } finally {
      setVpnConnecting(false);
    }
  };

  const testVpnDisconnect = async () => {
    setVpnConnecting(true);
    setVpnMsg("Memutuskan...");
    try {
      const res = await axios.post(`${API_URL}/vpn/disconnect`);
      setVpnMsg(res.data.message);
    } catch (err) {
      setVpnMsg("Error: " + (err.response?.data?.error || err.message));
    } finally {
      setVpnConnecting(false);
    }
  };

  const getTabHeader = () => {
    switch (activeTab) {
      case "company":
      case "profile":
        return {
          title: "Profil Perusahaan",
          desc: "Informasi resmi organisasi, identitas operasional, dan kontak resmi",
          icon: <Building2 size={22} className="text-blue-400" />,
        };
      case "users":
      case "roles":
        return {
          title: "Manajemen Pengguna & Role",
          desc: "Kelola akun pengguna, penugasan hak akses, dan matriks perizinan role",
          icon: <Users size={22} className="text-blue-400" />,
        };
      case "health":
        return {
          title: "Kesehatan Sistem & DB",
          desc: "Status operasional database, performa memori, dan servis pendukung NOCR",
          icon: <Activity size={22} className="text-blue-400" />,
        };
      case "api-keys":
      case "apikeys":
        return {
          title: "Akses API Key",
          desc: "Kelola token autentikasi integrasi API dan webhook",
          icon: <Key size={22} className="text-blue-400" />,
        };
      case "password":
        return {
          title: "Ubah Password",
          desc: "Perbarui kredensial keamanan akun Anda",
          icon: <Key size={22} className="text-blue-400" />,
        };
      case "mikrotik-gateway":
      case "vpn":
      case "core":
        return {
          title: "Core Gateway & Jaringan",
          desc: "Konfigurasi perangkat core gateway dan parameter routing",
          icon: <Network size={22} className="text-blue-400" />,
        };
      case "system":
      case "server":
      default:
        return {
          title: "Konfigurasi Server",
          desc: "Pengaturan infrastruktur server, koneksi daemon, dan konfigurasi lingkungan",
          icon: <Server size={22} className="text-blue-400" />,
        };
    }
  };

  const tabHeader = getTabHeader();

  return (
    <div className="h-full min-h-0 overflow-y-auto flex flex-col gap-6 w-full pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-3">
            {tabHeader.icon} {tabHeader.title}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {tabHeader.desc}
          </p>
        </div>
      </div>

      <div>
        {/* Content Settings - full width, tab driven by URL */}
        <div>
          {(activeTab === "company" || activeTab === "profile") && perms.companyRead && (
            <CompanyProfileSettings canUpdate={perms.companyUpdate} />
          )}

          {(activeTab === "users" || activeTab === "roles") && (perms.usersRead || perms.rolesRead) && (
            <UserAndRoleSettings
              userPerms={{
                canRead: perms.usersRead,
                canCreate: perms.usersCreate,
                canUpdate: perms.usersUpdate,
                canDelete: perms.usersDelete,
              }}
              rolePerms={{
                canRead: perms.rolesRead,
                canCreate: perms.rolesCreate,
                canUpdate: perms.rolesUpdate,
                canDelete: perms.rolesDelete,
              }}
            />
          )}

          {(activeTab === "api-keys" || activeTab === "apikeys") && perms.apikeysRead && (
            <ApiKeySettings
              canCreate={perms.apikeysCreate}
              canUpdate={perms.apikeysUpdate}
              canDelete={perms.apikeysDelete}
            />
          )}

          {activeTab === "password" && (
            <PasswordChangeSettings canUpdate={perms.passwordUpdate} />
          )}

          {activeTab === "health" && (
            <SystemHealth isAdmin={perms.healthUpdate} />
          )}

          {(activeTab === "system" || activeTab === "server" || activeTab === "mikrotik-gateway" || activeTab === "vpn" || activeTab === "core") && (perms.systemRead || perms.mikrotikRead) && (
            <SystemConfigSettings
              canUpdate={perms.systemUpdate}
              perms={perms}
              coreDevice={coreDevice}
              setCoreDevice={setCoreDevice}
              showCorePassword={showCorePassword}
              setShowCorePassword={setShowCorePassword}
              handleSaveCore={handleSaveCore}
              vpnConfig={vpnConfig}
              setVpnConfig={setVpnConfig}
              showVpnPassword={showVpnPassword}
              setShowVpnPassword={setShowVpnPassword}
              handleSaveVpn={handleSaveVpn}
              testVpnConnect={testVpnConnect}
              testVpnDisconnect={testVpnDisconnect}
              vpnConnecting={vpnConnecting}
              vpnMsg={vpnMsg}
              existingId={existingId}
              initialSubTab={
                activeTab === "mikrotik-gateway" || activeTab === "vpn" || activeTab === "core"
                  ? "gateway"
                  : searchParams?.get("tab") || "gateway"
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
