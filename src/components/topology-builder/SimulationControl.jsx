"use client";
import React, { useState } from "react";
import {
  Play,
  Pause,
  Zap,
  RotateCcw,
  Flame,
  Activity,
  AlertOctagon,
  ShieldCheck,
  Radio,
  SlidersHorizontal,
} from "lucide-react";

export default function SimulationControl({
  simulationActive,
  setSimulationActive,
  simulationSpeed,
  setSimulationSpeed,
  onResetAllStatus,
  onSimulateCascadeFailure,
  onSimulatePingBurst,
  onTurnAllOnline,
  onTurnAllOffline,
  onlineCount = 0,
  offlineCount = 0,
}) {
  const [isSimulatingOutage, setIsSimulatingOutage] = useState(false);

  const handleOutageClick = () => {
    setIsSimulatingOutage(true);
    onSimulateCascadeFailure?.();
    setTimeout(() => setIsSimulatingOutage(false), 2000);
  };

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-md px-3.5 py-2 flex items-center gap-3 z-30 select-none max-w-[95vw] overflow-x-auto custom-scrollbar">
      {/* Play / Pause Toggle */}
      <button
        onClick={() => setSimulationActive((prev) => !prev)}
        className={`cursor-pointer px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition ${
          simulationActive
            ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]"
            : "bg-amber-600 hover:bg-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.4)]"
        }`}
      >
        {simulationActive ? (
          <>
            <Pause size={13} />
            <span>Aliran Aktif</span>
          </>
        ) : (
          <>
            <Play size={13} />
            <span>Aliran Jeda</span>
          </>
        )}
      </button>

      <div className="w-px h-6 bg-slate-800 hidden sm:block" />

      {/* Ping Simulation Burst */}
      <button
        onClick={onSimulatePingBurst}
        title="Kirim gelombang simulasi ping / paket data ke semua jalur"
        className="cursor-pointer px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
      >
        <Zap size={13} className="text-cyan-400 animate-bounce" />
        <span className="hidden md:inline">Ping Test</span>
      </button>

      {/* Outage Simulation Trigger */}
      <button
        onClick={handleOutageClick}
        disabled={isSimulatingOutage}
        title="Simulasi link putus / server mati secara acak"
        className="cursor-pointer px-2.5 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900 border border-red-500/40 text-red-300 text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
      >
        <AlertOctagon size={13} className="text-red-400 animate-pulse" />
        <span className="hidden md:inline">Uji Gangguan</span>
      </button>

      <div className="w-px h-6 bg-slate-800 hidden sm:block" />

      {/* All Online / All Offline */}
      <div className="flex items-center gap-1">
        <button
          onClick={onTurnAllOnline}
          title="Nyalakan semua node (Hijau Menyala)"
          className="cursor-pointer px-2 py-1 rounded-md bg-emerald-950/50 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold flex items-center gap-1 transition"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          Semua ON ({onlineCount})
        </button>

        <button
          onClick={onTurnAllOffline}
          title="Matikan semua node (Merah Mati)"
          className="cursor-pointer px-2 py-1 rounded-md bg-red-950/50 hover:bg-red-900 border border-red-500/40 text-red-300 text-[10px] font-bold flex items-center gap-1 transition"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
          Semua OFF ({offlineCount})
        </button>
      </div>
    </div>
  );
}
