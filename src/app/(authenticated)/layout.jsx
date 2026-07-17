"use client";
// Trigger route manifest reload comment
import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { socket, AppStateContext, API_URL } from "@/App";
import {
  applySessionUser,
  getStoredUser,
  getRoleLabel,
  hasAccess,
} from "@/lib/roles";
import axios from "axios";
import { Network } from "lucide-react";

export default function AuthenticatedLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [tokenChecked, setTokenChecked] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [devices, setDevices] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const [toast, setToast] = useState(null);
  const [sessionUser, setSessionUser] = useState(() =>
    typeof window !== "undefined" ? getStoredUser() : {},
  );
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // Per-user alarm preference stored in localStorage
  const getAlarmKey = (user) => `nocr_alarm_enabled_${user?.username || "default"}`;
  const [alarmEnabled, setAlarmEnabledRaw] = useState(() => {
    if (typeof window === "undefined") return true;
    const user = getStoredUser();
    const stored = localStorage.getItem(getAlarmKey(user));
    return stored === null ? true : stored === "true";
  });
  const setAlarmEnabled = (valueOrFn) => {
    setAlarmEnabledRaw((prev) => {
      const next = typeof valueOrFn === "function" ? valueOrFn(prev) : valueOrFn;
      if (typeof window !== "undefined") {
        const user = getStoredUser();
        localStorage.setItem(getAlarmKey(user), String(next));
      }
      return next;
    });
  };

  const [activeAlarm, setActiveAlarm] = useState(null); // { msg, time }
  const alarmDelayRef = useRef(1500);
  const alarmTimerRef = useRef(null);

  const showToast = (message, type = "success", duration = 4000) => {
    setToast({ message, type });
    const timer = setTimeout(() => {
      setToast(null);
    }, duration);
    return timer;
  };

  useEffect(() => {
    // Auth check
    const token = localStorage.getItem("nocr_token");
    if (!token) {
      router.push("/login");
      return;
    }
    setTokenChecked(true);
  }, [router]);

  // Sync alarm preference when user session changes (login / role refresh)
  useEffect(() => {
    if (!sessionUser?.username) return;
    const stored = localStorage.getItem(getAlarmKey(sessionUser));
    setAlarmEnabledRaw(stored === null ? true : stored === "true");
  }, [sessionUser?.username]);

  // Helper: play offline alarm using Web Audio API
  const playAlarmSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const playTone = (freq, startTime, duration) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.35, startTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };
      playTone(880, ctx.currentTime, 0.18);
      playTone(660, ctx.currentTime + 0.22, 0.18);
      playTone(880, ctx.currentTime + 0.44, 0.18);
      playTone(660, ctx.currentTime + 0.66, 0.28);
    } catch (e) {
      // Web Audio not supported
    }
  };

  const fetchDevices = async () => {
    try {
      const res = await axios.get(`${API_URL}/devices`);
      setDevices(res.data);
      setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
    } catch (e) {
      console.error("Gagal mengambil perangkat", e);
    }
  };

  const refreshSessionUser = async () => {
    try {
      const prev = getStoredUser();
      const res = await axios.get(`${API_URL}/auth/me`);
      if (res.data?.user) {
        const next = applySessionUser(res.data.user);
        setSessionUser(next);
        if (prev.role && next?.role && prev.role !== next.role) {
          showToast(
            `Peran Anda diubah menjadi ${getRoleLabel(next.role)}`,
            "warning",
          );
        }
      }
    } catch (e) {
      console.error("Gagal memuat sesi user", e);
    }
  };

  useEffect(() => {
    if (!tokenChecked) return;

    const handleRoleEvent = (e) => {
      if (e.detail) setSessionUser(e.detail);
    };
    window.addEventListener("nocr-role-updated", handleRoleEvent);

    refreshSessionUser();
    const rolePoll = setInterval(refreshSessionUser, 60000);
    const onFocus = () => refreshSessionUser();
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(rolePoll);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("nocr-role-updated", handleRoleEvent);
    };
  }, [tokenChecked]);

    // Central Route Guard
  useEffect(() => {
    if (!tokenChecked || !sessionUser?.role) return;

    // Default to dashboard route if path is just /
    const currentPath =
      pathname === "/" ? "dashboard" : pathname.replace(/^\//, "");

    const firstSegment = currentPath.split("/")[0];
    let lookupKey = firstSegment;
    if (firstSegment === "monitoring" || firstSegment === "device" || firstSegment === "sites") {
      const parts = currentPath.split("/");
      if (parts.length > 1) {
        lookupKey = `${parts[0]}/${parts[1]}`;
      }
    }

    const routeToMenuKeyMap = {
      topology: "topology",
      "sites/desa": "sites",
      "sites/opd": "sites",
      sites: "sites",
      "laporan-harian": "laporan-harian",
      report: "laporan-harian",
      "live-chat": "chat",
      "monitoring/desa": "monitoring-l2tp",
      "monitoring/opd": "monitoring-pppoe",
      "device/ruijie": "devices-ruijie",
      "device/mikrotik": "devices-mikrotik",
      "device/hsgq-olt": "devices-hsgq",
    };

    let requiredMenuKey = routeToMenuKeyMap[lookupKey];

    // Handle settings sub-tabs separately
    if (firstSegment === "settings") {
      const urlParams = new URLSearchParams(window.location.search);
      const tab = urlParams.get("tab") || "core";
      const tabToMenuKeyMap = {
        core: "settings-mikrotik",
        vpn: "settings-vpn",
        health: "settings-health",
        whatsapp: "settings-wa",
        users: "settings-users",
        roles: "settings-roles",
        password: "settings-password",
        system: "settings-system",
      };
      requiredMenuKey = tabToMenuKeyMap[tab];
    }

    if (requiredMenuKey) {
      if (!hasAccess(sessionUser, requiredMenuKey, "read")) {
        showToast(
          `Akses Ditolak: Anda tidak memiliki izin untuk melihat ${requiredMenuKey}`,
          "error",
        );
        router.push("/dashboard");
      }
    }
  }, [tokenChecked, sessionUser, pathname, router]);

  useEffect(() => {
    if (!tokenChecked) return;

    // Load alarm delay setting
    axios.get("/api/settings/server")
      .then((res) => {
        if (res.data?.alarm_delay_ms !== undefined) {
          alarmDelayRef.current = Number(res.data.alarm_delay_ms) || 1500;
        }
      })
      .catch(() => {});

    if (socket) {
      const handleConnect = () => setIsConnected(true);
      const handleDisconnect = () => setIsConnected(false);

      const handleStatus = (data) => {
        const msg = data.message || data.msg || "";
        const lower = msg.toLowerCase();
        if (!lower.includes("berubah menjadi")) {
          return;
        }
        // Only show OFFLINE events in notification bell
        if (lower.includes("offline")) {
          setAlerts((prev) =>
            [
              { time: data.time ? new Date(data.time) : new Date(), msg, isRead: false },
              ...prev,
            ].slice(0, 20),
          );
          // Trigger alarm
          if (alarmEnabled) {
            clearTimeout(alarmTimerRef.current);
            alarmTimerRef.current = setTimeout(() => {
              playAlarmSound();
              setActiveAlarm({ msg, time: new Date() });
            }, alarmDelayRef.current);
          }
        }
      };

      const handleInitialLogs = (logs) => {
        if (Array.isArray(logs)) {
          const filtered = logs
            .filter((log) => {
              const msg = log.message || "";
              const lower = msg.toLowerCase();
              return lower.includes("berubah menjadi") && lower.includes("offline");
            })
            .map((log) => ({ time: new Date(log.time), msg: log.message, isRead: true }))
            .slice(0, 20);
          setAlerts(filtered);
        }
      };

      const handleDeviceStatus = (data) => {
        setDevices((prev) =>
          prev.map((d) =>
            d.id === data.id ? { ...d, status: data.status } : d,
          ),
        );
      };

      const handleRoleUpdated = (payload) => {
        const me = getStoredUser();
        if (
          payload?.userId &&
          (payload.userId === me.id || payload.username === me.username)
        ) {
          refreshSessionUser();
        }
      };

      const handleRoleNameChanged = (payload) => {
        const me = getStoredUser();
        if (payload?.oldName === me.role) {
          refreshSessionUser();
        }
      };

      socket.on("connect", handleConnect);
      socket.on("disconnect", handleDisconnect);
      socket.on("status", handleStatus);
      socket.on("activity_log_updated", handleStatus);
      socket.on("initial_logs", handleInitialLogs);
      socket.on("device-status", handleDeviceStatus);
      socket.on("user_role_updated", handleRoleUpdated);
      socket.on("role_name_changed", handleRoleNameChanged);

      socket.emit("request_initial_logs");

      if (socket.connected) {
        setIsConnected(true);
      }

      fetchDevices();

      return () => {
        socket.off("connect", handleConnect);
        socket.off("disconnect", handleDisconnect);
        socket.off("status", handleStatus);
        socket.off("activity_log_updated", handleStatus);
        socket.off("initial_logs", handleInitialLogs);
        socket.off("device-status", handleDeviceStatus);
        socket.off("user_role_updated", handleRoleUpdated);
        socket.off("role_name_changed", handleRoleNameChanged);
      };
    }
  }, [tokenChecked]);

  if (!tokenChecked) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <img
            src="/logo.png"
            alt="NOCR Logo"
            className="w-24 h-24 border-2 border-slate-600 rounded-full object-contain drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]"
          />
          <div className="text-xl font-bold text-blue-500 flex items-center gap-2">
            NOCR{" "}
            <span className="text-xs text-slate-400 font-normal mt-2">
              by: npma
            </span>
          </div>
          <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase mt-4">
            Loading setup...
          </p>
        </div>
      </div>
    );
  }

  const contextValue = {
    devices,
    alerts,
    isConnected,
    sessionUser,
    refreshDevices: fetchDevices,
    refreshSessionUser,
    showToast,
    lastSyncTime,
    setLastSyncTime,
    alarmEnabled,
    setAlarmEnabled,
    markAlertsRead: () => setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true }))),
  };

  const toggleSidebar = () => {
    if (window.innerWidth >= 768) {
      setIsDesktopSidebarOpen((prev) => !prev);
    } else {
      setIsMobileMenuOpen((prev) => !prev);
    }
  };

  return (
    <AppStateContext.Provider value={contextValue}>
      <div className="fixed inset-0 flex bg-slate-900 text-slate-50 overflow-hidden">
        {/* Mobile overlay */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 z-[2500] bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar with mobile slide-in */}
        <div
          className={`fixed inset-y-0 left-0 z-[3000] flex transition-all duration-300 ease-in-out overflow-hidden ${
            isMobileMenuOpen ? "translate-x-0 w-64" : "-translate-x-full w-64"
          } md:relative ${
            isDesktopSidebarOpen
              ? "md:translate-x-0 md:w-64"
              : "md:-translate-x-full md:w-0"
          }`}
        >
          <Suspense
            fallback={
              <div className="w-64 h-full bg-slate-800 border-r border-slate-700/50 flex-shrink-0"></div>
            }
          >
            <div className="w-64 h-full flex-shrink-0">
              <Sidebar
                isConnected={isConnected}
                onNavigate={() => setIsMobileMenuOpen(false)}
              />
            </div>
          </Suspense>
        </div>

        <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          <Topbar
            onMenuClick={toggleSidebar}
            isSidebarOpen={isDesktopSidebarOpen}
          />

          <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 md:p-6">
            {children}
          </div>
        </main>
      </div>

      {toast && (
        <>
          <style>{`
            @keyframes slideInUp {
              from {
                transform: translateY(100%) scale(0.95);
                opacity: 0;
              }
              to {
                transform: translateY(0) scale(1);
                opacity: 1;
              }
            }
            .animate-slide-in-up {
              animation: slideInUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
          `}</style>
          <div className="fixed bottom-6 right-6 z-[9999] animate-slide-in-up">
            <div
              className={`flex items-center gap-3 px-5 py-3.5 rounded-xl border shadow-2xl backdrop-blur-md transition-all duration-300 min-w-[280px] max-w-sm ${
                toast.type === "error"
                  ? "bg-slate-900/90 border-red-500/30 text-red-200 shadow-red-950/20"
                  : toast.type === "warning"
                    ? "bg-slate-900/90 border-amber-500/30 text-amber-200 shadow-amber-950/20"
                    : "bg-slate-900/90 border-emerald-500/30 text-emerald-200 shadow-emerald-950/20"
              }`}
            >
              <div className="flex-shrink-0">
                {toast.type === "error" ? (
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse" />
                ) : toast.type === "warning" ? (
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)] animate-pulse" />
                ) : (
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
                )}
              </div>
              <div className="flex-1 text-xs font-semibold tracking-wide pr-2 break-words">
                {toast.message}
              </div>
              <button
                onClick={() => setToast(null)}
                className="flex-shrink-0 text-slate-500 hover:text-slate-300 text-xs font-bold w-5 h-5 rounded-full hover:bg-slate-800/50 flex items-center justify-center transition-colors focus:outline-none"
              >
                ✕
              </button>
            </div>
          </div>
        </>
      )}

      {/* Offline Alarm Banner */}
      {activeAlarm && (
        <>
          <style>{`
            @keyframes alarmPulse {
              0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
              50% { box-shadow: 0 0 0 10px rgba(239,68,68,0); }
            }
            .alarm-pulse { animation: alarmPulse 1.2s ease-in-out infinite; }
            @keyframes alarmSlideIn {
              from { transform: translateY(100%) scale(0.96); opacity: 0; }
              to { transform: translateY(0) scale(1); opacity: 1; }
            }
            .alarm-slide-in { animation: alarmSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
          `}</style>
          <div className="fixed bottom-6 left-6 z-[9998] alarm-slide-in max-w-xs w-full">
            <div className="flex flex-col gap-2 bg-slate-900/95 border border-red-500/50 rounded-xl shadow-2xl shadow-red-950/30 backdrop-blur-md p-3.5 alarm-pulse">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.9)] animate-pulse flex-shrink-0" />
                  <span className="text-xs font-bold text-red-300 uppercase tracking-wider">⚠ Alarm Offline</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setAlarmEnabled((v) => !v)}
                    title={alarmEnabled ? "Matikan alarm" : "Nyalakan alarm"}
                    className={`cursor-pointer text-[10px] px-2 py-0.5 rounded font-bold border transition ${alarmEnabled ? "bg-red-900/40 border-red-700/50 text-red-300 hover:bg-red-800/50" : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700"}`}
                  >
                    {alarmEnabled ? "🔔 ON" : "🔕 OFF"}
                  </button>
                  <button
                    onClick={() => { setActiveAlarm(null); clearTimeout(alarmTimerRef.current); }}
                    className="cursor-pointer text-slate-500 hover:text-slate-200 transition w-5 h-5 rounded-full hover:bg-slate-800/50 flex items-center justify-center text-xs"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-200 break-words leading-snug">{activeAlarm.msg}</p>
              <p className="text-[10px] text-slate-500">{activeAlarm.time.toLocaleTimeString("id-ID")}</p>
            </div>
          </div>
        </>
      )}
    </AppStateContext.Provider>
  );
}
