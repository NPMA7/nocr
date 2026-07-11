"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Network,
  PieChart,
  GitGraph,
  Server,
  Settings,
  Database,
  Shield,
  Wifi,
  Monitor,
  Key,
  MapPin,
  ClipboardList,
  MessageCircle,
  ChevronDown,
  User,
} from "lucide-react";

import { useAppState } from "@/App";
import { hasAccess, isLegacyAdmin, getStoredUser } from "@/lib/roles";

export default function Sidebar({ isConnected, onNavigate }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") || "core";
  const { sessionUser } = useAppState();
  const [currentUser, setCurrentUser] = useState(null);

  const syncUser = () => setCurrentUser(getStoredUser());

  useEffect(() => {
    syncUser();
    const onRole = () => syncUser();
    window.addEventListener("nocr-role-updated", onRole);
    return () => window.removeEventListener("nocr-role-updated", onRole);
  }, []);

  useEffect(() => {
    if (sessionUser?.role) syncUser();
  }, [sessionUser]);

  const getLinkClass = (href) => {
    const isActive =
      pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
    return `flex items-center gap-3 px-4 py-3 text-slate-400 rounded-lg hover:bg-slate-800 hover:text-white transition duration-200 font-medium text-sm ${
      isActive ? "bg-blue-600 text-white hover:bg-blue-700" : ""
    }`;
  };

  const isAdmin = isLegacyAdmin(currentUser);

  return (
    <aside className="w-64 bg-slate-800 border-r border-slate-700/50 flex flex-col z-10 h-full">
      <div className="p-6 text-lg font-bold text-blue-500 flex flex-col gap-1 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <img
            src="/logo.png"
            alt="NOCR Logo"
            className="w-10 h-10 border-2 border-slate-600 rounded-full object-contain drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]"
          />
          <h1 className="text-lg font-bold text-blue-500">NOCR</h1>
          <div className="flex flex-col justify-center items-center">
            <span className="text-[10px] text-slate-400 font-normal">
              by: npma
            </span>
            <span className="text-[10px] text-slate-400 font-normal">
              v1.0.0
            </span>
          </div>
        </div>
        <span className="text-[12px] text-slate-400 font-normal mt-0.5">
          Network Operations Center
        </span>
      </div>

      <nav className="flex-1 p-4 flex flex-col gap-1 overflow-y-auto custom-scrollbar">
        {hasAccess(currentUser, "dashboard", "read") && (
          <Link
            href="/dashboard"
            onClick={onNavigate}
            scroll={false}
            className={getLinkClass("/dashboard")}
          >
            <PieChart size={18} /> Dashboard
          </Link>
        )}

        {hasAccess(currentUser, "topology", "read") && (
          <Link
            href="/topology"
            onClick={onNavigate}
            scroll={false}
            className={getLinkClass("/topology")}
          >
            <GitGraph size={18} /> Peta Topologi
          </Link>
        )}

        {["monitoring-l2tp", "monitoring-pppoe"].some((k) =>
          hasAccess(currentUser, k, "read"),
        ) && (
          <div className="flex flex-col gap-0.5">
            <Link
              href="/monitor-l2tp"
              onClick={onNavigate}
              scroll={false}
              className={`flex items-center justify-between w-full px-4 py-3 rounded-lg transition duration-200 font-medium text-sm ${
                pathname.startsWith("/monitor-l2tp") ||
                pathname.startsWith("/monitor-pppoe")
                  ? "bg-slate-800/50 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <Monitor size={18} /> Monitoring
              </div>
              <ChevronDown
                size={16}
                className={`transition-transform ${pathname.startsWith("/monitor-l2tp") || pathname.startsWith("/monitor-pppoe") ? "rotate-180" : ""}`}
              />
            </Link>

            {(pathname.startsWith("/monitor-l2tp") ||
              pathname.startsWith("/monitor-pppoe")) && (
              <div className="pl-6 pr-2 py-1.5 flex flex-col gap-1 border-l border-slate-700/50 ml-6 mt-1 mb-2 ">
                {hasAccess(currentUser, "monitoring-l2tp", "read") && (
                  <Link
                    href="/monitor-l2tp"
                    onClick={onNavigate}
                    scroll={false}
                    className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-md transition duration-200 ${
                      pathname.startsWith("/monitor-l2tp")
                        ? "text-blue-400 bg-blue-500/10"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                    }`}
                  >
                    <Monitor size={14} /> Monitor L2TP
                  </Link>
                )}
                {hasAccess(currentUser, "monitoring-pppoe", "read") && (
                  <Link
                    href="/monitor-pppoe"
                    onClick={onNavigate}
                    scroll={false}
                    className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-md transition duration-200 ${
                      pathname.startsWith("/monitor-pppoe")
                        ? "text-emerald-400 bg-emerald-500/10"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                    }`}
                  >
                    <Monitor size={14} /> Monitor PPPOE
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {["devices-ruijie", "devices-mikrotik", "devices-hsgq"].some((k) =>
          hasAccess(currentUser, k, "read"),
        ) && (
          <div className="flex flex-col gap-0.5">
            <Link
              href="/ruijie"
              onClick={onNavigate}
              scroll={false}
              className={`flex items-center justify-between w-full px-4 py-3 rounded-lg transition duration-200 font-medium text-sm ${
                pathname.startsWith("/mikrotik") ||
                pathname.startsWith("/ruijie") ||
                pathname.startsWith("/hsgq-olt")
                  ? "bg-slate-800/50 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <Server size={18} /> Perangkat Jaringan
              </div>
              <ChevronDown
                size={16}
                className={`transition-transform ${pathname.startsWith("/mikrotik") || pathname.startsWith("/ruijie") || pathname.startsWith("/hsgq-olt") ? "rotate-180" : ""}`}
              />
            </Link>

            {(pathname.startsWith("/mikrotik") ||
              pathname.startsWith("/ruijie") ||
              pathname.startsWith("/hsgq-olt")) && (
              <div className="pl-6 pr-2 py-1.5 flex flex-col gap-1 border-l border-slate-700/50 ml-6 mt-1 mb-2">
                {hasAccess(currentUser, "devices-ruijie", "read") && (
                  <Link
                    href="/ruijie"
                    onClick={onNavigate}
                    scroll={false}
                    className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-md transition duration-200 ${
                      pathname.startsWith("/ruijie")
                        ? "text-emerald-400 bg-emerald-500/10"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                    }`}
                  >
                    <Wifi size={14} /> Ruijie AP
                  </Link>
                )}
                {hasAccess(currentUser, "devices-mikrotik", "read") && (
                  <Link
                    href="/mikrotik"
                    onClick={onNavigate}
                    scroll={false}
                    className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-md transition duration-200 ${
                      pathname.startsWith("/mikrotik")
                        ? "text-blue-400 bg-blue-500/10"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                    }`}
                  >
                    <Server size={14} /> Mikrotik RO
                  </Link>
                )}
                {hasAccess(currentUser, "devices-hsgq", "read") && (
                  <Link
                    href="/hsgq-olt"
                    onClick={onNavigate}
                    scroll={false}
                    className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-md transition duration-200 ${
                      pathname.startsWith("/hsgq-olt")
                        ? "text-purple-400 bg-purple-500/10"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                    }`}
                  >
                    <Server size={14} /> HSGQ OLT
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {hasAccess(currentUser, "sites", "read") && (
          <Link
            href="/sites"
            onClick={onNavigate}
            scroll={false}
            className={getLinkClass("/sites")}
          >
            <MapPin size={18} /> Data Wilayah
          </Link>
        )}

        {hasAccess(currentUser, "laporan-harian", "read") && (
          <Link
            href="/daily-report"
            onClick={onNavigate}
            scroll={false}
            className={getLinkClass("/daily-report")}
          >
            <ClipboardList size={18} /> Laporan Harian
          </Link>
        )}

        {hasAccess(currentUser, "chat", "read") && (
          <Link
            href="/live-chat"
            onClick={onNavigate}
            scroll={false}
            className={getLinkClass("/live-chat")}
          >
            <MessageCircle size={18} /> Live Chat Omni
          </Link>
        )}

        {[
          "settings-mikrotik",
          "settings-vpn",
          "settings-health",
          "settings-wa",
          "settings-users",
          "settings-roles",
          "settings-password",
        ].some((k) => hasAccess(currentUser, k, "read")) && (
          <div className="flex flex-col gap-0.5">
            <Link
              href={`/settings?tab=${
                [
                  { key: "settings-mikrotik", tab: "core" },
                  { key: "settings-vpn", tab: "vpn" },
                  { key: "settings-health", tab: "health" },
                  { key: "settings-wa", tab: "whatsapp" },
                  { key: "settings-users", tab: "users" },
                  { key: "settings-roles", tab: "roles" },
                  { key: "settings-password", tab: "password" },
                ].find((item) => hasAccess(currentUser, item.key, "read"))?.tab || "core"
              }`}
              onClick={onNavigate}
              scroll={false}
              className={`${getLinkClass("/settings")} justify-between w-full`}
            >
              <div className="flex items-center gap-3">
                <Settings size={18} /> Pengaturan
              </div>
              <ChevronDown
                size={16}
                className={`transition-transform ${pathname.startsWith("/settings") ? "rotate-180" : ""}`}
              />
            </Link>

            {pathname.startsWith("/settings") && (
              <div className="pl-6 pr-2 py-1.5 flex flex-col gap-1 border-l border-slate-700/50 ml-6 mt-1 mb-2">
                {hasAccess(currentUser, "settings-mikrotik", "read") && (
                  <Link
                    href="/settings?tab=core"
                    onClick={onNavigate}
                    scroll={false}
                    className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-md transition duration-200 ${
                      currentTab === "core"
                        ? "text-blue-400 bg-blue-500/10"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                    }`}
                  >
                    <Server size={14} /> MikroTik Gateway
                  </Link>
                )}
                {hasAccess(currentUser, "settings-vpn", "read") && (
                  <Link
                    href="/settings?tab=vpn"
                    onClick={onNavigate}
                    scroll={false}
                    className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-md transition duration-200 ${
                      currentTab === "vpn"
                        ? "text-emerald-400 bg-emerald-500/10"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                    }`}
                  >
                    <Network size={14} /> VPN Connection
                  </Link>
                )}

                {hasAccess(currentUser, "settings-health", "read") && (
                  <Link
                    href="/settings?tab=health"
                    onClick={onNavigate}
                    scroll={false}
                    className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-md transition duration-200 ${
                      currentTab === "health"
                        ? "text-cyan-400 bg-cyan-500/10"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                    }`}
                  >
                    <Monitor size={14} /> Kesehatan Sistem & DB
                  </Link>
                )}
                {hasAccess(currentUser, "settings-wa", "read") && (
                  <Link
                    href="/settings?tab=whatsapp"
                    onClick={onNavigate}
                    scroll={false}
                    className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-md transition duration-200 ${
                      currentTab === "whatsapp"
                        ? "text-green-400 bg-green-500/10"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                    }`}
                  >
                    <MessageCircle size={14} /> WhatsApp Gateway
                  </Link>
                )}
                {hasAccess(currentUser, "settings-users", "read") && (
                  <Link
                    href="/settings?tab=users"
                    onClick={onNavigate}
                    scroll={false}
                    className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-md transition duration-200 ${
                      currentTab === "users"
                        ? "text-purple-400 bg-purple-500/10"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                    }`}
                  >
                    <User size={14} /> Manajemen Pengguna
                  </Link>
                )}
                {hasAccess(currentUser, "settings-roles", "read") && (
                  <Link
                    href="/settings?tab=roles"
                    onClick={onNavigate}
                    scroll={false}
                    className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-md transition duration-200 ${
                      currentTab === "roles"
                        ? "text-orange-400 bg-orange-500/10"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                    }`}
                  >
                    <Shield size={14} /> Manajemen Role
                  </Link>
                )}
                {hasAccess(currentUser, "settings-password", "read") && (
                  <Link
                    href="/settings?tab=password"
                    onClick={onNavigate}
                    scroll={false}
                    className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-md transition duration-200 ${
                      currentTab === "password"
                        ? "text-yellow-400 bg-yellow-500/10"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                    }`}
                  >
                    <Key size={14} /> Ubah Password
                  </Link>
                )}
              </div>
            )}
          </div>
        )}
      </nav>

      <div className="p-5 border-t border-slate-700/50 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${isConnected ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-slate-500"}`}
          ></span>
          <span>{isConnected ? "Server: Terhubung" : "Server: Terputus"}</span>
        </div>
      </div>
    </aside>
  );
}
