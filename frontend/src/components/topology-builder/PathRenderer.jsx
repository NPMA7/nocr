"use client";
import React, { useMemo } from "react";

/**
 * Menghitung jalur kabel ortogonal (sudut 90°) dengan rounded corners
 * seperti diagram jaringan profesional (Visio / draw.io style)
 */
export function calculateBezierPath(fromNode, toNode, fromPort = "auto", toPort = "auto") {
  if (!fromNode || !toNode) return { d: "", midX: 0, midY: 0, startX: 0, startY: 0, endX: 0, endY: 0 };

  const NODE_WIDTH = 210;
  const NODE_HEIGHT = 86;
  const R = 14; // Corner radius untuk tikungan halus

  // Pusat kedua node
  const c1x = fromNode.x + NODE_WIDTH / 2;
  const c1y = fromNode.y + NODE_HEIGHT / 2;
  const c2x = toNode.x + NODE_WIDTH / 2;
  const c2y = toNode.y + NODE_HEIGHT / 2;

  const dx = c2x - c1x;
  const dy = c2y - c1y;

  let startX = c1x;
  let startY = c1y;
  let endX = c2x;
  let endY = c2y;

  // Titik keluar (fromPort)
  if (fromPort === "top") {
    startX = c1x;
    startY = fromNode.y;
  } else if (fromPort === "bottom") {
    startX = c1x;
    startY = fromNode.y + NODE_HEIGHT;
  } else if (fromPort === "left") {
    startX = fromNode.x;
    startY = c1y;
  } else if (fromPort === "right") {
    startX = fromNode.x + NODE_WIDTH;
    startY = c1y;
  } else {
    // Auto-pilih port: prefer horizontal trunk (keluar kiri/kanan)
    // Keluar vertikal HANYA jika target hampir lurus di atas/bawah (kolom yang sama)
    if (Math.abs(dx) < 60) {
      // Target di kolom yang sama → keluar vertikal
      startY = dy > 0 ? fromNode.y + NODE_HEIGHT : fromNode.y;
    } else {
      // Target di samping/diagonal → keluar horizontal (buat trunk line)
      startX = dx > 0 ? fromNode.x + NODE_WIDTH : fromNode.x;
    }
  }

  // Titik masuk (toPort)
  if (toPort === "top") {
    endX = c2x;
    endY = toNode.y;
  } else if (toPort === "bottom") {
    endX = c2x;
    endY = toNode.y + NODE_HEIGHT;
  } else if (toPort === "left") {
    endX = toNode.x;
    endY = c2y;
  } else if (toPort === "right") {
    endX = toNode.x + NODE_WIDTH;
    endY = c2y;
  } else {
    // Auto-pilih port: prefer vertical drop (masuk atas/bawah)
    // Masuk horizontal HANYA jika sumber hampir lurus di samping (baris yang sama)
    if (Math.abs(dy) < 60) {
      // Sumber di baris yang sama → masuk horizontal
      endX = dx > 0 ? toNode.x : toNode.x + NODE_WIDTH;
    } else {
      // Sumber di atas/bawah/diagonal → masuk vertikal (drop down)
      endY = dy > 0 ? toNode.y : toNode.y + NODE_HEIGHT;
    }
  }

  // Kasus garis lurus (titik sejajar)
  if (Math.abs(startX - endX) < 2 || Math.abs(startY - endY) < 2) {
    const d = `M ${startX} ${startY} L ${endX} ${endY}`;
    return { d, midX: (startX + endX) / 2, midY: (startY + endY) / 2, startX, startY, endX, endY };
  }

  // Deteksi arah keluar/masuk berdasarkan posisi port terhadap node
  const exitOnTop = Math.abs(startY - fromNode.y) < 2;
  const exitOnBottom = Math.abs(startY - (fromNode.y + NODE_HEIGHT)) < 2;
  const exitVertical = exitOnTop || exitOnBottom;

  const entryOnTop = Math.abs(endY - toNode.y) < 2;
  const entryOnBottom = Math.abs(endY - (toNode.y + NODE_HEIGHT)) < 2;
  const entryVertical = entryOnTop || entryOnBottom;

  // Bangun waypoints untuk jalur ortogonal
  let waypoints;

  if (exitVertical && entryVertical) {
    // Keduanya vertikal → segmen horizontal di tengah
    let midY = (startY + endY) / 2;
    // Pastikan midY tidak terlalu dekat dengan node
    const minGap = 25;
    if (exitOnBottom) midY = Math.max(midY, startY + minGap);
    if (exitOnTop) midY = Math.min(midY, startY - minGap);
    if (entryOnTop) midY = Math.min(midY, endY - minGap);
    if (entryOnBottom) midY = Math.max(midY, endY + minGap);

    waypoints = [
      { x: startX, y: startY },
      { x: startX, y: midY },
      { x: endX, y: midY },
      { x: endX, y: endY },
    ];
  } else if (!exitVertical && !entryVertical) {
    // Keduanya horizontal → segmen vertikal di tengah
    let midX = (startX + endX) / 2;
    const minGap = 25;
    const exitOnRight = Math.abs(startX - (fromNode.x + NODE_WIDTH)) < 2;
    const exitOnLeft = Math.abs(startX - fromNode.x) < 2;
    const entryOnLeft = Math.abs(endX - toNode.x) < 2;
    const entryOnRight = Math.abs(endX - (toNode.x + NODE_WIDTH)) < 2;

    if (exitOnRight) midX = Math.max(midX, startX + minGap);
    if (exitOnLeft) midX = Math.min(midX, startX - minGap);
    if (entryOnLeft) midX = Math.min(midX, endX - minGap);
    if (entryOnRight) midX = Math.max(midX, endX + minGap);

    waypoints = [
      { x: startX, y: startY },
      { x: midX, y: startY },
      { x: midX, y: endY },
      { x: endX, y: endY },
    ];
  } else if (exitVertical && !entryVertical) {
    // Keluar vertikal, masuk horizontal → bentuk L
    waypoints = [
      { x: startX, y: startY },
      { x: startX, y: endY },
      { x: endX, y: endY },
    ];
  } else {
    // Keluar horizontal, masuk vertikal → bentuk L
    waypoints = [
      { x: startX, y: startY },
      { x: endX, y: startY },
      { x: endX, y: endY },
    ];
  }

  // Bangun SVG path dengan rounded corners di setiap tikungan
  let d = `M ${waypoints[0].x} ${waypoints[0].y}`;

  for (let i = 1; i < waypoints.length; i++) {
    if (i < waypoints.length - 1) {
      // Ini titik tikungan - tambahkan rounded corner
      const prev = waypoints[i - 1];
      const curr = waypoints[i];
      const next = waypoints[i + 1];

      const seg1Len = Math.hypot(curr.x - prev.x, curr.y - prev.y);
      const seg2Len = Math.hypot(next.x - curr.x, next.y - curr.y);
      const r = Math.min(R, seg1Len / 2, seg2Len / 2);

      if (r < 2) {
        // Terlalu kecil untuk rounded corner
        d += ` L ${curr.x} ${curr.y}`;
      } else {
        // Arah masuk ke tikungan
        const inDx = curr.x === prev.x ? 0 : (curr.x > prev.x ? 1 : -1);
        const inDy = curr.y === prev.y ? 0 : (curr.y > prev.y ? 1 : -1);

        // Arah keluar dari tikungan
        const outDx = next.x === curr.x ? 0 : (next.x > curr.x ? 1 : -1);
        const outDy = next.y === curr.y ? 0 : (next.y > curr.y ? 1 : -1);

        // Titik sebelum tikungan (berhenti R piksel sebelum sudut)
        const bx = curr.x - inDx * r;
        const by = curr.y - inDy * r;

        // Titik setelah tikungan (mulai R piksel setelah sudut)
        const ax = curr.x + outDx * r;
        const ay = curr.y + outDy * r;

        d += ` L ${bx} ${by} Q ${curr.x} ${curr.y} ${ax} ${ay}`;
      }
    } else {
      // Titik terakhir
      d += ` L ${waypoints[i].x} ${waypoints[i].y}`;
    }
  }

  // Hitung titik tengah untuk label agar tidak bertumpukan pada trunk line bersama
  let midX, midY;
  if (waypoints.length === 3) {
    // Bentuk L: waypoints = [start, corner, end]
    // Segmen 2 (corner -> end) adalah segmen unik yang menuju langsung ke target node (drop wire)
    const seg2Len = Math.hypot(waypoints[2].x - waypoints[1].x, waypoints[2].y - waypoints[1].y);
    if (seg2Len >= 35) {
      // Pasang label di segmen drop (tepat di atas perangkat tujuan)
      midX = (waypoints[1].x + waypoints[2].x) / 2;
      midY = (waypoints[1].y + waypoints[2].y) / 2;
    } else {
      // Jika segmen drop sangat pendek, gunakan segmen 1
      midX = (waypoints[0].x + waypoints[1].x) / 2;
      midY = (waypoints[0].y + waypoints[1].y) / 2;
    }
  } else if (waypoints.length === 4) {
    // Bentuk Z / Step: waypoints = [start, p1, p2, end]
    const lastSegLen = Math.hypot(waypoints[3].x - waypoints[2].x, waypoints[3].y - waypoints[2].y);
    if (lastSegLen >= 45) {
      midX = (waypoints[2].x + waypoints[3].x) / 2;
      midY = (waypoints[2].y + waypoints[3].y) / 2;
    } else {
      midX = (waypoints[1].x + waypoints[2].x) / 2;
      midY = (waypoints[1].y + waypoints[2].y) / 2;
    }
  } else {
    midX = (startX + endX) / 2;
    midY = (startY + endY) / 2;
  }

  return { d, midX, midY, startX, startY, endX, endY };
}

export default function PathRenderer({
  links = [],
  nodes = [],
  selectedLinkId = null,
  onSelectLink,
  simulationActive = true,
  simulationSpeed = 1,
  showLabels = true,
  onDeleteLink,
}) {
  const nodeMap = useMemo(() => {
    const map = new Map();
    nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [nodes]);

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-10"
      style={{ overflow: "visible" }}
    >
      <defs>
        {/* Neon Glow Filters */}
        <filter id="neon-glow-green" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <filter id="neon-glow-red" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <filter id="neon-glow-blue" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Gradient Jalur Online (Menyala) */}
        <linearGradient id="link-grad-green" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="50%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>

        {/* Gradient Jalur Offline (Mati) */}
        <linearGradient id="link-grad-red" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="50%" stopColor="#dc2626" />
          <stop offset="100%" stopColor="#991b1b" />
        </linearGradient>
      </defs>

      {links.map((link) => {
        const fromNode = nodeMap.get(link.from);
        const toNode = nodeMap.get(link.to);

        if (!fromNode || !toNode) return null;

        const { d, midX, midY } = calculateBezierPath(fromNode, toNode, link.fromPort, link.toPort);
        if (!d) return null;

        const isSelected = selectedLinkId === link.id;
        const isDead =
          fromNode.status === "offline" ||
          toNode.status === "offline";

        const isVPN = link.type === "vpn" || (link.label || "").toLowerCase().includes("vpn") || fromNode.type === "vpn" || toNode.type === "vpn";
        const isEthernet = !isVPN && (!link.type || link.type === "ethernet" || link.type === "copper" || link.type === "cat6" || (link.label || "").toLowerCase().includes("lan") || (link.label || "").toLowerCase().includes("cat"));
        const isFiber = !isVPN && !isEthernet && (link.type === "fiber" || (link.label || "").toLowerCase().includes("fo"));
        const isWireless = !isVPN && !isEthernet && link.type === "wireless";

        // Warna & Style
        const strokeColor = isDead
          ? "#ef4444"
          : isSelected
          ? "#38bdf8"
          : isFiber
          ? "#10b981"
          : isVPN
          ? "#f59e0b"
          : isWireless
          ? "#a855f7"
          : "#0ea5e9"; // Ethernet Cat6 (Biru)

        const glowFilter = isDead
          ? "url(#neon-glow-red)"
          : isSelected
          ? "url(#neon-glow-blue)"
          : isFiber
          ? "url(#neon-glow-green)"
          : "url(#neon-glow-blue)";

        const p1Color = isDead
          ? "#ef4444"
          : isSelected
          ? "#38bdf8"
          : isFiber
          ? "#34d399"
          : isVPN
          ? "#fbbf24"
          : isWireless
          ? "#c084fc"
          : "#38bdf8";

        const p1Filter = isDead
          ? "url(#neon-glow-red)"
          : isSelected
          ? "url(#neon-glow-blue)"
          : isFiber
          ? "url(#neon-glow-green)"
          : "url(#neon-glow-blue)";

        const p2Color = isDead
          ? "#ef4444"
          : isSelected
          ? "#60a5fa"
          : isFiber
          ? "#06b6d4"
          : isVPN
          ? "#f59e0b"
          : isWireless
          ? "#0ea5e9"
          : "#60a5fa";

        const linkBadgeStyle = isDead
          ? "bg-red-950/90 text-red-300 border-red-500/60 shadow-red-950/50"
          : isSelected
          ? "bg-sky-900/90 text-sky-200 border-sky-400 shadow-sky-950/50"
          : isFiber
          ? "bg-slate-900/90 text-emerald-300 border-emerald-500/40 hover:border-emerald-400"
          : isVPN
          ? "bg-slate-900/90 text-amber-300 border-amber-500/40 hover:border-amber-400"
          : isWireless
          ? "bg-slate-900/90 text-cyan-300 border-cyan-500/40 hover:border-cyan-400"
          : "bg-slate-900/90 text-sky-300 border-sky-500/40 hover:border-sky-400";

        const linkDotColor = isDead
          ? "bg-red-500 shadow-[0_0_6px_#ef4444] animate-pulse"
          : isFiber
          ? "bg-emerald-400 shadow-[0_0_6px_#10b981]"
          : isVPN
          ? "bg-amber-400 shadow-[0_0_6px_#f59e0b]"
          : isWireless
          ? "bg-cyan-400 shadow-[0_0_6px_#06b6d4]"
          : "bg-sky-400 shadow-[0_0_6px_#38bdf8]"; // Biru untuk Ethernet LAN!

        // Kecepatan animasi partikel (durasi default 2.2 detik untuk 1x)
        const particleDur = 2.2;

        return (
          <g key={link.id} className="cursor-pointer group">
            {/* Area Hitbox Transparan untuk Klik Mudah */}
            <path
              d={d}
              fill="none"
              stroke="transparent"
              strokeWidth="20"
              className="pointer-events-auto"
              onClick={(e) => {
                e.stopPropagation();
                onSelectLink?.(link);
              }}
            />

            {/* Background Path Outer Glow (Menyala / Mati) */}
            <path
              d={d}
              fill="none"
              stroke={strokeColor}
              strokeWidth={isDead ? 2 : isSelected ? 4 : 3}
              strokeOpacity={isDead ? 0.4 : 0.25}
              filter={glowFilter}
            />

            {/* Main Base Path - Zero Transition Lag for Real-time 60fps Dragging */}
            <path
              d={d}
              fill="none"
              stroke={strokeColor}
              strokeWidth={isSelected ? 3 : isDead ? 2 : 2.5}
              strokeDasharray={isDead ? "6 6" : isWireless ? "4 4" : "none"}
              className={isDead ? "opacity-60" : "opacity-95"}
            />

            {/* Animated Flowing Line (Dash Stroke Effect) */}
            {!isDead && simulationActive && (
              <path
                d={d}
                fill="none"
                stroke="#ffffff"
                strokeWidth={isSelected ? 2.5 : 2}
                strokeDasharray="8 14"
                strokeOpacity={0.85}
                className="pointer-events-none"
                style={{
                  animation: `dashFlow ${particleDur}s linear infinite`,
                }}
              />
            )}

            {/* Animated Travelling Photon Particle 1 */}
            {!isDead && simulationActive && (
              <circle r="4.5" fill={p1Color} filter={p1Filter} className="pointer-events-none">
                <animateMotion path={d} dur={`${particleDur}s`} repeatCount="indefinite" rotate="auto" />
              </circle>
            )}

            {/* Animated Travelling Photon Particle 2 (Offset by 50%) */}
            {!isDead && simulationActive && (
              <circle r="3.5" fill={p2Color} filter={p1Filter} className="pointer-events-none">
                <animateMotion
                  path={d}
                  dur={`${particleDur}s`}
                  begin={`-${particleDur / 2}s`}
                  repeatCount="indefinite"
                  rotate="auto"
                />
              </circle>
            )}

            {/* Red Pulsing Particle jika MATI / OFFLINE */}
            {isDead && simulationActive && (
              <circle r="3" fill="#ef4444" filter="url(#neon-glow-red)" className="pointer-events-none opacity-80">
                <animate
                  attributeName="r"
                  values="2;5;2"
                  dur="1.2s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.4;1;0.4"
                  dur="1.2s"
                  repeatCount="indefinite"
                />
              </circle>
            )}

            {/* Midpoint Info Badge using Pure SVG for 100% flawless export & high-DPI rendering */}
            {showLabels && (() => {
              const labelText = isDead ? "LINK MATI" : link.label || (isEthernet ? "LAN Cat6" : link.type.toUpperCase());
              const badgeWidth = Math.max(74, labelText.length * 6.6 + 26);
              const badgeHeight = 22;
              const bgFill = isDead
                ? "#2a0a0f"
                : isSelected
                ? "#0c2d48"
                : isFiber
                ? "#062820"
                : isVPN
                ? "#261a06"
                : isWireless
                ? "#220c30"
                : "#081d33";
              const strokeColor = isDead
                ? "#ef4444"
                : isSelected
                ? "#38bdf8"
                : isFiber
                ? "#10b981"
                : isVPN
                ? "#f59e0b"
                : isWireless
                ? "#a855f7"
                : "#38bdf8";
              const dotFill = isDead
                ? "#ef4444"
                : isFiber
                ? "#34d399"
                : isVPN
                ? "#fbbf24"
                : isWireless
                ? "#c084fc"
                : "#38bdf8";
              const textFill = isDead
                ? "#fca5a5"
                : isSelected
                ? "#e0f2fe"
                : isFiber
                ? "#6ee7b7"
                : isVPN
                ? "#fde68a"
                : isWireless
                ? "#e9d5ff"
                : "#bae6fd";

              return (
                <g
                  transform={`translate(${midX}, ${midY})`}
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectLink?.(link);
                  }}
                >
                  {/* Pill Background */}
                  <rect
                    x={-badgeWidth / 2}
                    y={-badgeHeight / 2}
                    width={badgeWidth}
                    height={badgeHeight}
                    rx={badgeHeight / 2}
                    fill={bgFill}
                    stroke={strokeColor}
                    strokeWidth={isSelected ? "2" : "1.2"}
                    strokeOpacity="0.9"
                    opacity="0.96"
                  />

                  {/* Status Dot */}
                  <circle
                    cx={-badgeWidth / 2 + 10}
                    cy={0}
                    r={3.2}
                    fill={dotFill}
                  />

                  {/* Badge Label Text */}
                  <text
                    x={-badgeWidth / 2 + 18}
                    y={3.5}
                    fill={textFill}
                    fontSize="9.5"
                    fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                    fontWeight="700"
                    letterSpacing="0.02em"
                    textAnchor="start"
                  >
                    {labelText}
                  </text>
                </g>
              );
            })()}
          </g>
        );
      })}

      {/* Global CSS Animation for Dash Flow */}
      <style>{`
        @keyframes dashFlow {
          from {
            stroke-dashoffset: 44;
          }
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </svg>
  );
}
