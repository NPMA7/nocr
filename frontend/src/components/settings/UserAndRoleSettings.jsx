"use client";
import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  User,
  Shield,
  Plus,
  Trash2,
  Pencil,
  Key,
  Eye,
  EyeOff,
  UserPlus,
  Save,
  X,
  Check,
  CheckCircle2,
  RotateCw,
  Lock
} from "lucide-react";
import { MENUS, ACTIONS, getStoredUser, isSuperAdmin } from "@/lib/roles";
import { API_URL, useAppState } from "@/App";

export default function UserAndRoleSettings({
  userPerms = { canRead: true, canCreate: true, canUpdate: true, canDelete: true },
  rolePerms = { canRead: true, canCreate: true, canUpdate: true, canDelete: true },
}) {
  const { showToast, sessionUser } = useAppState();
  const currentUser = sessionUser?.username ? sessionUser : getStoredUser();
  const requestorRole = (currentUser?.role || "").toLowerCase().trim();
  const isCallerAdmin = isSuperAdmin(currentUser) || requestorRole === "superadmin" || requestorRole === "admin";

  // ─── States: Users ───
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userForm, setUserForm] = useState({ username: "", password: "", role: "visitor" });
  const [showPassword, setShowPassword] = useState(false);
  const [userError, setUserError] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);
  const [roleEdits, setRoleEdits] = useState({});
  const [savingRoleId, setSavingRoleId] = useState(null);
  const [deleteConfirmUserId, setDeleteConfirmUserId] = useState(null);

  // Password reset modal
  const [selectedUserForPassword, setSelectedUserForPassword] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // ─── States: Roles ───
  const [roles, setRoles] = useState([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleEditMode, setRoleEditMode] = useState(false);
  const [roleFormId, setRoleFormId] = useState(null);
  const [roleFormName, setRoleFormName] = useState("");
  const [roleFormDesc, setRoleFormDesc] = useState("");
  const [roleFormPerms, setRoleFormPerms] = useState({});
  const [savingRole, setSavingRole] = useState(false);
  const [deleteConfirmRole, setDeleteConfirmRole] = useState(null);

  // ─── Fetchers ───
  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await axios.get(`${API_URL}/auth/users`);
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setUsers([]);
      if (showToast) showToast(err.response?.data?.error || "Gagal memuat pengguna", "error");
    } finally {
      setLoadingUsers(false);
      setRoleEdits({});
    }
  };

  const fetchRoles = async () => {
    setLoadingRoles(true);
    try {
      const res = await axios.get(`${API_URL}/roles`);
      const rolesData = Array.isArray(res.data) ? res.data : [];
      setRoles(rolesData);
      const assignable = rolesData.filter((r) => {
        const rName = (r.name || "").toLowerCase().trim();
        if (!isCallerAdmin && (rName === "superadmin" || rName === "admin")) return false;
        return true;
      });
      if (assignable.length > 0 && (!userForm.role || (!isCallerAdmin && (userForm.role === "superadmin" || userForm.role === "admin")))) {
        setUserForm((prev) => ({ ...prev, role: assignable[0].name }));
      }
    } catch (err) {
      setRoles([]);
      if (showToast) showToast(err.response?.data?.error || "Gagal memuat role", "error");
    } finally {
      setLoadingRoles(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  // ─── User Actions ───
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setUserError("");
    const roleToAssign = (userForm.role || "").toLowerCase().trim();
    if (!isCallerAdmin && (roleToAssign === "superadmin" || roleToAssign === "admin")) {
      setUserError("Akses ditolak: Hanya Super Admin yang dapat menunjuk role Super Admin.");
      return;
    }
    setCreatingUser(true);
    try {
      await axios.post(`${API_URL}/auth/users`, {
        username: userForm.username.trim(),
        password: userForm.password,
        role: userForm.role,
      });
      const assignable = roles.filter((r) => {
        const rName = (r.name || "").toLowerCase().trim();
        if (!isCallerAdmin && (rName === "superadmin" || rName === "admin")) return false;
        return true;
      });
      setUserForm({ username: "", password: "", role: assignable[0]?.name || "visitor" });
      if (showToast) showToast("Pengguna baru berhasil dibuat!", "success");
      fetchUsers();
    } catch (err) {
      setUserError(err.response?.data?.error || err.message);
    } finally {
      setCreatingUser(false);
    }
  };

  const handleUpdateUserRole = async (userId) => {
    const newRole = roleEdits[userId];
    if (!newRole) return;
    const normalizedNew = (newRole || "").toLowerCase().trim();
    if (!isCallerAdmin && (normalizedNew === "superadmin" || normalizedNew === "admin")) {
      if (showToast) showToast("Akses ditolak: Hanya Super Admin yang dapat menunjuk role Super Admin", "error");
      return;
    }
    const current = users.find((u) => u.id === userId);
    if (current && current.role === newRole) return;

    setSavingRoleId(userId);
    try {
      await axios.patch(`${API_URL}/auth/users/${userId}`, { role: newRole });
      if (showToast) showToast("Role pengguna berhasil diperbarui!", "success");
      await fetchUsers();
    } catch (err) {
      if (showToast) showToast(err.response?.data?.error || err.message, "error");
    } finally {
      setSavingRoleId(null);
    }
  };

  const confirmDeleteUser = async () => {
    if (!deleteConfirmUserId) return;
    const targetId = deleteConfirmUserId;
    setDeleteConfirmUserId(null);
    try {
      await axios.delete(`${API_URL}/auth/users/${targetId}`);
      if (showToast) showToast("Pengguna berhasil dihapus", "success");
      fetchUsers();
    } catch (err) {
      if (showToast) showToast(err.response?.data?.error || err.message, "error");
    }
  };

  const handleAdminChangePassword = async (e) => {
    e.preventDefault();
    if (!selectedUserForPassword || !newPassword.trim()) return;
    setChangingPassword(true);
    try {
      await axios.patch(`${API_URL}/auth/users/${selectedUserForPassword.id}`, {
        password: newPassword,
      });
      if (showToast) {
        showToast(`Password untuk ${selectedUserForPassword.username} berhasil diubah`, "success");
      }
      setSelectedUserForPassword(null);
      setNewPassword("");
    } catch (err) {
      if (showToast) showToast(err.response?.data?.error || err.message, "error");
    } finally {
      setChangingPassword(false);
    }
  };

  // ─── Role Actions ───
  const openCreateRole = () => {
    setRoleEditMode(false);
    setRoleFormId(null);
    setRoleFormName("");
    setRoleFormDesc("");
    setRoleFormPerms({});
    setShowRoleModal(true);
  };

  const openEditRole = (r) => {
    const rName = (r.name || "").toLowerCase().trim();
    if (rName === "superadmin") {
      if (showToast) showToast("Role Super Admin bawaan tidak bisa diedit.", "error");
      return;
    }
    if (!isCallerAdmin && rName === requestorRole) {
      if (showToast) showToast("Anda tidak dapat mengedit hak akses role Anda sendiri.", "error");
      return;
    }
    setRoleEditMode(true);
    setRoleFormId(r.id);
    setRoleFormName(r.name);
    setRoleFormDesc(r.description || "");
    let perms = {};
    try {
      const parsed = typeof r.permissions === "string" ? JSON.parse(r.permissions) : r.permissions;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) perms = parsed;
    } catch {}
    setRoleFormPerms(perms || {});
    setShowRoleModal(true);
  };

  const toggleRolePerm = (menu, action) => {
    setRoleFormPerms((prev) => {
      const menuPerms = prev[menu] || [];
      const newMenuPerms = menuPerms.includes(action)
        ? menuPerms.filter((a) => a !== action)
        : [...menuPerms, action];
      return { ...prev, [menu]: newMenuPerms };
    });
  };

  const selectAllRolePerms = () => {
    const all = {};
    Object.keys(MENUS).forEach((m) => {
      all[m] = [...ACTIONS];
    });
    setRoleFormPerms(all);
  };

  const clearAllRolePerms = () => {
    setRoleFormPerms({});
  };

  const handleSaveRole = async () => {
    if (!roleFormName.trim()) {
      if (showToast) showToast("Nama role tidak boleh kosong", "error");
      return;
    }
    setSavingRole(true);
    try {
      if (roleEditMode) {
        await axios.patch(`/api/roles/${roleFormId}`, {
          name: roleFormName.trim(),
          description: roleFormDesc.trim(),
          permissions: roleFormPerms,
        });
        if (showToast) showToast("Role berhasil diperbarui!", "success");
      } else {
        await axios.post("/api/roles", {
          name: roleFormName.trim(),
          description: roleFormDesc.trim(),
          permissions: roleFormPerms,
        });
        if (showToast) showToast("Role baru berhasil ditambahkan!", "success");
      }
      setShowRoleModal(false);
      fetchRoles();
    } catch (err) {
      if (showToast) showToast(err.response?.data?.error || "Gagal menyimpan role", "error");
    } finally {
      setSavingRole(false);
    }
  };

  const confirmDeleteRole = async () => {
    if (!deleteConfirmRole) return;
    const target = deleteConfirmRole;
    setDeleteConfirmRole(null);
    try {
      await axios.delete(`/api/roles/${target.id}`);
      if (showToast) showToast(`Role ${target.name} berhasil dihapus`, "success");
      fetchRoles();
    } catch (err) {
      if (showToast) showToast(err.response?.data?.error || "Gagal menghapus role", "error");
    }
  };

  const assignableRoles = roles.filter((r) => {
    const rName = (r.name || "").toLowerCase().trim();
    if (!isCallerAdmin && (rName === "superadmin" || rName === "admin")) {
      return false;
    }
    return true;
  });

  const filteredRoles = roles.filter((r) => {
    const rName = (r.name || "").toLowerCase().trim();
    if (!isCallerAdmin && (rName === "superadmin" || rName === "admin")) {
      return false;
    }
    return true;
  });

  const filteredUsers = users.filter((u) => {
    const uRole = (u.role || "").toLowerCase().trim();
    if (!isCallerAdmin && (uRole === "superadmin" || uRole === "admin")) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* ─── Unified 2-Column Responsive Bento Layout ─── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3.5 items-start">
        {/* ═════════════════════════════════════════════════════════════ */}
        {/* KOLOM KIRI: AKUN PENGGUNA (xl:col-span-7)                    */}
        {/* ═════════════════════════════════════════════════════════════ */}
        <div className="xl:col-span-7 bg-slate-900/70 border border-slate-800 rounded-lg p-3.5 md:p-4 backdrop-blur-sm transition-all space-y-3.5">
          {/* Header Card */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-slate-800/90 border border-slate-700/60 flex items-center justify-center text-sky-400 flex-shrink-0">
                <User size={14} />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-200 tracking-wide uppercase">
                  Akun Pengguna Sistem
                </span>
                <p className="text-[10px] text-slate-400 font-mono">
                  Daftar akun login dan penetapan hak akses
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/50 text-slate-300">
                {filteredUsers.length} AKUN
              </span>
              <button
                onClick={fetchUsers}
                disabled={loadingUsers}
                className={`p-1.5 rounded-md bg-slate-800/90 hover:bg-slate-700/80 border border-slate-700/60 text-slate-400 hover:text-slate-200 transition ${
                  loadingUsers ? "animate-spin text-sky-400" : ""
                }`}
                title="Refresh Daftar Pengguna"
              >
                <RotateCw size={12} />
              </button>
            </div>
          </div>

          {/* Inline Create User Form */}
          {userPerms.canCreate && (
            <form
              onSubmit={handleCreateUser}
              className="bg-slate-950/70 border border-slate-800 rounded-lg p-2.5 space-y-2"
            >
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <UserPlus size={12} className="text-sky-400" />
                <span>Tambah Pengguna Baru</span>
              </div>

              {userError && (
                <div className="text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded">
                  {userError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-4">
                  <input
                    type="text"
                    value={userForm.username}
                    onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                    placeholder="Username baru..."
                    required
                    className="w-full bg-slate-900 border border-slate-800 hover:border-slate-700 focus:border-sky-500 rounded-md px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-600 outline-none transition"
                  />
                </div>

                <div className="sm:col-span-4 relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    placeholder="Password..."
                    required
                    className="w-full bg-slate-900 border border-slate-800 hover:border-slate-700 focus:border-sky-500 rounded-md pl-2.5 pr-8 py-1.5 text-xs text-slate-100 placeholder-slate-600 outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>

                <div className="sm:col-span-2">
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 hover:border-slate-700 focus:border-sky-500 rounded-md px-2 py-1.5 text-xs text-slate-200 capitalize outline-none transition cursor-pointer"
                  >
                    {assignableRoles.length > 0 ? (
                      assignableRoles.map((r) => (
                        <option key={r.id} value={r.name} className="capitalize">
                          {r.name === "superadmin" ? "Super Admin" : r.name}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="visitor">Visitor</option>
                        <option value="editor">Editor</option>
                        {isCallerAdmin && <option value="superadmin">Super Admin</option>}
                      </>
                    )}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={creatingUser}
                    className="w-full bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-medium px-2.5 py-1.5 rounded-md text-xs transition flex items-center justify-center gap-1 cursor-pointer shadow-sm"
                  >
                    <Plus size={13} />
                    <span>{creatingUser ? "..." : "Tambah"}</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* User Table */}
          <div className="overflow-x-auto rounded-lg border border-slate-800/80">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 text-[10px] font-mono uppercase tracking-wider">
                  <th className="px-3.5 py-2.5">Akun Pengguna</th>
                  <th className="px-3.5 py-2.5">Role Akses</th>
                  <th className="px-3.5 py-2.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loadingUsers ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-500 animate-pulse">
                      Memuat daftar pengguna...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                      Belum ada pengguna terdaftar.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const editRole = roleEdits[u.id] ?? u.role;
                    const roleDirty = editRole !== u.role;
                    const isUserSuperAdmin = (u.role || "").toLowerCase() === "superadmin";
                    const isSelf = u.id === currentUser?.id || u.username === currentUser?.username;

                    return (
                      <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-3.5 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-slate-800 border border-slate-700/60 flex items-center justify-center text-slate-300 font-mono text-[11px] font-bold flex-shrink-0">
                              {(u.username || "U")[0].toUpperCase()}
                            </div>
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-semibold text-slate-200 truncate">
                                {u.username}
                              </span>
                              {isUserSuperAdmin && (
                                <span className="text-[9px] bg-amber-950/80 text-amber-300 border border-amber-800/70 px-1.5 py-0.2 rounded font-mono font-bold">
                                  SUPERADMIN
                                </span>
                              )}
                              {isSelf && (
                                <span className="text-[9px] bg-sky-950/60 text-sky-300 border border-sky-800/50 px-1.5 py-0.2 rounded font-mono">
                                  YOU
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-3.5 py-2.5">
                          <div className="flex items-center gap-1.5">
                            {isUserSuperAdmin && !isCallerAdmin ? (
                              <span className="text-xs text-amber-400 font-medium capitalize">
                                Super Admin
                              </span>
                            ) : (
                              <select
                                value={editRole}
                                disabled={
                                  !userPerms.canUpdate ||
                                  (!isCallerAdmin && isSelf) ||
                                  savingRoleId === u.id
                                }
                                title={
                                  !isCallerAdmin && isSelf
                                    ? "Tidak dapat mengubah role akun Anda sendiri"
                                    : ""
                                }
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setRoleEdits((prev) => ({ ...prev, [u.id]: val }));
                                }}
                                className={`bg-slate-950/70 border rounded-md px-2 py-1 text-xs text-slate-200 capitalize outline-none transition cursor-pointer ${
                                  roleDirty
                                    ? "border-sky-500 ring-1 ring-sky-500/30"
                                    : "border-slate-800 hover:border-slate-700"
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                              >
                                {assignableRoles.map((r) => (
                                  <option key={r.id} value={r.name} className="capitalize">
                                    {r.name === "superadmin" ? "Super Admin" : r.name}
                                  </option>
                                ))}
                              </select>
                            )}

                            {roleDirty && (
                              <button
                                onClick={() => handleUpdateUserRole(u.id)}
                                disabled={savingRoleId === u.id}
                                className="px-2 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-medium flex items-center gap-1 transition cursor-pointer"
                                title="Simpan Perubahan Role"
                              >
                                <Check size={12} />
                                <span>{savingRoleId === u.id ? "..." : "Simpan"}</span>
                              </button>
                            )}
                          </div>
                        </td>

                        <td className="px-3.5 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {userPerms.canUpdate && (isCallerAdmin || !isUserSuperAdmin) && (
                              <button
                                onClick={() => {
                                  setSelectedUserForPassword(u);
                                  setNewPassword("");
                                }}
                                className="cursor-pointer p-1.5 rounded text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition"
                                title="Ubah Password Pengguna"
                              >
                                <Key size={13} />
                              </button>
                            )}

                            {userPerms.canDelete && (isCallerAdmin || !isUserSuperAdmin) && !isSelf && (
                              <button
                                onClick={() => setDeleteConfirmUserId(u.id)}
                                className="cursor-pointer p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                                title="Hapus Pengguna"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ═════════════════════════════════════════════════════════════ */}
        {/* KOLOM KANAN: MANAJEMEN ROLE & AKSES (xl:col-span-5)          */}
        {/* ═════════════════════════════════════════════════════════════ */}
        <div className="xl:col-span-5 bg-slate-900/70 border border-slate-800 rounded-lg p-3.5 md:p-4 backdrop-blur-sm transition-all space-y-3.5">
          {/* Header Card */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-slate-800/90 border border-slate-700/60 flex items-center justify-center text-sky-400 flex-shrink-0">
                <Shield size={14} />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-200 tracking-wide uppercase">
                  Role & Hak Akses
                </span>
                <p className="text-[10px] text-slate-400 font-mono">
                  Matriks perizinan dan proteksi menu
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/50 text-slate-300">
                {filteredRoles.length} ROLE
              </span>
              {rolePerms.canCreate && (
                <button
                  onClick={openCreateRole}
                  className="cursor-pointer px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-semibold flex items-center gap-1 transition shadow-sm"
                  title="Tambah Role Baru"
                >
                  <Plus size={13} />
                  <span>Role</span>
                </button>
              )}
            </div>
          </div>

          {/* Role Table */}
          <div className="overflow-x-auto rounded-lg border border-slate-800/80">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 text-[10px] font-mono uppercase tracking-wider">
                  <th className="px-3.5 py-2.5">Nama Role</th>
                  <th className="px-3.5 py-2.5">Hak Akses</th>
                  <th className="px-3.5 py-2.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loadingRoles ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-500 animate-pulse">
                      Memuat data role...
                    </td>
                  </tr>
                ) : filteredRoles.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                      Belum ada role tambahan.
                    </td>
                  </tr>
                ) : (
                  filteredRoles.map((r) => {
                    let perms = {};
                    try {
                      const parsed =
                        typeof r.permissions === "string"
                          ? JSON.parse(r.permissions)
                          : r.permissions;
                      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                        perms = parsed;
                      }
                    } catch {}

                    const configuredMenus = Object.keys(perms).filter(
                      (k) => perms[k] && perms[k].length > 0
                    ).length;

                    const rName = (r.name || "").toLowerCase().trim();
                    const isSuperAdminRole = rName === "superadmin";
                    const isOwnRole = rName === requestorRole;
                    const isBuiltin = ["superadmin", "editor", "visitor"].includes(rName);

                    return (
                      <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-3.5 py-2.5">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              {isSuperAdminRole ? (
                                <span className="font-bold text-amber-400 flex items-center gap-1">
                                  <Shield size={12} className="text-amber-400" /> Super Admin
                                </span>
                              ) : (
                                <span className="font-semibold text-slate-200 capitalize">
                                  {r.name}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 truncate max-w-[150px]">
                              {r.description || "-"}
                            </span>
                          </div>
                        </td>

                        <td className="px-3.5 py-2.5">
                          {isSuperAdminRole ? (
                            <span className="text-[9.5px] font-mono font-bold bg-amber-950/60 text-amber-300 border border-amber-800/60 px-2 py-0.5 rounded">
                              Master All Access
                            </span>
                          ) : configuredMenus === 0 ? (
                            <span className="text-[10px] text-slate-500 italic">
                              Tidak ada akses
                            </span>
                          ) : (
                            <span className="text-[9.5px] font-mono bg-slate-800 text-slate-300 border border-slate-700/60 px-2 py-0.5 rounded">
                              {configuredMenus} Menu Diatur
                            </span>
                          )}
                        </td>

                        <td className="px-3.5 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {rolePerms.canUpdate && (
                              <button
                                onClick={() => openEditRole(r)}
                                disabled={isSuperAdminRole || (!isCallerAdmin && isOwnRole)}
                                className="cursor-pointer p-1.5 rounded text-slate-400 hover:text-sky-300 hover:bg-slate-800 transition disabled:opacity-30 disabled:cursor-not-allowed"
                                title={
                                  isSuperAdminRole
                                    ? "Superadmin tidak dapat diedit"
                                    : !isCallerAdmin && isOwnRole
                                    ? "Tidak dapat mengedit role sendiri"
                                    : "Edit Hak Akses Role"
                                }
                              >
                                <Pencil size={13} />
                              </button>
                            )}

                            {rolePerms.canDelete && (
                              <button
                                onClick={() => setDeleteConfirmRole(r)}
                                disabled={isBuiltin || isOwnRole}
                                className="cursor-pointer p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition disabled:opacity-30 disabled:cursor-not-allowed"
                                title={
                                  isBuiltin
                                    ? "Role bawaan sistem tidak bisa dihapus"
                                    : isOwnRole
                                    ? "Tidak dapat menghapus role sendiri"
                                    : "Hapus Role"
                                }
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ─── Modal 1: Ubah Password Pengguna (Admin Mode) ─── */}
      {selectedUserForPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-semibold text-slate-200 text-xs flex items-center gap-2">
                <Key size={14} className="text-amber-400" />
                Ubah Password Pengguna
              </h3>
              <button
                onClick={() => setSelectedUserForPassword(null)}
                className="cursor-pointer text-slate-400 hover:text-slate-200 transition"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAdminChangePassword} className="p-4 space-y-3">
              <p className="text-xs text-slate-300">
                Setel password baru untuk akun{" "}
                <span className="font-bold text-white font-mono bg-slate-800 px-1.5 py-0.5 rounded">
                  {selectedUserForPassword.username}
                </span>:
              </p>

              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Masukkan password baru..."
                  required
                  autoFocus
                  className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-sky-500 rounded-md pl-3 pr-9 py-2 text-xs text-slate-100 placeholder-slate-600 outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showNewPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedUserForPassword(null)}
                  className="px-3.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 font-medium transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={changingPassword || !newPassword.trim()}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 text-xs text-white font-semibold transition cursor-pointer shadow-sm disabled:opacity-50"
                >
                  <Key size={12} />
                  <span>{changingPassword ? "Menyimpan..." : "Simpan Password"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal 2: Konfirmasi Hapus Pengguna ─── */}
      {deleteConfirmUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-semibold text-rose-400 text-xs flex items-center gap-2">
                <Trash2 size={14} />
                Konfirmasi Hapus Pengguna
              </h3>
              <button
                onClick={() => setDeleteConfirmUserId(null)}
                className="cursor-pointer text-slate-400 hover:text-slate-200 transition"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-slate-300 leading-relaxed">
                Yakin ingin menghapus akun pengguna ini? Pengguna tidak akan dapat login lagi ke sistem NOCR.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmUserId(null)}
                  className="px-3.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 font-medium transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteUser}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-rose-600 hover:bg-rose-500 text-xs text-white font-semibold transition cursor-pointer shadow-sm"
                >
                  <Trash2 size={12} />
                  Ya, Hapus
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal 3: Konfirmasi Hapus Role ─── */}
      {deleteConfirmRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-semibold text-rose-400 text-xs flex items-center gap-2">
                <Trash2 size={14} />
                Konfirmasi Hapus Role
              </h3>
              <button
                onClick={() => setDeleteConfirmRole(null)}
                className="cursor-pointer text-slate-400 hover:text-slate-200 transition"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-slate-300 leading-relaxed">
                Yakin ingin menghapus role{" "}
                <span className="font-bold text-white font-mono bg-slate-800 px-1.5 py-0.5 rounded">
                  {deleteConfirmRole.name}
                </span>
                ? Pengguna dengan role ini akan kehilangan akses spesifik tersebut.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmRole(null)}
                  className="px-3.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 font-medium transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteRole}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-rose-600 hover:bg-rose-500 text-xs text-white font-semibold transition cursor-pointer shadow-sm"
                >
                  <Trash2 size={12} />
                  Ya, Hapus Role
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal 4: Edit / Tambah Matriks Perizinan Role ─── */}
      {showRoleModal && (
        <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg shadow-2xl max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-3.5 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center text-sky-400">
                  <Shield size={14} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wide">
                    {roleEditMode ? "Edit Konfigurasi Role" : "Tambah Role Baru"}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Tentukan nama role dan perizinan akses menu sistem
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRoleModal(false)}
                className="cursor-pointer text-slate-400 hover:text-white transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-3.5 max-h-[72vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Nama Role <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={roleFormName}
                    onChange={(e) => setRoleFormName(e.target.value)}
                    disabled={roleEditMode && roleFormName === "admin"}
                    placeholder="Contoh: support / engineer"
                    className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-sky-500 rounded-md px-3 py-1.5 text-xs text-white placeholder:text-slate-600 outline-none transition disabled:opacity-50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Deskripsi Singkat
                  </label>
                  <input
                    type="text"
                    value={roleFormDesc}
                    onChange={(e) => setRoleFormDesc(e.target.value)}
                    placeholder="Keterangan peruntukan role..."
                    className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-sky-500 rounded-md px-3 py-1.5 text-xs text-white placeholder:text-slate-600 outline-none transition"
                  />
                </div>
              </div>

              {/* Matriks Akses Menu */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Matriks Akses Menu (CRUD)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllRolePerms}
                      className="text-[10px] text-sky-400 hover:underline cursor-pointer"
                    >
                      Pilih Semua
                    </button>
                    <span className="text-slate-600 text-xs">•</span>
                    <button
                      type="button"
                      onClick={clearAllRolePerms}
                      className="text-[10px] text-slate-400 hover:underline cursor-pointer"
                    >
                      Kosongkan
                    </button>
                  </div>
                </div>

                <div className="border border-slate-800 rounded-lg overflow-x-auto">
                  <table className="w-full text-xs text-left min-w-[480px]">
                    <thead className="bg-slate-950/60 text-slate-400 text-[10px] font-mono uppercase tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="px-3 py-2">Menu Sistem</th>
                        <th className="px-3 py-2 text-center">Hak Akses (CRUD)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                      {Object.entries(MENUS).map(([menuKey, menuLabel]) => {
                        const menuPerms = roleFormPerms[menuKey] || [];
                        return (
                          <tr key={menuKey} className="hover:bg-slate-800/30 transition-colors">
                            <td className="px-3 py-2 text-slate-200 font-medium text-xs">
                              {menuLabel}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center justify-center gap-3">
                                {ACTIONS.map((action) => {
                                  const isChecked = menuPerms.includes(action);
                                  return (
                                    <label
                                      key={action}
                                      className={`flex items-center gap-1.5 cursor-pointer select-none px-2 py-0.5 rounded transition-all ${
                                        isChecked
                                          ? "bg-sky-950/60 border border-sky-700/60"
                                          : "hover:bg-slate-800/50 border border-transparent"
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={isChecked}
                                        onChange={() => toggleRolePerm(menuKey, action)}
                                      />
                                      <div
                                        className={`w-3.5 h-3.5 rounded flex items-center justify-center transition-all flex-shrink-0 ${
                                          isChecked
                                            ? "bg-sky-500 border border-sky-400 text-white shadow-[0_0_6px_rgba(14,165,233,0.7)]"
                                            : "bg-slate-950 border border-slate-700 text-transparent hover:border-slate-500"
                                        }`}
                                      >
                                        {isChecked && (
                                          <Check size={10} strokeWidth={3.5} className="text-white" />
                                        )}
                                      </div>
                                      <span
                                        className={`text-[11px] capitalize tracking-wide ${
                                          isChecked
                                            ? "text-sky-200 font-semibold"
                                            : "text-slate-400"
                                        }`}
                                      >
                                        {action}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 border-t border-slate-800 bg-slate-950/60 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRoleModal(false)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveRole}
                disabled={savingRole}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-md flex items-center gap-1.5 transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Save size={13} />
                <span>{savingRole ? "Menyimpan..." : roleEditMode ? "Simpan Perubahan" : "Buat Role"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
