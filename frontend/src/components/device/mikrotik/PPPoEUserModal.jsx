"use client";

import { UserPlus, X, Eye, EyeOff, Check } from "lucide-react";

export default function PPPoEUserModal({
  showAddSecret,
  setShowAddSecret,
  editingSecret,
  secretForm,
  setSecretForm,
  showPassword,
  setShowPassword,
  availableProfilesList,
  isCustomProfile,
  setIsCustomProfile,
  handleSaveSecret,
}) {
  if (!showAddSecret) return null;

  return (
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
            <div className="flex flex-col gap-2">
              <select
                value={isCustomProfile ? "__custom__" : secretForm.profile}
                onChange={(e) => {
                  if (e.target.value === "__custom__") {
                    setIsCustomProfile(true);
                  } else {
                    setIsCustomProfile(false);
                    setSecretForm({ ...secretForm, profile: e.target.value });
                  }
                }}
                className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:border-blue-500 outline-none w-full cursor-pointer"
              >
                {availableProfilesList.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
                <option value="__custom__">-- Input Profile Custom --</option>
              </select>
              {isCustomProfile && (
                <input
                  type="text"
                  required
                  value={secretForm.profile}
                  onChange={(e) =>
                    setSecretForm({ ...secretForm, profile: e.target.value })
                  }
                  placeholder="Ketik nama profile MikroTik persis..."
                  className="bg-slate-900 border border-blue-500 rounded-lg p-2.5 text-xs text-slate-100 outline-none w-full"
                />
              )}
            </div>
            <p className="text-[10px] text-slate-500">
              *Pilih profile yang tersedia di MikroTik atau ketik nama profile yang persis sama.
            </p>
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
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400">
              Local Address
            </label>
            <input
              type="text"
              value={secretForm.localAddress}
              onChange={(e) =>
                setSecretForm({ ...secretForm, localAddress: e.target.value })
              }
              placeholder="Contoh: 10.16.25.1 (Opsional)"
              className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:border-blue-500 outline-none w-full"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400">
              Remote Address
            </label>
            <input
              type="text"
              value={secretForm.remoteAddress}
              onChange={(e) =>
                setSecretForm({ ...secretForm, remoteAddress: e.target.value })
              }
              placeholder="Contoh: 10.16.25.20 (Opsional)"
              className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:border-blue-500 outline-none w-full"
            />
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
  );
}
