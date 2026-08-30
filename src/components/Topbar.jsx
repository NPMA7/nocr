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
import { useRouter } from "next/navigation";
import axios from "axios";
import { API_URL, socket, useAppState } from "@/App";
import { normalizeRole, getRoleLabel, getStoredUser, clearClientAuth } from "@/lib/roles";

export default function Topbar({ onMenuClick, isSidebarOpen }) {
  const { sessionUser, lastSyncTime, alerts, alarmEnabled, setAlarmEnabled, markAlertsRead, testAlarm } = useAppState();
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
  const router = useRouter();

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

  return (
    <header className="bg-slate-800 border-b border-slate-700/50 flex flex-col md:flex-row md:justify-between md:items-center relative z-[2000] shrink-0">
      {/* Baris Atas: Hamburger, Profil, Notifikasi, Status */}
      <div className="h-[70px] flex justify-between items-center px-3 md:px-6 w-full gap-2">
        <div className="flex items-center gap-2 md:gap-3">
          <button
            onClick={onMenuClick}
            className="cursor-pointer text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-700 transition flex items-center justify-center flex-shrink-0"
          >
            <div className="hidden md:block">
              {isSidebarOpen ? (
                <ChevronLeft size={24} />
              ) : (
                <ChevronRight size={24} />
              )}
            </div>
            <div className="block md:hidden">
              <Menu size={24} />
            </div>
          </button>
        </div>

        <div className="flex items-center gap-2.5 md:gap-4 flex-shrink-0">
          {lastSyncTime && (
            <div className="text-[10px] md:text-xs text-slate-400 flex items-center gap-1.5 bg-slate-800/50 px-2 py-1 md:px-3 md:py-1.5 rounded-lg border border-slate-700/50">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Auto-sync: {lastSyncTime}
            </div>
          )}

          {/* Alarm Toggle + Test Buttons */}
          {setAlarmEnabled && (
            <>
              <button
                onClick={() => setAlarmEnabled((v) => !v)}
                title={alarmEnabled ? "Alarm suara aktif – klik untuk matikan" : "Alarm suara mati – klik untuk aktifkan"}
                className={`cursor-pointer p-2 rounded-lg transition-colors ${
                  alarmEnabled
                    ? "text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    : "text-slate-500 hover:text-slate-300 hover:bg-slate-700"
                }`}
              >
                {alarmEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </button>
            </>
          )}

          {/* Notification Bell */}
          <div
            ref={notificationRef}
            className="relative cursor-pointer text-slate-200 hover:text-white transition"
            onClick={handleToggleNotifications}
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold animate-pulse">
                {unreadCount}
              </span>
            )}

            {showNotifications && (
              <div
                className="absolute top-10 right-0 w-80 max-w-[90vw] bg-slate-800 border border-slate-700 rounded-lg shadow-2xl overflow-hidden z-[2005] cursor-default"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-3 border-b border-slate-700 bg-slate-900/50 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-xs font-bold text-slate-200">
                      Notifikasi Offline
                    </span>
                    {alerts && alerts.length > 0 && (
                      <span className="text-[10px] text-slate-500">
                        ({alerts.length})
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="cursor-pointer text-slate-400 hover:text-white"
                  >
                    &times;
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {!alerts || alerts.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">
                      Tidak ada notifikasi offline
                    </div>
                  ) : (
                    alerts.map((alert, idx) => (
                      <div
                        key={idx}
                        className={`p-3 border-b border-slate-700/50 hover:bg-slate-700/30 transition flex items-start gap-2.5 ${
                          !alert.isRead ? "bg-red-500/5" : ""
                        }`}
                      >
                        <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5" />
                        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                          <span className="text-xs text-slate-200 leading-relaxed break-words">
                            {alert.msg}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {alert.time
                              ? new Date(alert.time).toLocaleTimeString("id-ID", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                })
                              : ""}
                          </span>
                        </div>
                        {!alert.isRead && (
                          <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 ring-2 ring-red-500/30" />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <span className="text-xs font-bold text-slate-200 uppercase">
                {username}
              </span>
              <span className="text-[10px] font-bold text-slate-200 uppercase bg-slate-600/20">
                {getRoleLabel(role)}
              </span>
            </div>
            <div className="w-9 h-9 rounded-full bg-slate-600/20 flex items-center justify-center font-bold text-slate-200 shadow-xl">
              {initials}
            </div>
          </div>

          <button
            onClick={handleLogout}
            title="Keluar"
            className="cursor-pointer text-slate-400 hover:text-red-400 transition-colors flex items-center gap-2"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </header>
  );
}
