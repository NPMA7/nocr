import React, { useMemo } from "react";
import { X, Trash2, Ruler } from "lucide-react";
import { IfaceBadge } from "./StatusBadge";

function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculatePolylineDistance(positions = []) {
  if (!Array.isArray(positions) || positions.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < positions.length - 1; i++) {
    const p1 = positions[i];
    const p2 = positions[i + 1];
    if (Array.isArray(p1) && Array.isArray(p2) && p1.length >= 2 && p2.length >= 2) {
      total += getDistanceMeters(p1[0], p1[1], p2[0], p2[1]);
    }
  }
  return total;
}

function formatDistance(meters) {
  if (!meters || isNaN(meters)) return "0 m";
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km (${Math.round(meters)} m)`;
  }
  return `${Math.round(meters)} m`;
}

export default function EdgeDetailsSidebar({
  selectedEdge,
  setSelectedEdge,
  readOnly,
  canDelete,
  setEdgesFromUser,
  coreInterfaces,
  markEdgeDeleted,
}) {
  const cableDistance = useMemo(() => {
    if (selectedEdge?.positions && selectedEdge.positions.length >= 2) {
      return calculatePolylineDistance(selectedEdge.positions);
    }
    const fNode = selectedEdge?.fromNode;
    const tNode = selectedEdge?.toNode;
    if (fNode && tNode && !isNaN(fNode.latitude) && !isNaN(tNode.latitude)) {
      const pos = [
        [fNode.latitude, fNode.longitude],
        ...(selectedEdge.waypoints || []),
        [tNode.latitude, tNode.longitude],
      ];
      return calculatePolylineDistance(pos);
    }
    return 0;
  }, [selectedEdge]);

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

            {/* Estimasi Panjang Kabel */}
            <div className="flex items-center justify-between p-3 bg-slate-900/60 rounded-xl border border-slate-700/60 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold text-sm">
                  📏
                </div>
                <div>
                  <div className="font-semibold text-slate-200">Estimasi Panjang Kabel</div>
                  <div className="text-[10px] text-slate-400">Total rute termasuk belokan</div>
                </div>
              </div>
              <div className="text-xs font-bold font-mono text-cyan-300 bg-cyan-950/80 border border-cyan-500/40 px-2 py-1 rounded-lg shadow-sm">
                {formatDistance(cableDistance)}
              </div>
            </div>

            {/* Waypoints / Belokan Kabel */}
            <div className="flex flex-col gap-2 p-3 bg-slate-900/60 rounded-xl border border-slate-700/60 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]"></span>
                  Titik Belokan (Pen Tool)
                </span>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-700/50">
                  {Array.isArray(selectedEdge.waypoints) ? selectedEdge.waypoints.length : 0} Titik
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                💡 <strong className="text-slate-300">Tips Pen Tool:</strong> Klik pada garis kabel di peta untuk menambahkan titik belokan baru. Geser bulatan biru untuk mengatur lekukan kabel sesuai jalan.
              </p>
              {Array.isArray(selectedEdge.waypoints) && selectedEdge.waypoints.length > 0 && !readOnly && (
                <button
                  type="button"
                  onClick={() => {
                    setEdgesFromUser((prev) =>
                      prev.map((ed) =>
                        ed.id === selectedEdge.id
                          ? { ...ed, waypoints: [] }
                          : ed
                      )
                    );
                    setSelectedEdge((prev) => (prev ? { ...prev, waypoints: [] } : prev));
                  }}
                  className="cursor-pointer mt-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[11px] font-medium border border-slate-600/50 transition flex items-center justify-center gap-1.5"
                >
                  <span>Reset Jalur ke Garis Lurus</span>
                </button>
              )}
            </div>

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
