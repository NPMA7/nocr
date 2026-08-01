"use client";

import { X, Trash2 } from "lucide-react";
import { IfaceBadge } from "./StatusBadge";

export default function EdgeDetailsSidebar({
  selectedEdge,
  setSelectedEdge,
  readOnly,
  canDelete,
  setEdgesFromUser,
  coreInterfaces,
  markEdgeDeleted,
}) {
  if (!selectedEdge) return null;

  return (
    <div
      className={`absolute top-0 right-0 bottom-0 w-80 bg-slate-800/95 backdrop-blur-md border-l border-slate-700/50 flex flex-col z-[1000] shadow-2xl transition-transform duration-300 ease-out ${
        selectedEdge ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="p-4 border-b border-slate-700/50 flex justify-between items-center">
        <h3 className="font-bold text-slate-100">Koneksi FO</h3>
        <button
          className="cursor-pointer text-slate-400 hover:text-white"
          onClick={() => setSelectedEdge(null)}
        >
          <X size={20} />
        </button>
      </div>
      <div className="p-5 flex-1 flex flex-col gap-4">
        {selectedEdge && (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400">
                Nama Kabel / Interface
              </label>
              <input
                type="text"
                readOnly={readOnly}
                value={selectedEdge.label || ""}
                onChange={(e) =>
                  setEdgesFromUser((prev) =>
                    prev.map((ed) =>
                      ed.id === selectedEdge.id
                        ? { ...ed, label: e.target.value }
                        : ed,
                    ),
                  )
                }
                className={`bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500 w-full ${
                  readOnly ? "opacity-70 cursor-default" : ""
                }`}
              />
              <p className="text-[10px] text-slate-500">
                Jika nama cocok dengan interface MikroTik, warna kabel akan
                mengikuti status interface secara otomatis.
              </p>
            </div>

            {/* Show matched interface status */}
            {selectedEdge.label &&
              (() => {
                const matched = coreInterfaces.find(
                  (i) =>
                    i.name &&
                    selectedEdge.label &&
                    i.name.toLowerCase() === selectedEdge.label.toLowerCase(),
                );
                if (!matched)
                  return (
                    <div className="bg-slate-900/40 rounded-lg p-3 border border-slate-700/40 text-xs text-slate-500">
                      Tidak ada interface MikroTik yang cocok dengan nama{" "}
                      <strong className="text-slate-400">
                        "{selectedEdge.label}"
                      </strong>
                    </div>
                  );
                return (
                  <div
                    className={`flex items-center justify-between p-3 rounded-lg border text-xs ${
                      matched.running === "true"
                        ? "bg-emerald-500/10 border-emerald-500/30"
                        : "bg-red-500/10 border-red-500/30"
                    }`}
                  >
                    <div>
                      <p className="text-slate-400">
                        Interface:{" "}
                        <span className="text-slate-200 font-medium">
                          {matched.name}
                        </span>
                      </p>
                      <p className="text-slate-500 mt-0.5">
                        MAC: {matched["mac-address"] || "-"} · MTU:{" "}
                        {matched.mtu || "-"}
                      </p>
                    </div>
                    <IfaceBadge
                      running={matched.running}
                      disabled={matched.disabled}
                    />
                  </div>
                );
              })()}

            {/* Manual override status */}
            {!coreInterfaces.find(
              (i) =>
                i.name?.toLowerCase() === selectedEdge.label?.toLowerCase(),
            ) && (
              <div className="flex justify-between items-center py-2.5 border-b border-slate-700/30">
                <span className="text-xs text-slate-400">Status Manual</span>
                <select
                  disabled={readOnly}
                  value={selectedEdge.status || "up"}
                  onChange={(e) =>
                    setEdgesFromUser((prev) =>
                      prev.map((ed) =>
                        ed.id === selectedEdge.id
                          ? { ...ed, status: e.target.value }
                          : ed,
                      ),
                    )
                  }
                  className="bg-slate-900 border border-slate-700 rounded-md p-1.5 text-xs text-slate-200 disabled:opacity-70"
                >
                  <option value="up">Aktif (UP)</option>
                  <option value="down">Putus (DOWN)</option>
                </select>
              </div>
            )}

            {canDelete && (
              <button
                onClick={() => {
                  markEdgeDeleted(selectedEdge.id);
                  setEdgesFromUser((prev) =>
                    prev.filter((e) => e.id !== selectedEdge.id),
                  );
                  setSelectedEdge(null);
                }}
                className="cursor-pointer mt-auto flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white py-2.5 rounded-lg text-xs font-semibold transition"
              >
                <Trash2 size={16} /> Potong Kabel
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
