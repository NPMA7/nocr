"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import {
  PieChart,
  GitGraph,
  Server,
  Settings,
  Monitor,
  Key,
  MapPin,
  ClipboardList,
  ChevronDown,
  Activity,
  Palette,
  Building2,
  Wifi,
  Shield,
  Lock,
  User,
  Users,
} from "lucide-react";

import { useAppState } from "@/App";
import { hasAccess, getStoredUser } from "@/lib/roles";

export default function Sidebar({
  isConnected,
  onNavigate,
  isCollapsed,
  onExpand,
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = pathname.startsWith("/settings")
    ? pathname.split("/")[2] || searchParams.get("tab") || "company"
    : null;
  const { sessionUser } = useAppState();
  const [currentUser, setCurrentUser] = useState(null);
  const [companyInfo, setCompanyInfo] = useState({
    name: "PT Milenial Inti Telekomunikasi",
    region: "Kabupaten Bandung",
  });

  useEffect(() => {
    const fetchCompany = () => {
      fetch("/api/settings/company")
        .then((res) => res.json())
        .then((data) => {
          if (data && data.name) {
            setCompanyInfo({
              name: data.name,
              region: data.region || "Kabupaten Bandung",
            });
          }
        })
        .catch(() => {});
    };

    fetchCompany();
    window.addEventListener("nocr-company-updated", fetchCompany);
    return () => window.removeEventListener("nocr-company-updated", fetchCompany);
  }, []);

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
      report: pathname.startsWith("/report") || pathname.startsWith("/daily-reports"),
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
    return `group flex items-center ${
      isCollapsed ? "justify-center px-2 w-full" : "gap-3 px-3 w-full"
    } py-2.5 min-h-[36px] rounded-lg transition-all duration-150 text-xs ${
      isActive
        ? "active-sidebar-item font-medium"
        : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50 font-normal"
    }`;
  };

  const getSubLinkClass = (isActive) => {
    return `flex items-center gap-2 px-3 py-2 min-h-[32px] text-xs rounded-lg transition-colors ${
      isActive
        ? "active-sidebar-subitem font-medium"
        : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 font-normal"
    }`;
  };

  const handleParentClick = (menu) => {
    if (isCollapsed) {
      onExpand?.();
    } else {
      toggleMenu(menu);
    }
  };

  return (
    <aside
      className={`bg-slate-950/95 border-r border-slate-800/80 flex flex-col z-[3000] h-full transition-all duration-300 ${
        isCollapsed ? "w-16 overflow-visible" : "w-64 overflow-hidden"
      } backdrop-blur-md`}
    >
      {/* ─── Header: Brand Logo & Title ───────────────────────────────── */}
      <div
        className={`h-14 flex items-center border-b border-slate-800/80 transition-all ${
          isCollapsed ? "justify-center px-2" : "px-4 gap-3"
        }`}
      >
        <div className="relative flex-shrink-0">
          <img
            src="/logo.png"
            alt="NOCR Logo"
            className="w-8 h-8 rounded-lg border border-slate-700/80 object-cover shadow-sm"
          />
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-2 ring-slate-950 ${
              isConnected ? "bg-emerald-400" : "bg-rose-500"
            }`}
          />
        </div>

        {!isCollapsed && (
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-100 font-mono tracking-wider">
                NOCR
              </span>
            </div>
            <p className="text-[10px] text-slate-400 tracking-normal font-medium truncate">
              Operations Center
            </p>
          </div>
        )}
      </div>

      {/* ─── Navigation Links ─────────────────────────────────────────── */}
      <nav
        className={`flex-1 flex flex-col gap-1 transition-all duration-300 ${
          isCollapsed
            ? "p-2 items-center overflow-visible"
            : "p-3 overflow-y-auto custom-scrollbar"
        }`}
      >
        {/* Category: MENU UTAMA */}
        {!isCollapsed && (
          <span className="text-[10px] font-semibold font-mono tracking-wider uppercase text-slate-400 px-3 pt-2 pb-1">
            Menu Utama
          </span>
        )}

        {/* 1. Dashboard */}
        {hasAccess(currentUser, "dashboard", "read") && (
          <Link
            href="/dashboard"
            onClick={onNavigate}
            scroll={false}
            title={isCollapsed ? "Dashboard Utama" : undefined}
            className={getLinkClass("/dashboard")}
          >
            <PieChart size={16} className="flex-shrink-0 group-hover:scale-105 transition-transform" />
            {!isCollapsed && <span>Dashboard</span>}
          </Link>
        )}

        {/* 2. Peta Wilayah */}
        {hasAccess(currentUser, "topology", "read") && (
          <Link
            href="/maps"
            onClick={onNavigate}
            scroll={false}
            title={isCollapsed ? "Peta Wilayah" : undefined}
            className={getLinkClass("/maps")}
          >
            <MapPin size={16} className="flex-shrink-0 group-hover:scale-105 transition-transform" />
            {!isCollapsed && <span>Peta Wilayah</span>}
          </Link>
        )}

        {/* 3. Topologi Jaringan */}
        {hasAccess(currentUser, "topology", "read") && (
          <Link
            href="/topology"
            onClick={onNavigate}
            scroll={false}
            title={isCollapsed ? "Topologi Jaringan" : undefined}
            className={getLinkClass("/topology")}
          >
            <GitGraph size={16} className="flex-shrink-0 group-hover:scale-105 transition-transform" />
            {!isCollapsed && <span>Topologi Jaringan</span>}
          </Link>
        )}

        {/* Category: MONITORING & INFRA */}
        {!isCollapsed && (
          <span className="text-[10px] font-semibold font-mono tracking-wider uppercase text-slate-400 px-3 pt-3.5 pb-1">
            Monitoring & Infra
          </span>
        )}

        {/* 4. Monitoring (Dropdown) */}
        {["monitoring-l2tp", "monitoring-pppoe", "monitoring-traffic"].some((k) =>
          hasAccess(currentUser, k, "read"),
        ) && (
          <div className="flex flex-col gap-0.5 w-full relative group">
            <button
              onClick={() => handleParentClick("monitoring")}
              className={`cursor-pointer flex items-center ${
                isCollapsed ? "justify-center px-2" : "justify-between px-3"
              } py-2.5 min-h-[36px] rounded-lg transition-all text-xs border-0 bg-transparent text-left outline-none w-full ${
                pathname.startsWith("/monitoring")
                  ? "active-sidebar-item font-medium"
                  : "text-slate-400 hover:bg-slate-900/50 hover:text-slate-200 font-normal"
              }`}
            >
              <div className="flex items-center gap-3">
                <Monitor size={16} className="flex-shrink-0" />
                {!isCollapsed && <span>Monitoring</span>}
              </div>
              {!isCollapsed && (
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 text-slate-500 ${
                    expandedMenus.monitoring ? "rotate-180 text-slate-300" : ""
                  }`}
                />
              )}
            </button>

            {/* Collapsed Flyout */}
            {isCollapsed && (
              <div className="absolute left-[100%] top-0 pl-1.5 hidden group-hover:block z-[9999]">
                <div className="bg-slate-900/95 border border-slate-800 rounded-lg shadow-2xl py-1.5 px-1 w-48 flex flex-col gap-0.5 backdrop-blur-md">
                  <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 mb-1 font-mono">
                    Monitoring
                  </div>
                  {hasAccess(currentUser, "monitoring-l2tp", "read") && (
                    <Link
                      href="/monitoring/desa"
                      onClick={onNavigate}
                      scroll={false}
                      className={getSubLinkClass(pathname.startsWith("/monitoring/desa"))}
                    >
                      <Monitor size={13} />
                      <span>Monitor Desa</span>
                    </Link>
                  )}
                  {hasAccess(currentUser, "monitoring-pppoe", "read") && (
                    <Link
                      href="/monitoring/opd"
                      onClick={onNavigate}
                      scroll={false}
                      className={getSubLinkClass(pathname.startsWith("/monitoring/opd"))}
                    >
                      <Monitor size={13} />
                      <span>Monitor OPD</span>
                    </Link>
                  )}
                  {hasAccess(currentUser, "monitoring-traffic", "read") && (
                    <Link
                      href="/monitoring/traffic"
                      onClick={onNavigate}
                      scroll={false}
                      className={getSubLinkClass(pathname.startsWith("/monitoring/traffic"))}
                    >
                      <Activity size={13} />
                      <span>Traffic Semua Site</span>
                    </Link>
                  )}
                </div>
              </div>
            )}

            {!isCollapsed && expandedMenus.monitoring && (
              <div className="ml-4 pl-3 border-l border-slate-800/80 my-1 flex flex-col gap-1">
                {hasAccess(currentUser, "monitoring-l2tp", "read") && (
                  <Link
                    href="/monitoring/desa"
                    onClick={onNavigate}
                    scroll={false}
                    className={getSubLinkClass(pathname.startsWith("/monitoring/desa"))}
                  >
                    <span>Monitor Desa</span>
                  </Link>
                )}
                {hasAccess(currentUser, "monitoring-pppoe", "read") && (
                  <Link
                    href="/monitoring/opd"
                    onClick={onNavigate}
                    scroll={false}
                    className={getSubLinkClass(pathname.startsWith("/monitoring/opd"))}
                  >
                    <span>Monitor OPD</span>
                  </Link>
                )}
                {hasAccess(currentUser, "monitoring-traffic", "read") && (
                  <Link
                    href="/monitoring/traffic"
                    onClick={onNavigate}
                    scroll={false}
                    className={getSubLinkClass(pathname.startsWith("/monitoring/traffic"))}
                  >
                    <span>Traffic Semua Site</span>
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {/* 5. Perangkat Jaringan (Dropdown) */}
        {["devices-ruijie", "devices-mikrotik", "devices-hsgq"].some((k) =>
          hasAccess(currentUser, k, "read"),
        ) && (
          <div className="flex flex-col gap-0.5 w-full relative group">
            <button
              onClick={() => handleParentClick("device")}
              className={`cursor-pointer flex items-center ${
                isCollapsed ? "justify-center px-2" : "justify-between px-3"
              } py-2.5 min-h-[36px] rounded-lg transition-all text-xs border-0 bg-transparent text-left outline-none w-full ${
                pathname.startsWith("/device")
                  ? "active-sidebar-item font-medium"
                  : "text-slate-400 hover:bg-slate-900/50 hover:text-slate-200 font-normal"
              }`}
            >
              <div className="flex items-center gap-3">
                <Server size={16} className="flex-shrink-0" />
                {!isCollapsed && <span>Perangkat Jaringan</span>}
              </div>
              {!isCollapsed && (
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 text-slate-500 ${
                    expandedMenus.device ? "rotate-180 text-slate-300" : ""
                  }`}
                />
              )}
            </button>

            {/* Collapsed Flyout */}
            {isCollapsed && (
              <div className="absolute left-[100%] top-0 pl-1.5 hidden group-hover:block z-[9999]">
                <div className="bg-slate-900/95 border border-slate-800 rounded-lg shadow-2xl py-1.5 px-1 w-48 flex flex-col gap-0.5 backdrop-blur-md">
                  <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 mb-1 font-mono">
                    Perangkat Jaringan
                  </div>
                  {hasAccess(currentUser, "devices-ruijie", "read") && (
                    <Link
                      href="/device/ruijie"
                      onClick={onNavigate}
                      scroll={false}
                      className={getSubLinkClass(pathname.startsWith("/device/ruijie"))}
                    >
                      <Wifi size={13} />
                      <span>Ruijie AP</span>
                    </Link>
                  )}
                  {hasAccess(currentUser, "devices-mikrotik", "read") && (
                    <Link
                      href="/device/mikrotik"
                      onClick={onNavigate}
                      scroll={false}
                      className={getSubLinkClass(pathname.startsWith("/device/mikrotik"))}
                    >
                      <Server size={13} />
                      <span>MikroTik Core</span>
                    </Link>
                  )}
                  {hasAccess(currentUser, "devices-hsgq", "read") && (
                    <Link
                      href="/device/hsgq-olt"
                      onClick={onNavigate}
                      scroll={false}
                      className={getSubLinkClass(pathname.startsWith("/device/hsgq-olt"))}
                    >
                      <Server size={13} />
                      <span>HSGQ OLT</span>
                    </Link>
                  )}
                </div>
              </div>
            )}

            {!isCollapsed && expandedMenus.device && (
              <div className="ml-4 pl-3 border-l border-slate-800/80 my-1 flex flex-col gap-1">
                {hasAccess(currentUser, "devices-ruijie", "read") && (
                  <Link
                    href="/device/ruijie"
                    onClick={onNavigate}
                    scroll={false}
                    className={getSubLinkClass(pathname.startsWith("/device/ruijie"))}
                  >
                    <span>Ruijie AP</span>
                  </Link>
                )}
                {hasAccess(currentUser, "devices-mikrotik", "read") && (
                  <Link
                    href="/device/mikrotik"
                    onClick={onNavigate}
                    scroll={false}
                    className={getSubLinkClass(pathname.startsWith("/device/mikrotik"))}
                  >
                    <span>MikroTik Core</span>
                  </Link>
                )}
                {hasAccess(currentUser, "devices-hsgq", "read") && (
                  <Link
                    href="/device/hsgq-olt"
                    onClick={onNavigate}
                    scroll={false}
                    className={getSubLinkClass(pathname.startsWith("/device/hsgq-olt"))}
                  >
                    <span>HSGQ OLT</span>
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {/* 6. Data Wilayah (Dropdown) */}
        {hasAccess(currentUser, "sites", "read") && (
          <div className="flex flex-col gap-0.5 w-full relative group">
            <button
              onClick={() => handleParentClick("sites")}
              className={`cursor-pointer flex items-center ${
                isCollapsed ? "justify-center px-2" : "justify-between px-3"
              } py-2.5 min-h-[36px] rounded-lg transition-all text-xs border-0 bg-transparent text-left outline-none w-full ${
                pathname.startsWith("/sites")
                  ? "active-sidebar-item font-medium"
                  : "text-slate-400 hover:bg-slate-900/50 hover:text-slate-200 font-normal"
              }`}
            >
              <div className="flex items-center gap-3">
                <MapPin size={16} className="flex-shrink-0" />
                {!isCollapsed && <span>Data Wilayah</span>}
              </div>
              {!isCollapsed && (
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 text-slate-500 ${
                    expandedMenus.sites ? "rotate-180 text-slate-300" : ""
                  }`}
                />
              )}
            </button>

            {/* Collapsed Flyout */}
            {isCollapsed && (
              <div className="absolute left-[100%] top-0 pl-1.5 hidden group-hover:block z-[9999]">
                <div className="bg-slate-900/95 border border-slate-800 rounded-lg shadow-2xl py-1.5 px-1 w-48 flex flex-col gap-0.5 backdrop-blur-md">
                  <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 mb-1 font-mono">
                    Data Wilayah
                  </div>
                  <Link
                    href="/sites/desa"
                    onClick={onNavigate}
                    scroll={false}
                    className={getSubLinkClass(pathname.startsWith("/sites/desa"))}
                  >
                    <span>Wilayah Desa</span>
                  </Link>
                  <Link
                    href="/sites/opd"
                    onClick={onNavigate}
                    scroll={false}
                    className={getSubLinkClass(pathname.startsWith("/sites/opd"))}
                  >
                    <span>Wilayah OPD</span>
                  </Link>
                </div>
              </div>
            )}

            {!isCollapsed && expandedMenus.sites && (
              <div className="ml-4 pl-3 border-l border-slate-800/80 my-1 flex flex-col gap-1">
                <Link
                  href="/sites/desa"
                  onClick={onNavigate}
                  scroll={false}
                  className={getSubLinkClass(pathname.startsWith("/sites/desa"))}
                >
                  <span>Wilayah Desa</span>
                </Link>
                <Link
                  href="/sites/opd"
                  onClick={onNavigate}
                  scroll={false}
                  className={getSubLinkClass(pathname.startsWith("/sites/opd"))}
                >
                  <span>Wilayah OPD</span>
                </Link>
              </div>
            )}
          </div>
        )}

        {/* 7. Laporan Harian (Dropdown) */}
        {hasAccess(currentUser, "laporan-harian", "read") && (
          <div className="flex flex-col gap-0.5 w-full relative group">
            <button
              onClick={() => handleParentClick("report")}
              className={`cursor-pointer flex items-center ${
                isCollapsed ? "justify-center px-2" : "justify-between px-3"
              } py-2.5 min-h-[36px] rounded-lg transition-all text-xs border-0 bg-transparent text-left outline-none w-full ${
                pathname.startsWith("/report") || pathname.startsWith("/daily-reports")
                  ? "active-sidebar-item font-medium"
                  : "text-slate-400 hover:bg-slate-900/50 hover:text-slate-200 font-normal"
              }`}
            >
              <div className="flex items-center gap-3">
                <ClipboardList size={16} className="flex-shrink-0" />
                {!isCollapsed && <span>Laporan Harian</span>}
              </div>
              {!isCollapsed && (
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 text-slate-500 ${
                    expandedMenus.report ? "rotate-180 text-slate-300" : ""
                  }`}
                />
              )}
            </button>

            {/* Collapsed Flyout */}
            {isCollapsed && (
              <div className="absolute left-[100%] top-0 pl-1.5 hidden group-hover:block z-[9999]">
                <div className="bg-slate-900/95 border border-slate-800 rounded-lg shadow-2xl py-1.5 px-1 w-48 flex flex-col gap-0.5 backdrop-blur-md">
                  <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 mb-1 font-mono">
                    Laporan Harian
                  </div>
                  <Link
                    href="/report/dashboard"
                    onClick={onNavigate}
                    scroll={false}
                    className={getSubLinkClass(pathname === "/report/dashboard" || pathname === "/daily-reports/dashboard")}
                  >
                    <span>Dashboard Laporan</span>
                  </Link>
                  <Link
                    href="/report"
                    onClick={onNavigate}
                    scroll={false}
                    className={getSubLinkClass(pathname === "/report" || pathname === "/daily-reports")}
                  >
                    <span>Kelola Laporan</span>
                  </Link>
                </div>
              </div>
            )}

            {!isCollapsed && expandedMenus.report && (
              <div className="ml-4 pl-3 border-l border-slate-800/80 my-1 flex flex-col gap-1">
                <Link
                  href="/report/dashboard"
                  onClick={onNavigate}
                  scroll={false}
                  className={getSubLinkClass(pathname === "/report/dashboard" || pathname === "/daily-reports/dashboard")}
                >
                  <span>Dashboard Laporan</span>
                </Link>
                <Link
                  href="/report"
                  onClick={onNavigate}
                  scroll={false}
                  className={getSubLinkClass(pathname === "/report" || pathname === "/daily-reports")}
                >
                  <span>Kelola Laporan</span>
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Category: KONFIGURASI */}
        {!isCollapsed && (
          <span className="text-[10px] font-semibold font-mono tracking-wider uppercase text-slate-400 px-3 pt-3.5 pb-1">
            Konfigurasi
          </span>
        )}

        {/* 8. Pengaturan (Dropdown) */}
        {hasAccess(currentUser, "settings", "read") && (
          <div className="flex flex-col gap-0.5 w-full relative group">
            <button
              onClick={() => handleParentClick("settings")}
              className={`cursor-pointer flex items-center ${
                isCollapsed ? "justify-center px-2" : "justify-between px-3"
              } py-2.5 min-h-[36px] rounded-lg transition-all text-xs border-0 bg-transparent text-left outline-none w-full ${
                pathname.startsWith("/settings")
                  ? "active-sidebar-item font-medium"
                  : "text-slate-400 hover:bg-slate-900/50 hover:text-slate-200 font-normal"
              }`}
            >
              <div className="flex items-center gap-3">
                <Settings size={16} className="flex-shrink-0" />
                {!isCollapsed && <span>Pengaturan</span>}
              </div>
              {!isCollapsed && (
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 text-slate-500 ${
                    expandedMenus.settings ? "rotate-180 text-slate-300" : ""
                  }`}
                />
              )}
            </button>

            {/* Collapsed Flyout */}
            {isCollapsed && (
              <div className="absolute left-[100%] top-0 pl-1.5 hidden group-hover:block z-[9999]">
                <div className="bg-slate-900/95 border border-slate-800 rounded-lg shadow-2xl py-1.5 px-1 w-52 flex flex-col gap-0.5 backdrop-blur-md">
                  <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 mb-1 font-mono">
                    Pengaturan Sistem
                  </div>
                  {hasAccess(currentUser, "settings-company", "read") && (
                    <Link
                      href="/settings/company"
                      onClick={onNavigate}
                      scroll={false}
                      className={getSubLinkClass(currentTab === "company" || currentTab === "profile")}
                    >
                      <Building2 size={13} />
                      <span>Profil Perusahaan</span>
                    </Link>
                  )}
                  {(hasAccess(currentUser, "settings-system", "read") ||
                    hasAccess(currentUser, "settings-mikrotik", "read") ||
                    hasAccess(currentUser, "settings-vpn", "read")) && (
                    <Link
                      href="/settings/system"
                      onClick={onNavigate}
                      scroll={false}
                      className={getSubLinkClass(
                        currentTab === "system" ||
                          currentTab === "server" ||
                          currentTab === "core" ||
                          currentTab === "mikrotik-gateway" ||
                          currentTab === "vpn"
                      )}
                    >
                      <Server size={13} />
                      <span>Konfigurasi Server</span>
                    </Link>
                  )}
                  {hasAccess(currentUser, "settings-health", "read") && (
                    <Link
                      href="/settings/health"
                      onClick={onNavigate}
                      scroll={false}
                      className={getSubLinkClass(currentTab === "health")}
                    >
                      <Activity size={13} />
                      <span>Kesehatan Sistem & DB</span>
                    </Link>
                  )}
                  {(hasAccess(currentUser, "settings-users", "read") || hasAccess(currentUser, "settings-roles", "read")) && (
                    <Link
                      href="/settings/users"
                      onClick={onNavigate}
                      scroll={false}
                      className={getSubLinkClass(currentTab === "users" || currentTab === "roles")}
                    >
                      <Users size={13} />
                      <span>Pengguna & Role</span>
                    </Link>
                  )}
                  {hasAccess(currentUser, "settings-password", "read") && (
                    <Link
                      href="/settings/password"
                      onClick={onNavigate}
                      scroll={false}
                      className={getSubLinkClass(currentTab === "password")}
                    >
                      <Lock size={13} />
                      <span>Ubah Password</span>
                    </Link>
                  )}
                  <Link
                    href="/settings/design"
                    onClick={onNavigate}
                    scroll={false}
                    className={getSubLinkClass(currentTab === "design" || pathname === "/settings/design")}
                  >
                    <Palette size={13} />
                    <span>Desain & Tema</span>
                  </Link>
                  {((currentUser?.role || "").toLowerCase() === "superadmin" ||
                    (currentUser?.role || "").toLowerCase() === "admin") && (
                    <Link
                      href="/settings/api-keys"
                      onClick={onNavigate}
                      scroll={false}
                      className={getSubLinkClass(currentTab === "api-keys" || currentTab === "apikeys")}
                    >
                      <Key size={13} />
                      <span>Akses API Key</span>
                    </Link>
                  )}
                </div>
              </div>
            )}

            {!isCollapsed && expandedMenus.settings && (
              <div className="ml-4 pl-3 border-l border-slate-800/80 my-1 flex flex-col gap-1">
                {hasAccess(currentUser, "settings-company", "read") && (
                  <Link
                    href="/settings/company"
                    onClick={onNavigate}
                    scroll={false}
                    className={getSubLinkClass(currentTab === "company" || currentTab === "profile")}
                  >
                    <span>Profil Perusahaan</span>
                  </Link>
                )}
                {(hasAccess(currentUser, "settings-system", "read") ||
                  hasAccess(currentUser, "settings-mikrotik", "read") ||
                  hasAccess(currentUser, "settings-vpn", "read")) && (
                  <Link
                    href="/settings/system"
                    onClick={onNavigate}
                    scroll={false}
                    className={getSubLinkClass(
                      currentTab === "system" ||
                        currentTab === "server" ||
                        currentTab === "core" ||
                        currentTab === "mikrotik-gateway" ||
                        currentTab === "vpn"
                    )}
                  >
                    <span>Konfigurasi Server</span>
                  </Link>
                )}
                {hasAccess(currentUser, "settings-health", "read") && (
                  <Link
                    href="/settings/health"
                    onClick={onNavigate}
                    scroll={false}
                    className={getSubLinkClass(currentTab === "health")}
                  >
                    <span>Kesehatan Sistem & DB</span>
                  </Link>
                )}
                {(hasAccess(currentUser, "settings-users", "read") || hasAccess(currentUser, "settings-roles", "read")) && (
                  <Link
                    href="/settings/users"
                    onClick={onNavigate}
                    scroll={false}
                    className={getSubLinkClass(currentTab === "users" || currentTab === "roles")}
                  >
                    <span>Pengguna & Role</span>
                  </Link>
                )}
                {hasAccess(currentUser, "settings-password", "read") && (
                  <Link
                    href="/settings/password"
                    onClick={onNavigate}
                    scroll={false}
                    className={getSubLinkClass(currentTab === "password")}
                  >
                    <span>Ubah Password</span>
                  </Link>
                )}
                <Link
                  href="/settings/design"
                  onClick={onNavigate}
                  scroll={false}
                  className={getSubLinkClass(currentTab === "design" || pathname === "/settings/design")}
                >
                  <span>Desain & Tema</span>
                </Link>
                {((currentUser?.role || "").toLowerCase() === "superadmin" ||
                  (currentUser?.role || "").toLowerCase() === "admin") && (
                  <Link
                    href="/settings/api-keys"
                    onClick={onNavigate}
                    scroll={false}
                    className={getSubLinkClass(currentTab === "api-keys" || currentTab === "apikeys")}
                  >
                    <span>Akses API Key</span>
                  </Link>
                )}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* ─── Footer: Clean Minimalist Tenant Indicator (Server: Terhubung Removed) ── */}
      <div
        className={`p-3 border-t border-slate-800/80 flex items-center transition-all ${
          isCollapsed ? "justify-center" : "gap-2.5"
        }`}
      >
        <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 flex-shrink-0">
          <Building2 size={13} />
        </div>
        {!isCollapsed && (
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-medium text-slate-200 truncate leading-tight">
              {companyInfo.name}
            </div>
            <div className="text-[10px] text-slate-400 truncate font-sans mt-0.5">
              {companyInfo.region}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
