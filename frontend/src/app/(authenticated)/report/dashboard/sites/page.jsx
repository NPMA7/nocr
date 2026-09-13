"use client";
import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import {
  ArrowLeft,
  Search,
  Building,
  BarChart2,
  RefreshCw,
  Calendar,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  LayoutGrid,
  Activity,
  Eye,
  X,
  Clock,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Layers,
  Copy,
  Check,
  Flame,
} from "lucide-react";
import Link from "next/link";

export default function SitesReportDetailPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [type, setType] = useState("ALL"); // ALL, L2TP, PPPOE
  const [range, setRange] = useState("7d"); // 7d, 1m, 1y, all, custom
  const [startMonth, setStartMonth] = useState(() => new Date().getMonth() + 1);
  const [startYear, setStartYear] = useState(() => new Date().getFullYear());
  const [endMonth, setEndMonth] = useState(() => new Date().getMonth() + 1);
  const [endYear, setEndYear] = useState(() => new Date().getFullYear());

  // Search & Chart Limit & View Mode
  const [searchTerm, setSearchTerm] = useState("");
  const [heatmapSearchTerm, setHeatmapSearchTerm] = useState("");
  const [chartLimit, setChartLimit] = useState(10); // 10, 15, 25, 50, all
  const [chartViewMode, setChartViewMode] = useState("column"); // "column" | "heatmap"

  // Table Pagination & Page Size (15, 50, 100, all)
  const [pageSize, setPageSize] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);

  // Modal State for Case Details
  const [selectedSiteForCases, setSelectedSiteForCases] = useState(null);
  const [modalSearchTerm, setModalSearchTerm] = useState("");
  const [copiedMac, setCopiedMac] = useState(null);

  const formatTimeWIB = (isoString) => {
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

  const handleCopyMac = (mac, e) => {
    if (e) e.stopPropagation();
    if (typeof navigator !== "undefined" && navigator.clipboard && mac) {
      navigator.clipboard.writeText(mac);
      setCopiedMac(mac);
      setTimeout(() => setCopiedMac(null), 1800);
    }
  };

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/reports/summary?type=${type}&range=${range}`;
      if (range === "custom") {
        url += `&startMonth=${startMonth}&startYear=${startYear}&endMonth=${endMonth}&endYear=${endYear}`;
      }
      const res = await axios.get(url);
      setData(res.data);
    } catch (err) {
      console.error("Gagal memuat rekapitulasi data sites:", err);
      setError(err.response?.data?.error || err.message || "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [type, range, startMonth, startYear, endMonth, endYear]);

  // Reset pagination on filter or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, pageSize, type, range]);

  const allDevices = useMemo(
    () => (Array.isArray(data?.allDevices) ? data.allDevices : []),
    [data]
  );
  const totalReportsCount = data?.stats?.totalReports || 0;

  // Filtered by search term for Table
  const filteredSites = useMemo(() => {
    return allDevices.filter((item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.mac && item.mac.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [allDevices, searchTerm]);

  // Filtered for Heatmap Search
  const heatmapSites = useMemo(() => {
    if (!heatmapSearchTerm.trim()) return allDevices;
    const q = heatmapSearchTerm.toLowerCase();
    return allDevices.filter((item) =>
      item.name.toLowerCase().includes(q) ||
      (item.mac && item.mac.toLowerCase().includes(q))
    );
  }, [allDevices, heatmapSearchTerm]);

  const apDesa = data?.stats?.totalApDesa ?? 280;
  const apOpd = data?.stats?.totalApOpd ?? 130;
  const apAll = data?.stats?.totalApAll ?? (apDesa + apOpd);

  // Computed Quick KPIs
  const impactedDesa = allDevices.filter((d) => d.type === "L2TP").length;
  const impactedOpd = allDevices.filter((d) => d.type === "PPPOE").length;
  const topSite = allDevices[0] || null;
  const avgCasesPerSite = allDevices.length > 0 ? (totalReportsCount / allDevices.length).toFixed(1) : "0";

  let tableTitleText = `Tabel Rincian Seluruh Sites (${filteredSites.length})`;
  if (type === "ALL") {
    tableTitleText = `Tabel Rincian Seluruh Sites (${filteredSites.length} / ${apAll} Sites)`;
  } else if (type === "L2TP") {
    tableTitleText = `Tabel Rincian Seluruh Sites Desa (${filteredSites.length} / ${apDesa} Sites)`;
  } else if (type === "PPPOE") {
    tableTitleText = `Tabel Rincian Seluruh Sites OPD (${filteredSites.length} / ${apOpd} Sites)`;
  }

  // Pagination Math
  const totalFilteredCount = filteredSites.length;
  const isAllPages = pageSize === "all";
  const effectivePageSize = isAllPages ? totalFilteredCount : Number(pageSize);
  const totalPages = Math.max(
    Math.ceil(totalFilteredCount / (effectivePageSize || 1)),
    1
  );

  const startIndex = isAllPages ? 0 : (currentPage - 1) * effectivePageSize;
  const endIndex = isAllPages
    ? totalFilteredCount
    : Math.min(startIndex + effectivePageSize, totalFilteredCount);

  const paginatedSites = filteredSites.slice(startIndex, endIndex);

  // Dynamic Chart Limit Sites
  const chartSites =
    chartLimit === "all"
      ? allDevices
      : allDevices.slice(0, Number(chartLimit));

  const maxCount = Math.max(...allDevices.map((d) => d.count), 1);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  const getPeriodLabelText = () => {
    if (range === "7d") return "7 Hari Terakhir";
    if (range === "1m") return "1 Bulan Terakhir";
    if (range === "1y") return "1 Tahun Terakhir";
    if (range === "all") return "Semua Waktu";
    if (range === "custom") {
      return `${monthNames[startMonth - 1] || startMonth} ${startYear} - ${monthNames[endMonth - 1] || endMonth} ${endYear}`;
    }
    return "Periode";
  };

  return (
    <div className="p-4 sm:p-6 lg:p-7 flex flex-col gap-6 w-full min-h-screen text-slate-100 pb-16 font-sans">
      {/* ─── Top Header & Navigation ──────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="flex flex-col gap-2">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Link
              href="/report/dashboard"
              className="hover:text-sky-400 flex items-center gap-1.5 transition font-medium text-slate-400"
            >
              <ArrowLeft size={13} />
              <span>Dashboard Laporan</span>
            </Link>
            <ChevronRight size={12} className="text-slate-600" />
            <span className="text-sky-400 font-semibold">Rekap Laporan Sites</span>
          </div>

          <div>
            <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
              <Building className="text-sky-400" size={24} />
              <span>Rekapitulasi Insiden Per Lokasi / Site</span>
              <span className="text-xs font-mono font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2.5 py-0.5 rounded-full">
                {allDevices.length} Sites Terdampak
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Data statistik akumulasi insiden gangguan jaringan per lokasi kantor OPD dan wilayah desa
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2.5">
          <Link
            href="/report/dashboard"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-200 rounded-lg text-xs font-semibold transition cursor-pointer shadow-sm"
          >
            <ArrowLeft size={13} />
            <span>Ke Dashboard Laporan</span>
          </Link>
        </div>
      </div>

      {/* ─── Unified Sleek Filter Toolbar ─────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/80 border border-slate-800/90 rounded-xl p-3 sm:p-3.5 shadow-sm backdrop-blur-sm">
        {/* Category Switcher Buttons */}
        <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800/90 gap-1 text-xs font-medium">
          {[
            { id: "ALL", label: "Semua", count: apAll },
            { id: "L2TP", label: "Desa", count: apDesa },
            { id: "PPPOE", label: "OPD", count: apOpd },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setType(t.id)}
              className={`cursor-pointer px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                type === t.id
                  ? t.id === "PPPOE"
                    ? "tag-opd shadow-md font-bold"
                    : t.id === "L2TP"
                    ? "tag-desa shadow-md font-bold"
                    : "bg-sky-600 text-white shadow-md font-bold"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
            >
              <span>{t.label}</span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                  type === t.id
                    ? "bg-black/20 text-white"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Time Range Select Dropdown */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Calendar
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-sky-400 pointer-events-none"
            />
            <select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="cursor-pointer appearance-none bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-200 text-xs font-semibold pl-9 pr-8 py-1.5 rounded-lg focus:outline-none focus:border-sky-500 transition shadow-sm"
            >
              <option value="7d">7 Hari Terakhir</option>
              <option value="1m">1 Bulan Terakhir</option>
              <option value="1y">1 Tahun Terakhir</option>
              <option value="all">Semua Waktu</option>
              <option value="custom">Kustom</option>
            </select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[10px]">
              ▼
            </span>
          </div>

          <div className="text-[11px] font-mono text-slate-400 hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-slate-950/60 border border-slate-800/80 rounded-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
            <span>Periode: <strong className="text-slate-200">{getPeriodLabelText()}</strong></span>
          </div>
        </div>

        {/* Custom Month Picker */}
        {range === "custom" && (
          <div className="w-full flex flex-wrap items-center gap-4 pt-3 border-t border-slate-800/80 bg-slate-950/60 p-3 rounded-lg text-xs text-slate-300 font-medium">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-sky-400" />
              <span>Dari:</span>
              <select
                value={startMonth}
                onChange={(e) => setStartMonth(Number(e.target.value))}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-sky-500 cursor-pointer"
              >
                {monthNames.map((m, idx) => (
                  <option key={idx} value={idx + 1}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                value={startYear}
                onChange={(e) => setStartYear(Number(e.target.value))}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-sky-500 cursor-pointer"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span>Hingga:</span>
              <select
                value={endMonth}
                onChange={(e) => setEndMonth(Number(e.target.value))}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-sky-500 cursor-pointer"
              >
                {monthNames.map((m, idx) => (
                  <option key={idx} value={idx + 1}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                value={endYear}
                onChange={(e) => setEndYear(Number(e.target.value))}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-sky-500 cursor-pointer"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
          <RefreshCw size={28} className="animate-spin text-sky-400" />
          <span className="text-xs font-semibold tracking-wider font-mono uppercase text-slate-400">
            Memuat Rekapitulasi Sites...
          </span>
        </div>
      ) : error ? (
        <div className="py-12 bg-rose-500/10 border border-rose-500/30 rounded-xl p-6 text-center text-rose-300 flex flex-col items-center gap-3">
          <AlertTriangle size={32} className="text-rose-400" />
          <p className="font-semibold text-sm">{error}</p>
          <button
            onClick={() => fetchSummary()}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs font-medium transition cursor-pointer"
          >
            Coba Lagi
          </button>
        </div>
      ) : (
        <>
          {/* ─── 4 Executive KPI Metric Cards ────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Card 1: Total Insiden */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 sm:p-4 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                  Total Insiden
                </span>
                <div className="p-1.5 bg-sky-500/10 text-sky-400 rounded-md">
                  <AlertTriangle size={14} />
                </div>
              </div>
              <div className="mt-2.5">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-sky-400 font-mono">
                    {totalReportsCount}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">kasus</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 truncate">
                  Periode {getPeriodLabelText()}
                </p>
              </div>
            </div>

            {/* Card 2: Sites Terdampak */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 sm:p-4 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Sites Terdampak
                </span>
                <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-md">
                  <Building size={14} />
                </div>
              </div>
              <div className="mt-2.5">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-emerald-400 font-mono">
                    {allDevices.length}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    / {type === "L2TP" ? apDesa : type === "PPPOE" ? apOpd : apAll} sites
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 truncate">
                  {impactedDesa} Desa • {impactedOpd} OPD
                </p>
              </div>
            </div>

            {/* Card 3: Frekuensi Tertinggi */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 sm:p-4 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Flame size={12} className="text-amber-400" />
                  Insiden Tertinggi
                </span>
                <div className="p-1.5 bg-amber-500/10 text-amber-400 rounded-md">
                  <TrendingUp size={14} />
                </div>
              </div>
              <div className="mt-2.5">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-amber-400 font-mono">
                    {topSite?.count || 0}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">kasus</span>
                </div>
                <p className="text-[11px] text-slate-300 font-medium mt-1 truncate" title={topSite?.name || "-"}>
                  {topSite?.name || "Tidak ada gangguan"}
                </p>
              </div>
            </div>

            {/* Card 4: Rata-rata per Site */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 sm:p-4 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  Rata-rata / Site
                </span>
                <div className="p-1.5 bg-blue-500/10 text-blue-400 rounded-md">
                  <Activity size={14} />
                </div>
              </div>
              <div className="mt-2.5">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-blue-400 font-mono">
                    {avgCasesPerSite}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">kasus / site</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 truncate">
                  Dari {allDevices.length} lokasi terdampak
                </p>
              </div>
            </div>
          </div>

          {/* ─── Dual View Chart Container: Column Chart vs Compact Heatmap ─── */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col gap-4 shadow-xl backdrop-blur-sm">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 flex-wrap gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <BarChart2 size={16} className="text-sky-400" />
                  Visualisasi Distribusi Insiden Per Lokasi
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {chartViewMode === "column"
                    ? `Grafik Komparasi Frekuensi Kasus (${chartLimit === "all" ? `Semua ${allDevices.length} Sites` : `Top ${chartLimit} Sites`})`
                    : `Matriks Heatmap (${allDevices.length} Sites terdata)`}
                </p>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {/* View Mode Switcher */}
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                  <button
                    onClick={() => setChartViewMode("column")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition cursor-pointer font-semibold ${
                      chartViewMode === "column"
                        ? "bg-sky-600 text-white shadow"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <BarChart2 size={13} />
                    <span>Grafik Kolom</span>
                  </button>

                  <button
                    onClick={() => setChartViewMode("heatmap")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition cursor-pointer font-semibold ${
                      chartViewMode === "heatmap"
                        ? "bg-sky-600 text-white shadow"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <LayoutGrid size={13} />
                    <span>Matriks Heatmap</span>
                  </button>
                </div>

                {/* Show Limit Filter for Column Chart */}
                {chartViewMode === "column" && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400">Tampilkan:</span>
                    <select
                      value={chartLimit}
                      onChange={(e) => setChartLimit(e.target.value === "all" ? "all" : Number(e.target.value))}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-sky-500 text-xs cursor-pointer font-medium"
                    >
                      <option value={10}>Top 10 Sites</option>
                      <option value={15}>Top 15 Sites</option>
                      <option value={25}>Top 25 Sites</option>
                      <option value={50}>Top 50 Sites</option>
                      <option value="all">Semua Sites ({allDevices.length})</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* VIEW MODE 1: COLUMN CHART */}
            {chartViewMode === "column" && (
              <>
                {chartSites.length === 0 ? (
                  <div className="py-16 text-center text-slate-500 text-xs">
                    Tidak ada data laporan gangguan pada periode ini
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {/* Desktop & Tablet Column Layout */}
                    <div className="hidden sm:block overflow-x-auto custom-scrollbar pb-2">
                      <div
                        className="flex items-end justify-between h-52 px-3 border-b border-slate-800/80 gap-3 pt-6 min-w-full"
                        style={{
                          minWidth: chartSites.length > 12 ? `${chartSites.length * 64}px` : "100%",
                        }}
                      >
                        {chartSites.map((site, idx) => {
                          const percentHeight = Math.round((site.count / maxCount) * 100);
                          const percentage = totalReportsCount > 0 ? ((site.count / totalReportsCount) * 100).toFixed(1) : "0.0";
                          const isTop3 = idx < 3;

                          return (
                            <div
                              key={idx}
                              onClick={() => setSelectedSiteForCases(site)}
                              className="relative h-full flex flex-col items-center justify-end flex-1 group cursor-pointer"
                            >
                              {/* Top Count Label */}
                              <span
                                className={`text-[11px] font-mono font-bold mb-1.5 transition-transform group-hover:scale-110 ${
                                  idx === 0
                                    ? "text-amber-400"
                                    : idx === 1
                                    ? "text-sky-300"
                                    : idx === 2
                                    ? "text-cyan-300"
                                    : "text-sky-400"
                                }`}
                              >
                                {site.count}
                              </span>

                              {/* Hover Tooltip Card */}
                              <div className="absolute bottom-full mb-8 bg-slate-950 border border-slate-800 text-[11px] rounded-xl px-3.5 py-2.5 opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-40 whitespace-nowrap shadow-2xl backdrop-blur-md flex flex-col gap-1">
                                <div className="font-bold text-xs text-slate-100">
                                  {site.name}
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                  <span className={`px-1.5 py-0.2 rounded font-bold ${site.type === "PPPOE" ? "tag-opd" : "tag-desa"}`}>
                                    {site.type === "PPPOE" ? "OPD" : "Desa"}
                                  </span>
                                  <span>•</span>
                                  <span className="font-bold text-slate-200">
                                    {site.count} Kasus ({percentage}%)
                                  </span>
                                </div>
                                <div className="text-[9px] font-semibold text-sky-400 mt-0.5">
                                  Klik untuk rincian insiden
                                </div>
                              </div>

                              {/* Vertical Column Bar */}
                              <div
                                className="w-full max-w-[28px] bg-slate-950 rounded-t-md relative overflow-hidden border-t border-x border-slate-800 group-hover:border-sky-400 transition-all duration-300"
                                style={{ height: `${Math.max(percentHeight, 5)}%` }}
                              >
                                <div
                                  className={`absolute inset-0 transition-opacity ${
                                    idx === 0
                                      ? "bg-gradient-to-t from-amber-600/70 to-amber-400 group-hover:opacity-90"
                                      : idx === 1
                                      ? "bg-gradient-to-t from-sky-600/70 to-sky-400 group-hover:opacity-90"
                                      : idx === 2
                                      ? "bg-gradient-to-t from-cyan-600/70 to-cyan-400 group-hover:opacity-90"
                                      : "bg-gradient-to-t from-sky-700/60 to-sky-500/90 group-hover:from-sky-600 group-hover:to-sky-400"
                                  }`}
                                ></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Clean Labels Under Columns */}
                      <div
                        className="flex justify-between px-3 gap-3 pt-2 pb-2 min-w-full"
                        style={{
                          minWidth: chartSites.length > 12 ? `${chartSites.length * 64}px` : "100%",
                        }}
                      >
                        {chartSites.map((site, idx) => (
                          <div
                            key={idx}
                            onClick={() => setSelectedSiteForCases(site)}
                            className="flex-1 flex flex-col items-center justify-start text-center min-w-0 cursor-pointer group"
                          >
                            <span className="text-[9px] font-mono font-bold text-slate-500 mb-0.5">
                              #{idx + 1}
                            </span>
                            <span
                              className="text-[10px] text-slate-300 font-medium line-clamp-2 leading-tight group-hover:text-sky-300 transition"
                              title={site.name}
                            >
                              {site.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Mobile Column View: Clean Stacked Horizontal Ranking */}
                    <div className="flex sm:hidden flex-col gap-2">
                      {chartSites.slice(0, 15).map((site, idx) => {
                        const percent = Math.round((site.count / maxCount) * 100);
                        const percentage = totalReportsCount > 0 ? ((site.count / totalReportsCount) * 100).toFixed(1) : "0.0";
                        return (
                          <div
                            key={idx}
                            onClick={() => setSelectedSiteForCases(site)}
                            className="flex flex-col gap-1.5 p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 cursor-pointer active:bg-slate-800"
                          >
                            <div className="flex items-center justify-between gap-2 min-w-0">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-[10px] font-mono font-bold text-slate-500 w-5">
                                  #{idx + 1}
                                </span>
                                <span className="text-xs font-semibold text-slate-200 truncate">
                                  {site.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${site.type === "PPPOE" ? "tag-opd" : "tag-desa"}`}>
                                  {site.type === "PPPOE" ? "OPD" : "Desa"}
                                </span>
                                <span className="text-xs font-bold text-sky-400 font-mono">
                                  {site.count} kasus
                                </span>
                              </div>
                            </div>
                            <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-sky-600 to-cyan-400"
                                style={{ width: `${Math.max(percent, 4)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* VIEW MODE 2: COMPACT HEATMAP MATRIX GRID */}
            {chartViewMode === "heatmap" && (
              <div className="flex flex-col gap-3">
                {/* Heatmap Controls & Legend */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/70 p-3 rounded-lg border border-slate-800 text-xs">
                  {/* Heatmap Search */}
                  <div className="relative w-full sm:w-64">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Cari lokasi di matriks..."
                      value={heatmapSearchTerm}
                      onChange={(e) => setHeatmapSearchTerm(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-7 py-1 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                    />
                    {heatmapSearchTerm && (
                      <button
                        onClick={() => setHeatmapSearchTerm("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {/* Legend Indicator */}
                  <div className="flex items-center gap-3.5 flex-wrap text-[11px]">
                    <span className="font-semibold text-slate-400">Intensitas:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded bg-rose-600 border border-rose-500 shadow-sm"></span>
                      <span className="text-slate-300">Tinggi (≥5)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded bg-amber-500/80 border border-amber-500/90"></span>
                      <span className="text-slate-300">Sedang (3-4)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded bg-slate-800 border border-slate-700"></span>
                      <span className="text-slate-400">Rendah (1-2)</span>
                    </div>
                  </div>
                </div>

                {heatmapSites.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 text-xs">
                    Tidak ada lokasi yang cocok dengan filter pencarian
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2 max-h-[480px] overflow-y-auto custom-scrollbar p-1">
                    {heatmapSites.map((site, idx) => {
                      const count = site.count;
                      const percentage = totalReportsCount > 0 ? ((count / totalReportsCount) * 100).toFixed(1) : "0.0";
                      const isHigh = count >= 5;
                      const isMedium = count >= 3 && count < 5;

                      return (
                        <div
                          key={idx}
                          onClick={() => setSelectedSiteForCases(site)}
                          className={`relative p-2.5 rounded-lg border transition-all cursor-pointer group flex flex-col justify-between h-[72px] shadow-sm ${
                            isHigh
                              ? "bg-rose-950/40 border-rose-600/60 text-slate-100 hover:bg-rose-900/50 hover:border-rose-500"
                              : isMedium
                              ? "bg-amber-950/30 border-amber-600/40 text-slate-200 hover:bg-amber-900/40 hover:border-amber-500"
                              : "bg-slate-950/70 border-slate-800/80 text-slate-300 hover:bg-slate-850 hover:border-slate-700"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <span
                              className="text-[10px] font-semibold line-clamp-2 leading-tight group-hover:text-sky-300 transition"
                              title={site.name}
                            >
                              {site.name}
                            </span>
                            <span
                              className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded shrink-0 ${
                                isHigh
                                  ? "bg-rose-600 text-white"
                                  : isMedium
                                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                  : "bg-slate-800 text-slate-300"
                              }`}
                            >
                              {count}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[9px] mt-1 pt-1 border-t border-slate-800/50">
                            <span className={`px-1 py-0.2 rounded font-bold ${site.type === "PPPOE" ? "tag-opd" : "tag-desa"}`}>
                              {site.type === "PPPOE" ? "OPD" : "Desa"}
                            </span>
                            <span className="font-mono text-slate-400">
                              {percentage}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ─── Detailed Data Table Section ─────────────────────────── */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col gap-4 shadow-xl backdrop-blur-sm">
            {/* Table Header Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Layers size={16} className="text-sky-400" />
                  {tableTitleText}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Daftar terperinci akumulasi kasus laporan gangguan per lokasi
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Search Input */}
                <div className="relative w-full sm:w-64">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                  />
                  <input
                    type="text"
                    placeholder="Cari nama site atau MAC..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-8 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-sky-500 transition shadow-inner"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Page Size Select */}
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-400">Baris:</span>
                  <select
                    value={pageSize}
                    onChange={(e) =>
                      setPageSize(
                        e.target.value === "all" ? "all" : Number(e.target.value)
                      )
                    }
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-sky-500 text-xs cursor-pointer font-medium"
                  >
                    <option value={15}>15 Per Halaman</option>
                    <option value={50}>50 Per Halaman</option>
                    <option value={100}>100 Per Halaman</option>
                    <option value="all">Semua ({filteredSites.length})</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Responsive Table */}
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 text-[11px] uppercase font-bold tracking-wider font-mono">
                    <th className="py-3 px-3.5 w-12 text-center">No</th>
                    <th className="py-3 px-4">Nama Site / Lokasi</th>
                    <th className="py-3 px-3.5">Kategori Tipe</th>
                    <th className="py-3 px-4">Distribusi Rasio</th>
                    <th className="py-3 px-4 text-center">Total Kasus</th>
                    <th className="py-3 px-4 text-right">Aksi Pintas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {paginatedSites.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-16 text-center text-slate-500 text-xs"
                      >
                        {searchTerm
                          ? `Tidak ada site yang cocok dengan kata kunci "${searchTerm}"`
                          : "Tidak ada data lokasi."}
                      </td>
                    </tr>
                  ) : (
                    paginatedSites.map((site, index) => {
                      const absoluteIndex = startIndex + index + 1;
                      const percentage =
                        totalReportsCount > 0
                          ? ((site.count / totalReportsCount) * 100).toFixed(1)
                          : "0.0";
                      const isDesa = site.type === "L2TP";
                      const isTop3 = absoluteIndex <= 3;

                      return (
                        <tr
                          key={site.name + index}
                          className="hover:bg-slate-850/50 transition group"
                        >
                          {/* Number */}
                          <td className="py-3.5 px-3.5 text-center font-mono text-[11px]">
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded font-bold ${
                                absoluteIndex === 1
                                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                  : absoluteIndex === 2
                                  ? "bg-slate-700/40 text-slate-200 border border-slate-600/40"
                                  : absoluteIndex === 3
                                  ? "bg-amber-700/20 text-amber-400 border border-amber-700/30"
                                  : "text-slate-500"
                              }`}
                            >
                              {absoluteIndex}
                            </span>
                          </td>

                          {/* Site Name & MAC */}
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col">
                              <span
                                onClick={() => setSelectedSiteForCases(site)}
                                className="font-semibold text-slate-100 group-hover:text-sky-300 transition cursor-pointer"
                              >
                                {site.name}
                              </span>
                              {site.mac && (
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[10px] text-slate-500 font-mono tracking-tight">
                                    {site.mac}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => handleCopyMac(site.mac, e)}
                                    className="text-slate-600 hover:text-slate-300 transition cursor-pointer"
                                    title="Salin MAC Address"
                                  >
                                    {copiedMac === site.mac ? (
                                      <Check size={11} className="text-emerald-400" />
                                    ) : (
                                      <Copy size={11} />
                                    )}
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Category Type */}
                          <td className="py-3.5 px-3.5">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                                site.type === "PPPOE"
                                  ? "tag-opd"
                                  : site.type === "L2TP"
                                  ? "tag-desa"
                                  : "bg-slate-800 text-slate-400 border-slate-700"
                              }`}
                            >
                              {site.type === "PPPOE"
                                ? "OPD"
                                : site.type === "L2TP"
                                ? "DESA"
                                : site.type}
                            </span>
                          </td>

                          {/* Distribution Ratio Percentage */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5 max-w-[140px]">
                              <div className="flex-1 bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                                <div
                                  className="bg-gradient-to-r from-sky-600 to-cyan-400 h-full rounded-full"
                                  style={{
                                    width: `${Math.min(
                                      (site.count / maxCount) * 100,
                                      100
                                    )}%`,
                                  }}
                                ></div>
                              </div>
                              <span className="text-slate-300 font-mono text-[11px] font-semibold w-10 text-right">
                                {percentage}%
                              </span>
                            </div>
                          </td>

                          {/* Total Cases Button */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => setSelectedSiteForCases(site)}
                              className="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 hover:border-sky-500/50 text-sky-400 hover:text-sky-300 font-bold rounded-lg text-xs font-mono transition cursor-pointer shadow-sm group/btn"
                              title="Klik untuk melihat rincian laporan kasus"
                            >
                              <span>{site.count} Laporan</span>
                              <Eye size={12} className="group-hover/btn:scale-110 transition-transform" />
                            </button>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            {site.mac && !site.mac.startsWith("MANUAL_") ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <Link
                                  href={`/monitoring/${isDesa ? "desa" : "opd"}/traffic/${encodeURIComponent(site.mac)}`}
                                  className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 px-2.5 py-1 rounded-md transition"
                                  title="Lihat Traffic Monitoring Site"
                                >
                                  <Activity size={12} />
                                  <span>Traffic</span>
                                </Link>
                                <Link
                                  href={`/sites/${isDesa ? "desa" : "opd"}/${encodeURIComponent(site.mac)}`}
                                  className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-400 hover:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 px-2.5 py-1 rounded-md transition"
                                  title="Lihat Detail Site"
                                >
                                  <span>Detail</span>
                                  <ExternalLink size={12} />
                                </Link>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-500 italic">
                                Perangkat manual
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Pagination Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-800 text-xs text-slate-400">
              <div>
                {totalFilteredCount > 0 ? (
                  <span>
                    Menampilkan <strong className="text-slate-200">{startIndex + 1}</strong> –{" "}
                    <strong className="text-slate-200">{endIndex}</strong> dari{" "}
                    <strong className="text-slate-200">{totalFilteredCount}</strong> lokasi
                  </span>
                ) : (
                  <span>Tidak ada data lokasi</span>
                )}
              </div>

              {!isAllPages && totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 hover:text-white hover:bg-slate-850 disabled:opacity-30 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft size={14} />
                    <span>Sebelumnya</span>
                  </button>

                  <div className="flex items-center gap-1 px-2 font-mono">
                    <span className="text-sky-400 font-bold">{currentPage}</span>
                    <span className="text-slate-600">/</span>
                    <span className="text-slate-400">{totalPages}</span>
                  </div>

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 hover:text-white hover:bg-slate-850 disabled:opacity-30 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer"
                  >
                    <span>Selanjutnya</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ─── Case Details Modal ──────────────────────────────────── */}
          {selectedSiteForCases && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col max-h-[88vh] w-full max-w-4xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
                {/* Modal Header */}
                <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-4 bg-slate-950/60">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                          selectedSiteForCases.type === "PPPOE" ? "tag-opd" : "tag-desa"
                        }`}
                      >
                        {selectedSiteForCases.type === "PPPOE" ? "OPD" : "Desa"}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">Rincian Riwayat Insiden</span>
                    </div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                      <Building className="text-sky-400" size={20} />
                      <span>{selectedSiteForCases.name}</span>
                    </h2>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span className="px-3 py-1 bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-bold rounded-lg font-mono">
                      {selectedSiteForCases.count} Kasus
                    </span>
                    <button
                      onClick={() => {
                        setSelectedSiteForCases(null);
                        setModalSearchTerm("");
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                      title="Tutup Dialog"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* Modal Toolbar */}
                <div className="px-4 sm:px-5 py-3 border-b border-slate-800 bg-slate-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-sm">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Cari indikasi issue atau tindakan..."
                      value={modalSearchTerm}
                      onChange={(e) => setModalSearchTerm(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  {selectedSiteForCases.mac && !selectedSiteForCases.mac.startsWith("MANUAL_") && (
                    <Link
                      href={`/monitoring/${selectedSiteForCases.type === "L2TP" ? "desa" : "opd"}/traffic/${encodeURIComponent(selectedSiteForCases.mac)}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-semibold transition cursor-pointer w-fit"
                    >
                      <Activity size={13} />
                      <span>Buka Traffic Monitoring</span>
                    </Link>
                  )}
                </div>

                {/* Modal Body Table */}
                <div className="p-4 sm:p-5 overflow-y-auto flex-1 custom-scrollbar">
                  {(!selectedSiteForCases.reports || selectedSiteForCases.reports.length === 0) ? (
                    <div className="py-16 text-center text-slate-500 text-xs">
                      Tidak ada detail rincian laporan pada periode ini.
                    </div>
                  ) : (
                    <div className="overflow-x-auto custom-scrollbar">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 text-[11px] uppercase font-bold tracking-wider font-mono">
                            <th className="py-2.5 px-3 w-10 text-center">No</th>
                            <th className="py-2.5 px-3">Waktu Offline</th>
                            <th className="py-2.5 px-3">Waktu Online Kembali</th>
                            <th className="py-2.5 px-3 text-center">Status</th>
                            <th className="py-2.5 px-3">Indikasi Kendala</th>
                            <th className="py-2.5 px-3">Tindakan Penanganan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 text-xs">
                          {selectedSiteForCases.reports
                            .filter((r) => {
                              if (!modalSearchTerm) return true;
                              const q = modalSearchTerm.toLowerCase();
                              return (
                                (r.issue && r.issue.toLowerCase().includes(q)) ||
                                (r.tindakan && r.tindakan.toLowerCase().includes(q)) ||
                                (r.report_date && r.report_date.includes(q))
                              );
                            })
                            .map((rep, idx) => (
                              <tr key={rep.id || idx} className="hover:bg-slate-850/40 transition">
                                <td className="py-3 px-3 text-center font-mono text-slate-500">
                                  {idx + 1}
                                </td>
                                <td className="py-3 px-3 font-mono text-slate-200">
                                  {formatTimeWIB(rep.offline_since)}
                                </td>
                                <td className="py-3 px-3 font-mono text-slate-300">
                                  {formatTimeWIB(rep.online_since)}
                                </td>
                                <td className="py-3 px-3 text-center">
                                  <span
                                    className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border ${
                                      rep.status_progress === "Progress"
                                        ? "bg-rose-500/10 text-rose-300 border-rose-500/30"
                                        : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                                    }`}
                                  >
                                    {rep.status_progress === "Progress" ? (
                                      <Clock size={10} className="animate-pulse" />
                                    ) : (
                                      <CheckCircle2 size={10} />
                                    )}
                                    <span>{rep.status_progress || "Progress"}</span>
                                  </span>
                                </td>
                                <td className="py-3 px-3">
                                  <span className="text-slate-200 font-medium whitespace-pre-wrap">
                                    {rep.issue || "Belum diisi"}
                                  </span>
                                </td>
                                <td className="py-3 px-3">
                                  <span className="text-slate-300 whitespace-pre-wrap">
                                    {rep.tindakan || "-"}
                                  </span>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between gap-4 text-xs text-slate-400">
                  <span className="text-[11px]">Rincian data diambil secara otomatis dari database laporan harian.</span>
                  <div className="flex items-center gap-2">
                    <Link
                      href="/report"
                      className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold shadow transition"
                    >
                      Kelola Laporan
                    </Link>
                    <button
                      onClick={() => {
                        setSelectedSiteForCases(null);
                        setModalSearchTerm("");
                      }}
                      className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs font-medium transition cursor-pointer"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
