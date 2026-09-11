"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import axios from "axios";
import {
  Activity,
  RefreshCw,
  Search,
  Users,
  BarChart2,
  TrendingUp,
  X,
  Clock,
  Wifi,
  WifiOff,
  Check,
  Calendar,
  ChevronDown,
  AlertTriangle,
  Download,
  FileSpreadsheet,
} from "lucide-react";
import { useToast } from "@/hooks/useToast";
import { getStoredUser } from "@/lib/roles";

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

function formatIndoDate(dateStr) {
  if (!dateStr) return "-";
  let y, m, d;
  if (/^\d{8}$/.test(dateStr)) {
    y = parseInt(dateStr.slice(0, 4));
    m = parseInt(dateStr.slice(4, 6)) - 1;
    d = parseInt(dateStr.slice(6, 8));
  } else if (typeof dateStr === "string" && dateStr.includes("-")) {
    const parts = dateStr.split(" ")[0].split("-");
    y = parseInt(parts[0]);
    m = parseInt(parts[1]) - 1;
    d = parseInt(parts[2]);
  } else {
    const dt = new Date(dateStr);
    if (isNaN(dt.getTime())) return String(dateStr);
    y = dt.getFullYear();
    m = dt.getMonth();
    d = dt.getDate();
  }
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  return `${d} ${months[m] || ""} ${y}`;
}

function formatIndoDateTime(dt = new Date()) {
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  const dayName = days[dt.getDay()];
  const d = dt.getDate();
  const m = months[dt.getMonth()];
  const y = dt.getFullYear();
  const hh = String(dt.getHours()).padStart(2, "0");
  const mm = String(dt.getMinutes()).padStart(2, "0");
  const ss = String(dt.getSeconds()).padStart(2, "0");
  return `${dayName}, ${d} ${m} ${y} pukul ${hh}:${mm}:${ss} WIB`;
}

function formatShortWibTime(dateInput) {
  if (!dateInput) return "";
  try {
    const dt = new Date(dateInput);
    if (isNaN(dt.getTime())) return "";
    return (
      dt.toLocaleTimeString("id-ID", {
        timeZone: "Asia/Jakarta",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).replace(".", ":") + " WIB"
    );
  } catch (e) {
    return "";
  }
}

function loadExcelJsLibrary() {
  return new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && window.ExcelJS) {
      return resolve(window.ExcelJS);
    }
    const script = document.createElement("script");
    script.src = "/exceljs.min.js";
    script.onload = () => resolve(window.ExcelJS);
    script.onerror = () => reject(new Error("Gagal mengunduh pustaka ExcelJS"));
    document.body.appendChild(script);
  });
}

function splitKecamatanDesa(fullName) {
  if (!fullName) return { kecamatan: "-", desa: "-" };
  const str = String(fullName).trim();
  if (str.includes("_")) {
    const parts = str.split("_");
    const kec = parts[0].trim();
    const desa = parts.slice(1).join(" ").trim();
    return {
      kecamatan: kec ? kec.charAt(0).toUpperCase() + kec.slice(1).toLowerCase() : "-",
      desa: desa ? desa.charAt(0).toUpperCase() + desa.slice(1).toLowerCase() : kec
    };
  }
  if (str.includes("-")) {
    const parts = str.split("-");
    const kec = parts[0].trim();
    const desa = parts.slice(1).join(" ").trim();
    return {
      kecamatan: kec ? kec.charAt(0).toUpperCase() + kec.slice(1).toLowerCase() : "-",
      desa: desa ? desa.charAt(0).toUpperCase() + desa.slice(1).toLowerCase() : kec
    };
  }
  return { kecamatan: "-", desa: str };
}

// ─── Dual Line Chart (SVG Light) ────────────────────────────────────────────
function DualLineChart({ points, isDaily = false }) {
  const [hoverIndex, setHoverIndex] = useState(null);

  if (!points || points.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-slate-500 text-xs bg-slate-900/40 rounded-lg border border-slate-700/50">
        Tidak ada data traffic tersedia untuk rentang ini
      </div>
    );
  }

  const W = 860,
    H = 170,
    PL = 60,
    PR = 16,
    PT = 20,
    PB = 32;
  const iW = W - PL - PR;
  const iH = H - PT - PB;

  const maxVal = Math.max(
    ...points.map((p) => Math.max(p.in || p.flowIn || 0, p.out || p.flowOut || 0, (p.flow || 0) / 2)),
    1
  );
  const step = points.length > 1 ? points.length - 1 : 1;

  const inPts = points.map((p, i) => ({
    x: PL + (i / step) * iW,
    y: PT + iH - ((p.in || p.flowIn || 0) / maxVal) * iH,
    val: p.in || p.flowIn || 0,
    time: isDaily ? shortDate(p.time) : shortTime(p.time),
  }));

  const outPts = points.map((p, i) => ({
    x: PL + (i / step) * iW,
    y: PT + iH - ((p.out || p.flowOut || 0) / maxVal) * iH,
    val: p.out || p.flowOut || 0,
    time: isDaily ? shortDate(p.time) : shortTime(p.time),
  }));

  const inLine = inPts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const outLine = outPts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  const inArea = inLine + ` L${inPts[inPts.length - 1].x.toFixed(1)},${PT + iH} L${PL},${PT + iH} Z`;
  const outArea = outLine + ` L${outPts[outPts.length - 1].x.toFixed(1)},${PT + iH} L${PL},${PT + iH} Z`;

  const yTicks = [0, 0.33, 0.66, 1].map((f) => ({
    val: maxVal * f,
    y: PT + iH - f * iH,
  }));

  const xTicks = points
    .map((p, i) => ({
      idx: i,
      x: PL + (i / step) * iW,
      time: isDaily ? shortDate(p.time) : shortTime(p.time),
    }))
    .filter((_, i, arr) => {
      const stride = Math.max(1, Math.floor(arr.length / 7));
      return i % stride === 0 || i === arr.length - 1;
    });

  const activeP = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div className="relative w-full bg-slate-900/60 rounded-lg p-3 border border-slate-700/50">
      <div className="flex items-center justify-between mb-2 px-1 text-[11px]">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            Uplink (In)
          </span>
          <span className="flex items-center gap-1.5 text-blue-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
            Downlink (Out)
          </span>
        </div>
        {activeP && (
          <div className="font-mono text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700 text-[10px]">
            {activeP.time} | In: <span className="text-emerald-400 font-bold">{formatBytes(activeP.in || activeP.flowIn || 0)}</span> | Out: <span className="text-blue-400 font-bold">{formatBytes(activeP.out || activeP.flowOut || 0)}</span>
          </div>
        )}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-40 overflow-visible cursor-crosshair select-none"
        onMouseLeave={() => setHoverIndex(null)}
      >
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PL} y1={t.y} x2={W - PR} y2={t.y} stroke="#334155" strokeWidth="1" strokeDasharray="2 2" />
            <text x={PL - 6} y={t.y + 3} textAnchor="end" fontSize="9" fill="#94a3b8" fontFamily="monospace">
              {formatBytes(t.val)}
            </text>
          </g>
        ))}

        {xTicks.map((t, i) => (
          <text key={i} x={t.x} y={H - 6} textAnchor="middle" fontSize="9" fill="#94a3b8" fontFamily="monospace">
            {t.time}
          </text>
        ))}

        <path d={inArea} fill="rgba(16, 185, 129, 0.08)" />
        <path d={outArea} fill="rgba(59, 130, 246, 0.08)" />

        <path d={inLine} fill="none" stroke="#10b981" strokeWidth="1.8" strokeLinejoin="round" />
        <path d={outLine} fill="none" stroke="#3b82f6" strokeWidth="1.8" strokeLinejoin="round" />

        {hoverIndex !== null && (
          <g>
            <line
              x1={inPts[hoverIndex].x}
              y1={PT}
              x2={inPts[hoverIndex].x}
              y2={PT + iH}
              stroke="#94a3b8"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
            <circle cx={inPts[hoverIndex].x} cy={inPts[hoverIndex].y} r="3.5" fill="#10b981" stroke="#0f172a" strokeWidth="2" />
            <circle cx={outPts[hoverIndex].x} cy={outPts[hoverIndex].y} r="3.5" fill="#3b82f6" stroke="#0f172a" strokeWidth="2" />
          </g>
        )}

        {points.map((_, i) => {
          const colW = iW / step;
          const x = PL + i * colW - colW / 2;
          return (
            <rect
              key={i}
              x={x}
              y={PT}
              width={colW}
              height={iH}
              fill="transparent"
              onMouseEnter={() => setHoverIndex(i)}
            />
          );
        })}
      </svg>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function MonitoringTrafficPage() {
  const [sites, setSites] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  // Filters & State
  const [rangeType, setRangeType] = useState("30days"); // Default 30h
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("traffic-desc");
  const [itemsPerPage, setItemsPerPage] = useState(30);
  const [currentPage, setCurrentPage] = useState(1);

  // Live Timer / Stopwatch State
  const [liveElapsed, setLiveElapsed] = useState("0.0");
  const [lastFetchDuration, setLastFetchDuration] = useState(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  // Modal Trend
  const [modalSite, setModalSite] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalData, setModalData] = useState(null);
  const [modalRange, setModalRange] = useState("30days");

  const [copiedKey, setCopiedKey] = useState(null);
  const { showToast, ToastComponent } = useToast();

  const handleCopy = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showToast(`Disalin: ${text}`, "success");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // ─── Stopwatch Timer Functions ──────────────────────────────────────────────
  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    startTimeRef.current = Date.now();
    setLiveElapsed("0.0");
    timerRef.current = setInterval(() => {
      if (startTimeRef.current) {
        const diff = (Date.now() - startTimeRef.current) / 1000;
        setLiveElapsed(diff.toFixed(1));
      }
    }, 100);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Cleanup timer on component unmount
  useEffect(() => {
    setCurrentUser(getStoredUser());
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const canManualSync = (currentUser?.role || "").toLowerCase() === "superadmin";

  // ─── Fetch All Sites Traffic ───────────────────────────────────────────────
  const fetchTraffic = async (isForce = false) => {
    setLoading(true);
    setError(null);
    startTimer();
    const startStamp = Date.now();

    try {
      const payload = {
        type: "l2tp",
        rangeType,
        forceRefresh: isForce,
      };

      if (rangeType === "custom") {
        if (!customStart || !customEnd) {
          showToast("Tentukan tanggal mulai dan selesai terlebih dahulu", "warning");
          setLoading(false);
          stopTimer();
          return;
        }
        payload.startDate = customStart.replace(/-/g, "");
        payload.endDate = customEnd.replace(/-/g, "");
      }

      const res = await axios.post("/api/traffic/all", payload, {
        timeout: 90000,
      });

      const data = res.data || {};
      setSites(data.sitesTraffic || []);
      setSummary({
        ...(data.summary || {}),
        startDate: data.startDate,
        endDate: data.endDate,
        rangeType: data.rangeType || rangeType,
      });
      if (data.lastSyncedAt) {
        setLastSyncedAt(data.lastSyncedAt);
      }
      if (isForce) {
        showToast("Sinkronisasi manual berhasil! Data terbaru tersimpan di database.", "success");
      }
      const totalSecs = ((Date.now() - startStamp) / 1000).toFixed(1);
      setLastFetchDuration(totalSecs);
    } catch (err) {
      console.error("Gagal ambil traffic:", err);
      const msg = err.response?.data?.error || err.message || "Gagal mengambil data traffic";
      setError(msg);
      showToast(msg, "error");
    } finally {
      stopTimer();
      setLoading(false);
    }
  };

  // ─── Export to Excel (.xlsx) dengan Border & Styling Lengkap ─────────────
  const exportToExcel = async () => {
    if (!sites || sites.length === 0) {
      showToast("Belum ada data traffic untuk diekspor", "warning");
      return;
    }

    try {
      showToast("Menyiapkan file Excel dengan border & styling...", "info");
      const ExcelJS = await loadExcelJsLibrary();

      const exportTime = new Date();
      const startDateRaw = summary?.startDate || "";
      const endDateRaw = summary?.endDate || "";

      let startFormatted = formatIndoDate(startDateRaw);
      let endFormatted = formatIndoDate(endDateRaw);

      if (!startDateRaw || !endDateRaw) {
        endFormatted = formatIndoDate(exportTime);
        const daysAgo = rangeType === "30days" ? 30 : rangeType === "7days" ? 7 : 1;
        const past = new Date(exportTime.getTime() - daysAgo * 86400000);
        startFormatted = formatIndoDate(past);
      }

      let rangeInfo = "";
      if (rangeType === "30days") {
        rangeInfo = `${startFormatted} s/d ${endFormatted} (30 Hari Terakhir)`;
      } else if (rangeType === "7days") {
        rangeInfo = `${startFormatted} s/d ${endFormatted} (7 Hari Terakhir)`;
      } else if (rangeType === "today") {
        rangeInfo = `${endFormatted} (24 Jam / Hari Ini)`;
      } else {
        rangeInfo = `${startFormatted} s/d ${endFormatted} (Kustom)`;
      }

      const fetchTimeInfo = formatIndoDateTime(exportTime);
      const totalSites = summary?.totalSites || sites.length;
      const totalTrafficStr = summary?.totalTrafficFormatted || formatBytes(summary?.totalTrafficBytes || 0);
      const totalInStr = formatBytes(summary?.totalInTrafficBytes || 0);
      const totalOutStr = formatBytes(summary?.totalOutTrafficBytes || 0);
      const totalClientsStr = summary?.totalClients ? Number(summary.totalClients).toLocaleString("id-ID") : "0";

      const wb = new ExcelJS.Workbook();
      wb.creator = "NOCR Monitoring Platform";
      wb.created = exportTime;
      const ws = wb.addWorksheet("Traffic L2TP Semua Site");

      ws.views = [{ showGridLines: true }];

      // 1. Header Judul (Baris 1) - Merge A1:G1
      ws.mergeCells("A1:G1");
      const cellTitle = ws.getCell("A1");
      cellTitle.value = "LAPORAN PENGGUNAAN TRAFFIC SEMUA SITE DESA";
      cellTitle.font = { name: "Calibri", size: 14, bold: true, color: { argb: "FF1E293B" } };
      cellTitle.alignment = { vertical: "middle", horizontal: "left" };
      ws.getRow(1).height = 26;

      // 2. Periode Data (Baris 2) - Merge A2:G2
      ws.mergeCells("A2:G2");
      const cellPeriode = ws.getCell("A2");
      cellPeriode.value = `Periode Rentang Data: ${rangeInfo}`;
      cellPeriode.font = { name: "Calibri", size: 10, italic: true, color: { argb: "FF475569" } };
      cellPeriode.alignment = { vertical: "middle", horizontal: "left" };
      ws.getRow(2).height = 18;

      // 3. Waktu Tarik Data (Baris 3) - Merge A3:G3
      ws.mergeCells("A3:G3");
      const cellWaktu = ws.getCell("A3");
      cellWaktu.value = `Waktu Pengambilan Data: ${fetchTimeInfo}`;
      cellWaktu.font = { name: "Calibri", size: 10, color: { argb: "FF475569" } };
      cellWaktu.alignment = { vertical: "middle", horizontal: "left" };
      ws.getRow(3).height = 18;

      // 4. Ringkasan Akumulasi (Baris 4) - Merge A4:G4
      ws.mergeCells("A4:G4");
      const cellSummary = ws.getCell("A4");
      cellSummary.value = `Ringkasan: Total Site: ${totalSites} Desa | Total Traffic: ${totalTrafficStr} (Down: ${totalInStr} | Up: ${totalOutStr}) | Total Klien Terdeteksi: ${totalClientsStr}`;
      cellSummary.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF0F172A" } };
      cellSummary.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
      cellSummary.alignment = { vertical: "middle", horizontal: "left" };
      ws.getRow(4).height = 22;

      // 5. Baris Kosong
      ws.getRow(5).height = 8;

      // 6. Header Kolom Tabel (Baris 6)
      const headers = ["No", "Nama Kecamatan", "Nama Desa", "Total Traffic", "Download (Down)", "Upload (Up)", "Total Klien"];
      const headerRow = ws.getRow(6);
      headerRow.values = headers;
      headerRow.height = 26;

      const tableHeaderBorder = {
        top: { style: "medium", color: { argb: "FF1E293B" } },
        left: { style: "thin", color: { argb: "FF334155" } },
        bottom: { style: "medium", color: { argb: "FF1E293B" } },
        right: { style: "thin", color: { argb: "FF334155" } }
      };

      headers.forEach((_, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = tableHeaderBorder;
      });

      const dataCellBorder = {
        top: { style: "thin", color: { argb: "FFD1D5DB" } },
        left: { style: "thin", color: { argb: "FFD1D5DB" } },
        bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
        right: { style: "thin", color: { argb: "FFD1D5DB" } }
      };

      const sortedData = [...filteredAndSortedSites];

      sortedData.forEach((site, index) => {
        const trafficBytes = site.totalTrafficBytes || 0;
        const { kecamatan, desa } = splitKecamatanDesa(site.siteName || site.alias || "");
        const rowValues = [
          index + 1,
          kecamatan,
          desa,
          formatBytes(trafficBytes),
          formatBytes(site.inTrafficBytes || 0),   // Download (Down)
          formatBytes(site.outTrafficBytes || 0),  // Upload (Up)
          site.clients ? Number(site.clients).toLocaleString("id-ID") : "0"
        ];

        const row = ws.addRow(rowValues);
        row.height = 20;
        const isEven = index % 2 === 1;

        rowValues.forEach((_, colIdx) => {
          const cell = row.getCell(colIdx + 1);
          cell.font = { name: "Calibri", size: 10, color: { argb: "FF1E293B" } };
          cell.border = dataCellBorder;
          if (isEven) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
          }
          if (colIdx === 0) {
            cell.alignment = { vertical: "middle", horizontal: "center" };
          } else if (colIdx >= 3) {
            cell.alignment = { vertical: "middle", horizontal: "right" };
          } else {
            cell.alignment = { vertical: "middle", horizontal: "left" };
          }
        });
      });

      ws.columns = [
        { width: 8 },
        { width: 24 },
        { width: 28 },
        { width: 20 },
        { width: 18 },
        { width: 18 },
        { width: 16 }
      ];

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const todayStr = new Date().toISOString().slice(0, 10);
      const filename = `Laporan_Traffic_Semua_Desa_${rangeType}_${todayStr}.xlsx`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showToast(`File ${filename} berhasil diunduh dengan border & styling rapi!`, "success");
    } catch (err) {
      console.error("Gagal export excel:", err);
      showToast("Gagal mengekspor file Excel: " + err.message, "error");
    }
  };

  // Initial load & when rangeType changes
  useEffect(() => {
    fetchTraffic(false);
  }, [rangeType]);

  // ─── Single Site Trend Modal ──────────────────────────────────────────────
  const openTrendModal = async (site) => {
    setModalSite(site);
    setModalData(null);
    setModalLoading(true);
    setModalRange(rangeType);

    try {
      const payload = {
        type: "l2tp",
        rangeType: rangeType,
        groupId: site.groupId,
        deviceSn: site.sn,
      };
      if (rangeType === "custom" && customStart && customEnd) {
        payload.startDate = customStart.replace(/-/g, "");
        payload.endDate = customEnd.replace(/-/g, "");
      }
      const res = await axios.post("/api/traffic/site", payload, { timeout: 30000 });
      setModalData(res.data?.sitesTraffic?.[0] || null);
    } catch (err) {
      console.error("Gagal load trend:", err);
      showToast("Gagal memuat tren grafik site", "error");
    } finally {
      setModalLoading(false);
    }
  };

  const changeModalRange = async (newRange) => {
    if (!modalSite) return;
    setModalRange(newRange);
    setModalLoading(true);
    try {
      const payload = {
        type: "l2tp",
        rangeType: newRange,
        groupId: modalSite.groupId,
        deviceSn: modalSite.sn,
      };
      const res = await axios.post("/api/traffic/site", payload, { timeout: 30000 });
      setModalData(res.data?.sitesTraffic?.[0] || null);
    } catch (err) {
      console.error("Gagal ubah range modal:", err);
      showToast("Gagal mengubah rentang grafik", "error");
    } finally {
      setModalLoading(false);
    }
  };

  // ─── Filtering & Sorting ──────────────────────────────────────────────────
  const filteredAndSortedSites = useMemo(() => {
    const term = search.toLowerCase().trim();
    let result = sites.filter((s) => {
      if (!term) return true;
      const name = (s.siteName || s.alias || "").toLowerCase();
      const ip = (s.ip || "").toLowerCase();
      const mac = (s.mac || "").toLowerCase();
      const sn = (s.sn || "").toLowerCase();
      const gid = String(s.groupId || "").toLowerCase();
      return name.includes(term) || ip.includes(term) || mac.includes(term) || sn.includes(term) || gid.includes(term);
    });

    result.sort((a, b) => {
      if (sortBy === "traffic-desc") {
        return (b.totalTrafficBytes || 0) - (a.totalTrafficBytes || 0);
      }
      if (sortBy === "traffic-asc") {
        return (a.totalTrafficBytes || 0) - (b.totalTrafficBytes || 0);
      }
      if (sortBy === "name-asc") {
        return (a.siteName || a.alias || "").localeCompare(b.siteName || b.alias || "");
      }
      if (sortBy === "clients-desc") {
        return (b.clients || 0) - (a.clients || 0);
      }
      if (sortBy === "status") {
        const isAOnline = a.status === "ON" || a.status === "Online" ? 1 : 0;
        const isBOnline = b.status === "ON" || b.status === "Online" ? 1 : 0;
        return isBOnline - isAOnline;
      }
      return 0;
    });

    return result;
  }, [sites, search, sortBy]);

  const maxTrafficInList = useMemo(() => {
    return Math.max(...sites.map((s) => s.totalTrafficBytes || 0), 1);
  }, [sites]);

  const totalPages = itemsPerPage === "all" ? 1 : Math.ceil(filteredAndSortedSites.length / itemsPerPage) || 1;
  const paginatedSites = useMemo(() => {
    if (itemsPerPage === "all") return filteredAndSortedSites;
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedSites.slice(start, start + itemsPerPage);
  }, [filteredAndSortedSites, currentPage, itemsPerPage]);

  const totalOnline = sites.filter((s) => s.status === "ON" || s.status === "Online").length;
  const totalOffline = sites.length > 0 ? sites.length - totalOnline : 0;

  const dateRangeText = useMemo(() => {
    const sRaw = summary?.startDate || "";
    const eRaw = summary?.endDate || "";
    if (sRaw && eRaw) {
      return `${formatIndoDate(sRaw)} s/d ${formatIndoDate(eRaw)} (30 Hari Terakhir)`;
    }
    const now = new Date();
    const past = new Date(now.getTime() - 30 * 86400000);
    return `${formatIndoDate(past)} s/d ${formatIndoDate(now)} (30 Hari Terakhir)`;
  }, [summary]);

  return (
    <div className="flex-1 w-full min-w-0 flex flex-col gap-2.5 md:gap-3 pb-4 relative text-slate-100">
      {ToastComponent}

      {/* ─── NOCR Standard Page Header ────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Activity size={20} className="text-blue-500 dark:text-blue-400" />
            Traffic Semua Site (DESA)
          </h1>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Akumulasi lalu lintas data & statistik total klien unik 280 Desa terpantau
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {lastSyncedAt && (
            <span className="text-[11px] text-slate-300 bg-slate-800/90 px-2.5 py-1.5 rounded-lg border border-slate-700/60 flex items-center gap-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              Terakhir sinkronasi: {formatShortWibTime(lastSyncedAt)}
            </span>
          )}

          {lastFetchDuration && !loading && (
            <span className="text-[11px] font-mono text-slate-400 bg-slate-800/80 px-2 py-1 rounded border border-slate-700/50 flex items-center gap-1">
              <Clock size={12} className="text-blue-400" />
              {lastFetchDuration}s
            </span>
          )}

          {canManualSync && (
            <button
              onClick={() => fetchTraffic(true)}
              disabled={loading}
              className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition shadow-md bg-blue-600 hover:bg-blue-700 border border-blue-500 text-white shadow-blue-500/20 disabled:opacity-50"
              title="Tarik data traffic terbaru secara langsung dari Ruijie Cloud (Khusus Super Admin)"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              <span>{loading ? "Menyinkronkan..." : "Sync Sekarang"}</span>
            </button>
          )}

          <button
            onClick={exportToExcel}
            disabled={loading || sites.length === 0}
            className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition shadow-md bg-emerald-600 hover:bg-emerald-700 border border-emerald-500 text-white shadow-emerald-500/20 disabled:opacity-50"
            title="Download Laporan ke Excel (.xlsx)"
          >
            <Download size={13} />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* ─── NOCR Standard Stats Cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-shrink-0">
        {/* Total Sites */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-2.5 md:p-3 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
            <Wifi size={14} className="text-blue-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Sites</p>
            <p className="text-base md:text-lg font-bold text-slate-100 leading-tight">
              {summary?.totalSites || sites.length || "-"}{" "}
            </p>
          </div>
        </div>

        {/* Total Traffic */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-2.5 md:p-3 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
            <TrendingUp size={14} className="text-blue-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Total Traffic ({rangeType === "30days" ? "30H" : rangeType === "7days" ? "7H" : rangeType === "today" ? "Hari Ini" : "Kustom"})
            </p>
            <p className="text-base md:text-lg font-bold text-slate-100 leading-tight">
              {summary?.totalTrafficFormatted || formatBytes(summary?.totalTrafficBytes || 0)}
            </p>
          </div>
        </div>

        {/* Total Klien */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-2.5 md:p-3 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <Users size={14} className="text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Klien Akumulatif</p>
            <p className="text-base md:text-lg font-bold text-slate-100 leading-tight">
              {summary?.totalClients ? Number(summary.totalClients).toLocaleString("id-ID") : "-"}
            </p>
          </div>
        </div>

        {/* Top Site */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-2.5 md:p-3 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <BarChart2 size={14} className="text-amber-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Site Tertinggi</p>
            <p className="text-xs md:text-sm font-bold text-slate-100 truncate leading-tight" title={summary?.topSite?.siteName || summary?.topSite?.alias || "-"}>
              {summary?.topSite?.siteName || summary?.topSite?.alias || "-"}
            </p>
            <p className="text-[10px] font-mono text-amber-400 font-semibold leading-none mt-0.5">
              {summary?.topSite?.totalTrafficBytes ? formatBytes(summary.topSite.totalTrafficBytes) : "-"}
            </p>
          </div>
        </div>
      </div>

      {/* ─── NOCR Main Table Panel ─────────────────────────────────────────── */}
      <div className="w-full flex flex-col bg-slate-800/50 border border-slate-700/50 rounded-xl min-w-0 overflow-hidden shadow-sm">
        {/* Panel Toolbar Header */}
        <div className="p-3 border-b border-slate-700/30 flex items-center justify-between gap-2.5 flex-shrink-0 flex-wrap">
          {/* Left: Fixed 30 Days Period Badge with Date Range */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold">
            <Calendar size={13} className="text-blue-400 flex-shrink-0" />
            <span>Periode: {dateRangeText}</span>
          </div>

          {/* Right: Search & Sort */}
          <div className="flex items-center gap-2 flex-1 sm:flex-none justify-end">
            <div className="relative flex-1 sm:w-56">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Cari desa, IP, MAC, SN..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-slate-900/60 border border-slate-700/50 rounded-lg pl-8 pr-3 py-1 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-slate-900/60 border border-slate-700/50 rounded-lg px-2.5 py-1 text-[11px] text-slate-300 focus:outline-none focus:border-blue-500"
            >
              <option value="traffic-desc">Traffic Terbanyak</option>
              <option value="traffic-asc">Traffic Terendah</option>
              <option value="name-asc">Nama Desa (A-Z)</option>
              <option value="clients-desc">Klien Terbanyak</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-slate-700 border-t-blue-500 animate-spin" />
            <div className="text-xs font-semibold text-slate-200">
              Mengambil data traffic 280 site secara paralel...
            </div>
            <div className="flex items-center gap-1.5 text-xs text-blue-400 font-mono bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
              <Clock size={12} className="animate-pulse" />
              <span>Waktu berjalan: <strong className="text-blue-300 font-bold">{liveElapsed}s</strong></span>
            </div>
            <p className="text-[10px] text-slate-500">
              Sinkronisasi rx/tx dan penghitungan total klien unik Ruijie Cloud
            </p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <AlertTriangle size={28} className="text-red-400 mb-1.5" />
            <div className="text-xs font-semibold text-red-300">{error}</div>
            <button
              onClick={() => fetchTraffic(false)}
              className="cursor-pointer mt-2.5 px-3 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-[11px] font-semibold text-white"
            >
              Coba Lagi
            </button>
          </div>
        ) : filteredAndSortedSites.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs">
            Tidak ada site yang cocok dengan pencarian.
          </div>
        ) : (
          <div className="w-full overflow-x-auto overflow-y-visible min-w-0 touch-auto relative">
            <table className="w-full text-left border-collapse table-fixed text-[11px]">
              <colgroup>
                <col style={{ width: "44px" }} />
                <col style={{ width: "24%" }} />
                <col style={{ width: "18%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "95px" }} />
                <col style={{ width: "70px" }} />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-700/50 bg-slate-900/40 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-2.5 px-2 text-center">#</th>
                  <th className="py-2.5 px-3">Lokasi / Desa</th>
                  <th className="py-2.5 px-2">MAC & SN</th>
                  <th className="py-2.5 px-2.5 text-right">Total Traffic</th>
                  <th className="py-2.5 px-2.5 text-right">Download (Down)</th>
                  <th className="py-2.5 px-2.5 text-right">Upload (Up)</th>
                  <th className="py-2.5 px-2 text-center">Total Klien</th>
                  <th className="py-2.5 px-2 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {paginatedSites.map((site, idx) => {
                  const globalRank = (currentPage - 1) * (itemsPerPage === "all" ? 0 : itemsPerPage) + idx + 1;
                  const trafficBytes = site.totalTrafficBytes || 0;

                  return (
                    <tr
                      key={site.groupId || site.sn || idx}
                      className="hover:bg-slate-700/20 transition-colors"
                    >
                      {/* Rank # */}
                      <td className="py-2.5 px-2 text-center font-mono text-slate-400">
                        {globalRank === 1 ? (
                          <span className="w-4 h-4 rounded inline-flex items-center justify-center font-bold text-[9px] bg-amber-600 text-white">
                            1
                          </span>
                        ) : globalRank === 2 ? (
                          <span className="w-4 h-4 rounded inline-flex items-center justify-center font-bold text-[9px] bg-slate-600 text-white">
                            2
                          </span>
                        ) : globalRank === 3 ? (
                          <span className="w-4 h-4 rounded inline-flex items-center justify-center font-bold text-[9px] bg-amber-900 text-white">
                            3
                          </span>
                        ) : (
                          globalRank
                        )}
                      </td>

                      {/* Site Name (No ID & No IP) */}
                      <td className="py-2.5 px-3 overflow-hidden">
                        <div className="font-semibold text-slate-100 truncate text-xs" title={site.siteName || site.alias}>
                          {site.siteName || site.alias}
                        </div>
                      </td>

                      {/* MAC & SN */}
                      <td className="py-2.5 px-2 overflow-hidden font-mono text-[11px]">
                        <div
                          className="text-blue-400 hover:underline cursor-pointer truncate"
                          onClick={() => handleCopy(site.mac, `mac-${site.mac}`)}
                          title="Klik salin MAC"
                        >
                          {site.mac || "-"}
                        </div>
                        <div
                          className="text-slate-500 text-[10px] cursor-pointer truncate"
                          onClick={() => handleCopy(site.sn, `sn-${site.sn}`)}
                          title="Klik salin SN"
                        >
                          SN:{site.sn || "-"}
                        </div>
                      </td>

                      {/* Total Traffic */}
                      <td className="py-2.5 px-2.5 text-right font-mono font-bold text-slate-100 text-xs">
                        {trafficBytes > 0 ? formatBytes(trafficBytes) : <span className="text-slate-500 font-normal">0 B</span>}
                      </td>

                      {/* Download (Down) */}
                      <td className="py-2.5 px-2.5 text-right font-mono font-semibold text-blue-400 text-xs">
                        ↓ {formatBytes(site.inTrafficBytes || 0)}
                      </td>

                      {/* Upload (Up) */}
                      <td className="py-2.5 px-2.5 text-right font-mono font-semibold text-emerald-400 text-xs">
                        ↑ {formatBytes(site.outTrafficBytes || 0)}
                      </td>

                      {/* Client Count */}
                      <td className="py-2.5 px-2 text-center">
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-700/40 text-slate-300 font-mono text-[11px] font-semibold"
                          title="Total Klien Akumulatif (30 Hari)"
                        >
                          <Users size={10} className="text-slate-400" />
                          {site.clients ? Number(site.clients).toLocaleString("id-ID") : "0"}
                        </span>
                      </td>

                      {/* Action Button: Direct Link to /monitoring/desa/traffic/[mac] */}
                      <td className="py-2.5 px-2 text-center">
                        <Link
                          href={`/monitoring/desa/traffic/${encodeURIComponent(site.mac || "")}`}
                          className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-700/50 hover:bg-blue-600 text-slate-300 hover:text-white border border-slate-600/40 text-[10px] font-medium transition"
                          title="Lihat Detail & Tren di Halaman Desa"
                        >
                          <TrendingUp size={11} />
                          <span>Tren</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {!loading && filteredAndSortedSites.length > 0 && (
          <div className="p-3 border-t border-slate-700/30 flex items-center justify-between flex-wrap gap-2 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span>Tampilkan:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  const v = e.target.value;
                  setItemsPerPage(v === "all" ? "all" : Number(v));
                  setCurrentPage(1);
                }}
                className="bg-slate-900/60 border border-slate-700/50 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none"
              >
                <option value={30}>30</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value="all">Semua ({filteredAndSortedSites.length})</option>
              </select>
              <span>
                Menampilkan {(currentPage - 1) * (itemsPerPage === "all" ? 0 : itemsPerPage) + 1} -{" "}
                {itemsPerPage === "all"
                  ? filteredAndSortedSites.length
                  : Math.min(currentPage * itemsPerPage, filteredAndSortedSites.length)}{" "}
                dari {filteredAndSortedSites.length} site
              </span>
            </div>

            {itemsPerPage !== "all" && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="cursor-pointer px-2 py-1 rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-[11px]"
                >
                  Prev
                </button>
                <span className="px-2 font-mono text-[11px]">
                  {currentPage} / {totalPages}
                </span>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="cursor-pointer px-2 py-1 rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-[11px]"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Modal Tren Grafik Site ────────────────────────────────────────── */}
      {modalSite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700/70 rounded-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto p-4 space-y-3 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-700/50 pb-2.5">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                  <Activity size={16} className="text-blue-400" />
                  Tren Traffic: {modalSite.siteName || modalSite.alias}
                </h3>
                <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400 mt-0.5 font-mono">
                  {modalSite.ip && <span>IP: {modalSite.ip}</span>}
                  {modalSite.mac && <span>MAC: {modalSite.mac}</span>}
                  {modalSite.sn && <span>SN: {modalSite.sn}</span>}
                </div>
              </div>
              <button
                onClick={() => setModalSite(null)}
                className="cursor-pointer w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
              >
                <X size={14} />
              </button>
            </div>

            {/* Modal Range Switcher */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded border border-slate-700/50 text-[10px]">
                {[
                  { id: "today", label: "Hari Ini" },
                  { id: "7days", label: "7 Hari" },
                  { id: "30days", label: "30 Hari" },
                ].map((r) => (
                  <button
                    key={r.id}
                    onClick={() => changeModalRange(r.id)}
                    className={`cursor-pointer px-2.5 py-0.5 rounded font-medium transition ${
                      modalRange === r.id
                        ? "bg-blue-600 text-white font-semibold"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              {modalData && (
                <div className="text-[11px] font-mono text-slate-300">
                  Total: <span className="font-bold text-white">{formatBytes(modalData.totalTrafficBytes || 0)}</span> | Klien:{" "}
                  <span className="font-bold text-emerald-400">{modalData.clients || 0}</span>
                </div>
              )}
            </div>

            {/* Modal Body: Chart */}
            {modalLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <div className="w-7 h-7 rounded-full border-2 border-slate-700 border-t-blue-500 animate-spin" />
                <span className="text-[11px] text-slate-400">Memuat kurva traffic...</span>
              </div>
            ) : (
              <div className="space-y-3">
                <DualLineChart
                  points={modalData?.trendPoints || []}
                  isDaily={modalRange === "7days" || modalRange === "30days"}
                />

                {modalData?.userTrandPoints && modalData.userTrandPoints.length > 0 && (
                  <div className="border-t border-slate-700/40 pt-2 text-[10px] font-mono text-slate-400 flex justify-between">
                    <div>Klien Terakhir: <span className="text-amber-400 font-bold">{modalData.userTrandClients || 0} user</span></div>
                    <div>Waktu Snapshot: <span className="text-slate-300">{modalData.userTrandLastTime || "-"}</span></div>
                  </div>
                )}
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex justify-end border-t border-slate-700/50 pt-2">
              <button
                onClick={() => setModalSite(null)}
                className="cursor-pointer px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
