"use client";
import {
  Search,
  Bell,
  MapPin,
  LogOut,
  Menu,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { API_URL, useAppState } from "@/App";
import { normalizeRole, getRoleLabel, getStoredUser } from "@/lib/roles";

export default function Topbar({ onMenuClick, isSidebarOpen }) {
  const { sessionUser, lastSyncTime, alerts, alarmEnabled, setAlarmEnabled, markAlertsRead } = useAppState();
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

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Notification panel state
  const [showNotifications, setShowNotifications] = useState(false);

  // Unread count = alerts with isRead: false
  const unreadCount = (alerts || []).filter((a) => !a.isRead).length;

  const handleToggleNotifications = () => {
    const newState = !showNotifications;
    setShowNotifications(newState);
    if (newState && markAlertsRead) {
      markAlertsRead();
    }
  };

  useEffect(() => {
    if (query.length >= 5) {
      setLoading(true);
      // Mengambil node dari topologi
      axios
        .get(`${API_URL}/topology`)
        .then((res) => {
          const nodes = res.data.nodes || [];
          const matches = nodes.filter(
            (n) =>
              (n.label &&
                n.label.toLowerCase().includes(query.toLowerCase())) ||
              (n.linked_interface &&
                n.linked_interface.toLowerCase().includes(query.toLowerCase())),
          );
          setSuggestions(matches);
          setShowSuggestions(true);
        })
        .catch((err) => {
          console.error(err);
        })
        .finally(() => setLoading(false));
    } else {
      setShowSuggestions(false);
      setSuggestions([]);
    }
  }, [query]);

  const handleSelect = (node) => {
    setShowSuggestions(false);
    setQuery("");
    router.push(`/topology?focus=${node.id}`);
  };

  const handleLogout = () => {
    localStorage.removeItem("nocr_token");
    localStorage.removeItem("nocr_user");
    window.location.href = "/login";
  };

  const searchInput = (
    <div className="relative w-full z-[2001]">
      <Search
        size={16}
        className={`absolute left-3 top-1/2 -translate-y-1/2 ${loading ? "text-blue-400 animate-pulse" : "text-slate-400"}`}
      />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cari interface atau nama titik (min 5 huruf)..."
        className="text-sm w-full bg-slate-900/50 border border-slate-700/50 rounded-full py-2 pl-10 pr-4 text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-slate-900 transition-all duration-300"
      />

      {/* Saran Dropdown */}
      {showSuggestions && (
        <div className="absolute top-12 left-0 right-0 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl max-h-72 overflow-auto">
          {suggestions.length > 0 ? (
            suggestions.map((node) => (
              <div
                key={node.id}
                onClick={() => handleSelect(node)}
                className="px-4 py-3 border-b border-slate-700/50 hover:bg-slate-700 cursor-pointer flex items-center justify-between transition-colors"
              >
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-200">
                    {node.label}
                  </span>
                  {node.linked_interface && (
                    <span className="text-[10px] text-blue-400 mt-0.5">
                      Interface: {node.linked_interface}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-900 px-2 py-1 rounded">
                    {node.type}
                  </span>
                  <MapPin size={14} className="text-slate-400" />
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-4 text-xs text-slate-500 text-center">
              Tidak ada hasil yang cocok.
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <header className="bg-slate-800 border-b border-slate-700/50 flex flex-col md:flex-row md:justify-between md:items-center relative z-[2000] shrink-0">
      {/* Baris Atas: Hamburger, Pencarian Desktop, Profil */}
      <div className="h-[70px] flex justify-between items-center px-4 md:px-6 w-full">
        <div className="flex items-center gap-3 flex-1 md:flex-none md:w-96 relative mr-4">
          <button
            onClick={onMenuClick}
            className="cursor-pointer text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-700 transition flex items-center justify-center"
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

          {/* Bilah Pencarian Desktop */}
          <div className="hidden md:block w-full">{searchInput}</div>
        </div>

        <div className="flex items-center gap-3 md:gap-5 flex-shrink-0">
          {lastSyncTime && (
            <div className="text-[10px] md:text-xs text-slate-400 flex items-center gap-1.5 bg-slate-800/50 px-2 py-1 md:px-3 md:py-1.5 rounded-lg border border-slate-700/50">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Auto-sync: {lastSyncTime}
            </div>
          )}

          {/* Alarm Toggle Button */}
          {setAlarmEnabled && (
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
          )}

          <div
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
              <span className="text-xs font-bold text-slate-200">
                {username}
              </span>
              <span
                className={`text-[10px] font-bold uppercase px-1.5 rounded ${
                  role === "admin"
                    ? "bg-blue-500/20 text-blue-400"
                    : role === "editor"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-slate-700 text-slate-400"
                }`}
              >
                {getRoleLabel(role)}
              </span>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-md">
              {initials}
            </div>
          </div>

          <div className="h-6 w-[1px] bg-slate-700/50"></div>

          <button
            onClick={handleLogout}
            title="Keluar"
            className="cursor-pointer text-slate-400 hover:text-red-400 transition-colors flex items-center gap-2"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>

      {/* Bilah Pencarian Seluler (Di Bawah Baris Atas) */}
      <div className="md:hidden px-4 pb-4 w-full">{searchInput}</div>
    </header>
  );
}
