"use client";
import React, { memo } from "react";
import {
  Cloud,
  Server,
  Router,
  Wifi,
  Shield,
  Monitor,
  Database,
  Radio,
  Box,
  Layers,
  Power,
  Trash2,
  Copy,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Laptop,
  Network,
  Lock,
} from "lucide-react";

const DEVICE_ICONS = {
  cloud: Cloud,
  router: Router,
  mikrotik: Router,
  vpn: Network,
  ont: Box,
  modem: Box,
  olt: Layers,
  odc: Database,
  odp: Box,
  switch: Layers,
  firewall: Shield,
  server: Server,
  ap: Wifi,
  ruijie: Wifi,
  wireless: Radio,
  pc: Monitor,
  laptop: Laptop,
  client: Monitor,
};

export function maskIpAddress(ipString, isReadOnly = false) {
  if (!ipString || typeof ipString !== "string") return "";
  if (!isReadOnly) return ipString;

  let mainIp = ipString.trim();
  let portSuffix = "";

  // Deteksi Port (contoh: :8680 atau :1549)
  if (mainIp.includes(":")) {
    const colonIdx = mainIp.lastIndexOf(":");
    const portPart = mainIp.substring(colonIdx + 1);
    if (!isNaN(portPart) || portPart.length > 0) {
      mainIp = mainIp.substring(0, colonIdx);
      portSuffix = ":xxx";
    }
  }

  // Deteksi Subnet Mask CIDR (contoh: /24)
  let subnetSuffix = "";
  if (mainIp.includes("/")) {
    const slashIdx = mainIp.lastIndexOf("/");
    subnetSuffix = mainIp.substring(slashIdx);
    mainIp = mainIp.substring(0, slashIdx);
  }

  // Pecah 4 oktet IP
  const octets = mainIp.split(".");
  if (octets.length === 4) {
    octets[2] = "xxx";
    return `${octets.join(".")}${subnetSuffix}${portSuffix}`;
  }

  return `${mainIp}${portSuffix}`;
}

function NodeCard({
  node,
  isSelected,
  onSelect,
  onMouseDown,
  onTouchStart,
  onStartLink,
  onFinishLink,
  onToggleStatus,
  onDelete,
  onDuplicate,
  isConnectingLink,
  isLinkStart,
  zoom = 1,
  readOnly = false,
  canDelete = true,
  simulationActive = true,
}) {
  const isOnline = node.status === "online";
  const IconComponent = DEVICE_ICONS[node.type] || Router;
  const isPassive = ["odp", "odc", "splitter", "closure", "joint_box", "patch_panel", "passive", "fiber_box"].includes(node.type?.toLowerCase());
  const isLiveNocr = Boolean(node.is_live_nocr || node.mapping_prefix || node.mapping_mac || node.nocr_category);

  const handlePortClick = (e, port) => {
    e.stopPropagation();
    if (readOnly) return;
    if (isConnectingLink) {
      if (isLinkStart) {
        // Cancel link if clicking the same node
        onStartLink?.(node.id, null);
      } else {
        // Finish link to this node
        onFinishLink?.(node.id, port);
      }
    } else {
      onStartLink?.(node.id, port);
    }
  };

  return (
    <div
      id={`node-${node.id}`}
      style={{
        transform: `translate(${node.x}px, ${node.y}px)`,
        width: 210,
        height: 86,
      }}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onClick={(e) => {
        e.stopPropagation();
        if (isConnectingLink && !isLinkStart) {
          onFinishLink?.(node.id, "auto");
        } else {
          onSelect?.(node);
        }
      }}
      className={`node-card-interactive absolute top-0 left-0 select-none group cursor-grab active:cursor-grabbing rounded-xl p-2.5 transition-shadow duration-300 border flex flex-col justify-between backdrop-blur-md z-20 ${
        isSelected
          ? "ring-2 ring-sky-400 border-sky-400 bg-slate-900/95 shadow-[0_0_25px_rgba(56,189,248,0.45)]"
          : isOnline
          ? "bg-slate-900/90 border-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.25)] hover:border-emerald-400 hover:shadow-[0_0_25px_rgba(16,185,129,0.4)]"
          : "bg-slate-900/90 border-red-500/70 shadow-[0_0_22px_rgba(239,68,68,0.35)] hover:border-red-400 hover:shadow-[0_0_28px_rgba(239,68,68,0.5)]"
      }`}
    >
      {/* Header: Icon, Type Badge & Quick Power Switch */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
              isOnline
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                : "bg-red-500/20 text-red-400 border border-red-500/40 shadow-[0_0_10px_rgba(239,68,68,0.3)]"
            }`}
          >
            <IconComponent size={15} />
          </div>

          <div className="min-w-0 flex-1 flex flex-col">
            <span
              className="text-xs font-bold text-slate-100 truncate tracking-tight leading-tight"
              title={node.label}
            >
              {node.label}
            </span>
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                {node.vendor || node.type}
              </span>
              {node.ip && (
                <>
                  <span className="text-slate-600 text-[8px]">•</span>
                  <span className="text-[9px] text-slate-400 font-mono truncate max-w-[125px]">
                    {maskIpAddress(node.ip, readOnly)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer: Status Glow Dot & Description */}
      <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-slate-800/80">
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full transition-all ${
              isOnline
                ? simulationActive
                  ? "bg-emerald-400 shadow-[0_0_8px_#10b981] animate-pulse"
                  : "bg-emerald-400 shadow-[0_0_8px_#10b981]"
                : "bg-red-500 shadow-[0_0_8px_#ef4444]"
            }`}
          />
          <span className={`font-semibold uppercase text-[9px] tracking-wider ${isOnline ? "text-emerald-400" : "text-red-400"}`}>
            {isOnline ? "Menyala" : "Mati"}
          </span>
        </div>

        <span className="text-[9px] text-slate-400 truncate max-w-[110px] text-right font-medium">
          {node.sublabel || (node.ports ? `${node.ports} Ports` : "Aktif")}
        </span>
      </div>

      {/* Quick Action Floating Bar on Hover */}
      {!readOnly && (
        <div className="absolute -top-3.5 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center bg-slate-900/90 border border-slate-700/80 rounded-lg p-0.5 shadow-xl backdrop-blur-sm z-30">
          {onDuplicate && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate?.(node);
              }}
              title="Duplikasi Node"
              className="cursor-pointer text-slate-400 hover:text-white hover:bg-slate-800 p-0.5 rounded transition"
            >
              <Copy size={12} />
            </button>
          )}

          {canDelete && onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(node.id);
              }}
              title="Hapus Node"
              className="cursor-pointer text-slate-400 hover:text-red-400 hover:bg-red-500/20 p-0.5 rounded transition"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      )}

      {/* Interactive Cable Port Connectors (Top, Bottom, Left, Right) */}
      {!readOnly && (
        <>
          {/* Port Atas */}
          <button
            onClick={(e) => handlePortClick(e, "top")}
            title="Tarik / Hubungkan Kabel ke Sini"
            className={`cursor-crosshair absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full flex items-center justify-center transition border shadow-md ${
              isLinkStart
                ? "bg-amber-400 border-amber-200 text-slate-950 scale-125 animate-pulse"
                : "bg-slate-800 hover:bg-sky-500 border-slate-600 hover:border-sky-300 text-slate-300 hover:text-white opacity-0 group-hover:opacity-100"
            }`}
          >
            <span className="text-[9px] font-black leading-none">+</span>
          </button>

          {/* Port Bawah */}
          <button
            onClick={(e) => handlePortClick(e, "bottom")}
            title="Tarik / Hubungkan Kabel ke Sini"
            className={`cursor-crosshair absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full flex items-center justify-center transition border shadow-md ${
              isLinkStart
                ? "bg-amber-400 border-amber-200 text-slate-950 scale-125 animate-pulse"
                : "bg-slate-800 hover:bg-sky-500 border-slate-600 hover:border-sky-300 text-slate-300 hover:text-white opacity-0 group-hover:opacity-100"
            }`}
          >
            <span className="text-[9px] font-black leading-none">+</span>
          </button>

          {/* Port Kiri */}
          <button
            onClick={(e) => handlePortClick(e, "left")}
            title="Tarik / Hubungkan Kabel ke Sini"
            className={`cursor-crosshair absolute top-1/2 -left-2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center transition border shadow-md ${
              isLinkStart
                ? "bg-amber-400 border-amber-200 text-slate-950 scale-125 animate-pulse"
                : "bg-slate-800 hover:bg-sky-500 border-slate-600 hover:border-sky-300 text-slate-300 hover:text-white opacity-0 group-hover:opacity-100"
            }`}
          >
            <span className="text-[9px] font-black leading-none">+</span>
          </button>

          {/* Port Kanan */}
          <button
            onClick={(e) => handlePortClick(e, "right")}
            title="Tarik / Hubungkan Kabel ke Sini"
            className={`cursor-crosshair absolute top-1/2 -right-2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center transition border shadow-md ${
              isLinkStart
                ? "bg-amber-400 border-amber-200 text-slate-950 scale-125 animate-pulse"
                : "bg-slate-800 hover:bg-sky-500 border-slate-600 hover:border-sky-300 text-slate-300 hover:text-white opacity-0 group-hover:opacity-100"
            }`}
          >
            <span className="text-[9px] font-black leading-none">+</span>
          </button>
        </>
      )}
    </div>
  );
}

export default memo(NodeCard);
