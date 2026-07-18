"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import axios from "axios";
import {
  ArrowLeft,
  RefreshCw,
  Activity,
  ArrowUp,
  ArrowDown,
  Wifi,
  TrendingUp,
  Users,
  AlertTriangle,
  Calendar,
  BarChart2,
} from "lucide-react";
import { useAppState } from "@/App";

// ─── Helpers ────────────────────────────────────────────────────────────────
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

function shortTime(timeStr) {
  if (!timeStr) return "";
  const parts = timeStr.split(" ");
  return parts[1] ? parts[1].slice(0, 5) : timeStr;
}

function shortDate(timeStr) {
  if (!timeStr) return "";
  if (/^\d{8}$/.test(timeStr)) {
    return `${timeStr.slice(0, 4)}-${timeStr.slice(4, 6)}-${timeStr.slice(6, 8)}`;
  }
  const parts = timeStr.split(" ");
  if (!parts[0]) return timeStr;
  const dp = parts[0].split("-");
  return dp.length >= 3 ? `${dp[1]}/${dp[2]}` : parts[0];
}

function formatTimeStr(timeStr) {
  if (!timeStr) return "";
  if (/^\d{8}$/.test(timeStr)) {
    return `${timeStr.slice(0, 4)}-${timeStr.slice(4, 6)}-${timeStr.slice(6, 8)}`;
  }
  return timeStr;
}

// ─── SVG Line Chart ─────────────────────────────────────────────────────────
function LineChart({
  points,
  valueKey,
  color = "#3b82f6",
  formatFn = (v) => v,
  isDaily = false,
}) {
  if (!points || points.length === 0) {
    return (
      <div className="flex items-center justify-center h-36 text-slate-500 text-xs">
        Tidak ada data
      </div>
    );
  }

  const W = 900,
    H = 160,
    PL = 56,
    PR = 16,
    PT = 20,
    PB = 32;
  const iW = W - PL - PR;
  const iH = H - PT - PB;
  const values = points.map((p) => p[valueKey] || 0);
  const maxV = Math.max(...values, 1);
  const step = points.length > 1 ? points.length - 1 : 1;

  const pts = points.map((p, i) => ({
    x: PL + (i / step) * iW,
    y: PT + iH - ((p[valueKey] || 0) / maxV) * iH,
    time: isDaily ? shortDate(p.time) : shortTime(p.time),
    val: p[valueKey] || 0,
  }));

  const linePath = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const areaPath =
    linePath +
    ` L${pts[pts.length - 1].x.toFixed(1)},${PT + iH} L${PL},${PT + iH} Z`;
  const yLines = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    val: maxV * f,
    y: PT + iH - f * iH,
  }));
  const labelEvery = Math.max(1, Math.ceil(pts.length / 10));

  return (
    <div className="w-full overflow-x-hidden">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient
            id={`g${color.replace("#", "")}`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {yLines.map((l, i) => (
          <g key={i}>
            <line
              x1={PL}
              y1={l.y}
              x2={W - PR}
              y2={l.y}
              stroke="#1e293b"
              strokeWidth="1"
            />
            <text
              x={PL - 6}
              y={l.y + 3}
              textAnchor="end"
              fill="#475569"
              fontSize="11"
            >
              {formatFn(l.val)}
            </text>
          </g>
        ))}
        {pts.length > 1 && (
          <path d={areaPath} fill={`url(#g${color.replace("#", "")})`} />
        )}
        {pts.length > 1 && (
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {pts.map((p, i) => (
          <g key={i}>
            <title>{`${p.time}: ${formatFn(p.val)}`}</title>
            <circle
              cx={p.x}
              cy={p.y}
              r="3"
              fill="#0f172a"
              stroke={color}
              strokeWidth="2"
            />
            {i % labelEvery === 0 && (
              <text
                x={p.x}
                y={PT + iH + 16}
                textAnchor="middle"
                fill="#475569"
                fontSize="10"
              >
                {p.time}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

// ─── Combined Traffic Chart (Ruijie Style) ──────────────────────────────────
function CombinedTrafficChart({ points, isDaily = false }) {
  const [hoverIndex, setHoverIndex] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const W = isMobile ? 500 : 900,
    H = 200,
    PL = isMobile ? 90 : 85,
    PR = 16,
    PT = 24,
    PB = 36;
  const iW = W - PL - PR;
  const iH = H - PT - PB;

  if (!points || points.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500 text-xs">
        Tidak ada data
      </div>
    );
  }

  const inValues = points.map((p) => p.in || 0);
  const outValues = points.map((p) => p.out || 0);
  const maxV = Math.max(...inValues, ...outValues, 1);
  const step = points.length > 1 ? points.length - 1 : 1;

  const pts = points.map((p, i) => {
    const x = PL + (i / step) * iW;
    const yIn = PT + iH - ((p.in || 0) / maxV) * iH;
    const yOut = PT + iH - ((p.out || 0) / maxV) * iH;
    const time = isDaily ? shortDate(p.time) : shortTime(p.time);
    return {
      x,
      yIn,
      yOut,
      time,
      rawTime: formatTimeStr(p.time),
      in: p.in || 0,
      out: p.out || 0,
    };
  });

  const inLinePath = pts
    .map(
      (p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.yIn.toFixed(1)}`,
    )
    .join(" ");
  const inAreaPath =
    inLinePath +
    ` L${pts[pts.length - 1].x.toFixed(1)},${PT + iH} L${PL},${PT + iH} Z`;

  const outLinePath = pts
    .map(
      (p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.yOut.toFixed(1)}`,
    )
    .join(" ");
  const outAreaPath =
    outLinePath +
    ` L${pts[pts.length - 1].x.toFixed(1)},${PT + iH} L${PL},${PT + iH} Z`;

  const yLines = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    val: maxV * f,
    y: PT + iH - f * iH,
  }));
  const labelEvery = Math.max(1, Math.ceil(pts.length / (isMobile ? 5 : 10)));

  const handleMouseMove = (e) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const svgX = (clientX / rect.width) * W;
    let minDiff = Infinity;
    let nearestIdx = 0;
    pts.forEach((p, idx) => {
      const diff = Math.abs(p.x - svgX);
      if (diff < minDiff) {
        minDiff = diff;
        nearestIdx = idx;
      }
    });

    setHoverIndex(nearestIdx);
    setMousePos({ x: clientX, y: clientY, width: rect.width });
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  const activePt = hoverIndex !== null ? pts[hoverIndex] : null;

  return (
    <div className="relative w-full">
      {/* Legend */}
      <div className="flex justify-center gap-6 mb-4 text-xs font-semibold text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-500 border border-emerald-400/40" />
          <span>Uplink (Out)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-blue-500 border border-blue-400/40" />
          <span>Downlink (In)</span>
        </div>
      </div>

      {/* SVG chart container */}
      <div className="relative overflow-visible">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto cursor-crosshair select-none"
          preserveAspectRatio="xMidYMid meet"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            <linearGradient id="grad-downlink" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.01" />
            </linearGradient>
            <linearGradient id="grad-uplink" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {yLines.map((l, i) => (
            <g key={i}>
              <line
                x1={PL}
                y1={l.y}
                x2={W - PR}
                y2={l.y}
                stroke="#1e293b"
                strokeWidth="1"
              />
              <text
                x={PL - 8}
                y={l.y + 3}
                textAnchor="end"
                fill="#64748b"
                fontSize={isMobile ? "13" : "11"}
              >
                {formatBytes(l.val)}
              </text>
            </g>
          ))}

          {/* Fills */}
          {pts.length > 1 && (
            <>
              <path d={inAreaPath} fill="url(#grad-downlink)" />
              <path d={outAreaPath} fill="url(#grad-uplink)" />
            </>
          )}

          {/* Lines */}
          {pts.length > 1 && (
            <>
              <path
                d={inLinePath}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={outLinePath}
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}

          {/* X axis labels */}
          {pts.map((p, i) => (
            <g key={i}>
              {i % labelEvery === 0 && (
                <text
                  x={p.x}
                  y={PT + iH + 18}
                  textAnchor="middle"
                  fill="#475569"
                  fontSize={isMobile ? "12" : "10"}
                >
                  {p.time}
                </text>
              )}
            </g>
          ))}

          {/* Hover indicator vertical line */}
          {activePt && (
            <line
              x1={activePt.x}
              y1={PT}
              x2={activePt.x}
              y2={PT + iH}
              stroke="#475569"
              strokeWidth="1.5"
              strokeDasharray="4,4"
              pointerEvents="none"
            />
          )}

          {/* Hover points */}
          {activePt && (
            <>
              <circle
                cx={activePt.x}
                cy={activePt.yIn}
                r="4.5"
                fill="#3b82f6"
                stroke="#0f172a"
                strokeWidth="2"
                pointerEvents="none"
              />
              <circle
                cx={activePt.x}
                cy={activePt.yOut}
                r="4.5"
                fill="#10b981"
                stroke="#0f172a"
                strokeWidth="2"
                pointerEvents="none"
              />
            </>
          )}
        </svg>

        {/* Floating Tooltip Box */}
        {activePt && (
          <div
            className="absolute z-30 bg-slate-950/95 border border-slate-700 rounded-lg p-3 text-[11px] shadow-2xl pointer-events-none text-slate-200"
            style={{
              left: `${mousePos.x + 16}px`,
              top: `${mousePos.y - 48}px`,
              transform: mousePos.x > (mousePos.width || 450) / 2 ? "translateX(-110%)" : "none",
            }}
          >
            <div className="font-bold border-b border-slate-800 pb-1 mb-1.5 text-slate-400">
              {activePt.rawTime}
            </div>
            <div className="flex flex-col gap-1 min-w-[120px]">
              <div className="flex justify-between items-center gap-3">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Uplink
                </span>
                <span className="font-mono font-bold text-emerald-400">
                  {formatBytes(activePt.out)}
                </span>
              </div>
              <div className="flex justify-between items-center gap-3">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Downlink
                </span>
                <span className="font-mono font-bold text-blue-400">
                  {formatBytes(activePt.in)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CombinedClientChart({ points, isDaily = false }) {
  const [hoverIndex, setHoverIndex] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const W = isMobile ? 500 : 900,
    H = 200,
    PL = isMobile ? 36 : 44,
    PR = 16,
    PT = 24,
    PB = 36;
  const iW = W - PL - PR;
  const iH = H - PT - PB;

  if (!points || points.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500 text-xs">
        Tidak ada data
      </div>
    );
  }

  const activeValues = points.map((p) => p.activeTotal || 0);
  const totalValues = points.map((p) => p.total || 0);
  const maxV = Math.max(...activeValues, ...totalValues, 1);
  const step = points.length > 1 ? points.length - 1 : 1;

  const pts = points.map((p, i) => {
    const x = PL + (i / step) * iW;
    const yActive = PT + iH - ((p.activeTotal || 0) / maxV) * iH;
    const yTotal = PT + iH - ((p.total || 0) / maxV) * iH;
    const time = isDaily ? shortDate(p.time) : shortTime(p.time);
    return {
      x,
      yActive,
      yTotal,
      time,
      rawTime: p.time,
      activeTotal: p.activeTotal || 0,
      total: p.total || 0,
    };
  });

  const activeLinePath = pts
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.yActive.toFixed(1)}`,
    )
    .join(" ");
  const activeAreaPath =
    activeLinePath +
    ` L${pts[pts.length - 1].x.toFixed(1)},${PT + iH} L${PL},${PT + iH} Z`;

  const totalLinePath = pts
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.yTotal.toFixed(1)}`,
    )
    .join(" ");

  const yLines = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    val: maxV * f,
    y: PT + iH - f * iH,
  }));
  const labelEvery = Math.max(1, Math.ceil(pts.length / (isMobile ? 5 : 10)));

  const handleMouseMove = (e) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const svgX = (clientX / rect.width) * W;
    let minDiff = Infinity;
    let nearestIdx = 0;
    pts.forEach((p, idx) => {
      const diff = Math.abs(p.x - svgX);
      if (diff < minDiff) {
        minDiff = diff;
        nearestIdx = idx;
      }
    });

    setHoverIndex(nearestIdx);
    setMousePos({ x: clientX, y: clientY, width: rect.width });
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  const activePt = hoverIndex !== null ? pts[hoverIndex] : null;

  return (
    <div className="relative w-full">
      {/* Legend */}
      <div className="flex justify-center gap-6 mb-4 text-xs font-semibold text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded bg-purple-500/20 border border-purple-500" />
          <span>Klien Aktif</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-0.5 border-t border-dashed border-slate-400" />
          <span>Total Terdeteksi</span>
        </div>
      </div>

      <div className="relative overflow-visible">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto cursor-crosshair select-none"
          preserveAspectRatio="xMidYMid meet"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            <linearGradient id="grad-active" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {yLines.map((l, i) => (
            <g key={i}>
              <line
                x1={PL}
                y1={l.y}
                x2={W - PR}
                y2={l.y}
                stroke="#1e293b"
                strokeWidth="1"
              />
              <text
                x={PL - 8}
                y={l.y + 3}
                textAnchor="end"
                fill="#64748b"
                fontSize={isMobile ? "13" : "11"}
              >
                {Math.round(l.val)}
              </text>
            </g>
          ))}

          {/* Fills */}
          {pts.length > 1 && (
            <path d={activeAreaPath} fill="url(#grad-active)" />
          )}

          {/* Lines */}
          {pts.length > 1 && (
            <>
              {/* Total Terdeteksi line (dashed) */}
              <path
                d={totalLinePath}
                fill="none"
                stroke="#64748b"
                strokeWidth="1.5"
                strokeDasharray="4,4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Klien Aktif line (solid) */}
              <path
                d={activeLinePath}
                fill="none"
                stroke="#a855f7"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}

          {/* X axis labels */}
          {pts.map((p, i) => (
            <g key={i}>
              {i % labelEvery === 0 && (
                <text
                  x={p.x}
                  y={PT + iH + 18}
                  textAnchor="middle"
                  fill="#475569"
                  fontSize={isMobile ? "12" : "10"}
                >
                  {p.time}
                </text>
              )}
            </g>
          ))}

          {/* Hover indicator line */}
          {activePt && (
            <line
              x1={activePt.x}
              y1={PT}
              x2={activePt.x}
              y2={PT + iH}
              stroke="#475569"
              strokeWidth="1.5"
              strokeDasharray="4,4"
              pointerEvents="none"
            />
          )}

          {/* Hover points */}
          {activePt && (
            <>
              <circle
                cx={activePt.x}
                cy={activePt.yActive}
                r="4.5"
                fill="#a855f7"
                stroke="#0f172a"
                strokeWidth="2"
                pointerEvents="none"
              />
              <circle
                cx={activePt.x}
                cy={activePt.yTotal}
                r="4"
                fill="#64748b"
                stroke="#0f172a"
                strokeWidth="1.5"
                pointerEvents="none"
              />
            </>
          )}
        </svg>

        {/* Floating Tooltip Box */}
        {activePt && (
          <div
            className="absolute z-30 bg-slate-950/95 border border-slate-700 rounded-lg p-3 text-[11px] shadow-2xl pointer-events-none text-slate-200"
            style={{
              left: `${mousePos.x + 16}px`,
              top: `${mousePos.y - 48}px`,
              transform: mousePos.x > (mousePos.width || 450) / 2 ? "translateX(-110%)" : "none",
            }}
          >
            <div className="font-bold border-b border-slate-800 pb-1 mb-1.5 text-slate-400">
              {formatTimeStr(activePt.rawTime)}
            </div>
            <div className="flex flex-col gap-1 min-w-[120px]">
              <div className="flex justify-between items-center gap-3">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                  Klien Aktif
                </span>
                <span className="font-mono font-bold text-purple-400">
                  {activePt.activeTotal}
                </span>
              </div>
              <div className="flex justify-between items-center gap-3">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <span className="w-2.5 h-0.5 border-t border-dashed border-slate-400" />
                  Total Terdeteksi
                </span>
                <span className="font-mono font-bold text-slate-400">
                  {activePt.total}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Range Config ─────────────────────────────────────────────────────────
const RANGES = [
  { key: "today", label: "24 Jam" },
  { key: "7days", label: "7 Hari" },
  { key: "30days", label: "30 Hari" },
];

// ─── Page ─────────────────────────────────────────────────────────────────
export default function TrafficDetailPage() {
  const params = useParams();
  const pathname = usePathname();
  const mac = decodeURIComponent(params.ruijie_mac || "");

  const { lastSyncTime } = useAppState();
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [range, setRange] = useState("today");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );
  const [tab, setTab] = useState("traffic");
  const [trafficData, setTrafficData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deviceLoading, setDeviceLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);

  useEffect(() => {
    if (!mac) return;
    setDeviceLoading(true);
    axios
      .get(`/api/sites/${encodeURIComponent(mac)}`)
      .then((res) => setDeviceInfo(res.data))
      .catch(() =>
        setDeviceInfo({
          ruijie_mac: mac,
          connection_type: "L2TP",
          prefix: mac,
        }),
      )
      .finally(() => setDeviceLoading(false));
  }, [mac]);

  const fetchTraffic = useCallback(async () => {
    if (!mac) return;
    setLoading(true);
    setError(null);
    try {
      const payload = {
        type: deviceInfo?.connection_type || "L2TP",
        rangeType: range,
        groupId: deviceInfo?.group_id || undefined,
        deviceSn: deviceInfo?.device_sn || undefined,
      };
      if (range === "custom") {
        payload.startDate = startDate.replace(/-/g, "");
        payload.endDate = endDate.replace(/-/g, "");
      }
      const res = await axios.post("/api/traffic/site", payload);
      setTrafficData(res.data?.sitesTraffic?.[0] || null);
      setLastFetch(new Date().toLocaleTimeString("id-ID"));
    } catch (e) {
      setError(
        e.response?.data?.error || e.message || "Gagal memuat data traffic",
      );
    } finally {
      setLoading(false);
    }
  }, [mac, deviceInfo, range, startDate, endDate]);

  // Fetch on mount or when lastSyncTime changes from auto-sync
  useEffect(() => {
    if (!deviceLoading) fetchTraffic();
  }, [fetchTraffic, deviceLoading, lastSyncTime]);

  const isOPD = pathname.includes("/monitoring/opd");
  const backHref = isOPD ? "/monitoring/opd" : "/monitoring/desa";
  const isDaily = range === "7days" || range === "30days";

  const trendPoints = trafficData?.trendPoints || [];
  const sumIn = trendPoints.reduce((sum, p) => sum + (p.in || 0), 0);
  const sumOut = trendPoints.reduce((sum, p) => sum + (p.out || 0), 0);

  const totalIn = sumIn > 0 ? sumIn : (trafficData?.inTrafficBytes || 0);
  const totalOut = sumOut > 0 ? sumOut : (trafficData?.outTrafficBytes || 0);
  const totalTraffic = totalIn + totalOut;

  const groupDisplayName = deviceInfo?.group_name || trafficData?.siteName?.split(" - ")[0] || "";

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden flex flex-col gap-6 p-1 pb-10">
      <style>{`
        .custom-date-picker::-webkit-calendar-picker-indicator {
          filter: invert(0.85);
          cursor: pointer;
          transform: scale(1.2);
          padding: 1px;
        }
      `}</style>
      {/* Header */}
      <div className="flex flex-col gap-4 bg-slate-800/40 p-5 border border-slate-800/80 rounded-2xl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Link
            href={backHref}
            className="cursor-pointer flex items-center gap-1 hover:text-slate-300 transition"
          >
            <ArrowLeft size={13} />
            {isOPD ? "Monitoring OPD" : "Monitoring Desa"}
          </Link>
          <span>/</span>
          <span className="flex items-center gap-1 text-slate-400">
            <BarChart2 size={12} /> Detail Traffic
          </span>
        </div>

        {/* Title row */}
        <div className="flex flex-col md:flex-row md:items-center md:flex-wrap gap-4 justify-between">
          <div className="flex flex-col gap-1.5 flex-shrink-0">
            <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
              <Activity className="text-blue-500 flex-shrink-0" size={22} />
              {deviceLoading ? (
                <span className="inline-block w-48 h-5 bg-slate-800 animate-pulse rounded" />
              ) : (
                deviceInfo?.prefix || mac
              )}
            </h1>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-slate-400 font-mono rounded-full border border-slate-700 px-2 py-0.5 bg-slate-800/30 whitespace-nowrap">
                {mac}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${
                  isOPD
                    ? "bg-purple-500/10 border-purple-500/20 text-purple-400"
                    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                }`}
              >
                {isOPD ? "OPD · PPPoE" : "Desa · L2TP"}
              </span>
            </div>
          </div>

          {/* Controls */}
          <div className="md:ml-auto flex items-center gap-2 flex-wrap">
            {/* Range selector */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg">
                <Calendar size={13} className="text-slate-400" />
                <select
                  value={range}
                  onChange={(e) => {
                    const val = e.target.value;
                    setRange(val);
                    const today = new Date();
                    if (val === "today") {
                      const start = new Date();
                      start.setDate(today.getDate() - 1);
                      setStartDate(start.toISOString().split("T")[0]);
                      setEndDate(today.toISOString().split("T")[0]);
                    } else if (val === "7days") {
                      const start = new Date();
                      start.setDate(today.getDate() - 7);
                      setStartDate(start.toISOString().split("T")[0]);
                      setEndDate(today.toISOString().split("T")[0]);
                    } else if (val === "30days") {
                      const start = new Date();
                      start.setDate(today.getDate() - 30);
                      setStartDate(start.toISOString().split("T")[0]);
                      setEndDate(today.toISOString().split("T")[0]);
                    }
                  }}
                  className="bg-transparent text-slate-200 text-xs outline-none cursor-pointer font-semibold ml-1.5"
                >
                  <option value="today" className="bg-slate-800 text-slate-200">24 Jam</option>
                  <option value="7days" className="bg-slate-800 text-slate-200">7 Hari</option>
                  <option value="30days" className="bg-slate-800 text-slate-200">30 Hari</option>
                  <option value="custom" className="bg-slate-800 text-slate-200">Custom</option>
                </select>
              </div>

              {range === "custom" && (
                <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-xs">
                  <input
                    type="date"
                    value={startDate}
                    max={endDate || new Date().toISOString().split("T")[0]}
                    onChange={(e) => {
                      const val = e.target.value;
                      setStartDate(val);
                      if (endDate && val > endDate) {
                        setEndDate(val);
                      }
                    }}
                    className="bg-transparent text-slate-200 text-xs outline-none cursor-pointer custom-date-picker w-24"
                  />
                  <span className="text-slate-500">-</span>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate}
                    max={new Date().toISOString().split("T")[0]}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEndDate(val);
                      if (startDate && val < startDate) {
                        setStartDate(val);
                      }
                    }}
                    className="bg-transparent text-slate-200 text-xs outline-none cursor-pointer custom-date-picker w-24"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex flex-col items-center gap-3 py-14 text-center bg-slate-800/40 border border-red-500/20 rounded-2xl">
          <AlertTriangle size={32} className="text-red-400" />
          <p className="text-sm text-red-400 max-w-md">{error}</p>
          <button
            onClick={fetchTraffic}
            className="cursor-pointer mt-1 px-4 py-2 bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg hover:bg-slate-700 transition"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !trafficData && !error && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-24 bg-slate-800/40 border border-slate-800/80 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Data */}
      {trafficData && !error && (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
                {
                  label: "Total Traffic",
                  value: formatBytes(totalTraffic),
                  icon: Activity,
                  color: "text-slate-100",
                  iconColor: "text-blue-400",
                  bg: "bg-blue-500/10",
                },
                {
                  label: "Downlink (In)",
                  value: formatBytes(totalIn),
                  icon: ArrowDown,
                  color: "text-blue-400",
                  iconColor: "text-blue-400",
                  bg: "bg-blue-500/10",
                },
                {
                  label: "Uplink (Out)",
                  value: formatBytes(totalOut),
                  icon: ArrowUp,
                  color: "text-emerald-400",
                  iconColor: "text-emerald-400",
                  bg: "bg-emerald-500/10",
                },
                {
                  label: "Client Aktif",
                  value: trafficData.clients ?? trafficData.userTrandClients ?? 0,
                  sub: `(Peak: ${trafficData.userTrandTotal24h ?? "-"} Klien)`,
                  icon: Wifi,
                  color: "text-purple-400",
                  iconColor: "text-purple-400",
                  bg: "bg-purple-500/10",
                },
              ].map((card, i) => (
              <div
                key={i}
                className="bg-slate-800/40 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-700 transition group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">
                    {card.label}
                  </span>
                  <div
                    className={`p-2 ${card.bg} ${card.iconColor} rounded-lg group-hover:scale-105 transition`}
                  >
                    <card.icon size={16} />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-xl font-bold ${card.color}`}>
                      {card.value}
                    </span>
                    {card.label === "Client Aktif" && card.sub && (
                      <span className="text-xs text-slate-400 font-semibold">
                        {card.sub}
                      </span>
                    )}
                  </div>
                  {card.label !== "Client Aktif" && card.sub && (
                    <div className="text-[10px] text-slate-500 mt-1">
                      {card.sub}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Tab Bar */}
          <div className="flex gap-1 border-b border-slate-800">
            {[
              { key: "traffic", label: "Trend Traffic", icon: TrendingUp },
              { key: "clients", label: "Trend Klien", icon: Users },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`cursor-pointer flex items-center gap-2 pb-3 px-4 text-xs font-semibold border-b-2 transition ${
                  tab === t.key
                    ? t.key === "traffic"
                      ? "border-blue-500 text-blue-400"
                      : "border-purple-500 text-purple-400"
                    : "border-transparent text-slate-500 hover:text-slate-300"
                }`}
              >
                <t.icon size={13} /> {t.label}
              </button>
            ))}
          </div>

          {/* Traffic Tab */}
          {tab === "traffic" && (
            <div className="flex flex-col gap-4">
              <div className="bg-slate-800/40 border border-slate-800/80 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <Activity
                      size={15}
                      className="text-blue-500 animate-pulse"
                    />
                    Wi-Fi Traffic Summary {groupDisplayName}
                  </h2>
                </div>
                <CombinedTrafficChart
                  points={trafficData.trendPoints || []}
                  isDaily={isDaily}
                />
              </div>
            </div>
          )}

          {/* Clients Tab */}
          {tab === "clients" && (
            <div className="flex flex-col gap-4">
              <div className="bg-slate-800/40 border border-slate-800/80 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Wifi size={14} className="text-purple-400" />
                  <h2 className="text-sm font-semibold text-slate-200">
                    Wi-Fi Client Summary {groupDisplayName}
                  </h2>
                </div>
                <CombinedClientChart
                  points={trafficData.userTrandPoints || []}
                  isDaily={isDaily}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
