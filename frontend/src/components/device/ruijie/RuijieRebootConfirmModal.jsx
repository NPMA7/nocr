"use client";

import { Power, X, Loader2 } from "lucide-react";

export default function RuijieRebootConfirmModal({
  rebootConfirmDevice,
  setRebootConfirmDevice,
  confirmReboot,
  isLoading = false,
}) {
  if (!rebootConfirmDevice) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
            <Power size={15} className="text-rose-400" />
            Konfirmasi Reboot
          </h3>
          <button
            onClick={() => !isLoading && setRebootConfirmDevice(null)}
            disabled={isLoading}
            className="cursor-pointer text-slate-400 hover:text-slate-200 transition disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-4 sm:p-5 space-y-4">
          <p className="text-xs text-slate-300 leading-relaxed">
            Apakah Anda yakin ingin me-reboot perangkat{" "}
            <span className="font-bold text-slate-100 font-mono">
              {rebootConfirmDevice.alias || rebootConfirmDevice.sn}
            </span>
            ?
          </p>
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] p-3 rounded-lg leading-relaxed">
            Perangkat akan terputus offline sementara selama proses reboot berlangsung.
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setRebootConfirmDevice(null)}
              disabled={isLoading}
              className="px-3.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 font-medium transition cursor-pointer disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={confirmReboot}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs text-white font-semibold transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
            >
              {isLoading ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Mengirim ke Cloud...
                </>
              ) : (
                <>
                  <Power size={13} />
                  Ya, Reboot
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
