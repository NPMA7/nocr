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
  Key,
  Activity,
  HardDrive,
  Cpu,
  RefreshCw,
  Play,
  Square,
  X,
  Power,
} from "lucide-react";
import { hasAccess, getStoredUser, getRoleLabel } from "@/lib/roles";
import RoleSettings from "@/components/RoleSettings";
import WhatsAppGateway from "@/components/WhatsAppGateway";

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
  const isRequestorAdmin = requestorRole === "admin";

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
                  .filter((r) => isRequestorAdmin || r.name !== "admin")
                  .map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name}
                    </option>
                  ))
              ) : (
                <>
                  <option value="visitor">Visitor</option>
                  <option value="editor">Editor</option>
                  {isRequestorAdmin && <option value="admin">Admin</option>}
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
            {users.map((u) => {
              const editRole = roleEdits[u.id] ?? u.role;
              const roleDirty = editRole !== u.role;
              return (
                <tr
                  key={u.id}
                  className="hover:bg-slate-700/20 transition-colors"
                >
                  <td className="px-4 py-3 text-xs font-semibold text-slate-200">
                    {u.username}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    <div className="flex items-center gap-2 flex-wrap">
                      {u.role === "admin" && !isRequestorAdmin ? (
                        <span className="bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs text-slate-400 rounded-lg capitalize">
                          Admin
                        </span>
                      ) : (
                        <select
                          value={editRole}
                          disabled={!canUpdate}
                          onChange={(e) =>
                            setRoleEdits((prev) => ({
                              ...prev,
                              [u.id]: e.target.value,
                            }))
                          }
                          className="cursor-pointer bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 rounded-lg outline-none focus:border-blue-500 capitalize disabled:opacity-50"
                        >
                          {(() => {
                            // Build options from availableRoles, or fallback to unique roles from users list
                            let roleOptions = availableRoles.length > 0
                              ? availableRoles.map((r) => ({ id: r.id, name: r.name }))
                              : [...new Set(users.map((usr) => usr.role))]
                                  .map((name) => ({ id: name, name }));

                            // Filter out admin option for non-admins
                            if (!isRequestorAdmin) {
                              roleOptions = roleOptions.filter((r) => r.name !== "admin");
                            }

                            // Always ensure current editRole is in the list
                            if (!roleOptions.find((r) => r.name === editRole)) {
                              roleOptions = [{ id: editRole, name: editRole }, ...roleOptions];
                            }

                            return roleOptions.map((r) => (
                              <option key={r.id} value={r.name} className="capitalize">
                                {r.name}
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
                      {canUpdate && (isRequestorAdmin || u.role !== "admin") && (
                        <button
                          title="Ubah Password"
                          onClick={() => setSelectedUserForPassword(u)}
                          className="text-slate-500 hover:text-blue-400 p-1.5 transition cursor-pointer"
                        >
                          <Key size={16} />
                        </button>
                      )}
                      {canDelete && (isRequestorAdmin || u.role !== "admin") && (
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

function PasswordChangeSettings({ canUpdate = true }) {
  const { showToast } = useAppState();
  const [form, setForm] = useState({ newPassword: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canUpdate) return;
    if (form.newPassword !== form.confirmPassword) {
      if (showToast) showToast("Konfirmasi password tidak cocok", "error");
      return;
    }
    setLoading(true);
    try {
      const user = getStoredUser();
      await axios.patch(`${API_URL}/auth/users/${user.id}`, {
        password: form.newPassword,
      });
      setForm({ newPassword: "", confirmPassword: "" });
      if (showToast) showToast("Password Anda berhasil diperbarui", "success");
    } catch (err) {
      if (showToast)
        showToast(err.response?.data?.error || err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-800 border border-slate-700/50 rounded-xl overflow-hidden shadow-lg p-5">
      <h2 className="text-base font-bold text-slate-100 flex items-center gap-2 mb-4">
        <Key size={20} className="text-blue-500" /> Ubah Password Saya
      </h2>
      <p className="text-xs text-slate-400 mb-6">
        Gunakan form di bawah ini untuk memperbarui kata sandi akun Anda.
        Pastikan password baru Anda kuat dan aman.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5 w-full">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Password Baru
          </label>
          <div className="relative">
            <input
              type={showPwd ? "text" : "password"}
              value={form.newPassword}
              onChange={(e) =>
                setForm({ ...form, newPassword: e.target.value })
              }
              placeholder="Masukkan password baru"
              required
              disabled={!canUpdate}
              minLength={4}
              className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-slate-100 focus:border-blue-500 outline-none w-full pr-10 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-slate-600 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setShowPwd(!showPwd)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
            >
              {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Konfirmasi Password Baru
          </label>
          <div className="relative">
            <input
              type={showPwd ? "text" : "password"}
              value={form.confirmPassword}
              onChange={(e) =>
                setForm({ ...form, confirmPassword: e.target.value })
              }
              placeholder="Konfirmasi password baru"
              required
              disabled={!canUpdate}
              minLength={4}
              className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-slate-100 focus:border-blue-500 outline-none w-full pr-10 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-slate-600 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setShowPwd(!showPwd)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
            >
              {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="mt-2">
          {canUpdate ? (
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 px-6 rounded-lg text-xs transition-all shadow-md disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>{" "}
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save size={16} /> Simpan Perubahan Password
                </>
              )}
            </button>
          ) : (
            <></>
          )}
        </div>
      </form>
    </div>
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
    if (!+bytes) return "0 Bytes";
    const k = 1024,
      dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  const formatUptime = (seconds) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}h ${h}j`;
    return `${h}j ${m}m`;
  };

  if (loading && !data)
    return (
      <div className="text-slate-400 p-5 animate-pulse">
        Memuat metrik sistem...
      </div>
    );

  return (
    <>
    <div className="flex flex-col gap-6">
      {/* OS Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-5 shadow-lg flex flex-col gap-2">
          <div className="flex items-center gap-2 text-blue-400 font-bold mb-1">
            <Cpu size={18} /> Beban CPU (Load Avg)
          </div>
          <div className="text-xl font-bold text-slate-100">
            {data?.os?.loadAvg
              ? data.os.loadAvg.map((n) => n.toFixed(2)).join(" | ")
              : "-"}
          </div>
          <div className="text-xs text-slate-400">Rata-rata 1, 5, 15 menit</div>
        </div>
        <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-5 shadow-lg flex flex-col gap-2">
          <div className="flex items-center gap-2 text-emerald-400 font-bold mb-1">
            <HardDrive size={18} /> Penggunaan RAM
          </div>
          <div className="text-xl font-bold text-slate-100">
            {formatBytes(data?.os?.totalMemory - data?.os?.freeMemory)}{" "}
            <span className="text-xs text-slate-400 font-normal">
              / {formatBytes(data?.os?.totalMemory)}
            </span>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-1.5 mt-1 overflow-hidden">
            <div
              className="bg-emerald-500 h-1.5 rounded-full"
              style={{
                width: `${((data?.os?.totalMemory - data?.os?.freeMemory) / data?.os?.totalMemory) * 100}%`,
              }}
            ></div>
          </div>
        </div>
        <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-5 shadow-lg flex flex-col gap-2">
          <div className="flex items-center gap-2 text-purple-400 font-bold mb-1">
            <Activity size={18} /> Server Uptime
          </div>
          <div className="text-xl font-bold text-slate-100">
            {formatUptime(data?.os?.uptime)}
          </div>
          <div className="text-xs text-slate-400">
            Waktu aktif host sejak restart
          </div>
        </div>
      </div>

      {/* Database Stats */}
      <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-5 shadow-lg">
        <div className="flex items-center gap-2 text-base font-bold text-slate-100 mb-4 border-b border-slate-700/50 pb-3">
          <Database size={20} className="text-cyan-400" /> PostgreSQL Database
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-400">
              Ukuran Penyimpanan
            </span>
            <span className="text-base font-bold text-slate-200">
              {data?.db?.size || "-"}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-400">
              Koneksi Aktif
            </span>
            <span className="text-base font-bold text-slate-200">
              {data?.db?.active_connections || 0}
            </span>
          </div>
          <div className="flex flex-col gap-1 col-span-2">
            <span className="text-xs font-semibold text-slate-400">
              Versi Mesin
            </span>
            <span className="text-xs font-semibold text-slate-300 break-words">
              {data?.db?.version || "-"}
            </span>
          </div>
        </div>
      </div>

      {/* PM2 Stats */}
      <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-5 shadow-lg">
        <div className="flex items-center justify-between mb-4 border-b border-slate-700/50 pb-3">
          <div className="flex items-center gap-2 text-base font-bold text-slate-100">
            <Terminal size={20} className="text-orange-400" /> Layanan Latar
            Belakang (PM2)
          </div>
          <button
            onClick={() => fetchHealth(true)}
            disabled={refreshing}
            className={`cursor-pointer text-slate-400 hover:text-slate-200 p-1.5 rounded-lg bg-slate-900 border border-slate-700 transition ${refreshing ? "animate-spin text-blue-400" : ""}`}
            title="Muat Ulang"
          >
            <RefreshCw size={14} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-900/50">
              <tr>
                <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase">
                  Aplikasi / Scraper
                </th>
                <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase">
                  Uptime
                </th>
                <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase">
                  Memori & CPU
                </th>
                <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase">
                  Restart
                </th>
                {isAdmin && (
                  <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase text-right">
                    Aksi
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {data?.pm2 && Array.isArray(data.pm2) ? (
                data.pm2.map((app) => (
                  <tr
                    key={app.name}
                    className="hover:bg-slate-700/20 transition-colors"
                  >
                    <td className="px-4 py-3 text-xs font-bold text-slate-200">
                      {app.name}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {app.status === "online" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>{" "}
                          Online
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>{" "}
                          {app.status || "Offline"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">
                      {formatUptime(app.uptime / 1000)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5 text-xs text-slate-400 font-mono">
                        <span>RAM: {formatBytes(app.memory)}</span>
                        <span>CPU: {app.cpu}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300 font-mono">
                      {app.restarts}x
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleRestart(app.name)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
                        >
                          <RefreshCw size={12} /> Restart
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="6"
                    className="px-4 py-3 text-center text-xs text-slate-500"
                  >
                    Data PM2 tidak tersedia.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
      {confirmRestartApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
              <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
                <RefreshCw size={16} className="text-blue-400" />
                Konfirmasi Restart
              </h3>
              <button onClick={() => setConfirmRestartApp(null)} className="cursor-pointer text-slate-400 hover:text-slate-200 transition">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-300 leading-relaxed">
                Yakin ingin merestart{" "}
                <span className="font-bold text-white">{confirmRestartApp}</span>?
              </p>
              <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs p-3 rounded-lg">
                ⚠️ Layanan akan offline sementara selama proses restart.
              </div>
              <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-700/30">
                <button
                  type="button"
                  onClick={() => setConfirmRestartApp(null)}
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-slate-300 font-medium transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={confirmRestart}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 border border-blue-500 text-xs text-white font-semibold transition cursor-pointer"
                >
                  <RefreshCw size={13} />
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

function SystemConfigSettings({ canUpdate = true }) {
  const { showToast } = useAppState();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newIssue, setNewIssue] = useState("");
  const [activeSubTab, setActiveSubTab] = useState("report");

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/settings/server");
      setSettings(res.data);
    } catch (err) {
      console.error(err);
      showToast("Gagal memuat pengaturan server", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!canUpdate) return;
    setSaving(true);
    try {
      await axios.post("/api/settings/server", settings);
      showToast("Pengaturan server berhasil disimpan!", "success");
    } catch (err) {
      console.error(err);
      showToast("Gagal menyimpan pengaturan server", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleAddIssue = () => {
    if (!newIssue.trim()) return;
    if (settings.standard_issues.includes(newIssue.trim())) {
      showToast("Issue sudah ada di daftar", "warning");
      return;
    }
    setSettings({
      ...settings,
      standard_issues: [...settings.standard_issues, newIssue.trim()],
    });
    setNewIssue("");
  };

  const handleRemoveIssue = (issue) => {
    setSettings({
      ...settings,
      standard_issues: settings.standard_issues.filter((i) => i !== issue),
    });
  };

  if (loading) {
    return <div className="p-5 text-slate-400">Memuat konfigurasi...</div>;
  }

  if (!settings) {
    return <div className="p-5 text-red-400">Gagal memuat konfigurasi.</div>;
  }

  return (
    <div className="bg-slate-800 border border-slate-700/50 rounded-xl overflow-hidden shadow-lg">
      <div className="p-5 border-b border-slate-700/50">
        <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
          <SettingsIcon size={20} className="text-red-400" /> Konfigurasi Server / Project
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Atur parameter operasional sistem NOCR tanpa perlu mengubah kode sumber.
        </p>
      </div>

      {/* Sub Tabs Navigation */}
      <div className="flex border-b border-slate-700/50 bg-slate-800/40 px-5 gap-6">
        <button
          type="button"
          onClick={() => setActiveSubTab("report")}
          className={`py-3 text-xs font-bold border-b-2 transition duration-200 cursor-pointer outline-none ${
            activeSubTab === "report"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          1. PARAMETER LAPORAN HARIAN
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab("sync")}
          className={`py-3 text-xs font-bold border-b-2 transition duration-200 cursor-pointer outline-none ${
            activeSubTab === "sync"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          2. PARAMETER SINKRONISASI & MONITORING
        </button>
      </div>

      <div className="p-5">
        <form onSubmit={handleSave} className="flex flex-col gap-5">
          {activeSubTab === "report" && (
            <div className="flex flex-col gap-4">
              <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                1. Parameter Laporan Harian
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400">
                    Minimal Durasi Offline (Menit)
                  </label>
                  <input
                    type="number"
                    min="1"
                    readOnly={!canUpdate}
                    value={settings.min_offline_duration_minutes}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        min_offline_duration_minutes: parseInt(e.target.value) || 1,
                      })
                    }
                    className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:border-blue-500 outline-none"
                    required
                  />
                  <span className="text-[10px] text-slate-500">
                    Perangkat offline yang kurang dari waktu ini tidak akan dimasukkan otomatis ke laporan harian.
                  </span>
                </div>
              </div>

              {/* Standard Issues Management */}
              <div className="flex flex-col gap-2 mt-2">
                <label className="text-xs font-semibold text-slate-400">
                  Daftar Pilihan Issue Standar (Dropdown)
                </label>
                
                {canUpdate && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newIssue}
                      onChange={(e) => setNewIssue(e.target.value)}
                      placeholder="Contoh: Kabel Digigit Tikus..."
                      className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 focus:border-blue-500 outline-none flex-1"
                    />
                    <button
                      type="button"
                      onClick={handleAddIssue}
                      className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-4 rounded-lg text-xs transition"
                    >
                      Tambah
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 mt-2 p-3 bg-slate-900/50 border border-slate-700/50 rounded-lg max-h-48 overflow-y-auto">
                  {settings.standard_issues.map((issue) => (
                    <div
                      key={issue}
                      className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 text-slate-200 text-xs px-2.5 py-1 rounded-full"
                    >
                      <span>{issue}</span>
                      {canUpdate && (
                        <button
                          type="button"
                          onClick={() => handleRemoveIssue(issue)}
                          className="text-slate-400 hover:text-red-400 transition"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeSubTab === "sync" && (
            <div className="flex flex-col gap-4">
              <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                2. Parameter Sinkronisasi & Monitoring
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400">
                    Interval Ping Perangkat (Detik)
                  </label>
                  <input
                    type="number"
                    min="2"
                    readOnly={!canUpdate}
                    value={settings.ping_interval_seconds}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        ping_interval_seconds: parseInt(e.target.value) || 5,
                      })
                    }
                    className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:border-blue-500 outline-none"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400">
                    Timeout Ping Perangkat (Detik)
                  </label>
                  <input
                    type="number"
                    min="1"
                    readOnly={!canUpdate}
                    value={settings.ping_timeout_seconds}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        ping_timeout_seconds: parseInt(e.target.value) || 15,
                      })
                    }
                    className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:border-blue-500 outline-none"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400">
                    Interval Broadcast Core (Detik)
                  </label>
                  <input
                    type="number"
                    min="2"
                    readOnly={!canUpdate}
                    value={settings.core_broadcast_interval_seconds || 10}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        core_broadcast_interval_seconds: parseInt(e.target.value) || 10,
                      })
                    }
                    className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:border-blue-500 outline-none"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400">
                    Interval Sinkronisasi Ruijie (Detik)
                  </label>
                  <input
                    type="number"
                    min="5"
                    readOnly={!canUpdate}
                    value={settings.sync_ruijie_interval_seconds || 60}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        sync_ruijie_interval_seconds: parseInt(e.target.value) || 60,
                      })
                    }
                    className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:border-blue-500 outline-none"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400">
                    Interval Sinkronisasi MikroTik (Detik)
                  </label>
                  <input
                    type="number"
                    min="5"
                    readOnly={!canUpdate}
                    value={settings.sync_mikrotik_interval_seconds || 60}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        sync_mikrotik_interval_seconds: parseInt(e.target.value) || 60,
                      })
                    }
                    className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:border-blue-500 outline-none"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400">
                    Interval Sinkronisasi Mappings (Detik)
                  </label>
                  <input
                    type="number"
                    min="5"
                    readOnly={!canUpdate}
                    value={settings.sync_mappings_interval_seconds || 60}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        sync_mappings_interval_seconds: parseInt(e.target.value) || 60,
                      })
                    }
                    className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:border-blue-500 outline-none"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400">
                    Delay Alarm Offline (ms)
                  </label>
                  <input
                    type="number"
                    min="0"
                    readOnly={!canUpdate}
                    value={settings.alarm_delay_ms ?? 1500}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        alarm_delay_ms: parseInt(e.target.value) || 0,
                      })
                    }
                    className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:border-blue-500 outline-none"
                    required
                  />
                  <span className="text-[10px] text-slate-500">
                    Delay sebelum alarm berbunyi setelah notif offline diterima. Berguna untuk menghindari false alarm akibat fluktuasi singkat.
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400">
                    Jenis Suara Alarm
                  </label>
                  <select
                    disabled={!canUpdate}
                    value={settings.alarm_sound || "beep"}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        alarm_sound: e.target.value,
                      })
                    }
                    className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:border-blue-500 outline-none"
                    required
                  >
                    <option value="beep">Beep (Default - Nada Kotak 4x)</option>
                    <option value="siren">Siren (Nada Naik-Turun Sawtooth)</option>
                    <option value="alert">Alert (3 Nada Cepat)</option>
                    <option value="ping">Ping (Nada Sine Lembut)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {canUpdate && (
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-700/50">
              <button
                type="submit"
                disabled={saving}
                className="cursor-pointer flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-2 px-6 rounded-lg text-xs transition"
              >
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                Simpan Konfigurasi
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

export default function SettingsWrapper(props) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/settings") {
      router.replace("/settings/core");
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
      passwordUpdate: hasAccess(userData, "settings-password", "update"),
      systemRead: hasAccess(userData, "settings-system", "read"),
      systemUpdate: hasAccess(userData, "settings-system", "update"),
    });
  };
  const searchParams = useSearchParams();
  const activeTab = activeTabProp || searchParams.get("tab") || "core";

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

  return (
    <div className="h-full min-h-0 overflow-y-auto flex flex-col gap-6 max-w-4xl mx-auto w-full pb-4">
      <div>
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-3">
          {" "}
          <Shield size={24} /> Pengaturan Sistem
        </h1>
        <p className="text-xs text-slate-400">
          Konfigurasi pusat untuk NOCR dan Perangkat Core
        </p>
      </div>

      <div>
        {/* Content Settings - full width, tab driven by URL */}
        <div>
          {activeTab === "core" && (
            <div className="bg-slate-800 border border-slate-700/50 rounded-xl overflow-hidden shadow-lg">
              <div className="p-5 border-b border-slate-700/50">
                <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Server size={20} /> MikroTik Gateway
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Router utama ini akan menjadi pusat monitoring untuk PPPoE,
                  ONT, dan interface pelanggan lainnya.
                </p>
              </div>
              <div className="p-5">
                <form onSubmit={handleSaveCore} className="flex flex-col gap-4">
                  <div
                    className={`grid grid-cols-2 gap-4 ${!perms.mikrotikUpdate ? "opacity-90" : ""}`}
                  >
                    <div className="flex flex-col gap-1.5 col-span-2 md:col-span-1">
                      <label className="text-xs font-semibold text-slate-400">
                        Nama Router
                      </label>
                      <input
                        type="text"
                        readOnly={!perms.mikrotikUpdate}
                        value={coreDevice.name}
                        onChange={(e) =>
                          setCoreDevice({ ...coreDevice, name: e.target.value })
                        }
                        className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:border-blue-500 outline-none"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 col-span-2 md:col-span-1">
                      <label className="text-xs font-semibold text-slate-400">
                        IP Address
                      </label>
                      <input
                        type="text"
                        readOnly={!perms.mikrotikUpdate}
                        value={coreDevice.ip_address}
                        onChange={(e) =>
                          setCoreDevice({
                            ...coreDevice,
                            ip_address: e.target.value,
                          })
                        }
                        placeholder="Contoh: 192.168.100.1"
                        className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:border-blue-500 outline-none"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 col-span-2 md:col-span-1">
                      <label className="text-xs font-semibold text-slate-400">
                        Username API
                      </label>
                      <input
                        type="text"
                        readOnly={!perms.mikrotikUpdate}
                        value={coreDevice.username}
                        onChange={(e) =>
                          setCoreDevice({
                            ...coreDevice,
                            username: e.target.value,
                          })
                        }
                        className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:border-blue-500 outline-none"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 col-span-2 md:col-span-1">
                      <label className="text-xs font-semibold text-slate-400">
                        Password API
                      </label>
                      <div className="relative">
                        <input
                          type={showCorePassword && perms.mikrotikUpdate ? "text" : "password"}
                          readOnly={!perms.mikrotikUpdate}
                          value={coreDevice.password}
                          onChange={(e) =>
                            setCoreDevice({
                              ...coreDevice,
                              password: e.target.value,
                            })
                          }
                          placeholder={
                            existingId
                              ? "Kosongkan jika tidak diubah"
                              : "Masukkan password"
                          }
                          className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:border-blue-500 outline-none w-full pr-10"
                        />
                        <button
                          type="button"
                          disabled={!perms.mikrotikUpdate}
                          onClick={() => perms.mikrotikUpdate && setShowCorePassword(!showCorePassword)}
                          className={`absolute right-3 top-1/2 -translate-y-1/2 ${perms.mikrotikUpdate ? "cursor-pointer text-slate-500 hover:text-slate-300" : "text-slate-600 cursor-not-allowed opacity-50"}`}
                          title={perms.mikrotikUpdate ? "" : "Anda hanya memiliki akses baca"}
                        >
                          {showCorePassword && perms.mikrotikUpdate ? (
                            <EyeOff size={16} />
                          ) : (
                            <Eye size={16} />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 col-span-2 md:col-span-1">
                      <label className="text-xs font-semibold text-slate-400">
                        Port API
                      </label>
                      <input
                        type="number"
                        readOnly={!perms.mikrotikUpdate}
                        value={coreDevice.port}
                        onChange={(e) =>
                          setCoreDevice({
                            ...coreDevice,
                            port: parseInt(e.target.value),
                          })
                        }
                        className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:border-blue-500 outline-none"
                        required
                      />
                    </div>
                  </div>

                  {perms.mikrotikUpdate && (
                    <div className="mt-4 flex justify-end">
                      <button
                        type="submit"
                        className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition shadow-lg shadow-blue-500/20"
                      >
                        <Save size={16} /> Simpan Konfigurasi
                      </button>
                    </div>
                  )}
                </form>
              </div>
            </div>
          )}

          {activeTab === "vpn" && (
            <div className="bg-slate-800 border border-slate-700/50 rounded-xl overflow-hidden shadow-lg">
              <div className="p-5 border-b border-slate-700/50 flex justify-between items-start">
                <div>
                  <h2 className="text-base font-bold text-emerald-400 flex items-center gap-2">
                    <Network size={20} /> VPN Connection (Windows / Linux)
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Biarkan backend memanggil koneksi VPN secara otomatis saat
                    jaringan terputus. Pada Windows menggunakan profil VPN
                    Windows (rasdial), sedangkan pada Linux menggunakan
                    PPPoE/VPN peers (pon/poff).
                  </p>
                </div>
              </div>
              <div className="p-5">
                <form onSubmit={handleSaveVpn} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-6">
                    {/* Platform Selector */}
                    <div className="flex flex-col gap-2 max-w-md">
                      <label className="text-xs font-semibold text-slate-400">
                        Pilih Platform VPN
                      </label>
                      <div className="grid grid-cols-2 bg-slate-900 p-1.5 rounded-lg border border-slate-700 gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setVpnConfig({
                              ...vpnConfig,
                              active_platform: "windows",
                            })
                          }
                          className={`cursor-pointer py-2 px-4 text-xs font-bold rounded-md transition-all duration-200 flex items-center justify-center gap-2 ${
                            vpnConfig.active_platform === "windows"
                              ? "bg-blue-600 text-white shadow-md"
                              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                          }`}
                        >
                          <Monitor size={14} />
                          Windows (rasdial)
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setVpnConfig({
                              ...vpnConfig,
                              active_platform: "linux",
                            })
                          }
                          className={`cursor-pointer py-2 px-4 text-xs font-bold rounded-md transition-all duration-200 flex items-center justify-center gap-2 ${
                            vpnConfig.active_platform === "linux"
                              ? "bg-orange-600 text-white shadow-md"
                              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                          }`}
                        >
                          <Terminal size={14} />
                          Linux (pon/poff)
                        </button>
                      </div>
                    </div>

                    <div className="border-t border-slate-700/50 my-1"></div>

                    {/* Conditional Platform Forms */}
                    {vpnConfig.active_platform === "windows" ? (
                      <div className="flex flex-col gap-4 max-w-xl transition-all duration-300">
                        <div className="flex items-center gap-2 pb-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                          <h3 className="text-xs font-bold text-slate-200">
                            Konfigurasi Windows
                          </h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="flex flex-col gap-1.5 col-span-2">
                            <label className="text-xs font-semibold text-slate-400">
                              Nama Profil VPN (rasdial)
                            </label>
                            <input
                              type="text"
                              readOnly={!perms.vpnUpdate}
                              value={vpnConfig.windows_name}
                              onChange={(e) =>
                                setVpnConfig({
                                  ...vpnConfig,
                                  windows_name: e.target.value,
                                })
                              }
                              placeholder='Contoh: "VPN_DISKOMINFO_KABBDG"'
                              className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:border-emerald-500 outline-none"
                            />
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-slate-400">
                              Username VPN (Opsional)
                            </label>
                            <input
                              type="text"
                              readOnly={!perms.vpnUpdate}
                              value={vpnConfig.windows_username}
                              onChange={(e) =>
                                setVpnConfig({
                                  ...vpnConfig,
                                  windows_username: e.target.value,
                                })
                              }
                              className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:border-emerald-500 outline-none"
                            />
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-slate-400">
                              Password VPN (Opsional)
                            </label>
                            <div className="relative">
                              <input
                                type={showVpnPassword && perms.vpnUpdate ? "text" : "password"}
                                value={vpnConfig.windows_password}
                                onChange={(e) =>
                                  setVpnConfig({
                                    ...vpnConfig,
                                    windows_password: e.target.value,
                                  })
                                }
                                className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:border-emerald-500 outline-none w-full pr-10"
                              />
                              <button
                                type="button"
                                disabled={!perms.vpnUpdate}
                                onClick={() => perms.vpnUpdate && setShowVpnPassword(!showVpnPassword)}
                                className={`absolute right-3 top-1/2 -translate-y-1/2 ${perms.vpnUpdate ? "text-slate-500 hover:text-slate-300" : "text-slate-600 cursor-not-allowed opacity-50"}`}
                                title={perms.vpnUpdate ? "" : "Anda hanya memiliki akses baca"}
                              >
                                {showVpnPassword && perms.vpnUpdate ? (
                                  <EyeOff size={16} />
                                ) : (
                                  <Eye size={16} />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4 max-w-xl transition-all duration-300">
                        <div className="flex items-center gap-2 pb-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                          <h3 className="text-xs font-bold text-slate-200">
                            Konfigurasi Linux
                          </h3>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-slate-400">
                            Nama Peer / PPPoE (pon/poff)
                          </label>
                          <input
                            type="text"
                            value={vpnConfig.linux_name}
                            onChange={(e) =>
                              setVpnConfig({
                                ...vpnConfig,
                                linux_name: e.target.value,
                              })
                            }
                            placeholder='Contoh: "diskominfo"'
                            className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:border-emerald-500 outline-none"
                          />
                        </div>

                        <div className="bg-slate-900/50 border border-slate-700/50 p-4 rounded-lg flex flex-col gap-2 mt-2">
                          <div className="flex items-center gap-2 text-xs font-semibold text-orange-400">
                            <Terminal size={14} />
                            Info Penggunaan pon/poff
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            Koneksi VPN pada sistem operasi Linux tidak
                            memerlukan input Username dan Password di sini.
                            Sistem akan memanggil perintah{" "}
                            <code className="bg-slate-950 px-1.5 py-0.5 rounded text-amber-500 font-mono">
                              pon [nama]
                            </code>{" "}
                            dan{" "}
                            <code className="bg-slate-950 px-1.5 py-0.5 rounded text-amber-500 font-mono">
                              poff [nama]
                            </code>{" "}
                            menggunakan konfigurasi peers yang sudah ada di file{" "}
                            <code className="bg-slate-950 px-1.5 py-0.5 rounded text-amber-500 font-mono">
                              /etc/ppp/peers/[nama]
                            </code>
                            .
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center mt-4">
                    <div className="flex items-center gap-2">
                      {perms.vpnUpdate && (
                        <>
                          <button
                            type="button"
                            onClick={testVpnConnect}
                            disabled={vpnConnecting}
                            className="cursor-pointer bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg text-xs transition"
                          >
                            Tes Hubungkan
                          </button>
                          <button
                            type="button"
                            onClick={testVpnDisconnect}
                            disabled={vpnConnecting}
                            className="cursor-pointer bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg text-xs transition"
                          >
                            Putuskan
                          </button>
                        </>
                      )}
                    </div>
                    {perms.vpnUpdate && (
                      <button
                        type="submit"
                        className="cursor-pointer flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-6 rounded-lg text-xs transition"
                      >
                        <Save size={16} /> Simpan Pengaturan
                      </button>
                    )}
                  </div>
                  {vpnMsg && (
                    <div className="mt-2 text-xs bg-slate-900 border border-slate-700 p-2 rounded-md text-slate-300 font-mono break-all">
                      {vpnMsg}
                    </div>
                  )}
                </form>
              </div>
            </div>
          )}

          {activeTab === "users" && perms.usersRead && (
            <UserManagement
              canCreate={perms.usersCreate}
              canUpdate={perms.usersUpdate}
              canDelete={perms.usersDelete}
            />
          )}

          {activeTab === "roles" && perms.rolesRead && (
            <RoleSettings
              showToast={showToast}
              canCreate={perms.rolesCreate}
              canUpdate={perms.rolesUpdate}
              canDelete={perms.rolesDelete}
            />
          )}

          {activeTab === "password" && (
            <PasswordChangeSettings canUpdate={perms.passwordUpdate} />
          )}

          {activeTab === "health" && (
            <SystemHealth isAdmin={perms.healthUpdate} />
          )}

          {activeTab === "whatsapp" && perms.waRead && (
            <WhatsAppGateway
              canCreate={perms.waCreate}
              canUpdate={perms.waUpdate}
              canDelete={perms.waDelete}
            />
          )}

          {activeTab === "system" && perms.systemRead && (
            <SystemConfigSettings
              canUpdate={perms.systemUpdate}
            />
          )}
        </div>
      </div>
    </div>
  );
}
