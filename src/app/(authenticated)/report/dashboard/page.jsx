"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import {
  Activity,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  ChevronRight,
  ClipboardList,
  BarChart3,
  Calendar,
  Layers,
  FileText,
  Check,
} from "lucide-react";
import { API_URL, socket as directSocket, useAppState } from "@/App";
import { getStoredUser } from "@/lib/roles";
import Link from "next/link";

export default function DailyReportDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [copied, setCopied] = useState(false);
  const appState = useAppState() || {};
  const socket = appState.socket || directSocket;

  // Filter States
  const [type, setType] = useState("ALL"); // ALL, L2TP, PPPOE
  const [range, setRange] = useState("7d"); // 7d, 1m, 1y, custom
  const [startMonth, setStartMonth] = useState(() => new Date().getMonth() + 1);
  const [startYear, setStartYear] = useState(() => new Date().getFullYear());
  const [endMonth, setEndMonth] = useState(() => new Date().getMonth() + 1);
  const [endYear, setEndYear] = useState(() => new Date().getFullYear());

  const fetchSummary = async (isPolling = false) => {
    if (!isPolling) setLoading(true);
    try {
      const res = await axios.get("/api/reports/summary", {
        params: {
          type,
          range,
          startMonth: range === "custom" ? startMonth : undefined,
          startYear: range === "custom" ? startYear : undefined,
          endMonth: range === "custom" ? endMonth : undefined,
          endYear: range === "custom" ? endYear : undefined,
        },
      });
      setData(res.data);
      setError(null);
    } catch (err) {
      setError(
        err.response?.data?.error || err.message || "Gagal memuat ringkasan",
      );
    } finally {
      if (!isPolling) setLoading(false);
    }
  };

  // Re-fetch when filter parameters change
  useEffect(() => {
    fetchSummary();
  }, [type, range, startMonth, startYear, endMonth, endYear]);

  // Real-time updates via Socket
  useEffect(() => {
    if (!socket) return;
    const handleDbChange = (payload) => {
      if (payload.table === "daily_reports") {
        fetchSummary(true);
      }
    };
    socket.on("db_change", handleDbChange);
    return () => socket.off("db_change", handleDbChange);
  }, [socket, type, range, startMonth, startYear, endMonth, endYear]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-slate-400">
        <RefreshCw className="animate-spin mb-4 text-blue-500" size={36} />
        <p className="text-sm">Memuat data dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-red-400 p-6 bg-red-950/20 border border-red-900/50 rounded-xl">
        <AlertTriangle className="mb-4 text-red-500" size={48} />
        <h3 className="text-lg font-semibold mb-2">Terjadi Kesalahan</h3>
        <p className="text-xs mb-4 text-center max-w-md">{error}</p>
        <button
          onClick={() => fetchSummary()}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs font-medium transition"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  const stats = data?.stats || { totalReports: 0, averagePerDay: 0 };
  const trend = Array.isArray(data?.trend)
    ? data.trend.map((t) => ({
        label: String(t?.label || ""),
        count: Number(t?.count || 0),
      }))
    : [];
  const weeklyAverage = Array.isArray(data?.weeklyAverage)
    ? data.weeklyAverage.map((w) => ({
        week: String(w?.week || "").replace(/^Minggu (\d+)$/, "Minggu ke $1"),
        average: Number(w?.average || 0),
      }))
    : [];
  const topDevices = Array.isArray(data?.topDevices)
    ? data.topDevices.map((d) => ({
        name: String(d?.name || "Lainnya"),
        count: Number(d?.count || 0),
      }))
    : [];
  const topIssues = Array.isArray(data?.topIssues)
    ? data.topIssues.map((i) => ({
        issue: String(i?.issue || "Lainnya"),
        count: Number(i?.count || 0),
      }))
    : [];

  // Max value for scaling SVG/HTML bar charts
  const maxWeeklyAverage = Math.max(...weeklyAverage.map((w) => w.average), 1);
  const maxDeviceCount = Math.max(...topDevices.map((d) => d.count), 1);
  const maxIssueCount = Math.max(...topIssues.map((i) => i.count), 1);

  const formatLocalDate = (isoString) => {
    if (!isoString) return "-";
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "-";
    try {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      });
      const parts = formatter.formatToParts(d);
      const partObj = {};
      parts.forEach((p) => {
        partObj[p.type] = p.value;
      });
      return `${partObj.year}-${partObj.month}-${partObj.day} ${partObj.hour}:${partObj.minute}:${partObj.second}`;
    } catch (e) {
      return "-";
    }
  };

  const getDayName = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("id-ID", { weekday: "short" });
    } catch (e) {
      return "";
    }
  };

  // Month list for dropdown
  const months = [
    { value: 1, label: "Januari" },
    { value: 2, label: "Februari" },
    { value: 3, label: "Maret" },
    { value: 4, label: "April" },
    { value: 5, label: "Mei" },
    { value: 6, label: "Juni" },
    { value: 7, label: "Juli" },
    { value: 8, label: "Agustus" },
    { value: 9, label: "September" },
    { value: 10, label: "Oktober" },
    { value: 11, label: "November" },
    { value: 12, label: "Desember" },
  ];

  // Year list for dropdown
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  // Helper untuk membuat kalimat kesimpulan otomatis sesuai periode yang dipilih
  const getPeriodLabelText = () => {
    if (range === "7d") return "7 Hari Terakhir";
    if (range === "1m") return "1 Bulan Terakhir";
    if (range === "1y") return "1 Tahun Terakhir";
    if (range === "all") return "Semua Waktu";
    if (range === "custom") {
      const sM = months.find((m) => m.value === startMonth)?.label || startMonth;
      const eM = months.find((m) => m.value === endMonth)?.label || endMonth;
      return `Periode Kustom (${sM} ${startYear} - ${eM} ${endYear})`;
    }
    return "Periode Terpilih";
  };

  const maxTrendPoint = (trend && trend.length > 0)
    ? trend.reduce((max, item) => (item.count > max.count ? item : max), { count: 0, label: "-" })
    : { count: 0, label: "-" };

  const maxWeekPoint = (weeklyAverage && weeklyAverage.length > 0)
    ? weeklyAverage.reduce((max, item) => (item.average > max.average ? item : max), { average: 0, week: "-" })
    : { average: 0, week: "-" };

  // Format top sites text (top 1-3 sites)
  let topSitesText = "tidak ada titik dominan";
  if (topDevices.length > 0) {
    const s1 = `${topDevices[0].name} (${topDevices[0].count} kasus)`;
    if (topDevices.length === 2) {
      topSitesText = `${s1}, disusul ${topDevices[1].name} (${topDevices[1].count} kasus)`;
    } else if (topDevices.length >= 3) {
      topSitesText = `${s1}, disusul ${topDevices[1].name} (${topDevices[1].count} kasus) dan ${topDevices[2].name} (${topDevices[2].count} kasus)`;
    } else {
      topSitesText = s1;
    }
  }

  // Format top issues text (top 1-2 issues)
  let topIssuesText = "faktor operasional umum";
  if (topIssues.length > 0) {
    const i1 = `${topIssues[0].issue} (${topIssues[0].count} kasus)`;
    if (topIssues.length >= 2) {
      topIssuesText = `${i1}, serta ${topIssues[1].issue} (${topIssues[1].count} kasus)`;
    } else {
      topIssuesText = i1;
    }
  }

  const categoryText = type === "ALL" ? "Desa & OPD" : type === "L2TP" ? "Desa" : "OPD";

  const weeklyText = maxWeekPoint.average > 0
    ? ` Secara distribusi mingguan, konsentrasi rata-rata laporan tertinggi terjadi pada ${maxWeekPoint.week} (rata-rata ${Math.ceil(maxWeekPoint.average)} kasus/hari).`
    : "";

  const executiveSummaryText = `Berdasarkan data laporan untuk ${getPeriodLabelText()} (Kategori: ${categoryText}), tercatat sebanyak ${stats.totalReports} total kasus gangguan dengan rata-rata ${Math.ceil(Number(stats.averagePerDay || 0))} kasus per hari.${weeklyText} Tren tertinggi harian terjadi pada ${maxTrendPoint.label !== "-" ? `periode/tanggal ${maxTrendPoint.label}` : "periode terpilih"} dengan jumlah ${maxTrendPoint.count} laporan. Lokasi dengan frekuensi gangguan terbanyak tercatat di ${topSitesText}, di mana indikasi kendala utama didominasi oleh ${topIssuesText}.`;

  const handleCopySummary = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(executiveSummaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden flex flex-col gap-6 p-1 pb-10">
      {/* Header & Main Controls */}
      <div className="flex flex-col gap-4 bg-slate-900/40 p-5 border border-slate-800/80 rounded-2xl">
        {/* Top Row: Title & Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-100 flex items-center gap-3">
              <Activity className="text-blue-500 animate-pulse" size={24} />
              Dashboard Laporan Harian
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Statistik penanganan gangguan dan log laporan periodik
            </p>
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto">
            <button
              onClick={() => fetchSummary(true)}
              className="cursor-pointer flex items-center gap-2 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-300 rounded-lg text-xs transition"
            >
              <RefreshCw size={13} />
              Segarkan
            </button>
            <Link
              href="/daily-reports"
              className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-lg shadow-blue-500/20 transition"
            >
              Kelola Laporan <ChevronRight size={13} />
            </Link>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-slate-800/60 w-full" />

        {/* Bottom Row: Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Connection Type Toggle */}
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setType("ALL")}
              className={`cursor-pointer px-3 py-1 rounded-md text-[11px] font-semibold transition ${
                type === "ALL"
                  ? "bg-blue-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setType("L2TP")}
              className={`cursor-pointer px-3 py-1 rounded-md text-[11px] font-semibold transition ${
                type === "L2TP"
                  ? "bg-blue-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Desa
            </button>
            <button
              onClick={() => setType("PPPOE")}
              className={`cursor-pointer px-3 py-1 rounded-md text-[11px] font-semibold transition ${
                type === "PPPOE"
                  ? "bg-blue-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              OPD
            </button>
          </div>

          {/* Time Range Selector */}
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setRange("7d")}
              className={`cursor-pointer px-3 py-1 rounded-md text-[11px] font-semibold transition ${
                range === "7d"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              7 Hari
            </button>
            <button
              onClick={() => setRange("1m")}
              className={`cursor-pointer px-3 py-1 rounded-md text-[11px] font-semibold transition ${
                range === "1m"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              1 Bulan
            </button>
            <button
              onClick={() => setRange("1y")}
              className={`cursor-pointer px-3 py-1 rounded-md text-[11px] font-semibold transition ${
                range === "1y"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              1 Tahun
            </button>
            <button
              onClick={() => setRange("all")}
              className={`cursor-pointer px-3 py-1 rounded-md text-[11px] font-semibold transition ${
                range === "all"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Semua Waktu
            </button>
            <button
              onClick={() => setRange("custom")}
              className={`cursor-pointer px-3 py-1 rounded-md text-[11px] font-semibold transition ${
                range === "custom"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Custom
            </button>
          </div>

          {/* Custom Date Range selector */}
          {range === "custom" && (
            <div className="flex flex-wrap items-center gap-2 text-xs bg-slate-950/60 border border-slate-800 px-3 py-1.5 rounded-lg">
              <span className="text-slate-400 font-semibold">Dari:</span>
              <select
                value={startMonth}
                onChange={(e) => setStartMonth(parseInt(e.target.value, 10))}
                className="bg-slate-950 text-slate-200 border border-slate-800 rounded px-1.5 py-0.5 outline-none cursor-pointer text-xs"
              >
                {months.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label.slice(0, 3)}
                  </option>
                ))}
              </select>
              <select
                value={startYear}
                onChange={(e) => setStartYear(parseInt(e.target.value, 10))}
                className="bg-slate-950 text-slate-200 border border-slate-800 rounded px-1.5 py-0.5 outline-none cursor-pointer text-xs"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>

              <span className="text-slate-400 font-semibold ml-2">Sampai:</span>
              <select
                value={endMonth}
                onChange={(e) => setEndMonth(parseInt(e.target.value, 10))}
                className="bg-slate-950 text-slate-200 border border-slate-800 rounded px-1.5 py-0.5 outline-none cursor-pointer text-xs"
              >
                {months.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label.slice(0, 3)}
                  </option>
                ))}
              </select>
              <select
                value={endYear}
                onChange={(e) => setEndYear(parseInt(e.target.value, 10))}
                className="bg-slate-950 text-slate-200 border border-slate-800 rounded px-1.5 py-0.5 outline-none cursor-pointer text-xs"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
{/* Dynamic Executive Audit Summary Card */}
      <div className="bg-gradient-to-r from-blue-950/40 via-slate-900/60 to-emerald-950/30 border border-blue-800/40 rounded-xl p-5 shadow-lg flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
              <FileText size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                Kesimpulan Laporan 
                <span className="text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  {getPeriodLabelText()}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Ringkasan naratif otomatis berdasarkan data &amp; periode terpilih
              </p>
            </div>
          </div>

          <button
            onClick={handleCopySummary}
            className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 rounded-lg text-xs transition"
          >
            {copied ? (
              <>
                <Check size={13} className="text-emerald-400" />
                <span className="text-emerald-400 font-medium">Tersalin!</span>
              </>
            ) : (
              <>
                <FileText size={13} />
                <span>Salin Kesimpulan</span>
              </>
            )}
          </button>
        </div>

        <blockquote className="text-sm text-slate-200 leading-relaxed italic bg-slate-950/60 p-4 rounded-lg border border-slate-800/80 border-l-4 border-l-blue-500">
          "{executiveSummaryText}"
        </blockquote>
      </div>

      
      {/* Grid Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Total Reports */}
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5 flex flex-col justify-between hover:border-slate-600 transition group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">
              Total Laporan
            </span>
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg group-hover:scale-105 transition">
              <ClipboardList size={18} />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold text-blue-400">
              {stats.totalReports}
            </span>
            <div className="text-[10px] text-slate-500 mt-1">
              Jumlah kasus gangguan dalam periode terpilih
            </div>
          </div>
        </div>

        {/* Card 2: Average Per Day */}
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5 flex flex-col justify-between hover:border-slate-600 transition group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">
              Rata-rata Laporan (Harian)
            </span>
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg group-hover:scale-105 transition">
              <BarChart3 size={18} />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold text-emerald-400">
              {Math.ceil(Number(stats.averagePerDay || 0))}
            </span>
            <div className="text-[10px] text-slate-500 mt-1">
              Kasus laporan gangguan per hari
            </div>
          </div>
        </div>
      </div>

      

      {/* Trend Chart - Full Width - SVG Line Chart */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <TrendingUp size={16} className="text-blue-400" />
            Tren Total Laporan Gangguan
          </h2>

          {/* Legenda Chart */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/30 px-2.5 py-1 rounded-lg">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-blue-500/30"></span>
              <span className="text-blue-300 font-semibold text-[11px]">Total Laporan Gangguan</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 px-2.5 py-1 rounded-lg text-slate-400 text-[11px]">
              <span>Kategori:</span>
              <span className="text-slate-200 font-semibold">
                {type === "ALL" ? "Semua (Desa & OPD)" : type === "L2TP" ? "Desa" : "OPD"}
              </span>
            </div>
          </div>
        </div>

        {/* SVG Line Chart */}
        {(() => {
          const chartW = 800;
          const chartH = 180;
          const padL = 40;
          const padR = 20;
          const padT = 20;
          const padB = 40;
          const innerW = chartW - padL - padR;
          const innerH = chartH - padT - padB;
          const maxVal = Math.max(...trend.map((t) => t.count), 1);
          const stepCount = trend.length > 1 ? trend.length - 1 : 1;
          const slotWidth = innerW / stepCount;

          const points = trend.map((item, i) => {
            const x = padL + (i / stepCount) * innerW;
            const countRatio = maxVal > 0 ? item.count / maxVal : 0;
            const y = padT + innerH - countRatio * innerH;
            return {
              x: isNaN(x) ? padL : x,
              y: isNaN(y) ? padT + innerH : y,
              ...item,
            };
          });

          const linePath = points
            .map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`)
            .join(" ");
          const areaPath =
            linePath +
            ` L${points[points.length - 1]?.x || padL},${padT + innerH} L${padL},${padT + innerH} Z`;

          // Y-axis grid lines (5 lines)
          const yGridLines = Array.from({ length: 5 }, (_, i) => {
            const val = Math.round((maxVal / 4) * i);
            const y = padT + innerH - (val / maxVal) * innerH;
            return { val, y };
          });

          // Sampling parameters for clean presentation regardless of data length
          const totalPoints = points.length;
          // Maximum number of X-axis labels to display (max ~8-10 evenly spaced labels)
          const maxLabels = totalPoints > 31 ? 8 : 10;
          const labelStep = Math.max(1, Math.ceil(totalPoints / maxLabels));

          // Maximum number of top numeric count indicators to display above line dots
          const maxCountLabels = totalPoints > 31 ? 10 : 14;
          const countStep = Math.max(1, Math.ceil(totalPoints / maxCountLabels));

          // Format function for date label
          const formatDateLabel = (item) => {
            const isMonthly = range === "1y" || (range === "all" && totalPoints > 365);
            if (isMonthly) return item.label;
            if (!item.label) return "";

            // Format YYYY-MM-DD to "DD MMM" (e.g. 15 Jan)
            const parts = item.label.split("-");
            if (parts.length === 3) {
              const mIndex = parseInt(parts[1], 10) - 1;
              const monthNames = [
                "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
                "Jul", "Agt", "Sep", "Okt", "Nov", "Des"
              ];
              return `${parseInt(parts[2], 10)} ${monthNames[mIndex] || parts[1]}`;
            }
            return item.label;
          };

          const formatHoverDate = (dateStr) => {
            if (!dateStr) return "-";
            const parts = dateStr.split("-");
            if (parts.length === 3) {
              const monthNames = [
                "Januari", "Februari", "Maret", "April", "Mei", "Juni",
                "Juli", "Agustus", "September", "Oktober", "November", "Desember"
              ];
              const mIdx = parseInt(parts[1], 10) - 1;
              return `${parseInt(parts[2], 10)} ${monthNames[mIdx] || parts[1]} ${parts[0]}`;
            }
            return dateStr;
          };

          const isTopPeak = hoveredPoint ? hoveredPoint.y < 60 : false;
          const isRightEdge = hoveredPoint ? hoveredPoint.x > chartW - 100 : false;
          const isLeftEdge = hoveredPoint ? hoveredPoint.x < 100 : false;

          const transformClass = `${isRightEdge ? "-translate-x-full" : isLeftEdge ? "translate-x-0" : "-translate-x-1/2"} ${isTopPeak ? "translate-y-3 mt-1" : "-translate-y-full mb-3"}`;

          return (
            <div className="relative overflow-visible group">
              {/* Floating Custom Interactive Hover Tooltip */}
              {hoveredPoint && (
                <div
                  className={`absolute pointer-events-none z-30 transition-all duration-150 transform ${transformClass}`}
                  style={{
                    left: `${(hoveredPoint.x / chartW) * 100}%`,
                    top: `${(hoveredPoint.y / chartH) * 100}%`,
                  }}
                >
                  <div className="bg-slate-950/95 border border-blue-500/50 rounded-xl px-3 py-2 text-xs shadow-2xl flex flex-col gap-1 min-w-[140px] backdrop-blur-md">
                    <div className="text-[11px] font-semibold text-slate-300 border-b border-slate-800 pb-1">
                      📅 {formatHoverDate(hoveredPoint.label)}
                    </div>
                    <div className="flex items-center gap-2 pt-0.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-blue-500/20 animate-pulse"></span>
                      <span className="font-bold text-blue-400 text-xs">
                        {hoveredPoint.count} Laporan
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <svg
                viewBox={`0 0 ${chartW} ${chartH}`}
                className="w-full h-auto min-h-[180px]"
                preserveAspectRatio="xMidYMid meet"
                onMouseLeave={() => setHoveredPoint(null)}
              >
                {/* Y-axis grid lines */}
                {yGridLines.map((line, i) => (
                  <g key={i}>
                    <line
                      x1={padL}
                      y1={line.y}
                      x2={chartW - padR}
                      y2={line.y}
                      stroke="#1e293b"
                      strokeWidth="1"
                    />
                    <text
                      x={padL - 6}
                      y={line.y + 3}
                      textAnchor="end"
                      fill="#64748b"
                      fontSize="9"
                    >
                      {line.val}
                    </text>
                  </g>
                ))}

                {/* Vertical Dashed Hover Guide Line */}
                {hoveredPoint && (
                  <line
                    x1={hoveredPoint.x}
                    y1={padT}
                    x2={hoveredPoint.x}
                    y2={padT + innerH}
                    stroke="#3b82f6"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                    opacity="0.8"
                  />
                )}

                {/* Gradient fill under line */}
                <defs>
                  <linearGradient
                    id="trendGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                    <stop
                      offset="100%"
                      stopColor="#3b82f6"
                      stopOpacity="0.02"
                    />
                  </linearGradient>
                </defs>
                {points.length > 1 && (
                  <path d={areaPath} fill="url(#trendGradient)" />
                )}

                {/* Line */}
                {points.length > 1 && (
                  <path
                    d={linePath}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Data points and invisible hover hit areas */}
                {points.map((p, i) => {
                  const isHovered = hoveredPoint?.label === p.label;
                  const isSampledDot = totalPoints <= 40 || i % labelStep === 0 || i === totalPoints - 1 || p.count > 0;
                  // Only show static count text numbers directly on line if range is <= 14 days
                  const showCount = totalPoints <= 14;

                  return (
                    <g key={i}>
                      {/* Transparent wide hover area */}
                      <rect
                        x={p.x - slotWidth / 2}
                        y={padT}
                        width={Math.max(slotWidth, 8)}
                        height={innerH}
                        fill="transparent"
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredPoint(p)}
                      />

                      {/* Dot circle */}
                      {(isSampledDot || isHovered) && (
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r={isHovered ? 6 : totalPoints > 50 ? 2.5 : 4}
                          fill={isHovered ? "#3b82f6" : "#1e293b"}
                          stroke="#3b82f6"
                          strokeWidth={isHovered ? 3 : totalPoints > 50 ? 1.5 : 2}
                          className="transition-all duration-150 pointer-events-none"
                        />
                      )}

                      {/* Count label on top of dot (only for small ranges <= 14 days) */}
                      {showCount && !isHovered && (
                        <text
                          x={p.x}
                          y={p.y - 8}
                          textAnchor="middle"
                          fill="#93c5fd"
                          fontSize="8"
                          fontWeight="600"
                          className="pointer-events-none"
                        >
                          {p.count}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* X-axis sampled labels */}
                {points.map((p, i) => {
                  const showLabel = i % labelStep === 0 || i === totalPoints - 1;
                  if (!showLabel) return null;

                  const formattedLabel = formatDateLabel(p);
                  const showYear = range === "custom" && startYear !== endYear;
                  const subLabel = showYear && p.label ? p.label.slice(0, 4) : "";

                  return (
                    <g key={`label-${i}`}>
                      <text
                        x={p.x}
                        y={padT + innerH + 16}
                        textAnchor="middle"
                        fill="#94a3b8"
                        fontSize="9"
                        fontWeight="500"
                      >
                        {formattedLabel}
                      </text>
                      {subLabel && (
                        <text
                          x={p.x}
                          y={padT + innerH + 26}
                          textAnchor="middle"
                          fill="#64748b"
                          fontSize="7"
                        >
                          {subLabel}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          );
        })()}
      </div>

      {/* Main Grid Content: Weekly Averages & Top Devices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Rata-rata Mingguan */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Calendar size={16} className="text-emerald-400" />
              Rata-rata Laporan Mingguan
            </h2>
            <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-lg text-[11px] font-medium text-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Rata-rata Laporan</span>
            </div>
          </div>
          <div className="flex items-end justify-between h-44 px-8 border-b border-slate-800/85 pt-4">
            {weeklyAverage.map((week, idx) => {
              const roundedAverage = Math.ceil(week.average);
              const percentHeight = Math.round(
                (week.average / maxWeeklyAverage) * 100,
              );
              return (
                <div
                  key={idx}
                  className="relative h-full flex flex-col items-center justify-end flex-1 group"
                >
                  {/* Count Label */}
                  <span className="text-[9px] font-bold text-emerald-300 mb-1">
                    {roundedAverage}
                  </span>
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-6 bg-slate-950/90 border border-slate-800 text-[10px] text-slate-300 rounded px-2.5 py-1 opacity-0 group-hover:opacity-100 transition pointer-events-none z-10 whitespace-nowrap">
                    Rata-rata: {roundedAverage} Laporan
                  </div>

                  {/* Bar Container */}
                  <div
                    className="w-10 bg-slate-800/60 rounded-t-sm relative overflow-hidden cursor-pointer"
                    style={{ height: `${Math.max(percentHeight, 4)}%` }}
                  >
                    <div className="absolute inset-0 bg-emerald-500/80 hover:bg-emerald-400 transition"></div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between px-8 text-center text-[10px] text-slate-500 font-medium h-16 pt-2">
            {weeklyAverage.map((w, idx) => (
              <div key={idx} className="flex-1">
                <span>{w.week}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chart 2: Top Laporan Perangkat/Sites Terbanyak - Column Chart */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Layers size={16} className="text-purple-400" />
              Top 10 Laporan Sites Terbanyak
            </h2>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-purple-500/10 border border-purple-500/30 px-2 py-0.5 rounded-lg text-[11px] font-medium text-purple-300">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                <span>Jumlah Laporan</span>
              </div>
              <Link
                href="/report/dashboard/sites"
                className="flex items-center gap-1 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition hover:scale-105 active:scale-95"
              >
                <span>Detail Laporan</span>
                <ChevronRight size={13} />
              </Link>
            </div>
          </div>
          {topDevices.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              Tidak ada data laporan gangguan
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {/* Column Chart */}
              <div className="flex items-end justify-between h-44 px-2 border-b border-slate-800/80 gap-2 pt-4">
                {topDevices.map((device, idx) => {
                  const percentHeight = Math.round(
                    (device.count / maxDeviceCount) * 100,
                  );
                  return (
                    <div
                      key={idx}
                      className="relative h-full flex flex-col items-center justify-end flex-1 group"
                    >
                      {/* Count Label */}
                      <span className="text-[9px] font-bold text-purple-300 mb-1">
                        {device.count}
                      </span>
                      {/* Bar */}
                      <div
                        className="w-full max-w-[32px] bg-slate-800 rounded-t-sm relative overflow-hidden cursor-pointer transition-all duration-500"
                        style={{ height: `${Math.max(percentHeight, 5)}%` }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-t from-purple-600/80 to-purple-400/90 hover:from-purple-500 hover:to-purple-300 transition"></div>
                      </div>
                      {/* Tooltip */}
                      <div className="absolute bottom-full mb-6 bg-slate-950/95 border border-slate-700 text-[10px] text-slate-200 rounded-lg px-2.5 py-1.5 opacity-0 group-hover:opacity-100 transition pointer-events-none z-20 whitespace-nowrap shadow-xl">
                        {device.name}:{" "}
                        <span className="font-bold text-purple-300">
                          {device.count}
                        </span>{" "}
                        Laporan
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Labels - Rotated */}
              <div className="flex justify-between px-2 gap-2 h-16">
                {topDevices.map((device, idx) => (
                  <div
                    key={idx}
                    className="flex-1 flex justify-center min-w-0 relative"
                  >
                    <span
                      className="text-[9px] text-slate-400 font-medium absolute top-1 whitespace-nowrap origin-top-left"
                      style={{
                        transform: "rotate(-40deg)",
                        transformOrigin: "top center",
                      }}
                      title={device.name}
                    >
                      {device.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chart 3: Top 10 Kendala/Issue - Horizontal Bar Chart */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-400" />
          Top 10 Kendala Terbanyak
          <span className="ml-auto text-[10px] text-slate-500 font-normal">
            Berdasarkan field Issue pada laporan
          </span>
        </h2>

        {!topIssues || topIssues.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            Tidak ada data kendala / issue
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {topIssues.map((item, idx) => {
              const pct = Math.round((item.count / maxIssueCount) * 100);
              const colors = [
                "from-rose-600 via-red-600 to-rose-500", // Rank 1 (Paling Merah di paling atas)
                "from-red-600 to-red-500",               // Rank 2 (Merah Terang)
                "from-red-500 to-rose-500",              // Rank 3 (Merah-Rose)
                "from-rose-500 to-orange-500",           // Rank 4 (Merah-Oranye)
                "from-orange-500 to-amber-500",          // Rank 5 (Oranye)
                "from-amber-500 to-amber-400",           // Rank 6 (Amber)
                "from-amber-400 to-yellow-500",          // Rank 7 (Kuning-Amber)
                "from-yellow-500 to-yellow-600",         // Rank 8 (Kuning)
                "from-yellow-600 to-slate-500",          // Rank 9 (Kuning-Kelu-Abu)
                "from-slate-500 to-slate-600",            // Rank 10 (Abu-abu)
              ];
              const color = colors[idx % colors.length];
              const countColor = idx === 0 ? "text-rose-400 font-extrabold" : idx === 1 ? "text-red-400 font-bold" : "text-amber-300";
              return (
                <div key={idx} className="flex items-center gap-3 group">
                  {/* Rank */}
                  <span className="text-[10px] font-bold text-slate-500 w-4 text-right flex-shrink-0">
                    {idx + 1}
                  </span>
                  {/* Label */}
                  <span
                    className="text-[11px] text-slate-300 truncate flex-shrink-0 w-52"
                    title={item.issue}
                  >
                    {item.issue}
                  </span>
                  {/* Bar */}
                  <div className="flex-1 relative bg-slate-800/60 rounded-full h-4 overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700`}
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                  {/* Count */}
                  <span className={`text-[11px] font-bold ${countColor} w-8 text-right flex-shrink-0`}>
                    {item.count}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
