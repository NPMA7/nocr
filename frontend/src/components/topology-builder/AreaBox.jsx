"use client";
import React, { useState } from "react";
import { Trash2, Edit3, Check, Palette, Move } from "lucide-react";

export const AREA_THEMES = {
  blue: {
    border: "border-blue-500/60 hover:border-blue-400",
    bg: "bg-blue-950/25",
    headerBg: "bg-blue-900/40 border-blue-500/40",
    text: "text-blue-300",
    badge: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    glow: "shadow-[0_0_25px_rgba(59,130,246,0.15)]",
    dot: "bg-blue-400",
  },
  emerald: {
    border: "border-emerald-500/60 hover:border-emerald-400",
    bg: "bg-emerald-950/25",
    headerBg: "bg-emerald-900/40 border-emerald-500/40",
    text: "text-emerald-300",
    badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    glow: "shadow-[0_0_25px_rgba(16,185,129,0.15)]",
    dot: "bg-emerald-400",
  },
  slate: {
    border: "border-slate-500/60 hover:border-slate-400",
    bg: "bg-slate-900/40",
    headerBg: "bg-slate-800/60 border-slate-600/40",
    text: "text-slate-300",
    badge: "bg-slate-700/50 text-slate-200 border-slate-600",
    glow: "shadow-[0_0_25px_rgba(148,163,184,0.1)]",
    dot: "bg-slate-400",
  },
  amber: {
    border: "border-amber-500/60 hover:border-amber-400",
    bg: "bg-amber-950/25",
    headerBg: "bg-amber-900/40 border-amber-500/40",
    text: "text-amber-300",
    badge: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    glow: "shadow-[0_0_25px_rgba(245,158,11,0.15)]",
    dot: "bg-amber-400",
  },
  cyan: {
    border: "border-cyan-500/60 hover:border-cyan-400",
    bg: "bg-cyan-950/25",
    headerBg: "bg-cyan-900/40 border-cyan-500/40",
    text: "text-cyan-300",
    badge: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    glow: "shadow-[0_0_25px_rgba(6,182,212,0.15)]",
    dot: "bg-cyan-400",
  },
  rose: {
    border: "border-rose-500/60 hover:border-rose-400",
    bg: "bg-rose-950/25",
    headerBg: "bg-rose-900/40 border-rose-500/40",
    text: "text-rose-300",
    badge: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    glow: "shadow-[0_0_25px_rgba(244,63,94,0.15)]",
    dot: "bg-rose-400",
  },
};

export default function AreaBox({
  area,
  containedCount = 0,
  isHighlighted = false,
  onStartDrag,
  onStartResize,
  onUpdate,
  onDelete,
  readOnly = false,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState(area.name || "Area Wilayah");
  const [showColorPicker, setShowColorPicker] = useState(false);

  const themeKey = area.color || "blue";
  const theme = AREA_THEMES[themeKey] || AREA_THEMES.blue;

  const handleSaveName = () => {
    setIsEditing(false);
    if (nameInput.trim() && nameInput.trim() !== area.name) {
      onUpdate?.(area.id, { name: nameInput.trim() });
    }
  };

  const handleColorChange = (c) => {
    setShowColorPicker(false);
    onUpdate?.(area.id, { color: c });
  };

  return (
    <div
      style={{
        transform: `translate(${area.x}px, ${area.y}px)`,
        width: `${area.width}px`,
        height: `${area.height}px`,
      }}
      className={`absolute top-0 left-0 rounded-2xl border-2 border-dashed ${theme.border} ${theme.bg} ${theme.glow} backdrop-blur-[2px] flex flex-col group select-none pointer-events-auto z-10 area-box-interactive ${
        isHighlighted
          ? "ring-4 ring-sky-400 border-sky-400 shadow-[0_0_50px_rgba(56,189,248,0.55)] scale-[1.01] transition-[box-shadow,ring-color,border-color] duration-300"
          : ""
      }`}
    >
      {/* Header Bar (Draggable) */}
      <div
        onMouseDown={(e) => {
          if (!readOnly && e.button === 0 && !e.target.closest("button") && !e.target.closest("input")) {
            e.stopPropagation();
            onStartDrag?.(area, e);
          }
        }}
        className={`h-9 px-3 flex items-center justify-between border-b rounded-t-2xl ${theme.headerBg} ${
          readOnly ? "cursor-default" : "cursor-grab active:cursor-grabbing"
        } transition select-none`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full ${theme.dot} shadow-[0_0_8px_currentColor] flex-shrink-0`} />
          
          {isEditing && !readOnly ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveName();
                  if (e.key === "Escape") {
                    setIsEditing(false);
                    setNameInput(area.name);
                  }
                }}
                className="bg-slate-900 border border-slate-700 text-slate-100 text-xs px-1.5 py-0.5 rounded font-bold focus:outline-none focus:border-blue-500 w-32 cursor-text"
              />
              <button
                onClick={handleSaveName}
                className="cursor-pointer text-emerald-400 hover:text-white p-0.5 rounded transition"
              >
                <Check size={13} />
              </button>
            </div>
          ) : (
            <div
              onDoubleClick={() => {
                if (!readOnly) setIsEditing(true);
              }}
              className={`flex items-center gap-1.5 min-w-0 ${!readOnly ? "cursor-pointer" : "cursor-default"}`}
              title={readOnly ? area.name : "Klik 2x untuk mengubah nama area"}
            >
              <span className={`text-xs font-bold ${theme.text} truncate max-w-[180px] tracking-wide`}>
                {area.name || "Area Wilayah"}
              </span>
              {!readOnly && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="cursor-pointer opacity-0 group-hover:opacity-100 text-slate-400 hover:text-white transition p-0.5"
                  title="Ubah Nama Area"
                >
                  <Edit3 size={11} />
                </button>
              )}
            </div>
          )}

          {/* Node Count Badge */}
          <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded-full border ${theme.badge}`}>
            {containedCount} Perangkat
          </span>
        </div>

        {/* Action Buttons (Color, Move Drag Indicator, Delete) */}
        {!readOnly && (
          <div className="flex items-center gap-1 relative flex-shrink-0">
            {/* Color Palette Trigger */}
            <div className="relative">
              <button
                onClick={() => setShowColorPicker((prev) => !prev)}
                title="Ganti Tema Warna Area"
                className="cursor-pointer text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800/60 transition"
              >
                <Palette size={13} />
              </button>

              {showColorPicker && (
                <div className="absolute right-0 top-7 z-50 bg-slate-900 border border-slate-700/80 rounded-xl p-2 shadow-2xl flex items-center gap-1.5 animate-in fade-in zoom-in-95">
                  {Object.keys(AREA_THEMES).map((colorKey) => (
                    <button
                      key={colorKey}
                      onClick={() => handleColorChange(colorKey)}
                      className={`cursor-pointer w-5 h-5 rounded-full border transition hover:scale-110 ${AREA_THEMES[colorKey].dot} ${
                        area.color === colorKey ? "ring-2 ring-white ring-offset-1 ring-offset-slate-900 border-white" : "border-transparent"
                      }`}
                      title={`Warna ${colorKey}`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Move handle icon */}
            <div
              title="Tahan & Tarik untuk menggeser area beserta seluruh perangkat di dalamnya"
              className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800/60 transition"
            >
              <Move size={13} />
            </div>

            {/* Delete Area */}
            <button
              onClick={() => onDelete?.(area.id)}
              title="Hapus Kotak Area (Perangkat di dalamnya tetap aman)"
              className="cursor-pointer text-slate-400 hover:text-red-400 p-1 rounded hover:bg-red-950/40 transition"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Body / Background Area (Can also be dragged to move all contained nodes) */}
      <div
        onMouseDown={(e) => {
          if (!readOnly && e.button === 0 && !e.target.closest("button") && !e.target.closest("input")) {
            e.stopPropagation();
            onStartDrag?.(area, e);
          }
        }}
        className={`flex-1 ${readOnly ? "cursor-default" : "cursor-grab active:cursor-grabbing"}`}
        title={!readOnly ? "Geser kotak area untuk memindahkan semua perangkat di dalamnya" : ""}
      />

      {/* Resize Handles (All 4 Corners + 4 Edges) */}
      {!readOnly && (
        <>
          {/* Top-Left */}
          <div
            onMouseDown={(e) => { if (e.button === 0) { e.stopPropagation(); onStartResize?.(area, e, "nw"); } }}
            className="absolute -top-1 -left-1 w-4 h-4 cursor-nw-resize z-20 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <div className={`w-2.5 h-2.5 rounded-tl border-l-2 border-t-2 ${theme.border}`} />
          </div>
          {/* Top-Right */}
          <div
            onMouseDown={(e) => { if (e.button === 0) { e.stopPropagation(); onStartResize?.(area, e, "ne"); } }}
            className="absolute -top-1 -right-1 w-4 h-4 cursor-ne-resize z-20 opacity-0 group-hover:opacity-100 transition-opacity flex justify-end"
          >
            <div className={`w-2.5 h-2.5 rounded-tr border-r-2 border-t-2 ${theme.border}`} />
          </div>
          {/* Bottom-Left */}
          <div
            onMouseDown={(e) => { if (e.button === 0) { e.stopPropagation(); onStartResize?.(area, e, "sw"); } }}
            className="absolute -bottom-1 -left-1 w-4 h-4 cursor-sw-resize z-20 opacity-0 group-hover:opacity-100 transition-opacity flex items-end"
          >
            <div className={`w-2.5 h-2.5 rounded-bl border-l-2 border-b-2 ${theme.border}`} />
          </div>
          {/* Bottom-Right */}
          <div
            onMouseDown={(e) => { if (e.button === 0) { e.stopPropagation(); onStartResize?.(area, e, "se"); } }}
            className="absolute -bottom-1 -right-1 w-5 h-5 cursor-se-resize z-20 flex items-end justify-end p-0.5"
          >
            <div className={`w-3 h-3 rounded-br border-r-2 border-b-2 ${theme.border} group-hover:scale-125 transition-transform`} />
          </div>
          {/* Top Edge */}
          <div
            onMouseDown={(e) => { if (e.button === 0) { e.stopPropagation(); onStartResize?.(area, e, "n"); } }}
            className="absolute -top-1 left-4 right-4 h-3 cursor-n-resize z-20 opacity-0 group-hover:opacity-100 transition-opacity"
          />
          {/* Bottom Edge */}
          <div
            onMouseDown={(e) => { if (e.button === 0) { e.stopPropagation(); onStartResize?.(area, e, "s"); } }}
            className="absolute -bottom-1 left-4 right-4 h-3 cursor-s-resize z-20 opacity-0 group-hover:opacity-100 transition-opacity"
          />
          {/* Left Edge */}
          <div
            onMouseDown={(e) => { if (e.button === 0) { e.stopPropagation(); onStartResize?.(area, e, "w"); } }}
            className="absolute top-4 -left-1 w-3 bottom-4 cursor-w-resize z-20 opacity-0 group-hover:opacity-100 transition-opacity"
          />
          {/* Right Edge */}
          <div
            onMouseDown={(e) => { if (e.button === 0) { e.stopPropagation(); onStartResize?.(area, e, "e"); } }}
            className="absolute top-4 -right-1 w-3 bottom-4 cursor-e-resize z-20 opacity-0 group-hover:opacity-100 transition-opacity"
          />
        </>
      )}
    </div>
  );
}
