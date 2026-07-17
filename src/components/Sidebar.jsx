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
  Activity,
} from "lucide-react";

import { useAppState } from "@/App";
import { hasAccess, isLegacyAdmin, getStoredUser } from "@/lib/roles";

export default function Sidebar({ isConnected, onNavigate }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = pathname.startsWith("/settings")
    ? pathname.split("/")[2] || "core"
    : null;
  const { sessionUser } = useAppState();
  const [currentUser, setCurrentUser] = useState(null);

  const [expandedMenus, setExpandedMenus] = useState({
    monitoring: false,
    device: false,
    sites: false,
    report: false,
    settings: false,
  });

  const syncUser = () => setCurrentUser(getStoredUser());

  useEffect(() => {
    setExpandedMenus({
      monitoring: pathname.startsWith("/monitoring"),
      device: pathname.startsWith("/device"),
      sites: pathname.startsWith("/sites"),
      report: pathname.startsWith("/report"),
      settings: pathname.startsWith("/settings"),
    });
  }, [pathname]);

  const toggleMenu = (menu) => {
    setExpandedMenus((prev) => ({
      ...prev,
      [menu]: !prev[menu],
    }));
  };

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
            <button
              onClick={() => toggleMenu("monitoring")}
              className={`cursor-pointer flex items-center justify-between w-full px-4 py-3 rounded-lg transition duration-200 font-medium text-sm border-0 bg-transparent text-left outline-none ${
                pathname.startsWith("/monitoring")
                  ? "bg-slate-800/50 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <Monitor size={18} /> Monitoring
              </div>
              <ChevronDown
                size={16}
                className={`transition-transform ${expandedMenus.monitoring ? "rotate-180" : ""}`}
              />
            </button>

            {expandedMenus.monitoring && (
              <div className="pl-6 pr-2 py-1.5 flex flex-col gap-1 border-l border-slate-700/50 ml-6 mt-1 mb-2 ">
                {hasAccess(currentUser, "monitoring-l2tp", "read") && (
                  <Link
                    href="/monitoring/desa"
                    onClick={onNavigate}
                    scroll={false}
                    className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-md transition duration-200 ${
                      pathname.startsWith("/monitoring/desa")
                        ? "text-blue-400 bg-blue-500/10"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                    }`}
                  >
                    <Monitor size={14} /> Monitor Desa
                  </Link>
                )}
                {hasAccess(currentUser, "monitoring-pppoe", "read") && (
                  <Link
                    href="/monitoring/opd"
                    onClick={onNavigate}
                    scroll={false}
                    className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-md transition duration-200 ${
                      pathname.startsWith("/monitoring/opd")
                        ? "text-emerald-400 bg-emerald-500/10"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                    }`}
                  >
                    <Monitor size={14} /> Monitor OPD
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
            <button
              onClick={() => toggleMenu("device")}
              className={`cursor-pointer flex items-center justify-between w-full px-4 py-3 rounded-lg transition duration-200 font-medium text-sm border-0 bg-transparent text-left outline-none ${
                pathname.startsWith("/device")
                  ? "bg-slate-800/50 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <Server size={18} /> Perangkat Jaringan
              </div>
              <ChevronDown
                size={16}
                className={`transition-transform ${expandedMenus.device ? "rotate-180" : ""}`}
              />
            </button>

            {expandedMenus.device && (
              <div className="pl-6 pr-2 py-1.5 flex flex-col gap-1 border-l border-slate-700/50 ml-6 mt-1 mb-2">
                {hasAccess(currentUser, "devices-ruijie", "read") && (
                  <Link
                    href="/device/ruijie"
                    onClick={onNavigate}
                    scroll={false}
                    className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-md transition duration-200 ${
                      pathname.startsWith("/device/ruijie")
                        ? "text-emerald-400 bg-emerald-500/10"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                    }`}
                  >
                    <Wifi size={14} /> Ruijie AP
                  </Link>
                )}
                {hasAccess(currentUser, "devices-mikrotik", "read") && (
                  <Link
                    href="/device/mikrotik"
                    onClick={onNavigate}
                    scroll={false}
                    className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-md transition duration-200 ${
                      pathname.startsWith("/device/mikrotik")
                        ? "text-blue-400 bg-blue-500/10"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                    }`}
                  >
                    <Server size={14} /> Mikrotik RO
                  </Link>
                )}
                {hasAccess(currentUser, "devices-hsgq", "read") && (
                  <Link
                    href="/device/hsgq-olt"
                    onClick={onNavigate}
                    scroll={false}
                    className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-md transition duration-200 ${
                      pathname.startsWith("/device/hsgq-olt")
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
          <div className="flex flex-col gap-0.5">
            <button
              onClick={() => toggleMenu("sites")}
              className={`cursor-pointer flex items-center justify-between w-full px-4 py-3 rounded-lg transition duration-200 font-medium text-sm border-0 bg-transparent text-left outline-none ${
                pathname.startsWith("/sites")
                  ? "bg-slate-800/50 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <MapPin size={18} /> Data Wilayah
              </div>
              <ChevronDown
                size={16}
                className={`transition-transform ${expandedMenus.sites ? "rotate-180" : ""}`}
              />
            </button>

            {expandedMenus.sites && (
              <div className="pl-6 pr-2 py-1.5 flex flex-col gap-1 border-l border-slate-700/50 ml-6 mt-1 mb-2">
                <Link
                  href="/sites/desa"
                  onClick={onNavigate}
                  scroll={false}
                  className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-md transition duration-200 ${
                    pathname.startsWith("/sites/desa")
                      ? "text-blue-400 bg-blue-500/10"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                  }`}
                >
                  <MapPin size={14} /> Wilayah Desa
                </Link>
                <Link
                  href="/sites/opd"
                  onClick={onNavigate}
                  scroll={false}
                  className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-md transition duration-200 ${
                    pathname.startsWith("/sites/opd")
                      ? "text-purple-400 bg-purple-500/10"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                  }`}
                >
                  <MapPin size={14} /> Wilayah OPD
                </Link>
              </div>
            )}
          </div>
        )}

        {hasAccess(currentUser, "laporan-harian", "read") && (
          <div className="flex flex-col gap-0.5">
            <button
              onClick={() => toggleMenu("report")}
              className={`cursor-pointer flex items-center justify-between w-full px-4 py-3 rounded-lg transition duration-200 font-medium text-sm border-0 bg-transparent text-left outline-none ${
                pathname.startsWith("/report")
                  ? "bg-slate-800/50 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <ClipboardList size={18} /> Laporan Harian
              </div>
              <ChevronDown
                size={16}
                className={`transition-transform ${expandedMenus.report ? "rotate-180" : ""}`}
              />
            </button>

            {expandedMenus.report && (
              <div className="pl-6 pr-2 py-1.5 flex flex-col gap-1 border-l border-slate-700/50 ml-6 mt-1 mb-2">
                <Link
                  href="/report/dashboard"
                  onClick={onNavigate}
                  scroll={false}
                  className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-md transition duration-200 ${
                    pathname === "/report/dashboard"
                      ? "text-blue-400 bg-blue-500/10"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                  }`}
                >
                  <Activity size={14} /> Dashboard Laporan
                </Link>
                <Link
                  href="/report"
                  onClick={onNavigate}
                  scroll={false}
                  className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-md transition duration-200 ${
                    pathname === "/report"
                      ? "text-emerald-400 bg-emerald-500/10"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                  }`}
                >
                  <ClipboardList size={14} /> Kelola Laporan
                </Link>
              </div>
            )}
          </div>
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
          "settings-system",
        ].some((k) => hasAccess(currentUser, k, "read")) && (
          <div className="flex flex-col gap-0.5">
            <button
              onClick={() => toggleMenu("settings")}
              className={`cursor-pointer flex items-center justify-between w-full px-4 py-3 rounded-lg transition duration-200 font-medium text-sm border-0 bg-transparent text-left outline-none ${
                pathname.startsWith("/settings")
                  ? "bg-slate-800/50 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <Settings size={18} /> Pengaturan
              </div>
              <ChevronDown
                size={16}
                className={`transition-transform ${expandedMenus.settings ? "rotate-180" : ""}`}
              />
            </button>

            {expandedMenus.settings && (
              <div className="pl-6 pr-2 py-1.5 flex flex-col gap-1 border-l border-slate-700/50 ml-6 mt-1 mb-2">
                {hasAccess(currentUser, "settings-mikrotik", "read") && (
                  <Link
                    href="/settings/core"
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
                    href="/settings/vpn"
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
                    href="/settings/health"
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
                    href="/settings/whatsapp"
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
                    href="/settings/users"
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
                    href="/settings/roles"
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
                    href="/settings/password"
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
                {hasAccess(currentUser, "settings-system", "read") && (
                  <Link
                    href="/settings/system"
                    onClick={onNavigate}
                    scroll={false}
                    className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-md transition duration-200 ${
                      currentTab === "system"
                        ? "text-red-400 bg-red-500/10"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                    }`}
                  >
                    <Settings size={14} /> Konfigurasi Server
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
