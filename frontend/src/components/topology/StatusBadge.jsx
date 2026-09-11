"use client";

export function StatusBadge({ online }) {
  return (
    <span
      className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
        online
          ? "bg-emerald-500/20 text-emerald-400"
          : "bg-red-500/20 text-red-400"
      }`}
    >
      {online ? "Online" : "Offline"}
    </span>
  );
}

export function IfaceBadge({ running, disabled }) {
  if (disabled === "true")
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-600/60 text-slate-400">
        Disabled
      </span>
    );
  if (running === "true")
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold tracking-wider">
        Up
      </span>
    );
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-bold tracking-wider">
      Down
    </span>
  );
}
