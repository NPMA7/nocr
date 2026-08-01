"use client";
import { useState, useEffect } from "react";
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
  const [chartLimit, setChartLimit] = useState(15); // 10, 15, 25, 50, all
  const [chartViewMode, setChartViewMode] = useState("column"); // "column" | "heatmap"

  // Table Pagination & Page Size (15, 50, 100, all)
  const [pageSize, setPageSize] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);

  // Modal State for Case Details
  const [selectedSiteForCases, setSelectedSiteForCases] = useState(null);
  const [modalSearchTerm, setModalSearchTerm] = useState("");

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
      console.error("Gagal mengambil data detail sites:", err);
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

  const allDevices = Array.isArray(data?.allDevices) ? data.allDevices : [];
  const totalReportsCount = data?.stats?.totalReports || 0;

  // Filtered by search term for Table
  const filteredSites = allDevices.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const apDesa = data?.stats?.totalApDesa ?? 280;
  const apOpd = data?.stats?.totalApOpd ?? 131;
  const apAll = data?.stats?.totalApAll ?? (apDesa + apOpd);

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

  return (
    <div className="p-4 lg:p-6 flex flex-col gap-6 w-full min-h-screen text-slate-100 pb-16">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Link
              href="/report/dashboard"
              className="hover:text-blue-400 flex items-center gap-1 transition"
            >
              <ArrowLeft size={14} />
              <span>Dashboard Laporan</span>
            </Link>
            <ChevronRight size={12} />
            <span className="text-slate-200 font-medium">Rekap Laporan Sites</span>
          </div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-100 flex items-center gap-2.5">
            <Building className="text-blue-400" size={24} />
            Rekapitulasi Laporan Gangguan Per Lokasi / Site
          </h1>
          <p className="text-xs text-slate-400">
            Data statistik laporan gangguan per lokasi instansi pemerintah dan desa
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchSummary()}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs font-medium transition cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh Data</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col gap-4 shadow-sm">
        {/* Top Row: Category Type Toggle & Range Selector */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Category Type Toggle */}
          <div className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-lg border border-slate-700/50">
            {[
              { id: "ALL", label: "Semua Kategori" },
              { id: "L2TP", label: "Desa" },
              { id: "PPPOE", label: "OPD" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setType(t.id)}
                className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                  type === t.id
                    ? t.id === "PPPOE"
                      ? "tag-opd shadow"
                      : t.id === "L2TP"
                      ? "tag-desa shadow"
                      : "bg-blue-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Date Range Options */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-lg border border-slate-700/50">
              {[
                { id: "7d", label: "7 Hari" },
                { id: "1m", label: "1 Bulan" },
                { id: "1y", label: "1 Tahun" },
                { id: "all", label: "Semua" },
                { id: "custom", label: "Custom" },
              ].map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRange(r.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                    range === r.id
                      ? "bg-blue-600 text-white shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Custom Month Picker */}
        {range === "custom" && (
          <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-slate-800/80 bg-slate-950/40 p-3 rounded-lg">
            <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
              <Calendar size={14} className="text-blue-400" />
              <span>Dari Bulan:</span>
            </div>
            <select
              value={startMonth}
              onChange={(e) => setStartMonth(Number(e.target.value))}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
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
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            <span className="text-slate-500 text-xs font-bold">—</span>

            <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
              <span>Sampai Bulan:</span>
            </div>
            <select
              value={endMonth}
              onChange={(e) => setEndMonth(Number(e.target.value))}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
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
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
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

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
          <RefreshCw size={26} className="animate-spin text-blue-400" />
          <span className="text-xs font-medium">Memuat data rekapitulasi...</span>
        </div>
      ) : error ? (
        <div className="py-12 bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center text-red-300">
          <p className="font-semibold text-sm mb-2">{error}</p>
          <button
            onClick={() => fetchSummary()}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition cursor-pointer"
          >
            Coba Lagi
          </button>
        </div>
      ) : (
        <>
          {/* Dual View Chart Container: Column Chart vs Compact Heatmap Grid */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex flex-col gap-3 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <BarChart2 size={16} className="text-blue-400" />
                  Visualisasi Laporan Gangguan Per Lokasi
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {chartViewMode === "column"
                    ? `Grafik Kolom Perbandingan (${chartLimit === "all" ? `Semua ${allDevices.length} Sites` : `Top ${chartLimit} Sites`})`
                    : `Matriks Heatmap Compact (${allDevices.length} Sites tanpa scroll horizontal)`}
                </p>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {/* View Mode Toggle Switcher */}
                <div className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-lg border border-slate-700/50 text-xs">
                  <button
                    onClick={() => setChartViewMode("column")}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded transition cursor-pointer font-semibold ${
                      chartViewMode === "column"
                        ? "bg-blue-600 text-white shadow"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <BarChart2 size={13} />
                    <span>Grafik Kolom</span>
                  </button>

                  <button
                    onClick={() => setChartViewMode("heatmap")}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded transition cursor-pointer font-semibold ${
                      chartViewMode === "heatmap"
                        ? "bg-blue-600 text-white shadow"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <LayoutGrid size={13} />
                    <span>Matriks Heatmap (Compact)</span>
                  </button>
                </div>

                {/* Show Options based on view mode */}
                {chartViewMode === "column" && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400">Tampilkan:</span>
                    <select
                      value={chartLimit}
                      onChange={(e) => setChartLimit(e.target.value === "all" ? "all" : Number(e.target.value))}
                      className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-100 focus:outline-none focus:border-blue-500 text-xs cursor-pointer"
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

            {/* VIEW MODE 1: COLUMN CHART (Compact Height & Minimal Bottom Padding) */}
            {chartViewMode === "column" && (
              <>
                {chartSites.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 text-xs">
                    Tidak ada data laporan gangguan pada periode ini
                  </div>
                ) : (
                  <div className="overflow-x-auto pb-1">
                    <div
                      className="flex items-end justify-between h-48 px-4 border-b border-slate-800/80 gap-3 pt-4 min-w-full"
                      style={{
                        minWidth: chartSites.length > 15 ? `${chartSites.length * 55}px` : "100%",
                      }}
                    >
                      {chartSites.map((site, idx) => {
                        const percentHeight = Math.round((site.count / maxCount) * 100);
                        const percentage = totalReportsCount > 0 ? ((site.count / totalReportsCount) * 100).toFixed(1) : "0.0";

                        return (
                          <div
                            key={idx}
                            onClick={() => setSelectedSiteForCases(site)}
                            className="relative h-full flex flex-col items-center justify-end flex-1 group cursor-pointer"
                          >
                            {/* Top Count Label */}
                            <span className="text-[11px] font-bold text-blue-300 mb-1">
                              {site.count}
                            </span>

                            {/* Bar Container */}
                            <div
                              className="w-full max-w-[26px] bg-slate-800 rounded-t-sm relative overflow-hidden cursor-pointer transition-all duration-300"
                              style={{ height: `${Math.max(percentHeight, 4)}%` }}
                            >
                              <div className="absolute inset-0 bg-blue-600 hover:bg-blue-400 transition-colors"></div>
                            </div>

                            {/* Hover Tooltip Card */}
                            <div
                              className="absolute bottom-full mb-6 text-[11px] rounded-xl px-3.5 py-2.5 opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-40 whitespace-nowrap shadow-2xl backdrop-blur-md flex flex-col gap-1 border"
                              style={{
                                backgroundColor: "var(--color-card-bg, #1E293B)",
                                borderColor: "var(--color-border-main, #334155)",
                                color: "var(--color-text-main, #F8FAFC)",
                              }}
                            >
                              <div className="font-extrabold text-xs tracking-wide" style={{ color: "var(--color-text-main, #F8FAFC)" }}>
                                {site.name}
                              </div>
                              <div className="flex items-center gap-2 text-[10px]" style={{ color: "var(--color-text-muted, #94A3B8)" }}>
                                <span className={`px-1 py-0.2 rounded font-bold ${site.type === "PPPOE" ? "tag-opd" : "tag-desa"}`}>
                                  {site.type === "PPPOE" ? "OPD" : "Desa"}
                                </span>
                                <span>•</span>
                                <span className="font-bold" style={{ color: "var(--color-text-main, #F8FAFC)" }}>
                                  {site.count} Laporan ({percentage}%)
                                </span>
                              </div>
                              <div className="text-[9px] font-bold mt-0.5" style={{ color: "var(--color-primary, #097FE8)" }}>
                                Klik untuk rincian kasus
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Compact Rotated Labels below Bars (Full Visibility, No Truncation) */}
                    <div
                      className="flex justify-between px-4 gap-3 h-36 pt-1 pb-4 min-w-full overflow-visible"
                      style={{
                        minWidth: chartSites.length > 15 ? `${chartSites.length * 55}px` : "100%",
                      }}
                    >
                      {chartSites.map((site, idx) => (
                        <div key={idx} className="flex-1 flex justify-center min-w-0 relative">
                          <span
                            onClick={() => setSelectedSiteForCases(site)}
                            className="text-[10px] text-slate-300 font-medium absolute top-2 left-1/2 -translate-x-1/2 origin-center -rotate-45 whitespace-nowrap hover:text-blue-300 transition select-none cursor-pointer"
                            title={`Klik untuk rincian kasus ${site.name}`}
                          >
                            {site.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* VIEW MODE 2: COMPACT HEATMAP MATRIX GRID */}
            {chartViewMode === "heatmap" && (
              <div className="flex flex-col gap-4">
                {/* Heatmap Legend */}
                <div className="flex items-center justify-between flex-wrap gap-3 bg-slate-800/40 p-3 rounded-lg border border-slate-700/60 text-xs text-slate-300 dark:text-slate-200">
                  <span className="font-bold text-slate-200">Intensitas Frekuensi Kasus:</span>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-1.5 font-medium">
                      <span className="w-3 h-3 rounded bg-blue-600 border border-blue-500 shadow-xs"></span>
                      <span>Tinggi (≥5 Kasus)</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-medium">
                      <span className="w-3 h-3 rounded bg-blue-500/30 border border-blue-500/50"></span>
                      <span>Sedang (3-4 Kasus)</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-medium">
                      <span className="w-3 h-3 rounded bg-slate-800 border border-slate-700"></span>
                      <span>Rendah (1-2 Kasus)</span>
                    </div>
                  </div>
                </div>

                {allDevices.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 text-xs">
                    Tidak ada data laporan gangguan pada periode ini
                  </div>
                ) : (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2 max-h-[500px] overflow-y-auto p-2 pb-20">
                    {allDevices.map((site, idx) => {
                      const count = site.count;
                      const percentage = totalReportsCount > 0 ? ((count / totalReportsCount) * 100).toFixed(1) : "0.0";
                      const isHigh = count >= 5;
                      const isMedium = count >= 3 && count < 5;

                      return (
                        <div
                          key={idx}
                          onClick={() => setSelectedSiteForCases(site)}
                          className={`relative p-2.5 rounded-lg border transition-all cursor-pointer group flex flex-col justify-between h-16 group-hover:z-30 ${
                            isHigh
                              ? "bg-blue-600 border-blue-500 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20"
                              : isMedium
                              ? "bg-blue-500/15 border-blue-500/30 text-blue-500 dark:text-blue-400 hover:bg-blue-500/25"
                              : "bg-slate-800/60 border-slate-700/60 text-slate-300 dark:text-slate-200 hover:bg-slate-700/60"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <span className="text-[10px] font-bold line-clamp-2 leading-tight group-hover:text-blue-200 transition">
                              {site.name}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md text-center min-w-[20px] ${
                                isHigh
                                  ? "bg-white text-blue-700 shadow-sm"
                                  : isMedium
                                  ? "bg-blue-500/20 text-blue-500 dark:text-blue-400 border border-blue-500/30"
                                  : "bg-slate-800 text-slate-300 border border-slate-700"
                              }`}
                            >
                              {count}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[9px] mt-1">
                            <span className={`px-1 py-0.2 rounded font-bold ${site.type === "PPPOE" ? "tag-opd" : "tag-desa"}`}>
                              {site.type === "PPPOE" ? "OPD" : "Desa"}
                            </span>
                            <span className="font-semibold text-slate-300 dark:text-slate-300">
                              {percentage}%
                            </span>
                          </div>

                          {/* Hover Tooltip Popover (Always opens downwards into open space below card) */}
                          <div
                            className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 text-[11px] rounded-xl px-3.5 py-2.5 opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-40 whitespace-nowrap shadow-2xl backdrop-blur-md flex flex-col gap-1 border"
                            style={{
                              backgroundColor: "var(--color-card-bg, #1E293B)",
                              borderColor: "var(--color-border-main, #334155)",
                              color: "var(--color-text-main, #F8FAFC)",
                            }}
                          >
                            <div className="font-extrabold text-xs tracking-wide" style={{ color: "var(--color-text-main, #F8FAFC)" }}>
                              {site.name}
                            </div>
                            <div className="flex items-center gap-2 text-[10px]" style={{ color: "var(--color-text-muted, #94A3B8)" }}>
                              <span className={`px-1 py-0.2 rounded font-bold ${site.type === "PPPOE" ? "tag-opd" : "tag-desa"}`}>
                                {site.type === "PPPOE" ? "OPD" : "Desa"}
                              </span>
                              <span>•</span>
                              <span className="font-bold" style={{ color: "var(--color-text-main, #F8FAFC)" }}>
                                {count} Laporan ({percentage}%)
                              </span>
                            </div>
                            {site.mac && (
                              <div className="text-[9px] font-mono" style={{ color: "var(--color-text-muted, #94A3B8)" }}>
                                MAC: {site.mac}
                              </div>
                            )}
                            <div className="text-[9px] font-bold mt-0.5" style={{ color: "var(--color-primary, #097FE8)" }}>
                              Klik kotak untuk rincian kasus
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Full Detailed Data Table with Pagination & Page Size (15, 50, 100, All) */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex flex-col gap-4 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Building size={16} className="text-blue-400" />
                  {tableTitleText}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Daftar lengkap rekapitulasi gangguan per lokasi
                </p>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {/* Search Input inside Table Header */}
                <div className="relative w-full sm:w-64">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    placeholder="Cari nama site..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Page Size Select (15, 50, 100, All) */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400">Tampilkan:</span>
                  <select
                    value={pageSize}
                    onChange={(e) =>
                      setPageSize(
                        e.target.value === "all" ? "all" : Number(e.target.value)
                      )
                    }
                    className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-blue-500 text-xs cursor-pointer"
                  >
                    <option value={15}>15 Per Halaman</option>
                    <option value={50}>50 Per Halaman</option>
                    <option value={100}>100 Per Halaman</option>
                    <option value="all">
                      Semua ({filteredSites.length})
                    </option>
                  </select>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-700/60 bg-slate-800/80 text-slate-300 dark:text-slate-200 text-[11px] uppercase font-bold tracking-wider">
                    <th className="py-2.5 px-4 w-12 text-center">No</th>
                    <th className="py-2.5 px-4">Nama Site / Lokasi</th>
                    <th className="py-2.5 px-4">Kategori Tipe</th>
                    <th className="py-2.5 px-4">Persentase</th>
                    <th className="py-2.5 px-4 text-center">Total Kasus</th>
                    <th className="py-2.5 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {paginatedSites.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-12 text-center text-slate-500 text-xs"
                      >
                        {searchTerm
                          ? `Tidak ada site yang cocok dengan pencarian "${searchTerm}"`
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
                      const siteDetailUrl = site.mac
                        ? `/sites/${isDesa ? "desa" : "opd"}/${site.mac}`
                        : null;

                      return (
                        <tr
                          key={index}
                          className="hover:bg-slate-800/40 transition group"
                        >
                          <td className="py-3 px-4 text-center font-medium text-slate-500">
                            {absoluteIndex}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-col">
                              <span className="font-semibold text-slate-200 group-hover:text-blue-300 transition">
                                {site.name}
                              </span>
                              {site.mac && (
                                <span className="text-[10px] text-slate-500 font-mono">
                                  MAC: {site.mac}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`text-[11px] font-medium px-2 py-0.5 rounded border ${
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
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="bg-blue-500 h-full rounded-full"
                                  style={{
                                    width: `${Math.min(
                                      (site.count / maxCount) * 100,
                                      100
                                    )}%`,
                                  }}
                                ></div>
                              </div>
                              <span className="text-slate-300 font-medium text-[11px]">
                                {percentage}%
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => setSelectedSiteForCases(site)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 hover:bg-blue-500/25 border border-blue-500/30 hover:border-blue-500/50 text-blue-300 hover:text-blue-200 font-semibold rounded-lg text-xs transition cursor-pointer shadow-sm group/btn"
                              title="Klik untuk melihat rincian laporan / kasus"
                            >
                              <span>{site.count} Laporan</span>
                              <Eye size={13} className="text-blue-400 group-hover/btn:scale-110 transition-transform" />
                            </button>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {site.mac && !site.mac.startsWith("MANUAL_") ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <Link
                                  href={`/monitoring/${isDesa ? "desa" : "opd"}/traffic/${encodeURIComponent(site.mac)}`}
                                  className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 px-2.5 py-1 rounded transition"
                                  title="Lihat Traffic Per Site"
                                >
                                  <Activity size={12} />
                                  <span>Traffic Site</span>
                                </Link>
                                <Link
                                  href={`/sites/${isDesa ? "desa" : "opd"}/${encodeURIComponent(site.mac)}`}
                                  className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 px-2.5 py-1 rounded transition"
                                  title="Lihat Detail Informasional Site"
                                >
                                  <span>Detail Site</span>
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
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800 text-xs text-slate-400">
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
                    className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft size={14} />
                    <span>Sebelumnya</span>
                  </button>

                  <div className="flex items-center gap-1 px-2 font-mono">
                    <span className="text-blue-400 font-bold">{currentPage}</span>
                    <span className="text-slate-600">/</span>
                    <span className="text-slate-400">{totalPages}</span>
                  </div>

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer"
                  >
                    <span>Selanjutnya</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Case Details Modal */}
          {selectedSiteForCases && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
              <div className="bg-slate-900 border border-slate-700/80 rounded-2xl flex flex-col max-h-[85vh] w-full max-w-4xl shadow-2xl overflow-hidden">
                {/* Modal Header */}
                <div className="p-4 sm:p-5 border-b border-slate-700/60 flex items-center justify-between gap-4 bg-slate-800/60">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                          selectedSiteForCases.type === "PPPOE" ? "tag-opd" : "tag-desa"
                        }`}
                      >
                        {selectedSiteForCases.type === "PPPOE" ? "OPD" : "Desa"}
                      </span>
                      <span className="text-xs text-slate-400">Rincian Laporan Kasus</span>
                    </div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                      <Building className="text-blue-500 dark:text-blue-400" size={20} />
                      <span>{selectedSiteForCases.name}</span>
                    </h2>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-500 dark:text-blue-400 text-xs font-bold rounded-lg">
                      {selectedSiteForCases.count} Total Laporan
                    </span>
                    <button
                      onClick={() => {
                        setSelectedSiteForCases(null);
                        setModalSearchTerm("");
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                      title="Tutup Modal"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* Modal Filter / Action Bar */}
                <div className="px-4 sm:px-5 py-3 border-b border-slate-700/60 bg-slate-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-sm">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Cari issue atau tindakan..."
                      value={modalSearchTerm}
                      onChange={(e) => setModalSearchTerm(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {selectedSiteForCases.mac && !selectedSiteForCases.mac.startsWith("MANUAL_") && (
                    <Link
                      href={`/monitoring/${selectedSiteForCases.type === "L2TP" ? "desa" : "opd"}/traffic/${encodeURIComponent(selectedSiteForCases.mac)}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-500 dark:text-blue-400 rounded-lg text-xs font-semibold transition cursor-pointer w-fit"
                    >
                      <Activity size={13} />
                      <span>Lihat Traffic Site</span>
                    </Link>
                  )}
                </div>

                {/* Modal Body / Table Content */}
                <div className="p-4 sm:p-5 overflow-y-auto flex-1">
                  {(!selectedSiteForCases.reports || selectedSiteForCases.reports.length === 0) ? (
                    <div className="py-12 text-center text-slate-500 text-xs">
                      Tidak ada detail rincian laporan pada periode ini.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-700/60 bg-slate-800/80 text-slate-300 dark:text-slate-200 text-[11px] uppercase font-bold tracking-wider">
                            <th className="py-2.5 px-3 w-10 text-center">No</th>
                            <th className="py-2.5 px-3">Jam Offline</th>
                            <th className="py-2.5 px-3">Jam Online Kembali</th>
                            <th className="py-2.5 px-3 text-center">Status</th>
                            <th className="py-2.5 px-3">Issue / Kendala</th>
                            <th className="py-2.5 px-3">Tindakan / Penanganan</th>
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
                              <tr key={rep.id || idx} className="hover:bg-slate-800/40 transition">
                                <td className="py-3 px-3 text-center font-medium text-slate-500">
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
                                        ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                                        : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                                    }`}
                                  >
                                    {rep.status_progress === "Progress" ? (
                                      <Clock size={10} />
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
                <div className="p-4 border-t border-slate-700/60 bg-slate-800/60 flex items-center justify-between gap-4 text-xs text-slate-300 dark:text-slate-200">
                  <span>Rincian data diambil dari Kelola Laporan.</span>
                  <div className="flex items-center gap-2">
                    <Link
                      href="/report"
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow transition"
                    >
                      Buka Kelola Laporan
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
