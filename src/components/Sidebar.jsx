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
import { isAdminRole, getStoredUser } from "@/lib/roles";

export default function Sidebar({ isConnected, onNavigate }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") || "core";
  const { sessionUser } = useAppState();
  const [isAdmin, setIsAdmin] = useState(false);

  const syncAdmin = () => setIsAdmin(isAdminRole(getStoredUser()));

  useEffect(() => {
    syncAdmin();
    const onRole = () => syncAdmin();
    window.addEventListener("nocr-role-updated", onRole);
    return () => window.removeEventListener("nocr-role-updated", onRole);
  }, []);

  useEffect(() => {
    if (sessionUser?.role) syncAdmin();
  }, [sessionUser]);

  const getLinkClass = (href) => {
    const isActive =
      pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
    return `flex items-center gap-3 px-4 py-3 text-slate-400 rounded-lg hover:bg-slate-800 hover:text-white transition duration-200 font-medium ${
      isActive ? "bg-blue-600 text-white hover:bg-blue-700" : ""
    }`;
  };

  return (
    <aside className="w-64 bg-slate-800 border-r border-slate-700/50 flex flex-col z-10 h-full">
      <div className="p-6 text-xl font-bold text-blue-500 flex flex-col gap-1 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <img
            src="/logo.png"
            alt="NOCR Logo"
            className="w-10 h-10 border-2 border-slate-600 rounded-full object-contain drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]"
          />
          <h1 className="text-xl font-bold text-blue-500">NOCR</h1>
          <div className="flex flex-col justify-center items-center">
            <span className="text-[10px] text-slate-400 font-normal">
              by: npma
            </span>
            <span className="text-[10px] text-slate-400 font-normal">
              v2.0.0
            </span>
          </div>
        </div>
        <span className="text-[12px] text-slate-400 font-normal mt-0.5">
          Network Operations Center
        </span>
      </div>

      <nav className="flex-1 p-4 flex flex-col gap-1">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          scroll={false}
          className={getLinkClass("/dashboard")}
        >
          <PieChart size={18} /> Dashboard
        </Link>
        <Link
          href="/topology"
          onClick={onNavigate}
          scroll={false}
          className={getLinkClass("/topology")}
        >
          <GitGraph size={18} /> Peta Topologi
        </Link>
        <div className="flex flex-col gap-0.5">
          <Link
            href="/monitor-l2tp"
            onClick={onNavigate}
            scroll={false}
            className={`flex items-center justify-between w-full px-4 py-3 rounded-lg transition duration-200 font-medium ${
              pathname.startsWith("/monitor-l2tp") || pathname.startsWith("/monitor-pppoe")
                ? "bg-slate-800/50 text-white"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <div className="flex items-center gap-3">
              <Monitor size={18} /> Monitoring
            </div>
            <ChevronDown size={16} className={`transition-transform ${pathname.startsWith("/monitor-l2tp") || pathname.startsWith("/monitor-pppoe") ? "rotate-180" : ""}`} />
          </Link>

          {(pathname.startsWith("/monitor-l2tp") || pathname.startsWith("/monitor-pppoe")) && (
            <div className="pl-6 pr-2 py-1.5 flex flex-col gap-1 border-l border-slate-700/50 ml-6 mt-1 mb-2">
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
            </div>
          )}
        </div>
        <div className="flex flex-col gap-0.5">
          <Link
            href="/ruijie"
            onClick={onNavigate}
            scroll={false}
            className={`flex items-center justify-between w-full px-4 py-3 rounded-lg transition duration-200 font-medium ${
              pathname.startsWith("/devices") || pathname.startsWith("/ruijie") || pathname.startsWith("/hsgq-olt")
                ? "bg-slate-800/50 text-white"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <div className="flex items-center gap-3">
              <Server size={18} /> Perangkat Jaringan
            </div>
            <ChevronDown size={16} className={`transition-transform ${pathname.startsWith("/devices") || pathname.startsWith("/ruijie") || pathname.startsWith("/hsgq-olt") ? "rotate-180" : ""}`} />
          </Link>

          {(pathname.startsWith("/devices") || pathname.startsWith("/ruijie") || pathname.startsWith("/hsgq-olt")) && (
            <div className="pl-6 pr-2 py-1.5 flex flex-col gap-1 border-l border-slate-700/50 ml-6 mt-1 mb-2">
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
              <Link
                href="/devices"
                onClick={onNavigate}
                scroll={false}
                className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-md transition duration-200 ${
                  pathname.startsWith("/devices")
                    ? "text-blue-400 bg-blue-500/10"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                <Server size={14} /> Mikrotik RO
              </Link>
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
            </div>
          )}
        </div>
        <Link
          href="/sites"
          onClick={onNavigate}
          scroll={false}
          className={getLinkClass("/sites")}
        >
          <MapPin size={18} /> Data Wilayah
        </Link>
        <Link
          href="/laporan-harian"
          onClick={onNavigate}
          scroll={false}
          className={getLinkClass("/laporan-harian")}
        >
          <ClipboardList size={18} /> Laporan Harian
        </Link>
        <Link
          href="/live-chat"
          onClick={onNavigate}
          scroll={false}
          className={getLinkClass("/live-chat")}
        >
          <MessageCircle size={18} /> Live Chat Omni
        </Link>
        

        <div className="flex flex-col gap-0.5">
          <Link
            href="/settings?tab=core"
            onClick={onNavigate}
            scroll={false}
            className={`${getLinkClass("/settings")} justify-between w-full`}
          >
            <div className="flex items-center gap-3">
              <Settings size={18} /> Pengaturan
            </div>
            <ChevronDown size={16} className={`transition-transform ${pathname.startsWith("/settings") ? "rotate-180" : ""}`} />
          </Link>

          {pathname.startsWith("/settings") && (
            <div className="pl-6 pr-2 py-1.5 flex flex-col gap-1 border-l border-slate-700/50 ml-6 mt-1 mb-2">
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
              {isAdmin && (
                <Link
                  href="/settings?tab=whatsapp"
                  onClick={onNavigate}
                  scroll={false}
                  className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-md transition duration-200 ${
                    currentTab === "whatsapp"
                      ? "text-emerald-400 bg-emerald-500/10"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                  }`}
                >
                  <MessageCircle size={14} /> WhatsApp Gateway
                </Link>
              )}
              {isAdmin && (
                <Link
                  href="/settings?tab=users"
                  onClick={onNavigate}
                  scroll={false}
                  className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-md transition duration-200 ${
                    currentTab === "users"
                      ? "text-blue-400 bg-blue-500/10"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                  }`}
                >
                  <User size={14} /> Manajemen Pengguna
                </Link>
              )}
              {isAdmin && (
                <Link
                  href="/settings?tab=roles"
                  onClick={onNavigate}
                  scroll={false}
                  className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-md transition duration-200 ${
                    currentTab === "roles"
                      ? "text-blue-400 bg-blue-500/10"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                  }`}
                >
                  <Shield size={14} /> Manajemen Role
                </Link>
              )}
              <Link
                href="/settings?tab=password"
                onClick={onNavigate}
                scroll={false}
                className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-md transition duration-200 ${
                  currentTab === "password"
                    ? "text-blue-400 bg-blue-500/10"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                <Key size={14} /> Ubah Password
              </Link>
            </div>
          )}
        </div>
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
