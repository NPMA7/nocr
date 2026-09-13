"use client";

import { useState, useMemo } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Settings,
  Info,
  Activity,
  Filter,
  ArrowDownRight,
  ArrowUpRight,
} from "lucide-react";

export default function ActivityLogList({ logs = [], isConnected = false }) {
  const [filterMode, setFilterMode] = useState("all"); // 'all' | 'offline' | 'online'

  const parsedLogs = useMemo(() => {
    return (logs || []).map((item) => {
      const msg = item.message || item.msg || "";
      const lower = msg.toLowerCase();
      let type = "info";
      if (lower.includes("offline") || lower.includes("gagal") || lower.includes("terputus") || lower.includes("dihapus")) {
        type = "offline";
      } else if (lower.includes("online") || lower.includes("berhasil") || lower.includes("terhubung")) {
        type = "online";
      } else if (lower.includes("simpan") || lower.includes("diperbarui") || lower.includes("tambah") || lower.includes("config")) {
        type = "config";
      }
      return {
        ...item,
        msg,
        type,
      };
    });
  }, [logs]);

  const stats = useMemo(() => {
    const offline = parsedLogs.filter((l) => l.type === "offline").length;
    const online = parsedLogs.filter((l) => l.type === "online").length;
    return { offline, online, total: parsedLogs.length };
  }, [parsedLogs]);

  const filteredLogs = useMemo(() => {
    if (filterMode === "offline") return parsedLogs.filter((l) => l.type === "offline");
    if (filterMode === "online") return parsedLogs.filter((l) => l.type === "online");
    return parsedLogs;
  }, [parsedLogs, filterMode]);

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3 md:p-3.5 flex flex-col h-full min-h-[340px] lg:min-h-0 backdrop-blur-sm">
      {/* Header bar */}
      <div className="flex-shrink-0 flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-slate-800 border border-slate-700/60 flex items-center justify-center text-slate-300">
            <Activity size={13} />
          </div>
          <div>
            <h3 className="text-xs md:text-sm font-bold text-slate-100 flex items-center gap-1.5">
              Log Aktivitas Real-time
            </h3>
          </div>
        </div>

        {/* Live indicator */}
        <span className="flex items-center gap-1.5 text-[9.5px] font-mono px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/50">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isConnected
                ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] animate-pulse"
                : "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]"
            }`}
          />
          <span className={isConnected ? "text-emerald-300" : "text-rose-300"}>
            {isConnected ? "LIVE STREAM" : "OFFLINE"}
          </span>
        </span>
      </div>

      {/* Filter Tabs: All, Offline / Error, Online */}
      <div className="flex-shrink-0 flex items-center gap-1.5 mb-2.5">
        <button
          type="button"
          onClick={() => setFilterMode("all")}
          className={`cursor-pointer text-[10.5px] font-medium px-2 py-1 rounded transition-all flex items-center gap-1.5 border ${
            filterMode === "all"
              ? "bg-slate-800 text-slate-100 border-slate-600 shadow-xs"
              : "bg-slate-950/40 text-slate-400 border-slate-800/60 hover:text-slate-200"
          }`}
        >
          <span>Semua</span>
          <span className="font-mono text-[9px] px-1 rounded bg-slate-700/60 text-slate-300">
            {stats.total}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFilterMode("offline")}
          className={`cursor-pointer text-[10.5px] font-medium px-2 py-1 rounded transition-all flex items-center gap-1.5 border ${
            filterMode === "offline"
              ? "bg-rose-950/50 text-rose-300 border-rose-600/70 shadow-xs"
              : stats.offline > 0
              ? "bg-rose-950/20 text-rose-400 border-rose-900/50 hover:bg-rose-950/40"
              : "bg-slate-950/40 text-slate-400 border-slate-800/60 hover:text-slate-200"
          }`}
        >
          <span>Insiden Offline</span>
          {stats.offline > 0 && (
            <span className="font-mono text-[9px] px-1 rounded bg-rose-500/30 text-rose-300 font-bold animate-pulse">
              {stats.offline}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setFilterMode("online")}
          className={`cursor-pointer text-[10.5px] font-medium px-2 py-1 rounded transition-all flex items-center gap-1.5 border ${
            filterMode === "online"
              ? "bg-emerald-950/50 text-emerald-300 border-emerald-600/70 shadow-xs"
              : "bg-slate-950/40 text-slate-400 border-slate-800/60 hover:text-slate-200"
          }`}
        >
          <span>Online / Pulih</span>
          <span className="font-mono text-[9px] px-1 rounded bg-slate-700/60 text-slate-300">
            {stats.online}
          </span>
        </button>
      </div>

      {/* Log Feed List */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-1.5 custom-scrollbar">
        {filteredLogs && filteredLogs.length > 0 ? (
          filteredLogs.map((item, i) => {
            const isOffline = item.type === "offline";
            const isOnline = item.type === "online";
            const isConfig = item.type === "config";

            return (
              <div
                key={item.id || i}
                className={`flex items-start gap-2.5 p-2 rounded-md border transition-colors ${
                  isOffline
                    ? "bg-rose-950/15 border-rose-900/30 hover:bg-rose-950/25"
                    : isOnline
                    ? "bg-slate-950/40 border-slate-800/60 hover:bg-slate-800/40"
                    : "bg-slate-950/40 border-slate-800/60 hover:bg-slate-800/40"
                }`}
              >
                {/* Status Badge */}
                <div className="flex-shrink-0 mt-0.5">
                  {isOffline ? (
                    <span className="flex items-center gap-1 text-[8.5px] font-bold font-mono tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40 px-1 py-0.5 rounded-xs">
                      <ArrowDownRight size={10} className="text-rose-400" />
                      DOWN
                    </span>
                  ) : isOnline ? (
                    <span className="flex items-center gap-1 text-[8.5px] font-bold font-mono tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1 py-0.5 rounded-xs">
                      <ArrowUpRight size={10} className="text-emerald-400" />
                      UP
                    </span>
                  ) : isConfig ? (
                    <span className="flex items-center gap-1 text-[8.5px] font-bold font-mono tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1 py-0.5 rounded-xs">
                      <Settings size={10} className="text-amber-400" />
                      CFG
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[8.5px] font-bold font-mono tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/30 px-1 py-0.5 rounded-xs">
                      <Info size={10} className="text-sky-400" />
                      INFO
                    </span>
                  )}
                </div>

                {/* Log Description & Timestamp */}
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="text-[11px] font-medium leading-tight text-slate-200 break-words">
                    {item.msg}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5 text-[9.5px] font-mono text-slate-500">
                    <span>
                      {item.time
                        ? new Date(item.time).toLocaleDateString("id-ID", {
                            day: "2-digit",
                            month: "short",
                          }) +
                          " " +
                          new Date(item.time).toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })
                        : "-"}
                    </span>
                    {item.user && (
                      <>
                        <span>•</span>
                        <span className="text-slate-400">Oleh: {item.user}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 py-8 text-slate-500 gap-2">
            <CheckCircle2 size={22} className="text-emerald-500/60" />
            <span className="text-xs">
              {filterMode === "offline"
                ? "Tidak ada insiden offline terdeteksi"
                : "Belum ada log aktivitas"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
