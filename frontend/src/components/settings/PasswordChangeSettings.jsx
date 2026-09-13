"use client";

import { useState, useMemo } from "react";
import axios from "axios";
import {
  Key,
  Eye,
  EyeOff,
  Check,
  ShieldCheck,
  ShieldAlert,
  Lock,
  User,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import { API_URL, useAppState } from "@/App";
import { getStoredUser, getRoleLabel, isSuperAdmin } from "@/lib/roles";

export default function PasswordChangeSettings({ canUpdate = true }) {
  const { showToast, sessionUser } = useAppState();
  const currentUser = sessionUser?.username ? sessionUser : getStoredUser();

  const [form, setForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // ─── Password Strength Calculations ───
  const password = form.newPassword;
  const confirmPassword = form.confirmPassword;

  const checks = useMemo(() => {
    return {
      minLength: password.length >= 6,
      hasUpperLower: /[a-z]/.test(password) && /[A-Z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSymbol: /[^A-Za-z0-9]/.test(password),
      isMatching: password.length > 0 && password === confirmPassword,
    };
  }, [password, confirmPassword]);

  const strengthScore = useMemo(() => {
    if (!password) return 0;
    let score = 0;
    if (checks.minLength) score += 1;
    if (checks.hasUpperLower) score += 1;
    if (checks.hasNumber) score += 1;
    if (checks.hasSymbol) score += 1;
    return score;
  }, [password, checks]);

  const strengthLabel = useMemo(() => {
    if (!password) return { text: "Belum diisi", color: "text-slate-500", bar: "bg-slate-700", width: "0%" };
    if (strengthScore <= 1) return { text: "Sangat Lemah", color: "text-rose-400", bar: "bg-rose-500", width: "25%" };
    if (strengthScore === 2) return { text: "Cukup", color: "text-amber-400", bar: "bg-amber-500", width: "50%" };
    if (strengthScore === 3) return { text: "Kuat", color: "text-sky-400", bar: "bg-sky-500", width: "75%" };
    return { text: "Sangat Kuat", color: "text-emerald-400", bar: "bg-emerald-500", width: "100%" };
  }, [password, strengthScore]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canUpdate) return;
    setErrorMsg("");

    if (password.length < 4) {
      setErrorMsg("Password minimal harus 4 karakter.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Konfirmasi password tidak cocok dengan password baru.");
      return;
    }

    setLoading(true);
    try {
      const user = currentUser?.id ? currentUser : getStoredUser();
      await axios.patch(`${API_URL}/auth/users/${user.id}`, {
        password: form.newPassword,
      });

      setForm({ newPassword: "", confirmPassword: "" });
      if (showToast) {
        showToast("Password akun Anda berhasil diperbarui!", "success");
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || "Gagal mengubah password";
      setErrorMsg(msg);
      if (showToast) showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setForm({ newPassword: "", confirmPassword: "" });
    setErrorMsg("");
  };

  const roleName = getRoleLabel(currentUser?.role || "visitor");
  const isSuper = isSuperAdmin(currentUser);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start max-w-5xl">
      {/* ═════════════════════════════════════════════════════════════ */}
      {/* KOLOM KIRI: FORM UBAH PASSWORD (lg:col-span-7)                 */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <div className="lg:col-span-7 bg-slate-900/70 border border-slate-800 rounded-lg p-3.5 md:p-4 backdrop-blur-sm transition-all space-y-3.5">
        {/* Card Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-slate-800/90 border border-slate-700/60 flex items-center justify-center text-sky-400 flex-shrink-0">
              <Key size={14} />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-200 tracking-wide uppercase">
                Perbarui Kata Sandi Akun
              </span>
              <p className="text-[10px] text-slate-400 font-mono">
                Setel kredensial login baru untuk keamanan akun Anda
              </p>
            </div>
          </div>

          <span className="text-[9px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/50 text-slate-300 flex items-center gap-1">
            <Lock size={10} className="text-sky-400" />
            TERPROTEKSI
          </span>
        </div>

        {/* User Identity Mini Banner */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-slate-800 border border-slate-700/70 flex items-center justify-center text-slate-200 font-mono text-xs font-bold">
              {(currentUser?.username || "U")[0].toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-100">
                  {currentUser?.username || "User"}
                </span>
                {isSuper ? (
                  <span className="text-[9px] bg-amber-950/80 text-amber-300 border border-amber-800/70 px-1.5 py-0.2 rounded font-mono font-bold">
                    SUPERADMIN
                  </span>
                ) : (
                  <span className="text-[9px] bg-slate-800 text-slate-300 border border-slate-700 px-1.5 py-0.2 rounded font-mono">
                    {roleName}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 font-mono">
                Akun aktif yang sedang login
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 text-[10px] font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Aktif</span>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="flex items-center gap-2 text-[11px] text-rose-300 bg-rose-950/40 border border-rose-800/60 px-3 py-2 rounded-lg">
            <AlertCircle size={13} className="text-rose-400 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Password Baru */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>Password Baru</span>
              {password && (
                <span className={`text-[10px] font-mono ${strengthLabel.color}`}>
                  Kekuatan: {strengthLabel.text}
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type={showNewPwd ? "text" : "password"}
                value={form.newPassword}
                onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                placeholder="Ketik kata sandi baru (min. 6 karakter)..."
                required
                disabled={!canUpdate || loading}
                minLength={4}
                className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-sky-500 rounded-md pl-3 pr-9 py-2 text-xs text-slate-100 placeholder-slate-600 outline-none transition disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowNewPwd(!showNewPwd)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                title={showNewPwd ? "Sembunyikan password" : "Tampilkan password"}
              >
                {showNewPwd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>

            {/* Password Strength Bar */}
            {password && (
              <div className="w-full bg-slate-800/80 rounded-full h-1 mt-1.5 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${strengthLabel.bar}`}
                  style={{ width: strengthLabel.width }}
                />
              </div>
            )}
          </div>

          {/* Konfirmasi Password Baru */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>Konfirmasi Password Baru</span>
              {confirmPassword && (
                <span
                  className={`text-[10px] font-mono flex items-center gap-1 ${
                    checks.isMatching ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {checks.isMatching ? (
                    <>
                      <CheckCircle2 size={10} /> Cocok
                    </>
                  ) : (
                    <>
                      <XCircle size={10} /> Belum Cocok
                    </>
                  )}
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type={showConfirmPwd ? "text" : "password"}
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                placeholder="Ulangi kata sandi baru..."
                required
                disabled={!canUpdate || loading}
                minLength={4}
                className={`w-full bg-slate-950 border rounded-md pl-3 pr-9 py-2 text-xs text-slate-100 placeholder-slate-600 outline-none transition disabled:opacity-50 ${
                  confirmPassword && !checks.isMatching
                    ? "border-amber-500/70 focus:border-amber-500"
                    : confirmPassword && checks.isMatching
                    ? "border-emerald-500/70 focus:border-emerald-500"
                    : "border-slate-800 hover:border-slate-700 focus:border-sky-500"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                title={showConfirmPwd ? "Sembunyikan password" : "Tampilkan password"}
              >
                {showConfirmPwd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={handleReset}
              disabled={loading || (!form.newPassword && !form.confirmPassword)}
              className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 font-medium transition cursor-pointer flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RotateCcw size={12} />
              <span>Reset Form</span>
            </button>

            <button
              type="submit"
              disabled={
                loading ||
                !canUpdate ||
                !form.newPassword ||
                !form.confirmPassword ||
                !checks.isMatching
              }
              className="px-4 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 text-xs text-white font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Check size={13} strokeWidth={2.5} />
                  <span>Simpan Perubahan Password</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* KOLOM KANAN: PEDOMAN KEAMANAN & STATUS (lg:col-span-5)        */}
      {/* ═════════════════════════════════════════════════════════════ */}
      <div className="lg:col-span-5 bg-slate-900/70 border border-slate-800 rounded-lg p-3.5 md:p-4 backdrop-blur-sm transition-all space-y-3.5">
        {/* Card Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-slate-800/90 border border-slate-700/60 flex items-center justify-center text-emerald-400 flex-shrink-0">
              <ShieldCheck size={14} />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-200 tracking-wide uppercase">
                Standar Keamanan
              </span>
              <p className="text-[10px] text-slate-400 font-mono">
                Panduan proteksi akun sistem NOCR
              </p>
            </div>
          </div>
        </div>

        {/* Dynamic Criteria Checklist */}
        <div className="space-y-2">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
            Kriteria Kata Sandi
          </span>
          <div className="space-y-1.5 bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5">
            <div className="flex items-center gap-2 text-xs">
              {checks.minLength ? (
                <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />
              ) : (
                <span className="w-3 h-3 rounded-full border border-slate-700 bg-slate-900 flex-shrink-0" />
              )}
              <span className={checks.minLength ? "text-slate-200 font-medium" : "text-slate-500"}>
                Minimal 6 karakter
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              {checks.hasUpperLower ? (
                <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />
              ) : (
                <span className="w-3 h-3 rounded-full border border-slate-700 bg-slate-900 flex-shrink-0" />
              )}
              <span className={checks.hasUpperLower ? "text-slate-200 font-medium" : "text-slate-500"}>
                Kombinasi huruf besar & kecil
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              {checks.hasNumber ? (
                <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />
              ) : (
                <span className="w-3 h-3 rounded-full border border-slate-700 bg-slate-900 flex-shrink-0" />
              )}
              <span className={checks.hasNumber ? "text-slate-200 font-medium" : "text-slate-500"}>
                Mengandung angka (0-9)
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              {checks.isMatching ? (
                <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />
              ) : (
                <span className="w-3 h-3 rounded-full border border-slate-700 bg-slate-900 flex-shrink-0" />
              )}
              <span className={checks.isMatching ? "text-slate-200 font-medium" : "text-slate-500"}>
                Konfirmasi password cocok
              </span>
            </div>
          </div>
        </div>

        {/* Security Notice */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5 space-y-1.5">
          <div className="flex items-center gap-1.5 text-slate-300 text-xs font-semibold">
            <ShieldAlert size={13} className="text-amber-400" />
            <span>Informasi Penting</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Perubahan kata sandi akan langsung berlaku untuk sesi login berikutnya di seluruh perangkat dan portal NOCR.
          </p>
        </div>
      </div>
    </div>
  );
}
