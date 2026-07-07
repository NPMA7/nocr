"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import { API_URL } from "@/App";
import {
  Network,
  ShieldAlert,
  Lock,
  User,
  ArrowRight,
  Eye,
  EyeOff,
} from "lucide-react";

export default function Login() {
  const [isSetup, setIsSetup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // Cek apakah sistem sudah diinisialisasi
    axios
      .get(`${API_URL}/auth/status`)
      .then((res) => {
        if (res.data.error === "TABEL_TIDAK_DITEMUKAN") {
          setError(
            "Tabel users tidak ditemukan di database Supabase. Silakan jalankan perintah SQL Setup.",
          );
        } else if (!res.data.initialized) {
          setIsSetup(true);
        }
      })
      .catch((err) => {
        console.error(err);
        setError("Gagal menghubungi server backend.");
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const endpoint = isSetup ? "/auth/setup" : "/auth/login";

    try {
      const res = await axios.post(`${API_URL}${endpoint}`, {
        username,
        password,
      });

      // Simpan token
      localStorage.setItem("nocr_token", res.data.token);
      localStorage.setItem("nocr_user", JSON.stringify(res.data.user));

      // Arahkan ke dashboard
      window.location.href = "/"; // Muat ulang penuh untuk menerapkan interceptor axios
    } catch (err) {
      setError(err.response?.data?.error || "Terjadi kesalahan jaringan");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-300">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decals */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-600/20 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-purple-600/20 rounded-full blur-[120px]" />

      <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl p-8 relative z-10">
        <p className="text-lg font-bold text-slate-400"> Login </p>
        <div className="flex justify-center">
          <img
            src="/logo.png"
            alt="NOCR Logo"
            className="w-24 h-24 border-2 border-slate-600 rounded-full object-contain drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]"
          />
        </div>

        <div className="text-center mb-8">
          <h1 className="text-xl font-bold text-white">
            <p className="text-xs text-slate-400">npma</p>
            {isSetup ? "Setup Administrator" : "NOCR"}
          </h1>

          <p className="text-xs text-slate-400">
            {isSetup
              ? "Sistem belum dikonfigurasi. Buat akun admin pertama Anda."
              : "Silakan masukkan kredensial Anda untuk mengakses sistem."}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6 flex items-start gap-3">
            <ShieldAlert size={20} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Username
            </label>
            <div className="relative">
              <User
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username"
                className="w-full bg-slate-950/50 border border-slate-700 rounded-lg py-3 pl-10 pr-4 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <Lock
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950/50 border border-slate-700 rounded-lg py-3 pl-10 pr-12 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 focus:outline-none transition-colors"
                tabIndex="-1"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="cursor-pointer mt-4 w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-lg shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting
              ? "Memproses..."
              : isSetup
                ? "Buat Akun & Masuk"
                : "Masuk ke Dashboard"}
            {!submitting && <ArrowRight size={18} />}
          </button>
        </form>
      </div>
    </div>
  );
}
