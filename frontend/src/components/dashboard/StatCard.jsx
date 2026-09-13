"use client";

import Link from "next/link";
import { ArrowUpRight, AlertCircle, CheckCircle2 } from "lucide-react";

export default function StatCard({
  icon: Icon,
  iconColorClass = "text-sky-400",
  title,
  value,
  subtext,
  badgeText,
  isAlert = false,
  href,
  onClick,
}) {
  const numValue = Number(value);
  const isCritical = isAlert && numValue > 0;

  const content = (
    <div
      className={`group relative flex flex-col justify-between p-3 md:p-3.5 transition-all duration-200 rounded-lg border overflow-hidden ${
        isCritical
          ? "bg-rose-950/25 border-rose-500/40 hover:border-rose-500/70 shadow-[0_0_15px_rgba(244,63,94,0.08)]"
          : "bg-slate-900/60 border-slate-800/80 hover:border-slate-700/90 hover:bg-slate-900/80"
      } ${href || onClick ? "cursor-pointer" : ""}`}
    >
      {/* Top Hairline accent indicator */}
      <div
        className={`absolute top-0 left-0 right-0 h-[2px] ${
          isCritical
            ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]"
            : "bg-transparent group-hover:bg-sky-500/40"
        } transition-all`}
      />

      {/* Card Header: Icon, Title & Badge */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 border ${
              isCritical
                ? "bg-rose-500/15 border-rose-500/30 text-rose-400"
                : "bg-slate-800/80 border-slate-700/60 text-slate-300"
            }`}
          >
            <Icon size={14} className={isCritical ? "text-rose-400" : iconColorClass} />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 truncate">
            {title}
          </span>
        </div>

        {/* Status / Alert Pill */}
        {isCritical ? (
          <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40 px-1.5 py-0.5 rounded-sm animate-pulse">
            <AlertCircle size={10} />
            {badgeText || "PERHATIAN"}
          </span>
        ) : badgeText ? (
          <span className="text-[9px] font-medium tracking-wide bg-slate-800 text-slate-300 border border-slate-700/60 px-1.5 py-0.5 rounded-sm">
            {badgeText}
          </span>
        ) : isAlert && numValue === 0 ? (
          <span className="flex items-center gap-1 text-[9px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded-sm">
            <CheckCircle2 size={10} />
            NORMAL
          </span>
        ) : null}
      </div>

      {/* Main Metric Value */}
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-1.5">
          <span
            className={`text-2xl md:text-3xl font-black font-mono tracking-tight ${
              isCritical
                ? "text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.3)]"
                : "text-slate-100"
            }`}
          >
            {value !== undefined && value !== null ? value : 0}
          </span>
        </div>

        {/* Link arrow if clickable */}
        {(href || onClick) && (
          <div className="text-slate-500 group-hover:text-slate-200 transition-colors">
            <ArrowUpRight size={14} />
          </div>
        )}
      </div>

      {/* Subtext info */}
      {subtext && (
        <div className="mt-1.5 pt-1.5 border-t border-slate-800/60 flex items-center justify-between text-[10.5px]">
          <span className={isCritical ? "text-rose-300/80 font-medium" : "text-slate-400"}>
            {subtext}
          </span>
        </div>
      )}
    </div>
  );

  if (href) {
    return <Link href={href} className="block">{content}</Link>;
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="w-full text-left">
        {content}
      </button>
    );
  }

  return content;
}
