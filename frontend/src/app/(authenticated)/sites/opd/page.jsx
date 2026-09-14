"use client";
import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import {
  MapPin,
  Search,
  RefreshCw,
  ChevronRight,
  Wifi,
  WifiOff,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  Phone,
  Layers,
  Globe,
} from "lucide-react";
import { getStoredUser, hasAccess } from "@/lib/roles";

function encodeMac(mac) {
  return encodeURIComponent(mac || "");
}

/** Alamat lengkap; jika kosong tampilkan titik koordinat */
function getSiteLocationDisplay(site) {
  const addr = site?.full_address?.trim();
  const lat = site?.latitude;
  const lng = site?.longitude;
  const hasCoords =
    lat != null &&
    lng != null &&
    !Number.isNaN(Number(lat)) &&
    !Number.isNaN(Number(lng));

  if (addr) {
    return {
      kind: "address",
      label: addr,
      hasCoords,
      lat: Number(lat),
      lng: Number(lng),
    };
  }

  if (hasCoords) {
    return {
      kind: "coords",
      label: `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`,
      hasCoords: true,
      lat: Number(lat),
      lng: Number(lng),
    };
  }

  return { kind: "empty", label: null, hasCoords: false };
}

function getValidPics(pics) {
  return (pics || []).filter((p) => p?.name?.trim());
}

function normalizeVendorGroup(vendorName) {
  if (!vendorName) return "";
  const upper = vendorName.trim().toUpperCase();
  if (upper.startsWith("BABBAGE") || upper === "BABBAGE") return "BABBAGE";
  return vendorName.trim();
}

function SitesListPage() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [filterVendor, setFilterVendor] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all"); // "all" | "online" | "offline"
  const filterType = "PPPOE"; // Locked to PPPOE for OPD

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(30);

  const [hasReadAccess, setHasReadAccess] = useState(true);
  const [copiedState, setCopiedState] = useState({});

  const copyToClipboard = (text, id) => {
    if (!text) return;
    navigator.clipboard.writeText(text.trim());
    setCopiedState((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setCopiedState((prev) => ({ ...prev, [id]: false }));
    }, 2000);
  };

  useEffect(() => {
    const user = getStoredUser();
    if (user && user.role) {
      if (!hasAccess(user, "sites", "read")) setHasReadAccess(false);
    }
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get("/api/sites");
      setItems(res.data || []);
    } catch (e) {
      setError(
        e.response?.data?.error || e.message || "Gagal memuat data wilayah",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const typeItems = useMemo(
    () => items.filter((d) => d.connection_type === filterType),
    [items, filterType],
  );

  const onlineCount = useMemo(() => {
    return typeItems.filter(
      (d) =>
        d.final_status === "Online" ||
        (!d.final_status &&
          (d.status_ruijie || "").toLowerCase() === "online" &&
          (d.status_mikrotik || "").toLowerCase() === "online"),
    ).length;
  }, [typeItems]);

  const offlineCount = typeItems.length - onlineCount;

  const vendorCounts = useMemo(() => {
    const counts = {};
    typeItems.forEach((d) => {
      if (d.site?.vendor && d.site.vendor.trim()) {
        const v = normalizeVendorGroup(d.site.vendor);
        counts[v] = (counts[v] || 0) + 1;
      }
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [typeItems]);

  const topVendor = vendorCounts.length > 0 ? vendorCounts[0] : null;

  const filtered = useMemo(() => {
    return items.filter((d) => {
      if (d.connection_type !== filterType) return false;

      const term = search.toLowerCase().trim();
      const rawVendor = (d.site?.vendor || "").trim();
      const groupedVendor = normalizeVendorGroup(rawVendor);

      // Vendor Filter
      if (filterVendor !== "all" && groupedVendor !== filterVendor) {
        return false;
      }

      // Online/Offline Status Filter
      const isOnline =
        d.final_status === "Online" ||
        (!d.final_status &&
          (d.status_ruijie || "").toLowerCase() === "online" &&
          (d.status_mikrotik || "").toLowerCase() === "online");
      if (filterStatus === "online" && !isOnline) return false;
      if (filterStatus === "offline" && isOnline) return false;

      // Search matching
      if (term) {
        const pics = d.site?.pics || [];
        const picMatch = pics.some(
          (p) =>
            (p.name && p.name.toLowerCase().includes(term)) ||
            (p.phone && p.phone.toLowerCase().includes(term)),
        );

        const matchesSearch =
          (d.prefix && d.prefix.toLowerCase().includes(term)) ||
          (d.ruijie_alias && d.ruijie_alias.toLowerCase().includes(term)) ||
          (d.mikrotik_alias && d.mikrotik_alias.toLowerCase().includes(term)) ||
          (d.ruijie_mac && d.ruijie_mac.toLowerCase().includes(term)) ||
          (d.site?.customer_id &&
            d.site.customer_id.toLowerCase().includes(term)) ||
          (d.site?.vendor && d.site.vendor.toLowerCase().includes(term)) ||
          (d.site?.full_address &&
            d.site.full_address.toLowerCase().includes(term)) ||
          picMatch;

        if (!matchesSearch) return false;
      }

      return true;
    });
  }, [items, search, filterVendor, filterStatus, filterType]);

  const totalPages = useMemo(() => {
    if (itemsPerPage === "all") return 1;
    return Math.ceil(filtered.length / itemsPerPage) || 1;
  }, [filtered.length, itemsPerPage]);

  const paginatedFiltered = useMemo(() => {
    if (itemsPerPage === "all") return filtered;
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage, itemsPerPage]);

  if (!hasReadAccess) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4">
        <AlertTriangle size={48} className="text-red-500/50" />
        <p>Akses Ditolak: Anda tidak memiliki izin (Read) ke Data Wilayah.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-4 min-w-0 pb-6">
      {/* 1. TOP HEADER & REFRESH ACTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <MapPin size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-slate-100">
                Data Wilayah OPD
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                KABEL FO PPPoE
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {typeItems.length} Titik
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Profil operasional per site OPD — prefix perangkat, vendor ISP, kontak PIC, dan koordinat GIS
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition disabled:opacity-50"
          >
            <RefreshCw
              size={13}
              className={loading ? "animate-spin text-blue-400" : "text-slate-400"}
            />
            <span>{loading ? "Memuat..." : "Muat Ulang"}</span>
          </button>
        </div>
      </div>

      {/* 2. COMPACT KPI STAT CARDS (4 Columns) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total OPD */}
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
              Total OPD
            </p>
            <p className="text-xl font-bold font-mono text-slate-100 mt-0.5">
              {typeItems.length}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Jalur Kabel FO PPPoE
            </p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-400">
            <MapPin size={15} />
          </div>
        </div>

        {/* OPD Online */}
        <div
          onClick={() => {
            setFilterStatus(filterStatus === "online" ? "all" : "online");
            setCurrentPage(1);
          }}
          className={`p-3 bg-slate-900 border rounded-xl shadow-sm flex items-center justify-between cursor-pointer transition ${
            filterStatus === "online"
              ? "border-emerald-500/50 bg-emerald-950/20"
              : "border-slate-800 hover:border-slate-700"
          }`}
          title="Klik untuk filter status Online"
        >
          <div>
            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
              OPD Online
            </p>
            <p className="text-xl font-bold font-mono text-emerald-400 mt-0.5">
              {onlineCount}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {typeItems.length > 0
                ? ((onlineCount / typeItems.length) * 100).toFixed(1)
                : 0}
              % terhubung
            </p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Wifi size={15} />
          </div>
        </div>

        {/* OPD Offline */}
        <div
          onClick={() => {
            setFilterStatus(filterStatus === "offline" ? "all" : "offline");
            setCurrentPage(1);
          }}
          className={`p-3 bg-slate-900 border rounded-xl shadow-sm flex items-center justify-between cursor-pointer transition ${
            filterStatus === "offline"
              ? "border-rose-500/50 bg-rose-950/20"
              : "border-slate-800 hover:border-slate-700"
          }`}
          title="Klik untuk filter status Offline"
        >
          <div>
            <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block"></span>
              OPD Offline
            </p>
            <p className="text-xl font-bold font-mono text-rose-400 mt-0.5">
              {offlineCount}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {offlineCount === 0 ? "Semua terhubung" : "Perlu pengecekan"}
            </p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <WifiOff size={15} />
          </div>
        </div>

        {/* Top ISP / Vendor */}
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl shadow-sm flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
              Vendor Terbanyak
            </p>
            <p className="text-sm font-bold text-slate-200 mt-1 truncate">
              {topVendor ? topVendor[0] : "Belum Ada"}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5 truncate">
              {topVendor ? `${topVendor[1]} site terhubung` : "Data kosong"}
            </p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-400 shrink-0">
            <Layers size={15} />
          </div>
        </div>
      </div>

      {/* 3. INTERACTIVE VENDOR FILTER CHIPS */}
      {vendorCounts.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 shadow-sm">
          <div className="flex items-center gap-2 mb-2 px-1 text-[11px] font-bold text-slate-400 font-mono uppercase tracking-wider">
            <Layers size={12} className="text-blue-400" />
            <span>Filter Cepat Vendor ISP ({vendorCounts.length} Vendor Terdaftar):</span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1">
            <button
              onClick={() => {
                setFilterVendor("all");
                setCurrentPage(1);
              }}
              className={`cursor-pointer px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
                filterVendor === "all"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}
            >
              <span>Semua</span>
              <span className="font-mono text-[10px] opacity-80">({typeItems.length})</span>
            </button>
            {vendorCounts.map(([vName, vCount]) => (
              <button
                key={vName}
                onClick={() => {
                  setFilterVendor(filterVendor === vName ? "all" : vName);
                  setCurrentPage(1);
                }}
                className={`cursor-pointer px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition flex items-center gap-1.5 ${
                  filterVendor === vName
                    ? "bg-blue-600 text-white font-bold shadow-sm"
                    : "bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800"
                }`}
              >
                <span>{vName}</span>
                <span className="font-mono text-[10px] opacity-80">({vCount})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 4. SITES TABLE SECTION */}
      <div className="flex flex-col min-w-0 bg-slate-900 border border-slate-800 rounded-xl shadow-sm overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-3 sm:p-4 border-b border-slate-800 flex items-center gap-2.5 flex-wrap">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px]">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              type="text"
              placeholder="Cari nama OPD, vendor, PIC, no. telp, alamat..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 outline-none transition"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Status Koneksi */}
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="all">Semua Koneksi</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
          </select>

          {/* Items Per Page */}
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-xs text-slate-500 hidden sm:inline">Per hal:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                const val =
                  e.target.value === "all" ? "all" : Number(e.target.value);
                setItemsPerPage(val);
                setCurrentPage(1);
              }}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value="all">Semua ({filtered.length})</option>
            </select>
          </div>
        </div>

        {/* Content Table / Cards */}
        <div className="overflow-x-auto custom-scrollbar min-w-0">
          {loading && items.length === 0 ? (
            <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <RefreshCw size={24} className="animate-spin text-blue-400" />
              <span className="text-xs">Memuat data wilayah OPD...</span>
            </div>
          ) : error && items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-red-400">
              <WifiOff size={28} />
              <p className="text-xs">{error}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-xs text-slate-400">
                Tidak ada data OPD yang cocok dengan filter pencarian.
              </p>
              {(search || filterVendor !== "all" || filterStatus !== "all") && (
                <button
                  onClick={() => {
                    setSearch("");
                    setFilterVendor("all");
                    setFilterStatus("all");
                  }}
                  className="mt-2 text-xs text-blue-400 hover:underline cursor-pointer"
                >
                  Reset Semua Filter
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden lg:block">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono text-[11px] uppercase tracking-wider">
                      <th className="py-2.5 px-4 font-semibold">Nama Site / OPD</th>
                      <th className="py-2.5 px-4 font-semibold">Vendor ISP / ID Pelanggan</th>
                      <th className="py-2.5 px-4 font-semibold">Kontak PIC</th>
                      <th className="py-2.5 px-4 font-semibold">Alamat & Koordinat</th>
                      <th className="py-2.5 px-4 font-semibold text-right w-24">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {paginatedFiltered.map((d) => {
                      const loc = getSiteLocationDisplay(d.site);
                      const vendor = d.site?.vendor;
                      const customerId = d.site?.customer_id;
                      const isOnline =
                        d.final_status === "Online" ||
                        (!d.final_status &&
                          (d.status_ruijie || "").toLowerCase() === "online" &&
                          (d.status_mikrotik || "").toLowerCase() === "online");
                      const pics = getValidPics(d.site?.pics);

                      return (
                        <tr
                          key={d.ruijie_mac}
                          className="hover:bg-slate-800/30 transition-colors group cursor-default"
                        >
                          {/* Site Prefix & Status */}
                          <td className="py-3 px-4 max-w-[240px]">
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${
                                  isOnline ? "bg-emerald-400" : "bg-rose-500"
                                }`}
                                title={isOnline ? "Online" : "Offline"}
                              />
                              <span
                                className="font-bold text-slate-100 truncate"
                                title={d.prefix || undefined}
                              >
                                {d.prefix || "—"}
                              </span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded font-bold shrink-0 tag-opd">
                                OPD
                              </span>
                            </div>
                            {d.ruijie_mac && (
                              <div className="flex items-center gap-1.5 mt-1 text-[10px] font-mono text-slate-500">
                                <span>{d.ruijie_mac}</span>
                                <button
                                  onClick={() =>
                                    copyToClipboard(
                                      d.ruijie_mac,
                                      `mac_${d.ruijie_mac}`,
                                    )
                                  }
                                  className="cursor-pointer text-slate-500 hover:text-slate-300"
                                  title="Salin MAC Address"
                                >
                                  {copiedState[`mac_${d.ruijie_mac}`] ? (
                                    <Check
                                      size={10}
                                      className="text-emerald-400"
                                    />
                                  ) : (
                                    <Copy size={10} />
                                  )}
                                </button>
                              </div>
                            )}
                          </td>

                          {/* Vendor & Customer ID */}
                          <td className="py-3 px-4 max-w-[220px]">
                            {vendor ? (
                              <div className="space-y-0.5">
                                <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-200 border border-slate-700">
                                  {vendor}
                                </span>
                                {customerId && (
                                  <div className="text-[11px] font-mono text-blue-300 flex items-center gap-1">
                                    <span>ID: {customerId}</span>
                                    <button
                                      onClick={() =>
                                        copyToClipboard(
                                          customerId,
                                          `cid_${d.ruijie_mac}`,
                                        )
                                      }
                                      className="cursor-pointer text-slate-500 hover:text-slate-300"
                                      title="Salin ID Pelanggan"
                                    >
                                      {copiedState[`cid_${d.ruijie_mac}`] ? (
                                        <Check
                                          size={10}
                                          className="text-emerald-400"
                                        />
                                      ) : (
                                        <Copy size={10} />
                                      )}
                                    </button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-500 text-[11px] italic">
                                Belum diisi
                              </span>
                            )}
                          </td>

                          {/* PIC List */}
                          <td className="py-3 px-4 max-w-[220px]">
                            {pics.length > 0 ? (
                              <div className="flex flex-col gap-1 min-w-0">
                                {pics.map((p, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center gap-1.5 text-xs text-slate-200"
                                  >
                                    <span className="font-medium truncate">
                                      {p.name}
                                    </span>
                                    {p.phone && (
                                      <a
                                        href={`https://wa.me/${p.phone.replace(/[^0-9]/g, "").replace(/^0/, "62")}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="cursor-pointer font-mono text-[11px] text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-0.5 shrink-0"
                                        title="Hubungi via WhatsApp"
                                      >
                                        <Phone size={10} />
                                        <span>{p.phone}</span>
                                      </a>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-500 text-[11px]">—</span>
                            )}
                          </td>

                          {/* Address & Coordinates */}
                          <td className="py-3 px-4 max-w-[280px]">
                            <div className="space-y-1">
                              {loc.label ? (
                                <p
                                  className="text-slate-300 text-xs line-clamp-2 leading-relaxed"
                                  title={loc.label}
                                >
                                  {loc.label}
                                </p>
                              ) : (
                                <span className="text-slate-500 text-[11px] italic">
                                  Belum diisi
                                </span>
                              )}
                              {loc.hasCoords && (
                                <a
                                  href={`https://www.google.com/maps?q=${loc.lat},${loc.lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[10px] font-mono text-blue-400 hover:text-blue-300 hover:underline cursor-pointer"
                                  title="Buka lokasi di Google Maps"
                                >
                                  <Globe size={11} />
                                  <span>
                                    {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
                                  </span>
                                  <ExternalLink size={9} />
                                </a>
                              )}
                            </div>
                          </td>

                          {/* Action */}
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                router.push(
                                  `/sites/opd/${encodeMac(d.ruijie_mac)}`,
                                )
                              }
                              className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-400 hover:text-white bg-blue-500/10 hover:bg-blue-600 rounded-lg border border-blue-500/20 transition"
                            >
                              <span>Detail</span>
                              <ChevronRight size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="lg:hidden divide-y divide-slate-800">
                {paginatedFiltered.map((d) => {
                  const loc = getSiteLocationDisplay(d.site);
                  const vendor = d.site?.vendor;
                  const customerId = d.site?.customer_id;
                  const pics = getValidPics(d.site?.pics);
                  const isOnline =
                    d.final_status === "Online" ||
                    (!d.final_status &&
                      (d.status_ruijie || "").toLowerCase() === "online" &&
                      (d.status_mikrotik || "").toLowerCase() === "online");

                  return (
                    <div
                      key={d.ruijie_mac}
                      className="p-4 flex flex-col gap-2.5 hover:bg-slate-800/20 transition"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              isOnline ? "bg-emerald-400" : "bg-rose-500"
                            }`}
                          />
                          <span className="font-bold text-slate-100 text-sm truncate">
                            {d.prefix || "—"}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded font-bold shrink-0 tag-opd">
                            OPD
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            router.push(`/sites/opd/${encodeMac(d.ruijie_mac)}`)
                          }
                          className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-400 hover:text-white bg-blue-500/10 hover:bg-blue-600 rounded-lg border border-blue-500/20 transition shrink-0"
                        >
                          <span>Detail</span>
                          <ChevronRight size={13} />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                        <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                          <span className="text-[10px] text-slate-500 uppercase font-mono block">
                            Vendor ISP
                          </span>
                          <span className="text-slate-200 font-semibold truncate block mt-0.5">
                            {vendor || "—"}
                          </span>
                          {customerId && (
                            <span className="text-[10px] font-mono text-blue-300 truncate block">
                              ID: {customerId}
                            </span>
                          )}
                        </div>

                        <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                          <span className="text-[10px] text-slate-500 uppercase font-mono block">
                            PIC
                          </span>
                          {pics.length > 0 ? (
                            <span className="text-slate-200 font-semibold truncate block mt-0.5">
                              {pics[0].name}
                            </span>
                          ) : (
                            <span className="text-slate-500 text-xs block mt-0.5">
                              —
                            </span>
                          )}
                          {pics.length > 0 && pics[0].phone && (
                            <a
                              href={`tel:${pics[0].phone}`}
                              className="text-[10px] font-mono text-emerald-400 hover:underline truncate block"
                            >
                              {pics[0].phone}
                            </a>
                          )}
                        </div>
                      </div>

                      {loc.label && (
                        <div className="text-[11px] text-slate-400 flex items-start gap-1.5 pt-0.5">
                          <MapPin
                            size={12}
                            className="text-slate-500 shrink-0 mt-0.5"
                          />
                          <span className="line-clamp-2">{loc.label}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Pagination Bar */}
        {filtered.length > 0 && (
          <div className="px-4 py-2.5 border-t border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs bg-slate-950">
            <span className="text-slate-400 font-medium">
              {itemsPerPage === "all"
                ? `Menampilkan ${filtered.length} dari ${filtered.length} OPD`
                : `Menampilkan ${Math.min((currentPage - 1) * itemsPerPage + 1, filtered.length)}-${Math.min(currentPage * itemsPerPage, filtered.length)} dari ${filtered.length} OPD`}
            </span>
            {itemsPerPage !== "all" && totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-slate-300 border border-slate-800 transition cursor-pointer"
                >
                  Prev
                </button>
                <span className="text-slate-400 font-mono font-medium px-2">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-slate-300 border border-slate-800 transition cursor-pointer"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SitesPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-slate-400 text-xs">
          Memuat data wilayah OPD...
        </div>
      }
    >
      <SitesListPage />
    </Suspense>
  );
}
