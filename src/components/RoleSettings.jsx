import React, { useState, useEffect } from "react";
import axios from "axios";
import { Trash2, Pencil, Shield, Plus, X, Save } from "lucide-react";
import { MENUS, ACTIONS } from "@/lib/roles";

export default function RoleSettings({ showToast }) {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const [formId, setFormId] = useState(null);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formPerms, setFormPerms] = useState({});

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/roles");
      if (Array.isArray(res.data)) {
        setRoles(res.data);
      } else {
        console.error("Invalid roles data:", res.data);
        setRoles([]);
        showToast("Gagal memuat role: Format data tidak valid", "error");
      }
    } catch (err) {
      showToast(err.response?.data?.error || "Gagal memuat role", "error");
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const openCreate = () => {
    setEditMode(false);
    setFormId(null);
    setFormName("");
    setFormDesc("");
    setFormPerms({});
    setShowModal(true);
  };

  const openEdit = (r) => {
    if (r.name === "admin") {
      showToast(
        "Role Admin bawaan tidak bisa diedit. Harap gunakan role lain.",
        "error",
      );
      return;
    }
    setEditMode(true);
    setFormId(r.id);
    setFormName(r.name);
    setFormDesc(r.description || "");
    let perms = {};
    try {
      let parsed =
        typeof r.permissions === "string"
          ? JSON.parse(r.permissions)
          : r.permissions;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        perms = parsed;
      }
    } catch (e) {}
    setFormPerms(perms || {});
    setShowModal(true);
  };

  const togglePerm = (menu, action) => {
    setFormPerms((prev) => {
      const menuPerms = prev[menu] || [];
      const newMenuPerms = menuPerms.includes(action)
        ? menuPerms.filter((a) => a !== action)
        : [...menuPerms, action];
      return { ...prev, [menu]: newMenuPerms };
    });
  };

  const saveRole = async () => {
    if (!formName.trim())
      return showToast("Nama role tidak boleh kosong", "error");
    try {
      if (editMode) {
        await axios.patch(`/api/roles/${formId}`, {
          name: formName,
          description: formDesc,
          permissions: formPerms,
        });
        showToast("Role berhasil diperbarui!", "success");
      } else {
        await axios.post("/api/roles", {
          name: formName,
          description: formDesc,
          permissions: formPerms,
        });
        showToast("Role berhasil ditambahkan!", "success");
      }
      setShowModal(false);
      fetchRoles();
    } catch (err) {
      showToast(err.response?.data?.error || "Gagal menyimpan role", "error");
    }
  };

  const deleteRole = async (r) => {
    if (["admin", "editor", "visitor"].includes(r.name)) {
      return showToast("Role bawaan sistem tidak bisa dihapus", "error");
    }
    if (!confirm(`Hapus role ${r.name}?`)) return;
    try {
      await axios.delete(`/api/roles/${r.id}`);
      showToast("Role berhasil dihapus", "success");
      fetchRoles();
    } catch (err) {
      showToast(err.response?.data?.error || "Gagal menghapus role", "error");
    }
  };

  return (
    <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
        <Shield size={120} />
      </div>

      <div className="flex items-center justify-between mb-6 relative z-10">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Shield className="text-blue-400" size={24} /> Manajemen Role
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Atur hak akses secara spesifik untuk setiap kelompok pengguna
          </p>
        </div>
        <button
          onClick={openCreate}
          className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition duration-200"
        >
          <Plus size={18} /> Tambah Role
        </button>
      </div>

      <div className="overflow-x-auto relative z-10">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-700/50 text-slate-400 text-xs">
              <th className="pb-3 font-medium">Nama Role</th>
              <th className="pb-3 font-medium">Deskripsi</th>
              <th className="pb-3 font-medium">Hak Akses (Permissions)</th>
              <th className="pb-3 font-medium text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="text-xs text-slate-300">
            {loading ? (
              <tr>
                <td colSpan={4} className="text-center py-8 text-slate-400">
                  Memuat data...
                </td>
              </tr>
            ) : !Array.isArray(roles) || roles.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-8 text-slate-400">
                  Belum ada role tambahan
                </td>
              </tr>
            ) : (
              roles.map((r) => {
                let perms = {};
                try {
                  let parsed =
                    typeof r.permissions === "string"
                      ? JSON.parse(r.permissions)
                      : r.permissions;
                  if (
                    parsed &&
                    typeof parsed === "object" &&
                    !Array.isArray(parsed)
                  ) {
                    perms = parsed;
                  }
                } catch (e) {}

                const configuredMenus = Object.keys(perms).filter(
                  (k) => perms[k] && perms[k].length > 0,
                ).length;

                return (
                  <tr
                    key={r.id}
                    className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors"
                  >
                    <td className="py-4 font-semibold text-slate-200 capitalize">
                      {r.name === "admin" ? (
                        <span className="text-blue-400 flex items-center gap-1.5">
                          <Shield size={14} /> {r.name}
                        </span>
                      ) : (
                        r.name
                      )}
                    </td>
                    <td className="py-4 text-slate-400">
                      {r.description || "-"}
                    </td>
                    <td className="py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {r.name === "admin" ? (
                          <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded border border-slate-600">
                            All Access
                          </span>
                        ) : configuredMenus === 0 ? (
                          <span className="text-xs text-slate-500 italic">
                            No access
                          </span>
                        ) : (
                          <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded border border-slate-600">
                            {configuredMenus} Menus Configured
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(r)}
                          disabled={r.name === "admin"}
                          className={`cursor-pointer p-1.5 rounded-lg transition duration-200 ${r.name === "admin" ? "text-slate-600 cursor-not-allowed" : "bg-slate-700/50 text-slate-300 hover:text-blue-400 hover:bg-slate-700"}`}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => deleteRole(r)}
                          disabled={["admin", "editor", "visitor"].includes(
                            r.name,
                          )}
                          className={`cursor-pointer p-1.5 rounded-lg transition duration-200 ${["admin", "editor", "visitor"].includes(r.name) ? "text-slate-600 cursor-not-allowed" : "bg-slate-700/50 text-slate-300 hover:text-red-400 hover:bg-slate-700"}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[4000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-700/50 bg-slate-800/80">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                {editMode ? (
                  <Pencil size={20} className="text-blue-400" />
                ) : (
                  <Plus size={20} className="text-blue-400" />
                )}
                {editMode ? "Edit Role" : "Tambah Role Baru"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="cursor-pointer text-slate-400 hover:text-white transition"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 flex flex-col gap-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Nama Role
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    disabled={editMode && formName === "admin"}
                    placeholder="e.g. support"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Deskripsi Singkat
                  </label>
                  <input
                    type="text"
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    placeholder="Penjelasan singkat"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-3 border-b border-slate-700 pb-2">
                  Konfigurasi Akses Menu
                </label>
                <div className="border border-slate-700 rounded-lg overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-700/50 text-slate-300">
                      <tr>
                        <th className="px-4 py-2.5 font-medium">Menu</th>
                        <th className="px-4 py-2.5 font-medium text-center">
                          Aksi Akses (CRUD)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50 bg-slate-800">
                      {Object.entries(MENUS).map(([menuKey, menuLabel]) => {
                        const menuPerms = formPerms[menuKey] || [];
                        return (
                          <tr
                            key={menuKey}
                            className="hover:bg-slate-700/20 transition-colors"
                          >
                            <td className="px-4 py-3 text-slate-200 font-medium">
                              {menuLabel}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-4">
                                {ACTIONS.map((action) => (
                                  <label
                                    key={action}
                                    className="flex items-center gap-1.5 cursor-pointer group"
                                  >
                                    <div className="relative flex items-center">
                                      <input
                                        type="checkbox"
                                        className="peer sr-only"
                                        checked={menuPerms.includes(action)}
                                        onChange={() =>
                                          togglePerm(menuKey, action)
                                        }
                                      />
                                      <div className="w-4 h-4 border border-slate-500 rounded bg-slate-900 peer-checked:bg-blue-500 peer-checked:border-blue-500 flex items-center justify-center transition-all">
                                        <svg
                                          className="w-3 h-3 text-white scale-0 peer-checked:scale-100 transition-transform"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          stroke="currentColor"
                                          strokeWidth={3}
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M5 13l4 4L19 7"
                                          />
                                        </svg>
                                      </div>
                                    </div>
                                    <span className="text-xs text-slate-400 group-hover:text-slate-200 capitalize select-none">
                                      {action}
                                    </span>
                                  </label>
                                ))}
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
            <div className="p-5 border-t border-slate-700/50 bg-slate-800/80 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="cursor-pointer px-5 py-2.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
              >
                Batal
              </button>
              <button
                onClick={saveRole}
                className="cursor-pointer px-5 py-2.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20 rounded-lg flex items-center gap-2 transition-all active:scale-95"
              >
                <Save size={16} />
                {editMode ? "Simpan Perubahan" : "Buat Role"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
