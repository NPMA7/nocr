"use client";

import { useMemo } from "react";
import {
  Server,
  Cpu,
  HardDrive,
  Network,
  Clock,
  Activity,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

export default function CoreGatewayStrip({ coreStatus, isConnected = true }) {
  const cpuPercent = Number(coreStatus?.cpu) || 0;

  const memInfo = useMemo(() => {
    if (!coreStatus?.total_memory && !coreStatus?.free_memory) {
      return { freeText: "--", totalText: "--", usedPercent: 0, freeGb: 0 };
    }
    const totalBytes = Number(coreStatus.total_memory) || 0;
    const freeBytes = Number(coreStatus.free_memory) || 0;
    const usedBytes = Math.max(0, totalBytes - freeBytes);

    const totalGb = (totalBytes / (1024 * 1024 * 1024)).toFixed(1);
    const freeGb = (freeBytes / (1024 * 1024 * 1024)).toFixed(2);
    const usedPercent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0;

    return {
      freeText: `${freeGb} GB`,
      totalText: `${totalGb} GB`,
      usedPercent,
      freeGb,
    };
  }, [coreStatus]);

  const pppoeCount = coreStatus?.pppoe_active ?? 0;
  const l2tpCount = coreStatus?.l2tp_active ?? 0;
  const totalTunnels = Number(pppoeCount) + Number(l2tpCount);

  // CPU status color
  const cpuColor =
    cpuPercent >= 80
      ? "text-rose-400 bg-rose-500"
      : cpuPercent >= 50
      ? "text-amber-400 bg-amber-500"
      : "text-emerald-400 bg-emerald-500";

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3 md:p-3.5 backdrop-blur-sm transition-all duration-200">
      {/* Header bar: Model, IP, Version, Live state */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 mb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-md bg-slate-800/90 border border-slate-700/60 flex items-center justify-center text-sky-400 flex-shrink-0">
            <Server size={14} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs md:text-sm font-bold text-slate-100 font-mono tracking-tight">
                {coreStatus?.board || coreStatus?.device_name || "MikroTik CCR2116-12G-4S+"}
              </span>
              {coreStatus?.version && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-slate-800 border border-slate-700/60 text-slate-300">
                  RouterOS v{coreStatus.version}
                </span>
              )}
              {coreStatus?.architecture && (
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded-sm bg-slate-800/60 border border-slate-700/40 text-slate-400 hidden sm:inline-block">
                  {coreStatus.architecture}
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
              <span>Host IP: <span className="font-mono text-slate-300">{coreStatus?.ip_address || "10.10.10.1"}</span></span>
              <span>•</span>
              <span>Gateway Utama NOC</span>
            </p>
          </div>
        </div>

        {/* Right tags: Uptime & Live Status */}
        <div className="flex items-center gap-2">
          {coreStatus?.uptime && (
            <span className="flex items-center gap-1.5 text-[10px] font-mono text-slate-300 bg-slate-800/80 border border-slate-700/50 px-2 py-1 rounded-md">
              <Clock size={11} className="text-slate-400" />
              <span>Up: {coreStatus.uptime}</span>
            </span>
          )}
          <span className="flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-md bg-slate-800/80 border border-slate-700/50">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isConnected
                  ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] animate-pulse"
                  : "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]"
              }`}
            />
            <span className={isConnected ? "text-emerald-300" : "text-rose-300"}>
              {isConnected ? "Live Monitored" : "Offline"}
            </span>
          </span>
        </div>
      </div>

      {/* 4 Telemetry Gauge Columns */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-3">
        {/* Metric 1: CPU Load */}
        <div className="bg-slate-950/40 border border-slate-800/60 rounded-md p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[10.5px] font-medium mb-1">
            <span className="flex items-center gap-1.5">
              <Cpu size={13} className="text-sky-400" />
              CPU Load
            </span>
            <span className="text-[10px] text-slate-400 font-mono">CCR 16-Core</span>
          </div>
          <div className="flex items-baseline justify-between mt-0.5">
            <span className={`text-xl md:text-2xl font-black font-mono tracking-tight ${cpuColor.split(" ")[0]}`}>
              {coreStatus ? `${cpuPercent}%` : "--"}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              {cpuPercent < 50 ? "Beban Ringan" : cpuPercent < 80 ? "Beban Sedang" : "Beban Tinggi"}
            </span>
          </div>
          {/* Visual Mini Progress Bar */}
          <div className="w-full bg-slate-800/80 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${cpuColor.split(" ")[1]}`}
              style={{ width: `${Math.max(2, Math.min(100, cpuPercent))}%` }}
            />
          </div>
        </div>

        {/* Metric 2: Memory (RAM) */}
        <div className="bg-slate-950/40 border border-slate-800/60 rounded-md p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[10.5px] font-medium mb-1">
            <span className="flex items-center gap-1.5">
              <HardDrive size={13} className="text-emerald-400" />
              RAM Tersedia
            </span>
            <span className="text-[10px] text-slate-400 font-mono">{memInfo.totalText} Total</span>
          </div>
          <div className="flex items-baseline justify-between mt-0.5">
            <span className="text-xl md:text-2xl font-black font-mono tracking-tight text-slate-100">
              {coreStatus ? memInfo.freeText : "--"}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {coreStatus ? `${memInfo.usedPercent}% used` : ""}
            </span>
          </div>
          {/* Visual Mini Progress Bar */}
          <div className="w-full bg-slate-800/80 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${Math.max(2, Math.min(100, 100 - memInfo.usedPercent))}%` }}
            />
          </div>
        </div>

        {/* Metric 3: Active Tunnel / Sessions */}
        <div className="bg-slate-950/40 border border-slate-800/60 rounded-md p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[10.5px] font-medium mb-1">
            <span className="flex items-center gap-1.5">
              <Network size={13} className="text-cyan-400" />
              Sesi Tunnel Aktif
            </span>
            <span className="text-[9px] text-cyan-400 font-mono bg-cyan-950/60 px-1 py-0.5 rounded border border-cyan-800/50">
              LIVE
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-0.5">
            <span className="text-xl md:text-2xl font-black font-mono tracking-tight text-slate-100">
              {coreStatus ? totalTunnels : "--"}
            </span>
            <div className="flex items-center gap-2 text-[10px] font-mono">
              <span className="text-sky-400">PPPoE: <b>{pppoeCount}</b></span>
              <span className="text-slate-600">|</span>
              <span className="text-emerald-400">L2TP: <b>{l2tpCount}</b></span>
            </div>
          </div>
          <div className="w-full bg-slate-800/80 rounded-full h-1.5 mt-2 overflow-hidden flex">
            <div
              className="h-full bg-sky-500 transition-all duration-500"
              style={{
                width: totalTunnels > 0 ? `${(pppoeCount / totalTunnels) * 100}%` : "50%",
              }}
            />
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{
                width: totalTunnels > 0 ? `${(l2tpCount / totalTunnels) * 100}%` : "50%",
              }}
            />
          </div>
        </div>

        {/* Metric 4: Link Health & Uptime Status */}
        <div className="bg-slate-950/40 border border-slate-800/60 rounded-md p-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[10.5px] font-medium mb-1">
            <span className="flex items-center gap-1.5">
              <Activity size={13} className="text-emerald-400" />
              Infrastruktur Core
            </span>
            <span className="text-[10px] text-emerald-400 flex items-center gap-1">
              <CheckCircle2 size={11} /> 10G Trunk
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-0.5">
            <span className="text-sm md:text-base font-bold font-mono tracking-tight text-emerald-400 truncate">
              {coreStatus ? "NORMAL / UP" : "CONNECTING..."}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              SFP+ Link
            </span>
          </div>
          <div className="w-full bg-slate-800/80 rounded-full h-1.5 mt-2 overflow-hidden">
            <div className="h-full bg-emerald-500 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
