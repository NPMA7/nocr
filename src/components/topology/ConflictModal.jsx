"use client";
import { useState } from "react";
import { X, RefreshCw, Save } from "lucide-react";

export default function ConflictModal({ conflicts, onForce, onAcceptServer, onDismiss }) {
  const [selected, setSelected] = useState(
    () => new Set(conflicts.map((c) => c.id)),
  );

  const toggleAll = () => {
    if (selected.size === conflicts.length) setSelected(new Set());
    else setSelected(new Set(conflicts.map((c) => c.id)));
  };

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="absolute inset-0 z-[5000] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-amber-500/30 rounded-2xl shadow-2xl shadow-amber-500/10 w-full max-w-lg flex flex-col overflow-hidden animate-fade-in-up">
        {/* Header */}
        <div className="p-5 border-b border-slate-700/50 bg-amber-500/5 flex items-start gap-3">
          <div className="mt-0.5 flex-shrink-0 w-9 h-9 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-base">
            ⚠️
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-amber-300 text-sm">
              Konflik Perubahan Terdeteksi
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              {conflicts.length} node sudah diubah user lain sejak kamu mulai
              mengedit. Pilih tindakan untuk setiap node di bawah ini.
            </p>
          </div>
          <button
            onClick={onDismiss}
            className="cursor-pointer text-slate-500 hover:text-white transition flex-shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Node list */}
        <div className="overflow-y-auto max-h-72 divide-y divide-slate-700/40">
          {/* Select all row */}
          <div className="px-5 py-2.5 flex items-center gap-3 bg-slate-800/40">
            <input
              type="checkbox"
              id="conflict-select-all"
              checked={selected.size === conflicts.length}
              onChange={toggleAll}
              className="w-4 h-4 accent-amber-500 cursor-pointer"
            />
            <label
              htmlFor="conflict-select-all"
              className="text-xs font-semibold text-slate-300 cursor-pointer"
            >
              Pilih Semua ({conflicts.length} node)
            </label>
          </div>

          {conflicts.map((c) => (
            <div
              key={c.id}
              className={`px-5 py-3 flex items-start gap-3 transition ${selected.has(c.id) ? "bg-amber-500/5" : ""}`}
            >
              <input
                type="checkbox"
                id={`conflict-${c.id}`}
                checked={selected.has(c.id)}
                onChange={() => toggle(c.id)}
                className="w-4 h-4 mt-0.5 accent-amber-500 cursor-pointer flex-shrink-0"
              />
              <label
                htmlFor={`conflict-${c.id}`}
                className="flex-1 min-w-0 cursor-pointer"
              >
                <p className="text-xs font-semibold text-slate-100 truncate">
                  {c.label}
                </p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 font-mono">
                    {c.id}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    DB diubah:{" "}
                    {c.dbVersion?.last_modified_at
                      ? new Date(
                          c.dbVersion.last_modified_at,
                        ).toLocaleTimeString("id-ID")
                      : "tidak diketahui"}
                  </span>
                </div>
              </label>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="p-5 border-t border-slate-700/50 bg-slate-800/30 flex flex-col gap-3">
          <p className="text-[11px] text-slate-500 text-center">
            {selected.size === 0
              ? "Tidak ada node dipilih"
              : `${selected.size} node terpilih`}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => onAcceptServer(selected)}
              disabled={selected.size === 0}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RefreshCw size={14} /> Pakai Versi Server
            </button>
            <button
              onClick={() => onForce(selected)}
              disabled={selected.size === 0}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white transition shadow-lg shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Save size={14} /> Pakai Versimu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
