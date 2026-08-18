"use client";

import { useState } from "react";
import { Cpu, Network, Clock, RefreshCw, ChevronUp, ChevronDown, Wifi, Users, Server, Layers } from "lucide-react";
import { StatusBadge } from "./StatusBadge";

// Inline SVG icon for split view
function SplitHIcon({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="18" rx="1" />
      <rect x="14" y="3" width="7" height="18" rx="1" />
    </svg>
  );
}

export default function CoreInterfacePanel({
  coreStatus,
  siteAktif,
  siteOffline,
  showIfacePanel,
  setShowIfacePanel,
  liveLogs,
  showMobileMode,
  networkMode,
  setNetworkMode,
  setFlyToTarget,
  mapTheme,
  setMapTheme,
  showLabels,
  setShowLabels,
  nodeViewFilter,
  setNodeViewFilter,
  splitMode,
  setSplitMode,
}) {
  const [showModePanel, setShowModePanel] = useState(true);

  return (
    <>
      {/* Left Panel — Live Status Card */}
      <div className="hidden md:flex absolute top-3 left-3 z-[1000] w-64 flex-col gap-2 pointer-events-none">
        {/* Live Online/Offline Log Card */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-900/95 shadow-xl backdrop-blur-sm pointer-events-auto">
          <button
            type="button"
            onClick={() => setShowIfacePanel((v) => !v)}
            className="cursor-pointer w-full p-3 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Network size={14} className="text-blue-400" />
              <span className="text-xs font-bold text-slate-200">
                Status
              </span>

              {/* Badges Aktif (Biru) & Offline (Merah) */}
              <div className="flex items-center gap-1.5 ml-1">
                <span
                  className="text-[10px] px-2 py-0.5 rounded font-bold bg-blue-600 text-white flex items-center gap-1 shadow-sm"
                  title="Site Aktif / Online"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse inline-block" />
                  {siteAktif ?? 0}
                </span>
                <span
                  className="text-[10px] px-2 py-0.5 rounded font-bold bg-red-600 text-white flex items-center gap-1 shadow-sm"
                  title="Site Offline"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />
                  {siteOffline ?? 0}
                </span>
              </div>
            </div>
            {showIfacePanel ? (
              <ChevronUp
                size={14}
                className="cursor-pointer text-slate-400"
              />
            ) : (
              <ChevronDown
                size={14}
                className="cursor-pointer text-slate-400"
              />
            )}
          </button>
          {showIfacePanel && (
            <div className="border-t border-slate-700/50 max-h-96 flex flex-col">
              <div className="overflow-auto flex-1">
                {liveLogs.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">
                    Belum ada perubahan status...
                  </div>
                ) : (
                  liveLogs.map((log, i) => {
                    const isOnline = log.msg
                      .toLowerCase()
                      .includes("menjadi online");
                    return (
                      <div
                        key={i}
                        className={`px-3 py-2 flex items-start gap-2 border-b border-slate-800/60 hover:bg-slate-800/30 transition text-xs ${
                          i === 0 ? "bg-slate-800/20" : ""
                        }`}
                      >
                        <div
                          className={`flex-shrink-0 w-1.5 h-1.5 rounded-full mt-1 ${
                            isOnline ? "bg-emerald-400" : "bg-red-400"
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-200 leading-snug break-words">
                            {log.msg}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {log.time instanceof Date
                              ? log.time.toLocaleTimeString("id-ID")
                              : ""}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Floating Panel — Theme & Mode Toggle */}
      <div
        className={`${
          showMobileMode ? "flex" : "hidden"
        } w-44 md:flex absolute bottom-8 left-3 md:bottom-auto md:top-3 md:left-auto md:right-3 z-[1000] flex-col gap-2 pointer-events-none max-h-[calc(100%-24px)] overflow-y-auto hide-scrollbar`}
      >
        {/* Mode Panel */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-900/95 shadow-xl backdrop-blur-sm pointer-events-auto">
          <button
            type="button"
            onClick={() => setShowModePanel((v) => !v)}
            className="cursor-pointer w-full p-3 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Layers size={14} className="text-blue-400" />
              <span className="text-xs font-bold text-slate-200">
                Mode
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-slate-800 text-slate-300 border border-slate-700/60 ml-0.5">
                {splitMode ? "Split" : (networkMode === "pppoe" ? "OPD" : "Desa")}
              </span>
            </div>
            {showModePanel ? (
              <ChevronUp
                size={14}
                className="cursor-pointer text-slate-400"
              />
            ) : (
              <ChevronDown
                size={14}
                className="cursor-pointer text-slate-400"
              />
            )}
          </button>

          {showModePanel && (
            <div className="border-t border-slate-700/50 p-3 flex flex-col gap-1.5">
              {/* Tombol Jaringan: hanya tampil saat split TIDAK aktif */}
              {!splitMode && (
                <button
                  type="button"
                  onClick={() => {
                    const nextMode = networkMode === "pppoe" ? "l2tp" : "pppoe";
                    setNetworkMode(nextMode);
                    if (setFlyToTarget) {
                      if (nextMode === "pppoe") {
                        setFlyToTarget({ lat: -7.0225, lng: 107.527, zoom: 16.5 });
                      } else {
                        setFlyToTarget({ lat: -7.065, lng: 107.55, zoom: 11 });
                      }
                    }
                  }}
                  className="cursor-pointer w-full px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition flex items-center justify-center gap-1.5 bg-blue-500/10 text-blue-500 dark:text-blue-400 hover:bg-blue-500/20 border border-blue-500/30"
                >
                  <Wifi size={12} />
                  Jaringan: {networkMode === "pppoe" ? "OPD" : "Desa"}
                </button>
              )}

              {/* Tombol Split View — selalu tampil, letakkan di bawah Jaringan */}
              <button
                type="button"
                onClick={() =>
                  setSplitMode((prev) => (prev === "horizontal" ? null : "horizontal"))
                }
                className={`cursor-pointer w-full px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition flex items-center justify-center gap-1.5 ${
                  splitMode === "horizontal"
                    ? "bg-blue-600 text-white ring-1 ring-violet-400/50"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
                title="Split View: OPD (kiri) | Desa (kanan)"
              >
                <SplitHIcon size={12} />
                {splitMode === "horizontal" ? "Keluar Split View" : "Split View"}
              </button>

              <div className="h-px bg-slate-700/50 w-full my-1" />
              <button
                type="button"
                onClick={() =>
                  setMapTheme(mapTheme === "dark" ? "colored" : "dark")
                }
                className={`cursor-pointer w-full px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition flex items-center justify-center gap-1.5 ${
                  mapTheme === "dark"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
                title="Toggle Tema Peta"
              >
                <span
                  className={`fa ${
                    mapTheme === "dark" ? "fa-moon" : "fa-sun"
                  } text-[10px]`}
                />
                Tema Peta
              </button>
              <button
                type="button"
                onClick={() => setShowLabels(!showLabels)}
                className={`cursor-pointer w-full px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition flex items-center justify-center gap-1.5 ${
                  showLabels
                    ? "bg-blue-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                <span
                  className={`fa ${
                    showLabels ? "fa-eye" : "fa-eye-slash"
                  } text-[9px]`}
                />
                Label Node
              </button>
              <button
                type="button"
                onClick={() =>
                  setNodeViewFilter((f) => (f === "client" ? "all" : "client"))
                }
                className={`cursor-pointer w-full px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition flex items-center justify-center gap-1.5 ${
                  nodeViewFilter === "client"
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                <Users size={12} />
                Hanya Client
              </button>
              <button
                type="button"
                onClick={() =>
                  setNodeViewFilter((f) =>
                    f === "infrastructure" ? "all" : "infrastructure",
                  )
                }
                className={`cursor-pointer w-full px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition flex items-center justify-center gap-1.5 ${
                  nodeViewFilter === "infrastructure"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                <Server size={12} />
                Hanya Infrastruktur
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
