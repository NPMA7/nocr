"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import {
  Lock,
  User,
  ShieldAlert,
  ArrowRight,
  Eye,
  EyeOff,
  Activity,
  Server,
  Radio,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import { API_URL, socket } from "@/App";
import {
  applySessionUser,
  getDefaultAccessibleRoute,
  isClientTokenValid,
  clearClientAuth,
} from "@/lib/roles";
import { getStoredThemeConfig, applyThemeConfig } from "@/lib/themeEngine";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isSetup, setIsSetup] = useState(false);

  useEffect(() => {
    // Apply theme on client mount
    if (typeof window !== "undefined") {
      try {
        const config = getStoredThemeConfig();
        applyThemeConfig(config);
      } catch (e) {
        console.warn("Theme apply warning:", e);
      }
    }

    const initLogin = async () => {
      try {
        // Check if user already has an active session via HttpOnly cookie
        try {
          const res = await axios.get(`${API_URL}/auth/me`, { timeout: 3000 });
          if (res.data?.user) {
            const userObj = applySessionUser(res.data.user);
            router.push(getDefaultAccessibleRoute(userObj));
            return;
          }
        } catch (e) {
          clearClientAuth();
        }

        // Check if system needs setup (no admin users in DB)
        try {
          const res = await axios.get(`${API_URL}/auth/check-setup`, {
            timeout: 3000,
          });
          if (res.data?.isSetup) {
            setIsSetup(true);
          }
        } catch (err) {
          if (
            err.response?.data?.message?.includes("relation") ||
            err.response?.data?.message?.includes("does not exist")
          ) {
            setError(
              "Tabel users tidak ditemukan di database PostgreSQL. Silakan jalankan perintah SQL Setup."
            );
            setIsSetup(true);
          }
        }
      } catch (err) {
        console.error("Login initialization error:", err);
      }
    };

    initLogin();
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const endpoint = isSetup ? "/auth/setup" : "/auth/login";
      const res = await axios.post(`${API_URL}${endpoint}`, {
        username,
        password,
      });

      if (res.data?.user) {
        const userObj = applySessionUser(res.data.user);
        if (socket && socket.disconnected) {
          socket.connect();
        }
        const targetRoute = getDefaultAccessibleRoute(userObj);
        window.location.href = targetRoute;
      }
    } catch (err) {
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Gagal masuk. Periksa username dan password Anda."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-slate-950 text-slate-100 selection:bg-sky-500 selection:text-white">
      {/* ─── LEFT PANEL: NOC Operational Showcase (Visible on lg+) ─────── */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-7/12 relative flex-col justify-between p-12 bg-gradient-to-br from-slate-900 via-slate-950 to-[#070b12] border-r border-slate-850 overflow-hidden">
        {/* Subtle Tech Grid Background Pattern */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(#38bdf8 1px, transparent 1px)`,
            backgroundSize: "28px 28px",
          }}
        />

        {/* Ambient Top Glow (Subtle Dark Slate/Cyan, No Purple Blob) */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Header Branding */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="NOCR Logo"
              className="w-10 h-10 rounded-xl border border-slate-700/80 object-cover shadow-md"
            />
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-xl font-black font-mono tracking-widest text-slate-100">
                  NOCR
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/30 text-sky-300 font-semibold tracking-wider">
                  OPERATIONS CONSOLE
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Network Operations Center & Reporting
              </p>
            </div>
          </div>
        </div>

        {/* Middle Feature Content */}
        <div className="relative z-10 max-w-lg my-auto py-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-xs text-slate-300 font-mono mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Pusat Monitoring Terpadu 24/7</span>
          </div>

          <h1 className="text-3xl xl:text-4xl font-black text-slate-100 tracking-tight leading-tight mb-4">
            Monitoring Infrastruktur Jaringan & Telekomunikasi 
          </h1>

          <p className="text-sm text-slate-400 leading-relaxed mb-8">
            Platform pengawasan terpusat untuk memantau performa perangkat , ketersediaan link, topologi interaktif, dan telemetri gateway secara real-time.
          </p>

          {/* Technical Spec List */}
          <div className="space-y-3.5 border-t border-slate-850 pt-6">
            <div className="flex items-start gap-3 text-xs text-slate-300">
              <div className="w-5 h-5 rounded-md bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 flex-shrink-0 mt-0.5">
                <Radio size={12} />
              </div>
              <div>
                <span className="font-semibold text-slate-200">
                  Telemetri Real-time WebSockets
                </span>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  Pembaruan instan status koneksi dan latensi link tanpa reload halaman.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 text-xs text-slate-300">
              <div className="w-5 h-5 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0 mt-0.5">
                <Server size={12} />
              </div>
              <div>
                <span className="font-semibold text-slate-200">
                  Infrastruktur  Terpadu
                </span>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  Dukungan terintegrasi untuk Router, OLT, Switch, dan AP.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 text-xs text-slate-300">
              <div className="w-5 h-5 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 flex-shrink-0 mt-0.5">
                <Activity size={12} />
              </div>
              <div>
                <span className="font-semibold text-slate-200">
                  Sistem Alarm & Deteksi Insiden Cepat
                </span>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  Monitoring proaktif titik putus jaringan dengan audio alert dan log insiden seketika.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 pt-6 border-t border-slate-850">
          <span>NOCR Operations Console</span>
          <span className="font-mono text-[11px]">Multi-Tenant Architecture</span>
        </div>
      </div>

      {/* ─── RIGHT PANEL: Authentication Form ─────────────────────────── */}
      <div className="w-full lg:w-1/2 xl:w-5/12 flex items-center justify-center p-6 sm:p-10 md:p-14 relative">
        <div className="w-full max-w-md">
          {/* Mobile Header Brand (Hidden on lg+) */}
          <div className="lg:hidden flex flex-col items-center text-center mb-8">
            <img
              src="/logo.png"
              alt="NOCR Logo"
              className="w-16 h-16 rounded-2xl border border-slate-700/80 object-cover shadow-lg mb-3"
            />
            <div className="flex items-center gap-2.5">
              <span className="text-2xl font-black font-mono tracking-widest text-slate-100">
                NOCR
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/30 text-sky-300 font-semibold tracking-wider">
                OPERATIONS CONSOLE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Network Operations Center & Reporting
            </p>
          </div>

          {/* Form Header */}
          <div className="mb-8">
            <h2 className="text-2xl font-black text-slate-100 tracking-tight">
              {isSetup ? "Inisialisasi Administrator" : "Masuk ke Konsol"}
            </h2>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              {isSetup
                ? "Sistem belum dikonfigurasi. Buat akun Super Administrator pertama untuk memulai."
                : "Masukkan username dan password Anda untuk mengakses dashboard operasional."}
            </p>
          </div>

          {/* Error Alert Banner */}
          {error && (
            <div className="rounded-lg p-3.5 mb-6 flex items-start gap-3 text-xs bg-rose-950/40 border border-rose-800/60 text-rose-300">
              <ShieldAlert size={18} className="shrink-0 mt-0.5 text-rose-400" />
              <p className="leading-relaxed font-medium">{error}</p>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username Field */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User size={16} />
                </div>
                <input
                  type="text"
                  required
                  autoFocus
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan username Anda"
                  className="w-full bg-slate-900/80 border border-slate-800 rounded-lg py-2.5 pl-10 pr-4 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sky-500/80 focus:ring-2 focus:ring-sky-500/20 transition-all font-medium"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Password
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock size={16} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-900/80 border border-slate-800 rounded-lg py-2.5 pl-10 pr-11 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sky-500/80 focus:ring-2 focus:ring-sky-500/20 transition-all font-medium font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="cursor-pointer absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 focus:outline-none transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="cursor-pointer w-full mt-2 py-2.5 px-4 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold tracking-wide transition-all shadow-md shadow-sky-950/50 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Memverifikasi Akses...</span>
                </>
              ) : (
                <>
                  <span>
                    {isSetup ? "Inisialisasi Sistem" : "Masuk ke Dashboard"}
                  </span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {/* Security & Audit Notice */}
          <div className="mt-8 pt-6 border-t border-slate-850 flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span>Sesi Terenkripsi TLS/JWT</span>
            </div>
            <span>v2.0 Enterprise</span>
          </div>
        </div>
      </div>
    </div>
  );
}
