import React from "react";
import { X, Server } from "lucide-react";
import OntDetailView from "./OntDetailView";

export default function OntDetailModal({
  ontIdString,
  portId,
  ontId,
  onClose,
}) {
  if (!portId) return null;

  const b = data?.base || {};
  const v = data?.version || {};
  const c = data?.capability || {};

  // Helper for rows
  const DetailRow = ({ label, value }) => (
    <div className="flex justify-between items-center py-2 border-b border-slate-700/50 last:border-0 hover:bg-slate-800/30 transition-colors px-2 rounded-md">
      <span className="text-slate-400 text-xs">{label}</span>
      <span className="text-slate-200 text-xs font-medium text-right break-all ml-4">
        {value !== "" && value !== undefined && value !== null ? value : "-"}
      </span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-800 border border-slate-700 shadow-2xl rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-slate-700 bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
              <Server size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                Detail ONT: {ontIdString}
              </h2>
              <p className="text-xs text-slate-400">
                Menampilkan spesifikasi mendalam dari perangkat ONT
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 custom-scrollbar">
          <OntDetailView portId={portId} ontId={ontId} />
        </div>
      </div>
    </div>
  );
}
