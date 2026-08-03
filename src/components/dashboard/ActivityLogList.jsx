"use client";

import { CheckCircle2, AlertCircle, Settings, Info } from "lucide-react";

export default function ActivityLogList({ logs = [], isConnected = false }) {
  const getLogStyle = (msg) => {
    if (!msg)
      return {
        bgColor:
          "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20 text-slate-800 dark:text-slate-200",
        iconColor: "text-blue-600 dark:text-blue-400",
        iconType: "info",
      };
    const lowercaseMsg = msg.toLowerCase();
    if (lowercaseMsg.includes("berhasil") || lowercaseMsg.includes("online")) {
      return {
        bgColor:
          "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-slate-800 dark:text-slate-200",
        iconColor: "text-emerald-600 dark:text-emerald-400",
        iconType: "check",
      };
    }
    if (
      lowercaseMsg.includes("gagal") ||
      lowercaseMsg.includes("offline") ||
      lowercaseMsg.includes("dihapus")
    ) {
      return {
        bgColor:
          "bg-rose-50 dark:bg-red-500/10 border-rose-200 dark:border-red-500/20 text-slate-800 dark:text-slate-200",
        iconColor: "text-rose-600 dark:text-red-400",
        iconType: "alert",
      };
    }
    if (
      lowercaseMsg.includes("simpan") ||
      lowercaseMsg.includes("diperbarui") ||
      lowercaseMsg.includes("ditambahkan")
    ) {
      return {
        bgColor:
          "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-slate-800 dark:text-slate-200",
        iconColor: "text-amber-600 dark:text-amber-400",
        iconType: "settings",
      };
    }
    return {
      bgColor:
        "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20 text-slate-800 dark:text-slate-200",
      iconColor: "text-blue-600 dark:text-blue-400",
      iconType: "info",
    };
  };

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl p-4 md:p-5 flex flex-col h-full min-h-[300px] lg:min-h-0">
      <h3 className="flex-shrink-0 text-sm font-bold border-b border-slate-200 dark:border-slate-700/30 pb-3 mb-3 text-slate-900 dark:text-slate-200 flex justify-between items-center">
        <span>Log Aktivitas</span>
        <span className="flex items-center gap-1.5 text-[10px] font-semibold bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/50 px-2 py-0.5 rounded-full select-none">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isConnected
                ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)] animate-pulse"
                : "bg-rose-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]"
            }`}
          />
          <span className="text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {isConnected ? "Live" : "Terputus"}
          </span>
        </span>
      </h3>

      <div className="flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-2.5 custom-scrollbar">
        {logs && logs.length > 0 ? (
          logs.map((a, i) => {
            const style = getLogStyle(a.message || a.msg);
            return (
              <div
                key={i}
                className={`flex gap-3 p-3 rounded-lg border text-xs transition duration-200 hover:translate-x-0.5 ${style.bgColor}`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {style.iconType === "check" && (
                    <CheckCircle2 size={14} className={style.iconColor} />
                  )}
                  {style.iconType === "alert" && (
                    <AlertCircle size={14} className={style.iconColor} />
                  )}
                  {style.iconType === "settings" && (
                    <Settings size={14} className={style.iconColor} />
                  )}
                  {style.iconType === "info" && (
                    <Info size={14} className={style.iconColor} />
                  )}
                </div>
                <div className="flex-1 flex flex-col gap-1 min-w-0">
                  <span className="font-medium leading-relaxed break-words">
                    {a.message || a.msg}
                  </span>
                  <span className="text-[9px] text-slate-500 dark:text-slate-400 font-mono self-start uppercase">
                    {new Date(a.time).toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "short",
                    })}{" "}
                    {new Date(a.time).toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 py-12 text-slate-400 dark:text-slate-500 gap-2">
            <Info size={24} className="animate-pulse" />
            <span className="text-xs">Belum ada aktivitas</span>
          </div>
        )}
      </div>
    </div>
  );
}
