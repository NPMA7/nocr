"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { Lock, User, ShieldAlert, ArrowRight, Eye, EyeOff } from "lucide-react";
import { API_URL, socket } from "@/App";
import { applySessionUser, getDefaultAccessibleRoute, getStoredUser } from "@/lib/roles";
import { getStoredThemeConfig, applyThemeConfig } from "@/lib/themeEngine";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isSetup, setIsSetup] = useState(false);

  useEffect(() => {
    // Apply theme on client mount
    if (typeof window !== "undefined") {
      const config = getStoredThemeConfig();
      applyThemeConfig(config);
    }

    // Check if user already has a valid token
    const token = localStorage.getItem("nocr_token");
    if (token) {
      const user = getStoredUser();
      router.push(getDefaultAccessibleRoute(user));
      return;
    }

    // Check if system needs setup (no admin users in DB)
    axios
      .get(`${API_URL}/auth/check-setup`)
      .then((res) => {
        if (res.data?.isSetup) {
          setIsSetup(true);
        }
      })
      .catch((err) => {
        if (
          err.response?.data?.message?.includes("relation") ||
          err.response?.data?.message?.includes("does not exist")
        ) {
          setError(
            "Tabel users tidak ditemukan di database Supabase. Silakan jalankan perintah SQL Setup."
          );
          setIsSetup(true);
        }
      })
      .finally(() => setLoading(false));
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

      if (res.data.token) {
        localStorage.setItem("nocr_token", res.data.token);
        let userObj = res.data.user;
        if (userObj) {
          userObj = applySessionUser(userObj);
        }
        if (socket.disconnected) {
          socket.connect();
        }
        const targetRoute = getDefaultAccessibleRoute(userObj);
        router.push(targetRoute);
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

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center transition-colors duration-300"
        style={{
          backgroundColor: "var(--color-app-bg, #0F172A)",
          color: "var(--color-text-main, #F8FAFC)",
        }}
      >
        <div
          className="animate-spin w-8 h-8 border-4 border-t-transparent rounded-full"
          style={{ borderColor: "var(--color-primary, #3B82F6)", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden transition-colors duration-300"
      style={{
        backgroundColor: "var(--color-app-bg, #0F172A)",
        color: "var(--color-text-main, #F8FAFC)",
      }}
    >
      {/* Background Decorative Ambient Flares */}
      <div
        className="absolute top-[-10%] left-[-10%] w-96 h-96 rounded-full blur-[120px] opacity-30"
        style={{ backgroundColor: "var(--color-primary, #3B82F6)" }}
      />
      <div
        className="absolute bottom-[-10%] right-[-10%] w-96 h-96 rounded-full blur-[120px] opacity-20"
        style={{ backgroundColor: "var(--color-purple, #8B5CF6)" }}
      />

      <div
        className="w-full max-w-md border rounded-2xl shadow-2xl p-8 relative z-10 backdrop-blur-xl transition-colors duration-300"
        style={{
          backgroundColor: "var(--color-card-bg, #1E293B)",
          borderColor: "var(--color-border-main, #334155)",
        }}
      >
        <div className="flex justify-center mb-4">
          <img
            src="/logo.png"
            alt="NOCR Logo"
            className="w-24 h-24 border-2 rounded-full shadow-md"
            style={{ borderColor: "var(--color-border-main, #334155)" }}
          />
        </div>

        <div className="text-center mb-8">
          <h1
            className="text-2xl font-extrabold tracking-tight"
            style={{ color: "var(--color-text-main, #F8FAFC)" }}
          >
            {isSetup ? "Setup Administrator" : "NOCR"}
          </h1>

          <p
            className="text-xs mt-1 font-medium"
            style={{ color: "var(--color-text-muted, #94A3B8)" }}
          >
            {isSetup
              ? "Sistem belum dikonfigurasi. Buat akun admin pertama Anda."
              : "Silakan masukkan kredensial Anda untuk mengakses sistem."}
          </p>
        </div>

        {error && (
          <div
            className="border rounded-lg p-4 mb-6 flex items-start gap-3 text-xs"
            style={{
              backgroundColor: "rgba(246, 73, 50, 0.1)",
              borderColor: "var(--color-danger, #EF4444)",
              color: "var(--color-danger, #EF4444)",
            }}
          >
            <ShieldAlert size={20} className="shrink-0 mt-0.5" />
            <p className="leading-relaxed">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: "var(--color-text-muted, #94A3B8)" }}
            >
              Username
            </label>
            <div className="relative">
              <User
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--color-text-muted, #94A3B8)" }}
              />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username"
                className="w-full border rounded-lg py-3 pl-10 pr-4 text-xs font-medium focus:outline-none transition-all"
                style={{
                  backgroundColor: "var(--color-app-bg, #0F172A)",
                  borderColor: "var(--color-border-main, #334155)",
                  color: "var(--color-text-main, #F8FAFC)",
                }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: "var(--color-text-muted, #94A3B8)" }}
            >
              Password
            </label>
            <div className="relative">
              <Lock
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--color-text-muted, #94A3B8)" }}
              />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border rounded-lg py-3 pl-10 pr-12 text-xs font-medium focus:outline-none transition-all"
                style={{
                  backgroundColor: "var(--color-app-bg, #0F172A)",
                  borderColor: "var(--color-border-main, #334155)",
                  color: "var(--color-text-main, #F8FAFC)",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 focus:outline-none transition-colors"
                style={{ color: "var(--color-text-muted, #94A3B8)" }}
                tabIndex="-1"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="cursor-pointer mt-3 w-full font-bold py-3 px-4 rounded-lg shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: "var(--color-primary, #3B82F6)",
              color: "#FFFFFF",
            }}
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
