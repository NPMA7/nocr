"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  Download,
  Trash2,
  Calendar,
  HardDrive,
  Maximize2,
  MousePointer,
  HelpCircle,
} from "lucide-react";

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
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const viewportRef = useRef(null);

  const resetTransform = useCallback(() => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (isOpen) {
      resetTransform();
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen, resetTransform]);

  // Keyboard Shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setScale((prev) => Math.min(prev * 1.25, 8));
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        setScale((prev) => Math.max(prev / 1.25, 0.4));
      } else if (e.key === "0" || e.key.toLowerCase() === "r") {
        e.preventDefault();
        resetTransform();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, resetTransform]);

  if (!isOpen || !photo) return null;

  const imageUrl =
    photo.preview_url ||
    photo.url ||
    photo.thumbnail_url ||
    (photo.drive_id ? `https://lh3.googleusercontent.com/d/${photo.drive_id}` : "");

  // Mouse Wheel Zoom
  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.18 : 0.85;
    setScale((prev) => {
      const nextScale = Math.min(Math.max(prev * zoomFactor, 0.4), 8);
      if (nextScale <= 1) {
        setPosition({ x: 0, y: 0 });
      }
      return nextScale;
    });
  };

  // Double Click Zoom Toggle
  const handleDoubleClick = (e) => {
    e.stopPropagation();
    if (scale > 1.2) {
      resetTransform();
    } else {
      setScale(2.5);
    }
  };

  // Drag to Pan Handlers
  const handleMouseDown = (e) => {
    // Only allow left click drag
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
    };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    setPosition({
      x: dragStartRef.current.posX + deltaX,
      y: dragStartRef.current.posY + deltaY,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomIn = () => setScale((prev) => Math.min(prev * 1.25, 8));
  const handleZoomOut = () =>
    setScale((prev) => {
      const next = Math.max(prev / 1.25, 0.4);
      if (next <= 1) setPosition({ x: 0, y: 0 });
      return next;
    });
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
      className="fixed inset-0 z-[9999] flex flex-col bg-black/95 backdrop-blur-md transition-opacity duration-200 animate-fadeIn select-none overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Top Header Controls */}
      <div className="flex items-center justify-between p-3.5 bg-slate-900/90 border-b border-slate-800 text-slate-100 z-20 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="px-2.5 py-1 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-bold uppercase tracking-wider shrink-0">
            {deviceLabel}
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white truncate">
              {photo.file_name || `${deviceLabel} Photo`}
            </h3>
            <p className="text-[11px] text-slate-400 font-mono truncate">
              Site: {sitePrefix} · {formattedDate}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Zoom Controls */}
          <button
            type="button"
            onClick={handleZoomIn}
            className="cursor-pointer p-2 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white transition"
            title="Zoom In (+)"
          >
            <ZoomIn size={16} />
          </button>

          <span className="text-[11px] font-mono text-slate-400 px-1 min-w-[45px] text-center">
            {Math.round(scale * 100)}%
          </span>

          <button
            type="button"
            onClick={handleZoomOut}
            className="cursor-pointer p-2 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white transition"
            title="Zoom Out (-)"
          >
            <ZoomOut size={16} />
          </button>

          <button
            type="button"
            onClick={resetTransform}
            className="cursor-pointer p-2 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white transition"
            title="Reset Zoom (1:1 / R)"
          >
            <RotateCcw size={15} />
          </button>

          <button
            type="button"
            onClick={handleRotate}
            className="cursor-pointer p-2 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white transition"
            title="Putar 90°"
          >
            <RotateCw size={15} />
          </button>

          <div className="h-5 w-[1px] bg-slate-700 mx-1" />

          {imageUrl && (
            <a
              href={imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              download={photo.file_name || "evidence_photo.jpg"}
              className="cursor-pointer p-2 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white transition flex items-center gap-1"
              title="Download Gambar HD"
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
              className="cursor-pointer p-2 rounded-lg bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-white transition"
              title="Hapus Foto"
            >
              <Trash2 size={16} />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer p-2 ml-2 rounded-lg bg-slate-800/90 hover:bg-red-500 text-slate-300 hover:text-white transition"
            title="Tutup (Esc)"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main Interactive Viewport with Mouse Zoom & Pan */}
      <div
        ref={viewportRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        className={`flex-1 flex items-center justify-center overflow-hidden relative select-none ${
          isDragging ? "cursor-grabbing" : scale > 1 ? "cursor-grab" : "cursor-zoom-in"
        }`}
      >
        {imageUrl ? (
          <div
            style={{
              transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale}) rotate(${rotation}deg)`,
              transition: isDragging ? "none" : "transform 0.15s ease-out",
              transformOrigin: "center center",
            }}
            className="pointer-events-none flex items-center justify-center max-w-full max-h-full"
          >
            <img
              src={imageUrl}
              alt={deviceLabel}
              draggable={false}
              className="max-h-[82vh] max-w-[88vw] object-contain rounded-lg shadow-2xl user-select-none"
              onError={(e) => {
                if (photo.drive_id && !e.target.src.includes("/api/drive/image")) {
                  e.target.src = `/api/drive/image/${photo.drive_id}`;
                }
              }}
            />
          </div>
        ) : (
          <div className="text-slate-400 text-xs">Gambar tidak dapat dimuat</div>
        )}

        {/* Floating Quick Hint */}
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-700/70 text-slate-300 text-[11px] shadow-lg pointer-events-none flex items-center gap-2 backdrop-blur-sm opacity-75 hover:opacity-100 transition-opacity">
          <span>🖱️ <b>Scroll Mouse</b>: Zoom In / Out</span>
          <span>·</span>
          <span>🖐️ <b>Drag</b>: Geser Foto</span>
          <span>·</span>
          <span>👆 <b>Double Click</b>: Zoom Cepat</span>
        </div>
      </div>

      {/* Bottom Info Bar */}
      <div className="px-4 py-2.5 bg-slate-900/95 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1.5">
            <HardDrive size={13} className="text-blue-400" /> Tersimpan di Google Drive (FOTO_DEVICES)
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar size={13} className="text-emerald-400" /> Diunggah: {formattedDate}
          </span>
        </div>
        <div className="text-slate-500 font-mono text-[10px] flex items-center gap-3">
          <span>Skala: {Math.round(scale * 100)}%</span>
          <span>Rotasi: {rotation}°</span>
          <span>Pos: ({Math.round(position.x)}, {Math.round(position.y)})</span>
        </div>
      </div>
    </div>
  );
}
