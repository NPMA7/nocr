"use client";

import { Wifi, WifiOff, Settings } from "lucide-react";

export default function MikrotikStatCards({ coreStatus, notConfigured }) {
  if (!coreStatus) return null;

  return (
    <div className="flex-shrink-0 bg-slate-900 border border-slate-800 rounded-xl p-3.5 sm:p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-start sm:items-center gap-3.5 min-w-0">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${
            coreStatus.connected
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : "bg-rose-500/10 border-rose-500/20 text-rose-400"
          }`}
        >
          {coreStatus.connected ? (
            <Wifi size={18} />
          ) : (
            <WifiOff size={18} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-100 text-sm">
              {coreStatus.device_name || "MikroTik Pusat"}
            </span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-md font-mono font-bold flex items-center gap-1.5 border ${
                coreStatus.connected
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-rose-500/10 text-rose-400 border-rose-500/20"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  coreStatus.connected ? "bg-emerald-400 animate-pulse" : "bg-rose-400"
                }`}
              />
              {coreStatus.connected ? "Connected" : "Disconnected"}
            </span>
            {coreStatus.board && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                {coreStatus.board}
              </span>
            )}
          </div>

          {coreStatus.connected ? (
            <div className="flex items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-400 flex-wrap font-mono">
              <span className="flex items-center gap-1">
                <span className="text-slate-500">IP:</span>
                <span className="text-slate-200">{coreStatus.ip_address}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="text-slate-500">CPU:</span>
                <span className="text-slate-200 font-semibold">{coreStatus.cpu}%</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="text-slate-500">Uptime:</span>
                <span className="text-slate-200">{coreStatus.uptime}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="text-slate-500">RouterOS:</span>
                <span className="text-slate-200">{coreStatus.version}</span>
              </span>
            </div>
          ) : (
            <p className="text-xs text-rose-400 mt-1">{coreStatus.error}</p>
          )}
        </div>
      </div>

      {notConfigured && (
        <a
          href="/settings"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex-shrink-0 shadow-sm"
        >
          <Settings size={14} /> Konfigurasi
        </a>
      )}
    </div>
  );
}
