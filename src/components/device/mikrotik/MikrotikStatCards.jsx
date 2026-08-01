"use client";

import { Wifi, WifiOff, Settings } from "lucide-react";

export default function MikrotikStatCards({ coreStatus, notConfigured }) {
  if (!coreStatus) return null;

  return (
    <div
      className={`flex-shrink-0 rounded-xl border p-5 flex items-center gap-5 ${
        coreStatus.connected
          ? "bg-emerald-500/5 border-emerald-500/20"
          : "bg-red-500/5 border-red-500/20"
      }`}
    >
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
          coreStatus.connected ? "bg-emerald-500/20" : "bg-red-500/20"
        }`}
      >
        {coreStatus.connected ? (
          <Wifi size={22} className="text-emerald-400" />
        ) : (
          <WifiOff size={22} className="text-red-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <span className="font-bold text-slate-100">
            {coreStatus.device_name || "MikroTik Pusat"}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
              coreStatus.connected
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-red-500/20 text-red-400"
            }`}
          >
            {coreStatus.connected ? "Connected" : "Disconnected"}
          </span>
        </div>
        {coreStatus.connected ? (
          <div className="flex gap-6 mt-1.5 text-xs text-slate-400 flex-wrap">
            <span>
              IP:{" "}
              <span className="text-slate-200">{coreStatus.ip_address}</span>
            </span>
            <span>
              Uptime:{" "}
              <span className="text-slate-200">{coreStatus.uptime}</span>
            </span>
            <span>
              CPU: <span className="text-slate-200">{coreStatus.cpu}%</span>
            </span>
            <span>
              Board: <span className="text-slate-200">{coreStatus.board}</span>
            </span>
            <span>
              RouterOS:{" "}
              <span className="text-slate-200">{coreStatus.version}</span>
            </span>
          </div>
        ) : (
          <p className="text-xs text-slate-400 mt-1">{coreStatus.error}</p>
        )}
      </div>
      {notConfigured && (
        <a
          href="/settings"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-semibold transition flex-shrink-0"
        >
          <Settings size={15} /> Konfigurasi
        </a>
      )}
    </div>
  );
}
