"use client";

import { Cpu, Network, Clock, RefreshCw, ChevronUp, ChevronDown, Wifi, Users, Server } from "lucide-react";
import { StatusBadge } from "./StatusBadge";

export default function CoreInterfacePanel({
  coreStatus,
  siteAktif,
  showIfacePanel,
  setShowIfacePanel,
  liveLogs,
  showMobileMode,
  networkMode,
  setNetworkMode,
  mapTheme,
  setMapTheme,
  showLabels,
  setShowLabels,
  nodeViewFilter,
  setNodeViewFilter,
}) {
  return (
    <>
      {/* Left Panel — MikroTik Core Live Status */}
      <div className="hidden md:flex absolute top-3 left-3 z-[1000] w-56 flex-col gap-2 pointer-events-none">
        {/* Core Status Card */}
        {coreStatus && (
          <div
            className={`rounded-xl border p-3.5 shadow-xl backdrop-blur-sm pointer-events-auto ${
              coreStatus.connected
                ? "bg-slate-900/95 border-emerald-500/30"
                : "bg-slate-900/95 border-red-500/30"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    coreStatus.connected
                      ? "bg-emerald-400 animate-pulse"
                      : "bg-red-400"
                  }`}
                />
                <span className="text-xs font-bold text-slate-200">
                  {coreStatus.device_name || "MikroTik Pusat"}
                </span>
              </div>
              <StatusBadge online={coreStatus.connected} />
            </div>
            {coreStatus.connected ? (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="bg-slate-800/80 rounded-lg p-2 flex items-center gap-2 min-w-0">
                  <Cpu size={13} className="text-blue-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-slate-500">CPU</p>
                    <p className="text-xs font-bold text-slate-200">
                      {coreStatus.cpu}%
                    </p>
                  </div>
                </div>
                <div className="bg-slate-800/80 rounded-lg p-2 flex items-center gap-2 min-w-0">
                  <Network
                    size={13}
                    className="text-emerald-400 flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-slate-500">Site Aktif</p>
                    <p className="text-xs font-bold text-emerald-400">
                      {siteAktif}
                    </p>
                  </div>
                </div>
                <div className="bg-slate-800/80 rounded-lg p-2 flex items-center gap-2 min-w-0">
                  <Clock
                    size={13}
                    className="text-amber-400 flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-slate-500">Uptime</p>
                    <p className="text-xs font-bold text-slate-200 truncate">
                      {coreStatus.uptime}
                    </p>
                  </div>
                </div>
                <div className="bg-slate-800/80 rounded-lg p-2 flex items-center gap-2 min-w-0">
                  <RefreshCw
                    size={13}
                    className="text-purple-400 flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-slate-500">Board</p>
                    <p className="text-xs font-bold text-slate-200 truncate">
                      {coreStatus.board}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-red-400 mt-1">
                {coreStatus.error}
              </p>
            )}
          </div>
        )}

        {/* Live Online/Offline Log Card */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-900/95 shadow-xl backdrop-blur-sm pointer-events-auto">
          <button
            onClick={() => setShowIfacePanel((v) => !v)}
            className="cursor-pointer w-full p-3 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Network size={13} className="text-blue-400" />
              <span className="text-xs font-bold text-slate-200">
                Status
              </span>
              <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                LIVE
              </span>
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
            <div className="border-t border-slate-700/50 max-h-72 flex flex-col">
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

      {/* Right Floating Panel — Legend & Theme Toggle */}
      <div
        className={`${
          showMobileMode ? "flex" : "hidden"
        } w-42 md:flex absolute bottom-8 left-3 md:bottom-auto md:top-3 md:left-auto md:right-3 z-[1000] flex-col gap-2 pointer-events-none max-h-[calc(100%-24px)] overflow-y-auto hide-scrollbar`}
      >
        {/* Cable Color Legend */}
        <div className="hidden md:block rounded-xl border border-slate-700/50 bg-slate-900/95 shadow-xl backdrop-blur-sm pointer-events-auto p-3">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Legenda Warna Kabel dan Node
          </p>
          <div className="flex flex-col gap-1.5 text-[10px] text-slate-400">
            <span className="flex items-center gap-2">
              <span className="w-6 h-1 bg-green-500 rounded inline-block" />{" "}
              UP
            </span>
            <span className="flex items-center gap-2">
              <span
                className="w-6 h-1 rounded inline-block"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(90deg,#ef4444 0,#ef4444 4px,transparent 4px,transparent 10px)",
                }}
              />{" "}
              DOWN
            </span>
            <span className="flex items-center gap-2">
              <span
                className="w-6 h-1 rounded inline-block"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(90deg,#475569 0,#475569 3px,transparent 3px,transparent 7px)",
                }}
              />{" "}
              Disabled
            </span>
          </div>
        </div>

        {/* Mode Panel */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-900/95 shadow-xl backdrop-blur-sm pointer-events-auto p-3">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Mode
          </p>
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() =>
                setNetworkMode((prev) => (prev === "pppoe" ? "l2tp" : "pppoe"))
              }
              className="cursor-pointer w-full px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition flex items-center justify-center gap-1.5 bg-blue-500/10 text-blue-500 dark:text-blue-400 hover:bg-blue-500/20 border border-blue-500/30"
            >
              <Wifi size={12} />
              Jaringan: {networkMode === "pppoe" ? "OPD" : "Desa"}
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
        </div>
      </div>
    </>
  );
}
