"use client";

import {
  Bell,
  LogOut,
  Menu,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import axios from "axios";
import { socket, useAppState } from "@/App";
import { normalizeRole, getRoleLabel, getStoredUser, clearClientAuth } from "@/lib/roles";

export default function Topbar({ onMenuClick, isSidebarOpen }) {
  const pathname = usePathname();
  const {
    sessionUser,
    lastSyncTime,
    alerts,
    alarmEnabled,
    setAlarmEnabled,
    markAlertsRead,
    isConnected,
  } = useAppState();
  const [userData, setUserData] = useState(() => getStoredUser());

  useEffect(() => {
    if (sessionUser?.username) setUserData(sessionUser);
  }, [sessionUser]);

  useEffect(() => {
    const onRole = (e) => {
      if (e.detail) setUserData(e.detail);
    };
    window.addEventListener("nocr-role-updated", onRole);
    return () => window.removeEventListener("nocr-role-updated", onRole);
  }, []);

  const role = normalizeRole(userData.role) || "visitor";
  const username = userData.username || "User";
  const initials = username.substring(0, 2).toUpperCase();

  // Notification panel state
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef(null);

  const unreadCount = alerts ? alerts.filter((a) => !a.isRead).length : 0;

  const handleToggleNotifications = () => {
    if (!showNotifications && unreadCount > 0) {
      markAlertsRead?.();
    }
    setShowNotifications(!showNotifications);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target)
      ) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showNotifications]);

  const handleLogout = async () => {
    try {
      await axios.post("/api/auth/logout");
    } catch (e) {}
    clearClientAuth();
    if (socket) {
      socket.auth = { token: null };
      socket.disconnect();
    }
    window.location.href = "/login";
  };

  // Breadcrumb resolver
  const getPageTitle = () => {
    if (pathname === "/" || pathname === "/dashboard") return "Dashboard Utama";
    if (pathname.startsWith("/maps")) return "Peta Wilayah";
    if (pathname.startsWith("/topology")) return "Topologi Jaringan";
    if (pathname.startsWith("/monitoring/desa")) return "Monitoring Wilayah Desa";
    if (pathname.startsWith("/monitoring/opd")) return "Monitoring Perangkat OPD";
    if (pathname.startsWith("/monitoring/traffic")) return "Monitoring Traffic";
    if (pathname.startsWith("/device/ruijie")) return "Perangkat Ruijie";
    if (pathname.startsWith("/device/mikrotik")) return "Core Gateway MikroTik";
    if (pathname.startsWith("/device/hsgq-olt")) return "Infrastruktur OLT HSGQ";
    if (pathname.startsWith("/sites/desa")) return "Data Wilayah Desa";
    if (pathname.startsWith("/sites/opd")) return "Data Wilayah OPD";
    if (pathname.startsWith("/sites")) return "Data Wilayah";
    if (pathname.startsWith("/daily-reports") || pathname.startsWith("/report")) return "Laporan Harian";
    if (pathname === "/settings/company" || pathname === "/settings/profile") return "Profil Perusahaan";
    if (pathname === "/settings/users" || pathname === "/settings/roles") return "Pengguna & Role";
    if (pathname === "/settings/health") return "Kesehatan Sistem & DB";
    if (pathname === "/settings/system") return "Konfigurasi Server";
    if (pathname === "/settings/password") return "Ubah Password";
    if (pathname === "/settings/design") return "Desain & Tema";
    if (pathname === "/settings/api-keys" || pathname === "/settings/apikeys") return "Akses API Key";
    if (pathname === "/settings/mikrotik-gateway" || pathname === "/settings/core" || pathname === "/settings/vpn") return "Core Gateway";
    if (pathname.startsWith("/settings")) return "Pengaturan Sistem";
    return "Operations Console";
  };

  return (
    <header className="bg-slate-950/80 border-b border-slate-800/80 flex items-center justify-between px-3 md:px-5 h-14 relative z-[2000] shrink-0 backdrop-blur-md transition-all">
      {/* ─── Left: Sidebar Toggle & Modern Breadcrumb ───────────────── */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          aria-label={isSidebarOpen ? "Kecilkan Sidebar" : "Perbesar Sidebar"}
          className="cursor-pointer text-slate-400 hover:text-slate-100 p-1.5 rounded-lg hover:bg-slate-900 transition flex items-center justify-center flex-shrink-0"
        >
          <div className="hidden md:block">
            {isSidebarOpen ? <ChevronLeft size={17} /> : <ChevronRight size={17} />}
          </div>
          <div className="block md:hidden">
            <Menu size={18} />
          </div>
        </button>

        {/* Clean Modern Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-2 text-xs min-w-0">
          <span className="text-slate-400 font-semibold font-mono tracking-wider">
            NOCR
          </span>
          <span className="text-slate-600 font-light select-none">/</span>
          <span className="text-slate-200 font-medium truncate tracking-tight">
            {getPageTitle()}
          </span>
          <span className="hidden lg:inline-flex items-center gap-1.5 ml-2 pl-2.5 border-l border-slate-800 text-[11px] text-slate-400">
            Kab. Bandung
          </span>
        </nav>
      </div>

      {/* ─── Right Controls: Sync Time, Alarm, Notifications, User Profile */}
      <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
        {/* Modern Live Sync Pill */}
        {lastSyncTime && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-slate-900/80 border border-slate-800 text-[10px] sm:text-[11px] font-mono text-slate-300 sm:text-slate-400">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isConnected
                  ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] animate-pulse"
                  : "bg-rose-500"
              }`}
            />
            <span className="text-slate-200 font-medium">{lastSyncTime}</span>
          </div>
        )}

        {/* Alarm Audio Toggle Button */}
        {setAlarmEnabled && (
          <button
            onClick={() => setAlarmEnabled((v) => !v)}
            aria-label={alarmEnabled ? "Matikan alarm suara" : "Nyalakan alarm suara"}
            className={`cursor-pointer p-2 rounded-lg transition ${
              alarmEnabled
                ? "bg-rose-950/40 text-rose-300 border border-rose-800/40 hover:bg-rose-900/50"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            {alarmEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        )}

        {/* Notification Bell with Dropdown */}
        <div ref={notificationRef} className="relative">
          <button
            onClick={handleToggleNotifications}
            aria-label="Notifikasi"
            className={`cursor-pointer p-2 rounded-lg transition relative ${
              showNotifications
                ? "bg-slate-800 text-white"
                : "text-slate-400 hover:text-white hover:bg-slate-900"
            }`}
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-slate-950 animate-pulse" />
            )}
          </button>

          {showNotifications && (
            <div
              className="absolute top-11 right-0 w-80 max-w-[90vw] bg-slate-900/95 border border-slate-800 rounded-lg shadow-2xl overflow-hidden z-[2005] backdrop-blur-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-3 border-b border-slate-800 bg-slate-950/70 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                  <span className="text-xs font-semibold text-slate-200">
                    Notifikasi Insiden
                  </span>
                  {alerts && alerts.length > 0 && (
                    <span className="text-[10px] font-mono text-slate-400">
                      ({alerts.length})
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setShowNotifications(false)}
                  className="cursor-pointer text-slate-400 hover:text-white text-xs px-1"
                >
                  &times;
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto custom-scrollbar">
                {!alerts || alerts.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">
                    Tidak ada notifikasi insiden
                  </div>
                ) : (
                  alerts.map((alert, idx) => (
                    <div
                      key={alert.id || idx}
                      className={`p-2.5 border-b border-slate-800/60 hover:bg-slate-800/40 transition flex items-start gap-2.5 text-[11px] ${
                        !alert.isRead ? "bg-rose-950/15" : ""
                      }`}
                    >
                      <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-rose-500 mt-1" />
                      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                        <span className="text-slate-200 leading-snug break-words">
                          {alert.msg}
                        </span>
                        <span className="text-[9.5px] text-slate-500 font-mono">
                          {alert.time
                            ? new Date(alert.time).toLocaleTimeString("id-ID", {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })
                            : ""}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Subtle Vertical Divider */}
        <div className="w-[1px] h-5 bg-slate-800/80 mx-0.5 hidden sm:block" />

        {/* ─── Modern Refined User Profile & Logout ──────────────────── */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-2 pl-1 py-1 pr-2">
            {/* Elegant Circular Gradient Avatar */}
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 border border-slate-700/80 flex items-center justify-center font-bold text-[11px] text-slate-200 shadow-sm flex-shrink-0">
              {initials}
            </div>

            {/* Username & Role */}
            <div className="hidden sm:flex flex-col leading-tight min-w-0">
              <span className="text-xs font-semibold text-slate-200 capitalize truncate">
                {username.toLowerCase()}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                {getRoleLabel(role)}
              </span>
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            aria-label="Keluar / Logout"
            className="cursor-pointer p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition flex items-center justify-center"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
