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
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Connection Type Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
            {[
              { id: "ALL", label: "Semua Kategori" },
              { id: "L2TP", label: "Desa (L2TP)" },
              { id: "PPPOE", label: "OPD (PPPoE)" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setType(t.id)}
                className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                  type === t.id
                    ? "bg-blue-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Date Range Options */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              {[
                { id: "7d", label: "7 Hari" },
                { id: "1m", label: "30 Hari" },
                { id: "1y", label: "1 Tahun" },
                { id: "all", label: "Semua" },
                { id: "custom", label: "Custom" },
              ].map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRange(r.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                    range === r.id
                      ? "bg-slate-700 text-white shadow"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
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
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                  <button
                    onClick={() => setChartViewMode("column")}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded transition cursor-pointer font-medium ${
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
                    className={`flex items-center gap-1.5 px-3 py-1 rounded transition cursor-pointer font-medium ${
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
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:border-blue-500 text-xs cursor-pointer"
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
                            className="relative h-full flex flex-col items-center justify-end flex-1 group"
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
                            <div className="absolute bottom-full mb-6 bg-slate-950/95 border border-blue-500/30 text-[11px] text-slate-200 rounded-xl px-3 py-2 opacity-0 group-hover:opacity-100 transition pointer-events-none z-20 whitespace-nowrap shadow-2xl backdrop-blur-md flex flex-col gap-0.5">
                              <div className="font-bold text-slate-100">{site.name}</div>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                <span>{site.type === "PPPOE" ? "OPD (PPPoE)" : "Desa (L2TP)"}</span>
                                <span>•</span>
                                <span className="text-blue-300 font-semibold">{site.count} Laporan ({percentage}%)</span>
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
                            className="text-[10px] text-slate-300 font-medium absolute top-2 left-1/2 -translate-x-1/2 origin-center -rotate-45 whitespace-nowrap hover:text-blue-300 transition select-none"
                            title={site.name}
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
                <div className="flex items-center justify-between flex-wrap gap-3 bg-slate-950/60 p-3 rounded-lg border border-slate-800 text-xs text-slate-400">
                  <span className="font-semibold text-slate-300">Intensitas Frekuensi Kasus:</span>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded bg-blue-600 border border-blue-400"></span>
                      <span>Tinggi (≥5 Kasus)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded bg-blue-900/80 border border-blue-700"></span>
                      <span>Sedang (3-4 Kasus)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
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
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(115px,1fr))] gap-2 max-h-[460px] overflow-y-auto pr-1">
                    {allDevices.map((site, idx) => {
                      const count = site.count;
                      const percentage = totalReportsCount > 0 ? ((count / totalReportsCount) * 100).toFixed(1) : "0.0";
                      const isHigh = count >= 5;
                      const isMedium = count >= 3 && count < 5;

                      return (
                        <div
                          key={idx}
                          className={`relative p-2.5 rounded-lg border transition-all cursor-pointer group flex flex-col justify-between h-16 ${
                            isHigh
                              ? "bg-blue-600/90 border-blue-400 text-white hover:bg-blue-500 shadow-md shadow-blue-600/20"
                              : isMedium
                              ? "bg-blue-900/50 border-blue-700/80 text-blue-100 hover:bg-blue-800/80"
                              : "bg-slate-950/70 border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:border-slate-700"
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
                                  ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                                  : "bg-slate-800 text-slate-400 border border-slate-700"
                              }`}
                            >
                              {count}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[9px] text-slate-400 mt-1">
                            <span className="truncate opacity-80">
                              {site.type === "PPPOE" ? "OPD" : "Desa"}
                            </span>
                            <span className="font-semibold text-slate-300">
                              {percentage}%
                            </span>
                          </div>

                          {/* Hover Tooltip Popover */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-950 border border-blue-500/30 text-[11px] text-slate-200 rounded-xl px-3 py-2 opacity-0 group-hover:opacity-100 transition pointer-events-none z-30 whitespace-nowrap shadow-2xl backdrop-blur-md flex flex-col gap-0.5">
                            <div className="font-bold text-slate-100">{site.name}</div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400">
                              <span>{site.type === "PPPOE" ? "OPD (PPPoE)" : "Desa (L2TP)"}</span>
                              <span>•</span>
                              <span className="text-blue-300 font-semibold">{count} Laporan ({percentage}%)</span>
                            </div>
                            {site.mac && (
                              <div className="text-[9px] text-slate-500 font-mono">
                                MAC: {site.mac}
                              </div>
                            )}
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
                  Tabel Rincian Seluruh Sites ({filteredSites.length})
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
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
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
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500 text-xs cursor-pointer"
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
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 text-[11px] uppercase font-semibold tracking-wider">
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
                                  ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                  : site.type === "L2TP"
                                  ? "bg-slate-800 text-slate-300 border-slate-700"
                                  : "bg-slate-800 text-slate-400 border-slate-700"
                              }`}
                            >
                              {site.type === "PPPOE"
                                ? "OPD (PPPoE)"
                                : site.type === "L2TP"
                                ? "Desa (L2TP)"
                                : "Unknown"}
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
                            <span className="px-2.5 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-300 font-semibold rounded text-xs">
                              {site.count} Laporan
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {siteDetailUrl ? (
                              <Link
                                href={siteDetailUrl}
                                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 px-2.5 py-1 rounded transition"
                              >
                                <span>Detail Site</span>
                                <ExternalLink size={12} />
                              </Link>
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
        </>
      )}
    </div>
  );
}
