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

export default function Sidebar({
  isConnected,
  onNavigate,
  isCollapsed,
  onExpand,
}) {
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
    return `flex items-center ${isCollapsed ? "justify-center px-2" : "gap-3 px-4"} py-3 text-slate-400 rounded-lg hover:bg-slate-800 hover:text-white transition duration-200 font-medium text-sm ${
      isActive ? "bg-blue-600 text-white hover:bg-blue-700" : ""
    }`;
  };

  const handleParentClick = (menu) => {
    if (isCollapsed) {
      onExpand?.();
    } else {
      toggleMenu(menu);
    }
  };

  const isAdmin = isLegacyAdmin(currentUser);

  return (
    <aside
      className={`bg-slate-800 border-r border-slate-700/50 flex flex-col z-[3000] h-full transition-all duration-300 ${isCollapsed ? "w-16 overflow-visible" : "w-64 overflow-hidden"}`}
    >
      <div
        className={`p-4 flex flex-col gap-1 border-b border-slate-700/50 transition-all duration-300 ${isCollapsed ? "items-center" : "p-4"}`}
      >
        <div className="flex items-center gap-2">
          <img
            src="/logo.png"
            alt="NOCR Logo"
            className="w-10 h-10 border-2 border-slate-600 rounded-full object-contain flex-shrink-0 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]"
          />
          {!isCollapsed && (
            <div>
              <div className="flex">
                {/* <div className="flex items-center gap-2"> */}
                <h1 className="text-lg font-bold text-blue-500 whitespace-nowrap">
                  NOCR
                </h1>
                <span className="text-[10px] text-slate-400 font-normal">
                  v2.0.0
                </span>
                {/* <span className="text-[10px] text-slate-400 font-normal">
                  by: npma
                </span> */}
              </div>
              <span className="text-[12px] text-slate-400 font-normal whitespace overflow-hidden text-ellipsis">
                Network Operations Center
              </span>
            </div>
          )}
        </div>
      </div>

      <nav
        className={`flex-1 flex flex-col gap-1 transition-all duration-300 ${isCollapsed ? "p-2 items-center overflow-visible" : "p-4 overflow-y-auto custom-scrollbar"}`}
      >
        {hasAccess(currentUser, "dashboard", "read") && (
          <Link
            href="/dashboard"
            onClick={onNavigate}
            scroll={false}
            title={isCollapsed ? "Dashboard" : undefined}
            className={getLinkClass("/dashboard")}
          >
            <PieChart size={18} className="flex-shrink-0" />
            {!isCollapsed && <span>Dashboard</span>}
          </Link>
        )}

        {hasAccess(currentUser, "topology", "read") && (
          <Link
            href="/topology"
            onClick={onNavigate}
            scroll={false}
            title={isCollapsed ? "Peta Topologi" : undefined}
            className={getLinkClass("/topology")}
          >
            <GitGraph size={18} className="flex-shrink-0" />
            {!isCollapsed && <span>Peta Topologi</span>}
          </Link>
        )}
        {hasAccess(currentUser, "chat", "read") && (
          <Link
            href="/live-chat"
            onClick={onNavigate}
            scroll={false}
            title={isCollapsed ? "Live Chat Omni" : undefined}
            className={getLinkClass("/live-chat")}
          >
            <MessageCircle size={18} className="flex-shrink-0" />
            {!isCollapsed && <span>Live Chat Omni</span>}
          </Link>
        )}
        {["monitoring-l2tp", "monitoring-pppoe"].some((k) =>
          hasAccess(currentUser, k, "read"),
        ) && (
          <div className="flex flex-col gap-0.5 w-full relative group">
            <button
              onClick={() => handleParentClick("monitoring")}
              className={`cursor-pointer flex items-center ${isCollapsed ? "justify-center px-2" : "justify-between px-4"} py-3 rounded-lg transition duration-200 font-medium text-sm border-0 bg-transparent text-left outline-none w-full ${
                pathname.startsWith("/monitoring")
                  ? "bg-slate-800/50 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <Monitor size={18} className="flex-shrink-0" />
                {!isCollapsed && <span>Monitoring</span>}
              </div>
              {!isCollapsed && (
                <ChevronDown
                  size={16}
                  className={`transition-transform ${expandedMenus.monitoring ? "rotate-180" : ""}`}
                />
              )}
            </button>

            {/* Collapsed Hover Flyout */}
            {isCollapsed && (
              <div className="absolute left-[100%] top-0 pl-2 hidden group-hover:block z-[9999]">
                <div className="bg-slate-900 border border-slate-700/80 rounded-lg shadow-2xl py-2 px-1.5 w-48 flex flex-col gap-1 backdrop-blur-md max-h-[380px] overflow-y-auto custom-scrollbar">
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-700/30 mb-1 sticky top-0 bg-slate-900 z-10">
                    Monitoring
                  </div>
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
                      <Monitor size={14} className="flex-shrink-0" />
                      <span>Monitor Desa</span>
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
                      <Monitor size={14} className="flex-shrink-0" />
                      <span>Monitor OPD</span>
                    </Link>
                  )}
                </div>
              </div>
            )}

            {!isCollapsed && expandedMenus.monitoring && (
              <div className="pl-6 pr-2 py-1.5 flex flex-col gap-1 border-l border-slate-700/50 ml-6 mt-1 mb-2">
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
                    <Monitor size={14} className="flex-shrink-0" />
                    <span>Monitor Desa</span>
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
                    <Monitor size={14} className="flex-shrink-0" />
                    <span>Monitor OPD</span>
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {["devices-ruijie", "devices-mikrotik", "devices-hsgq"].some((k) =>
          hasAccess(currentUser, k, "read"),
        ) && (
          <div className="flex flex-col gap-0.5 w-full relative group">
            <button
              onClick={() => handleParentClick("device")}
              className={`cursor-pointer flex items-center ${isCollapsed ? "justify-center px-2" : "justify-between px-4"} py-3 rounded-lg transition duration-200 font-medium text-sm border-0 bg-transparent text-left outline-none w-full ${
                pathname.startsWith("/device")
                  ? "bg-slate-800/50 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <Server size={18} className="flex-shrink-0" />
                {!isCollapsed && <span>Perangkat Jaringan</span>}
              </div>
              {!isCollapsed && (
                <ChevronDown
                  size={16}
                  className={`transition-transform ${expandedMenus.device ? "rotate-180" : ""}`}
                />
              )}
            </button>

            {/* Collapsed Hover Flyout */}
            {isCollapsed && (
              <div className="absolute left-[100%] top-0 pl-2 hidden group-hover:block z-[9999]">
                <div className="bg-slate-900 border border-slate-700/80 rounded-lg shadow-2xl py-2 px-1.5 w-48 flex flex-col gap-1 backdrop-blur-md max-h-[380px] overflow-y-auto custom-scrollbar">
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-700/30 mb-1 sticky top-0 bg-slate-900 z-10">
                    Perangkat Jaringan
                  </div>
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
                      <Wifi size={14} className="flex-shrink-0" />
                      <span>Ruijie AP</span>
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
                      <Server size={14} className="flex-shrink-0" />
                      <span>Mikrotik RO</span>
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
                      <Server size={14} className="flex-shrink-0" />
                      <span>HSGQ OLT</span>
                    </Link>
                  )}
                </div>
              </div>
            )}

            {!isCollapsed && expandedMenus.device && (
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
                    <Wifi size={14} className="flex-shrink-0" />
                    <span>Ruijie AP</span>
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
                    <Server size={14} className="flex-shrink-0" />
                    <span>Mikrotik RO</span>
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
                    <Server size={14} className="flex-shrink-0" />
                    <span>HSGQ OLT</span>
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {hasAccess(currentUser, "sites", "read") && (
          <div className="flex flex-col gap-0.5 w-full relative group">
            <button
              onClick={() => handleParentClick("sites")}
              className={`cursor-pointer flex items-center ${isCollapsed ? "justify-center px-2" : "justify-between px-4"} py-3 rounded-lg transition duration-200 font-medium text-sm border-0 bg-transparent text-left outline-none w-full ${
                pathname.startsWith("/sites")
                  ? "bg-slate-800/50 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <MapPin size={18} className="flex-shrink-0" />
                {!isCollapsed && <span>Data Wilayah</span>}
              </div>
              {!isCollapsed && (
                <ChevronDown
                  size={16}
                  className={`transition-transform ${expandedMenus.sites ? "rotate-180" : ""}`}
                />
              )}
            </button>

            {/* Collapsed Hover Flyout */}
            {isCollapsed && (
              <div className="absolute left-[100%] top-0 pl-2 hidden group-hover:block z-[9999]">
                <div className="bg-slate-900 border border-slate-700/80 rounded-lg shadow-2xl py-2 px-1.5 w-48 flex flex-col gap-1 backdrop-blur-md max-h-[380px] overflow-y-auto custom-scrollbar">
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-700/30 mb-1 sticky top-0 bg-slate-900 z-10">
                    Data Wilayah
                  </div>
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
                    <MapPin size={14} className="flex-shrink-0" />
                    <span>Wilayah Desa</span>
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
                    <MapPin size={14} className="flex-shrink-0" />
                    <span>Wilayah OPD</span>
                  </Link>
                </div>
              </div>
            )}

            {!isCollapsed && expandedMenus.sites && (
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
                  <MapPin size={14} className="flex-shrink-0" />
                  <span>Wilayah Desa</span>
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
                  <MapPin size={14} className="flex-shrink-0" />
                  <span>Wilayah OPD</span>
                </Link>
              </div>
            )}
          </div>
        )}

        {hasAccess(currentUser, "laporan-harian", "read") && (
          <div className="flex flex-col gap-0.5 w-full relative group">
            <button
              onClick={() => handleParentClick("report")}
              className={`cursor-pointer flex items-center ${isCollapsed ? "justify-center px-2" : "justify-between px-4"} py-3 rounded-lg transition duration-200 font-medium text-sm border-0 bg-transparent text-left outline-none w-full ${
                pathname.startsWith("/report")
                  ? "bg-slate-800/50 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <ClipboardList size={18} className="flex-shrink-0" />
                {!isCollapsed && <span>Laporan Harian</span>}
              </div>
              {!isCollapsed && (
                <ChevronDown
                  size={16}
                  className={`transition-transform ${expandedMenus.report ? "rotate-180" : ""}`}
                />
              )}
            </button>

            {/* Collapsed Hover Flyout */}
            {isCollapsed && (
              <div className="absolute left-[100%] top-0 pl-2 hidden group-hover:block z-[9999]">
                <div className="bg-slate-900 border border-slate-700/80 rounded-lg shadow-2xl py-2 px-1.5 w-48 flex flex-col gap-1 backdrop-blur-md max-h-[380px] overflow-y-auto custom-scrollbar">
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-700/30 mb-1 sticky top-0 bg-slate-900 z-10">
                    Laporan Harian
                  </div>
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
                    <Activity size={14} className="flex-shrink-0" />
                    <span>Dashboard Laporan</span>
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
                    <ClipboardList size={14} className="flex-shrink-0" />
                    <span>Kelola Laporan</span>
                  </Link>
                </div>
              </div>
            )}

            {!isCollapsed && expandedMenus.report && (
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
                  <Activity size={14} className="flex-shrink-0" />
                  <span>Dashboard Laporan</span>
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
                  <ClipboardList size={14} className="flex-shrink-0" />
                  <span>Kelola Laporan</span>
                </Link>
              </div>
            )}
          </div>
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
          <div className="flex flex-col gap-0.5 w-full relative group">
            <button
              onClick={() => handleParentClick("settings")}
              className={`cursor-pointer flex items-center ${isCollapsed ? "justify-center px-2" : "justify-between px-4"} py-3 rounded-lg transition duration-200 font-medium text-sm border-0 bg-transparent text-left outline-none w-full ${
                pathname.startsWith("/settings")
                  ? "bg-slate-800/50 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <Settings size={18} className="flex-shrink-0" />
                {!isCollapsed && <span>Pengaturan</span>}
              </div>
              {!isCollapsed && (
                <ChevronDown
                  size={16}
                  className={`transition-transform ${expandedMenus.settings ? "rotate-180" : ""}`}
                />
              )}
            </button>

            {/* Collapsed Hover Flyout */}
            {isCollapsed && (
              <div className="absolute left-[100%] bottom-0 pl-2 hidden group-hover:block z-[9999]">
                <div className="bg-slate-900 border border-slate-700/80 rounded-lg shadow-2xl py-2 px-1.5 w-52 flex flex-col gap-1 backdrop-blur-md max-h-[380px] overflow-y-auto custom-scrollbar">
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-700/30 mb-1 sticky top-0 bg-slate-900 z-10">
                    Pengaturan
                  </div>
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
                      <Server size={14} className="flex-shrink-0" />
                      <span>MikroTik Gateway</span>
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
                      <Network size={14} className="flex-shrink-0" />
                      <span>VPN Connection</span>
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
                      <Monitor size={14} className="flex-shrink-0" />
                      <span>Kesehatan Sistem & DB</span>
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
                      <MessageCircle size={14} className="flex-shrink-0" />
                      <span>WhatsApp Gateway</span>
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
                      <User size={14} className="flex-shrink-0" />
                      <span>Manajemen Pengguna</span>
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
                      <Shield size={14} className="flex-shrink-0" />
                      <span>Manajemen Role</span>
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
                      <Key size={14} className="flex-shrink-0" />
                      <span>Ubah Password</span>
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
                      <Settings size={14} className="flex-shrink-0" />
                      <span>Konfigurasi Server</span>
                    </Link>
                  )}
                </div>
              </div>
            )}

            {!isCollapsed && expandedMenus.settings && (
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
                    <Server size={14} className="flex-shrink-0" />
                    <span>MikroTik Gateway</span>
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
                    <Network size={14} className="flex-shrink-0" />
                    <span>VPN Connection</span>
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
                    <Monitor size={14} className="flex-shrink-0" />
                    <span>Kesehatan Sistem & DB</span>
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
                    <MessageCircle size={14} className="flex-shrink-0" />
                    <span>WhatsApp Gateway</span>
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
                    <User size={14} className="flex-shrink-0" />
                    <span>Manajemen Pengguna</span>
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
                    <Shield size={14} className="flex-shrink-0" />
                    <span>Manajemen Role</span>
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
                    <Key size={14} className="flex-shrink-0" />
                    <span>Ubah Password</span>
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
                    <Settings size={14} className="flex-shrink-0" />
                    <span>Konfigurasi Server</span>
                  </Link>
                )}
              </div>
            )}
          </div>
        )}
      </nav>

      <div
        className={`p-5 border-t border-slate-700/50 text-xs text-slate-400 transition-all duration-300 ${isCollapsed ? "flex justify-center p-4" : ""}`}
      >
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isConnected ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-slate-500"}`}
          ></span>
          {!isCollapsed && (
            <span>
              {isConnected ? "Server: Terhubung" : "Server: Terputus"}
            </span>
          )}
        </div>
      </div>
    </aside>
  );
}
