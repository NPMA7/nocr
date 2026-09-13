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
} from "lucide-react";

export default function MikrotikDetailCard({ coreStatus, isConnected = true }) {
  const cpuPercent = Number(coreStatus?.cpu) || 1;

  const memInfo = useMemo(() => {
    if (!coreStatus?.total_memory && !coreStatus?.free_memory) {
      return { freeText: "15.34 GB", totalText: "16.0 GB", usedPercent: 4 };
    }
    const totalBytes = Number(coreStatus.total_memory) || 0;
    const freeBytes = Number(coreStatus.free_memory) || 0;
    const usedBytes = Math.max(0, totalBytes - freeBytes);

    const totalGb = (totalBytes / (1024 * 1024 * 1024)).toFixed(1);
    const freeGb = (freeBytes / (1024 * 1024 * 1024)).toFixed(2);
    const usedPercent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 4;

    return {
      freeText: `${freeGb} GB`,
      totalText: `${totalGb} GB`,
      usedPercent,
    };
  }, [coreStatus]);

  const pppoeCount = coreStatus?.pppoe_active ?? 119;
  const l2tpCount = coreStatus?.l2tp_active ?? 234;
  const totalTunnels = Number(pppoeCount) + Number(l2tpCount);

  const cpuColor =
    cpuPercent >= 80
      ? "text-rose-400 bg-rose-500"
      : cpuPercent >= 50
      ? "text-amber-400 bg-amber-500"
      : "text-emerald-400 bg-emerald-500";

  return (
    <div className="h-full bg-slate-900/70 border border-slate-800 rounded-lg p-3 md:p-3.5 flex flex-col justify-between backdrop-blur-sm transition-all duration-200">
      {/* Header: Identity & Status */}
      <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-md bg-slate-800/90 border border-slate-700/60 flex items-center justify-center text-sky-400 flex-shrink-0">
            <Server size={14} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs md:text-sm font-bold text-slate-100 font-mono tracking-tight truncate">
                {coreStatus?.board || "CCR2116-12G-4S+"}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono">
              IP: <span className="text-slate-300">{coreStatus?.ip_address || "10.16.25.1"}</span>
              {coreStatus?.version ? ` • v${coreStatus.version}` : " • v7.16.2"}
            </p>
          </div>
        </div>

        {/* Live Badge */}
        <span className="flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700/50">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isConnected
                ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] animate-pulse"
                : "bg-rose-500"
            }`}
          />
          <span className={isConnected ? "text-emerald-300" : "text-rose-400"}>
            {isConnected ? "LIVE" : "OFF"}
          </span>
        </span>
      </div>

      {/* Metric 1: CPU Load */}
      <div className="py-1.5">
        <div className="flex items-center justify-between text-[10.5px]">
          <span className="flex items-center gap-1.5 text-slate-400 font-medium">
            <Cpu size={12} className="text-sky-400" />
            CPU Load
          </span>
          <span className="font-mono font-bold text-slate-100 text-xs">
            {cpuPercent}%
          </span>
        </div>
        <div className="w-full bg-slate-800/80 rounded-full h-1 mt-1 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${cpuColor.split(" ")[1]}`}
            style={{ width: `${Math.max(3, Math.min(100, cpuPercent))}%` }}
          />
        </div>
      </div>

      {/* Metric 2: Memory (RAM) */}
      <div className="py-1.5">
        <div className="flex items-center justify-between text-[10.5px]">
          <span className="flex items-center gap-1.5 text-slate-400 font-medium">
            <HardDrive size={12} className="text-emerald-400" />
            RAM Bebas
          </span>
          <span className="font-mono font-bold text-slate-100 text-xs">
            {memInfo.freeText}
          </span>
        </div>
        <div className="flex items-center justify-between text-[9.5px] text-slate-500 font-mono mt-0.5">
          <span>{memInfo.totalText} Total</span>
          <span>{memInfo.usedPercent}% used</span>
        </div>
        <div className="w-full bg-slate-800/80 rounded-full h-1 mt-1 overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${Math.max(3, Math.min(100, 100 - memInfo.usedPercent))}%` }}
          />
        </div>
      </div>

      {/* Metric 3: Tunnel Sessions (PPPoE + L2TP) */}
      <div className="py-1.5">
        <div className="flex items-center justify-between text-[10.5px]">
          <span className="flex items-center gap-1.5 text-slate-400 font-medium">
            <Network size={12} className="text-cyan-400" />
            Tunnel Sesi
          </span>
          <span className="font-mono font-bold text-slate-100 text-xs">
            {totalTunnels} Sesi
          </span>
        </div>
        <div className="flex items-center justify-between text-[9.5px] text-slate-400 font-mono mt-0.5">
          <span className="text-sky-400">PPPoE: <b>{pppoeCount}</b></span>
          <span className="text-emerald-400">L2TP: <b>{l2tpCount}</b></span>
        </div>
      </div>

      {/* Footer: Uptime & Link Trunk */}
      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
        <span className="flex items-center gap-1 truncate" title={coreStatus?.uptime || "3w 1d 5h"}>
          <Clock size={11} className="text-slate-500" />
          <span className="truncate">Up: {coreStatus?.uptime || "3w 1d 5h 35m"}</span>
        </span>
        <span className="flex items-center gap-1 text-emerald-400 font-semibold">
          <CheckCircle2 size={11} /> 10G SFP+
        </span>
      </div>
    </div>
  );
}
