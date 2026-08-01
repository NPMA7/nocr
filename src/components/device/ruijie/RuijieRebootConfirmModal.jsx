"use client";

import { Power, X } from "lucide-react";

export default function RuijieRebootConfirmModal({
  rebootConfirmDevice,
  setRebootConfirmDevice,
  confirmReboot,
}) {
  if (!rebootConfirmDevice) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
          <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
            <Power size={16} className="text-red-400" />
            Konfirmasi Reboot
          </h3>
          <button
            onClick={() => setRebootConfirmDevice(null)}
            className="cursor-pointer text-slate-400 hover:text-slate-200 transition"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-300 leading-relaxed">
            Apakah Anda yakin ingin me-reboot perangkat{" "}
            <span className="font-bold text-white">
              {rebootConfirmDevice.alias || rebootConfirmDevice.sn}
            </span>
            ?
          </p>
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg leading-relaxed">
            ⚠️ Perangkat akan offline sementara selama proses reboot berlangsung.
          </div>
          <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-700/30">
            <button
              type="button"
              onClick={() => setRebootConfirmDevice(null)}
              className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-slate-300 font-medium transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={confirmReboot}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 border border-red-500 text-xs text-white font-semibold transition shadow-lg shadow-red-500/10 cursor-pointer"
            >
              <Power size={13} />
              Ya, Reboot
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
