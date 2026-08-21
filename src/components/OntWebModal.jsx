"use client";
import { useState, useRef } from "react";
import {
  Globe,
  X,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
  Maximize2,
  Minimize2,
} from "lucide-react";

export default function OntWebModal({ device, onClose }) {
  const [iframeKey, setIframeKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const iframeRef = useRef(null);

  const ip = device?.remote_address;
  const proxyUrl = ip ? `/ont-proxy/${encodeURIComponent(ip)}/` : "";

  const handleCopyIp = () => {
    if (!ip) return;
    navigator.clipboard.writeText(ip);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRefresh = () => {
    setIsLoading(true);
    setIframeKey((prev) => prev + 1);
  };

  return (
    <div className="fixed inset-0 z-[4000] flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className={`bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
          isFullscreen
            ? "w-full h-full rounded-none"
            : "w-full max-w-6xl h-[88vh] max-h-[900px]"
        }`}
      >
        {/* Modal Header */}
        <div className="px-4 py-3 bg-slate-850 border-b border-slate-700/50 flex items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center flex-shrink-0 text-purple-400">
              <Globe size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-slate-100 truncate">
                  Web Management ONT
                </h3>
                <span className="text-[11px] font-semibold text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                  {device.prefix
                    ? String(device.prefix).toUpperCase()
                    : device.mikrotik_name || "OPD"}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  <ShieldCheck size={11} /> NOCR Reverse Proxy (No VPN Required)
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                Target IP: {ip || "-"}{" "}
                {device.ruijie_mac && (
                  <span className="text-slate-500 font-normal">
                    • MAC: {device.ruijie_mac}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {ip && (
              <button
                onClick={handleCopyIp}
                className="cursor-pointer p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
                title="Salin IP ONT"
              >
                {copied ? (
                  <Check size={15} className="text-emerald-400" />
                ) : (
                  <Copy size={15} />
                )}
              </button>
            )}

            <button
              onClick={handleRefresh}
              className="cursor-pointer p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
              title="Reload Web ONT"
            >
              <RefreshCw
                size={15}
                className={isLoading ? "animate-spin text-purple-400" : ""}
              />
            </button>

            {proxyUrl && (
              <a
                href={proxyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="cursor-pointer p-1.5 text-slate-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-lg transition"
                title="Buka Web ONT di Tab Baru"
              >
                <ExternalLink size={15} />
              </a>
            )}

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="cursor-pointer p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition hidden sm:block"
              title={isFullscreen ? "Keluar Fullscreen" : "Layar Penuh"}
            >
              {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>

            <button
              onClick={onClose}
              className="cursor-pointer p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition ml-1"
              title="Tutup Modal"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Modal Iframe Content */}
        <div className="relative flex-1 w-full bg-slate-950 overflow-hidden">
          {isLoading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm gap-3">
              <div className="w-9 h-9 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-300 font-medium">
                Memuat Web Management ONT ({ip})...
              </p>
              <p className="text-[11px] text-slate-500">
                Menghubungkan lewat reverse proxy server internal
              </p>
            </div>
          )}

          {ip ? (
            <iframe
              key={iframeKey}
              ref={iframeRef}
              src={proxyUrl}
              onLoad={() => setIsLoading(false)}
              className="w-full h-full border-0 bg-white"
              title={`ONT Management ${ip}`}
              sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-modals"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 p-6 text-center">
              <Globe size={32} className="mb-2 opacity-40" />
              <p className="text-sm font-semibold text-slate-300">
                IP ONT Tidak Tersedia
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Perangkat ini belum memiliki remote IP address MikroTik yang
                terdaftar.
              </p>
            </div>
          )}
        </div>

        {/* Footer Bar */}
        <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Koneksi Reverse Proxy Aktif</span>
          </div>
          <span className="font-mono text-[10px] text-slate-400">
            http://{ip}/
          </span>
        </div>
      </div>
    </div>
  );
}
