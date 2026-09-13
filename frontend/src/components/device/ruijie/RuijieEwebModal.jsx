"use client";

import { Globe, X, ExternalLink, Link } from "lucide-react";

export default function RuijieEwebModal({ ewebModalData, setEwebModalData }) {
  if (!ewebModalData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
            <Globe size={15} className="text-blue-400" />
            Akses Web Perangkat (eWeb)
          </h3>
          <button
            onClick={() => setEwebModalData(null)}
            className="cursor-pointer text-slate-400 hover:text-slate-200 transition"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-4 sm:p-5 space-y-4">
          <p className="text-xs text-slate-400">
            Tunnel eWeb berhasil dibuat untuk{" "}
            <span className="font-bold text-slate-100">
              {ewebModalData.device.alias || ewebModalData.device.sn}
            </span>
            . Pilih opsi URL untuk membuka antarmuka web:
          </p>

          <div className="space-y-2">
            {ewebModalData.urls.ipUrl && (
              <button
                type="button"
                onClick={() => {
                  window.open(ewebModalData.urls.ipUrl, "_blank");
                  setEwebModalData(null);
                }}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition shadow-sm cursor-pointer text-left"
              >
                <span className="flex items-center gap-2">
                  <ExternalLink size={13} />
                  Direct IP URL (Rekomendasi)
                </span>
                <span className="text-[10px] bg-blue-700/60 px-2 py-0.5 rounded font-mono font-bold">
                  Fast
                </span>
              </button>
            )}

            {ewebModalData.urls.domainUrl && (
              <button
                type="button"
                onClick={() => {
                  window.open(ewebModalData.urls.domainUrl, "_blank");
                  setEwebModalData(null);
                }}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-200 transition cursor-pointer text-left"
              >
                <span className="flex items-center gap-2">
                  <Globe size={13} className="text-slate-400" />
                  Domain URL
                </span>
                <ExternalLink size={12} className="text-slate-500" />
              </button>
            )}

            {ewebModalData.urls.useUrl && (
              <button
                type="button"
                onClick={() => {
                  window.open(ewebModalData.urls.useUrl, "_blank");
                  setEwebModalData(null);
                }}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-200 transition cursor-pointer text-left"
              >
                <span className="flex items-center gap-2">
                  <Link size={13} className="text-slate-400" />
                  useUrl Fallback
                </span>
                <ExternalLink size={12} className="text-slate-500" />
              </button>
            )}
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setEwebModalData(null)}
              className="px-3.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 font-medium transition cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
