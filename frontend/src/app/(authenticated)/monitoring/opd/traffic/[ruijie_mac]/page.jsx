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
  Copy,
  Check,
} from "lucide-react";
import { useAppState } from "@/App";
import { useToast } from "@/hooks/useToast";

// ─── Helpers ────────────────────────────────────────────────────────────────
function formatBytes(bytes) {
  if (!bytes || bytes <= 0 || isNaN(bytes)) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(
    Math.max(0, Math.floor(Math.log(bytes) / Math.log(1024))),
    units.length - 1
  );
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
    H = 210,
    PL = isMobile ? 80 : 76,
    PR = 16,
    PT = 24,
    PB = 36;
  const iW = W - PL - PR;
  const iH = H - PT - PB;

  if (!points || points.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-52 text-slate-500 text-xs font-mono">
        <Activity size={24} className="opacity-30 mb-2" />
        Tidak ada data traffic pada rentang waktu ini
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
      <div className="flex justify-center gap-6 mb-3 text-xs font-semibold text-slate-400">
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
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.01" />
            </linearGradient>
            <linearGradient id="grad-uplink" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
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
                y={l.y + 3.5}
                textAnchor="end"
                fill="#64748b"
                fontFamily="monospace"
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
                  fill="#64748b"
                  fontFamily="monospace"
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
              stroke="#64748b"
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
            className="absolute z-30 bg-slate-950/95 border border-slate-800 rounded-xl p-3 text-[11px] shadow-2xl pointer-events-none text-slate-200 backdrop-blur-md min-w-[140px]"
            style={{
              left: `${mousePos.x + 16}px`,
              top: `${mousePos.y - 48}px`,
              transform: mousePos.x > (mousePos.width || 450) / 2 ? "translateX(-110%)" : "none",
            }}
          >
            <div className="font-bold border-b border-slate-800 pb-1 mb-1.5 text-slate-400 font-mono">
              {activePt.rawTime}
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center gap-3">
                <span className="flex items-center gap-1.5 text-slate-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Uplink
                </span>
                <span className="font-mono font-bold text-emerald-400">
                  {formatBytes(activePt.out)}
                </span>
              </div>
              <div className="flex justify-between items-center gap-3">
                <span className="flex items-center gap-1.5 text-slate-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
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

// ─── Combined Client Chart ──────────────────────────────────────────────────
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
    H = 210,
    PL = isMobile ? 40 : 44,
    PR = 16,
    PT = 24,
    PB = 36;
  const iW = W - PL - PR;
  const iH = H - PT - PB;

  if (!points || points.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-52 text-slate-500 text-xs font-mono">
        <Users size={24} className="opacity-30 mb-2" />
        Tidak ada data klien pada rentang waktu ini
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
      <div className="flex justify-center gap-6 mb-3 text-xs font-semibold text-slate-400">
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
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.25" />
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
                y={l.y + 3.5}
                textAnchor="end"
                fill="#64748b"
                fontFamily="monospace"
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
                  fill="#64748b"
                  fontFamily="monospace"
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
              stroke="#64748b"
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
            className="absolute z-30 bg-slate-950/95 border border-slate-800 rounded-xl p-3 text-[11px] shadow-2xl pointer-events-none text-slate-200 backdrop-blur-md min-w-[140px]"
            style={{
              left: `${mousePos.x + 16}px`,
              top: `${mousePos.y - 48}px`,
              transform: mousePos.x > (mousePos.width || 450) / 2 ? "translateX(-110%)" : "none",
            }}
          >
            <div className="font-bold border-b border-slate-800 pb-1 mb-1.5 text-slate-400 font-mono">
              {formatTimeStr(activePt.rawTime)}
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center gap-3">
                <span className="flex items-center gap-1.5 text-slate-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  Klien Aktif
                </span>
                <span className="font-mono font-bold text-purple-400">
                  {activePt.activeTotal}
                </span>
              </div>
              <div className="flex justify-between items-center gap-3">
                <span className="flex items-center gap-1.5 text-slate-400 font-medium">
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

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function TrafficDetailPage() {
  const params = useParams();
  const pathname = usePathname();
  const mac = decodeURIComponent(params.ruijie_mac || "");

  const { lastSyncTime } = useAppState();
  const { showToast, ToastComponent } = useToast();
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
  const [copiedMac, setCopiedMac] = useState(false);

  useEffect(() => {
    if (!mac) return;
    setDeviceLoading(true);
    axios
      .get(`/api/sites/${encodeURIComponent(mac)}`)
      .then((res) => setDeviceInfo(res.data))
      .catch(() =>
        setDeviceInfo({
          ruijie_mac: mac,
          connection_type: "PPPOE",
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
        type: deviceInfo?.connection_type || "PPPOE",
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

  const handleCopyMac = () => {
    if (!mac) return;
    navigator.clipboard.writeText(mac);
    setCopiedMac(true);
    showToast("MAC Address disalin ke clipboard", "success");
    setTimeout(() => setCopiedMac(false), 2000);
  };

  return (
    <div className="flex-1 w-full min-w-0 flex flex-col gap-3.5 pb-6 relative">
      {ToastComponent}

      {/* 1. TOP HEADER & BREADCRUMB */}
      <div className="flex flex-col gap-3 bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-4.5 shadow-sm">
        {/* Breadcrumb Nav */}
        <div className="flex items-center gap-2 text-xs">
          <Link
            href={backHref}
            className="cursor-pointer flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition font-medium"
          >
            <ArrowLeft size={13} />
            {isOPD ? "Monitoring OPD" : "Monitoring Desa"}
          </Link>
          <span className="text-slate-600">/</span>
          <span className="flex items-center gap-1.5 text-blue-400 font-semibold">
            <BarChart2 size={13} /> Detail Traffic Per Site
          </span>
        </div>

        {/* Title & Controls Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1 border-t border-slate-800/80">
          {/* Site Identity */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
              <Activity size={20} className={loading ? "animate-pulse" : ""} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-bold text-slate-100 truncate font-mono">
                  {deviceLoading ? (
                    <span className="inline-block w-44 h-6 bg-slate-800 animate-pulse rounded" />
                  ) : (
                    deviceInfo?.prefix || mac
                  )}
                </h1>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded whitespace-nowrap ${isOPD ? "tag-opd" : "tag-desa"}`}>
                  {isOPD ? "OPD · PPPoE" : "Desa · L2TP"}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <button
                  onClick={handleCopyMac}
                  className="cursor-pointer inline-flex items-center gap-1.5 text-[11px] font-mono text-slate-400 bg-slate-950 border border-slate-800 hover:border-slate-700 px-2 py-0.5 rounded-md transition"
                  title="Klik untuk salin MAC"
                >
                  <span>MAC: {mac}</span>
                  {copiedMac ? (
                    <Check size={11} className="text-emerald-400" />
                  ) : (
                    <Copy size={11} className="text-slate-500" />
                  )}
                </button>
                {lastFetch && (
                  <span className="text-[10px] text-slate-500 font-mono">
                    Update: {lastFetch}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Controls: Range selector & Refresh button */}
          <div className="flex items-center gap-2 flex-wrap self-start lg:self-auto">
            {/* Range dropdown */}
            <div className="relative flex items-center">
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
                className="cursor-pointer bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-8 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono min-w-[120px]"
              >
                <option value="today">24 Jam</option>
                <option value="7days">7 Hari</option>
                <option value="30days">30 Hari</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            {/* Custom Range Picker */}
            {range === "custom" && (
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-lg text-xs font-mono">
                <input
                  type="date"
                  value={startDate}
                  max={endDate || new Date().toISOString().split("T")[0]}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStartDate(val);
                    if (endDate && val > endDate) setEndDate(val);
                  }}
                  className="bg-transparent text-slate-200 text-xs outline-none cursor-pointer w-24"
                />
                <span className="text-slate-600">-</span>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  max={new Date().toISOString().split("T")[0]}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEndDate(val);
                    if (startDate && val < startDate) setStartDate(val);
                  }}
                  className="bg-transparent text-slate-200 text-xs outline-none cursor-pointer w-24"
                />
              </div>
            )}

            {/* Refresh Button */}
            <button
              onClick={fetchTraffic}
              disabled={loading}
              className="cursor-pointer flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition shadow-sm bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 whitespace-nowrap"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex flex-col items-center justify-center gap-3 p-8 text-center bg-slate-900 border border-rose-500/20 rounded-xl shadow-sm">
          <AlertTriangle size={28} className="text-rose-400" />
          <p className="text-xs text-rose-400 font-mono max-w-md">{error}</p>
          <button
            onClick={fetchTraffic}
            className="cursor-pointer mt-1 px-4 py-1.5 bg-slate-950 border border-slate-800 text-slate-300 text-xs font-semibold rounded-lg hover:border-slate-700 transition"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !trafficData && !error && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-24 bg-slate-900 border border-slate-800 rounded-xl animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Data Section */}
      {trafficData && !error && (
        <>
          {/* 2. 4 STAT CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 flex-shrink-0">
            {/* Total Traffic */}
            <div className="p-3 sm:p-3.5 bg-slate-900 border border-slate-800 rounded-xl shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  Total Traffic
                </p>
                <p className="text-xl font-bold font-mono text-slate-100 mt-0.5">
                  {formatBytes(totalTraffic)}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                  Volume kumulatif
                </p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                <Activity size={15} />
              </div>
            </div>

            {/* Downlink (In) */}
            <div className="p-3 sm:p-3.5 bg-slate-900 border border-slate-800 rounded-xl shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider font-mono flex items-center gap-1">
                  <span>Downlink (In)</span>
                </p>
                <p className="text-xl font-bold font-mono text-blue-400 mt-0.5">
                  {formatBytes(totalIn)}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                  Trafik masuk / download
                </p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                <ArrowDown size={15} />
              </div>
            </div>

            {/* Uplink (Out) */}
            <div className="p-3 sm:p-3.5 bg-slate-900 border border-slate-800 rounded-xl shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider font-mono flex items-center gap-1">
                  <span>Uplink (Out)</span>
                </p>
                <p className="text-xl font-bold font-mono text-emerald-400 mt-0.5">
                  {formatBytes(totalOut)}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                  Trafik keluar / upload
                </p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <ArrowUp size={15} />
              </div>
            </div>

            {/* Client Aktif */}
            <div className="p-3 sm:p-3.5 bg-slate-900 border border-slate-800 rounded-xl shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider font-mono">
                  Client Aktif
                </p>
                <p className="text-xl font-bold font-mono text-purple-400 mt-0.5">
                  {trafficData.clients ?? trafficData.userTrandClients ?? 0}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                  Peak: {trafficData.userTrandTotal24h ?? "-"} Klien
                </p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                <Wifi size={15} />
              </div>
            </div>
          </div>

          {/* 3. TABS SELECTOR */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 w-fit">
            {[
              { key: "traffic", label: "Trend Traffic", icon: TrendingUp },
              { key: "clients", label: "Trend Klien", icon: Users },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                  tab === t.key
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <t.icon size={13} />
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          {/* 4. CHART CARD CONTAINER */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm">
            {tab === "traffic" && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                    <h2 className="text-xs sm:text-sm font-semibold text-slate-200 font-mono">
                      Wi-Fi Traffic Summary {groupDisplayName}
                    </h2>
                  </div>
                </div>
                <CombinedTrafficChart
                  points={trafficData.trendPoints || []}
                  isDaily={isDaily}
                />
              </div>
            )}

            {tab === "clients" && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                    <h2 className="text-xs sm:text-sm font-semibold text-slate-200 font-mono">
                      Wi-Fi Client Summary {groupDisplayName}
                    </h2>
                  </div>
                </div>
                <CombinedClientChart
                  points={trafficData.userTrandPoints || []}
                  isDaily={isDaily}
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
