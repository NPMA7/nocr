"use client";

import { useState, useEffect } from "react";
import { X, ZoomIn, ZoomOut, RotateCw, Download, Trash2, Calendar, HardDrive, Eye } from "lucide-react";

export default function EvidenceLightboxModal({
  isOpen,
  onClose,
  photo,
  deviceLabel,
  sitePrefix,
  onDelete,
  canEdit = false,
}) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setRotation(0);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen || !photo) return null;

  const imageUrl = photo.preview_url || photo.url || photo.thumbnail_url || (photo.drive_id ? `https://lh3.googleusercontent.com/d/${photo.drive_id}` : "");

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  const formattedDate = photo.updated_at
    ? new Date(photo.updated_at).toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-black/90 backdrop-blur-md transition-opacity duration-200 animate-fadeIn select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Top Header Controls */}
      <div className="flex items-center justify-between p-4 bg-slate-900/80 border-b border-slate-800 text-slate-100 z-10">
        <div className="flex items-center gap-3">
          <span className="px-2.5 py-1 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-bold uppercase tracking-wider">
            {deviceLabel}
          </span>
          <div>
            <h3 className="text-sm font-semibold text-white">
              {photo.file_name || `${deviceLabel} Photo`}
            </h3>
            <p className="text-[11px] text-slate-400 font-mono">
              Site: {sitePrefix} · {formattedDate}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleZoomIn}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 transition"
            title="Zoom In"
          >
            <ZoomIn size={16} />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 transition"
            title="Zoom Out"
          >
            <ZoomOut size={16} />
          </button>
          <button
            type="button"
            onClick={handleRotate}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 transition"
            title="Putar Gambar"
          >
            <RotateCw size={16} />
          </button>
          {imageUrl && (
            <a
              href={imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              download={photo.file_name || "evidence_photo.jpg"}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 transition"
              title="Download / Buka Gambar HD"
            >
              <Download size={16} />
            </a>
          )}
          {canEdit && onDelete && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Hapus foto ${deviceLabel}?`)) {
                  onDelete();
                  onClose();
                }
              }}
              className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-white transition"
              title="Hapus Foto"
            >
              <Trash2 size={16} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-2 ml-2 rounded-lg bg-slate-800/80 hover:bg-red-500 hover:text-white text-slate-300 transition"
            title="Tutup (Esc)"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main Image Viewport */}
      <div className="flex-1 flex items-center justify-center overflow-hidden p-4 relative cursor-grab active:cursor-grabbing">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={deviceLabel}
            style={{
              transform: `scale(${scale}) rotate(${rotation}deg)`,
              transition: "transform 0.2s ease-out",
            }}
            className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg shadow-2xl pointer-events-auto"
            onError={(e) => {
              // If preview URL fails, fallback to direct proxy
              if (photo.drive_id && !e.target.src.includes('/api/drive/image')) {
                e.target.src = `/api/drive/image/${photo.drive_id}`;
              }
            }}
          />
        ) : (
          <div className="text-slate-400 text-xs">Gambar tidak dapat dimuat</div>
        )}
      </div>

      {/* Bottom Info Bar */}
      <div className="px-4 py-2.5 bg-slate-900/90 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <HardDrive size={13} className="text-blue-400" /> Tersimpan di Google Drive (FOTO_DEVICES)
          </span>
          <span className="flex items-center gap-1">
            <Calendar size={13} className="text-emerald-400" /> Diunggah: {formattedDate}
          </span>
        </div>
        <div className="text-slate-500 font-mono text-[10px]">
          Skala: {Math.round(scale * 100)}% · Rotasi: {rotation}°
        </div>
      </div>
    </div>
  );
}
