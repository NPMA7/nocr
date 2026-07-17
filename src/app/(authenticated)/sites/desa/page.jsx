"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import {
  MapPin,
  Search,
  RefreshCw,
  ChevronRight,
  Building2,
  Wifi,
  WifiOff,
  AlertTriangle,
} from "lucide-react";
import { getStoredUser, hasAccess } from "@/lib/roles";

function encodeMac(mac) {
  return encodeURIComponent(mac || "");
}

/** Alamat lengkap; jika kosong tampilkan titik koordinat */
function getSiteLocationDisplay(site) {
  const addr = site?.full_address?.trim();
  if (addr) return { kind: "address", label: addr };
  const lat = site?.latitude;
  const lng = site?.longitude;
  if (
    lat != null &&
    lng != null &&
    !Number.isNaN(Number(lat)) &&
    !Number.isNaN(Number(lng))
  ) {
    return {
      kind: "coords",
      label: `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`,
    };
  }
  return { kind: "empty", label: null };
}

function getValidPics(pics) {
  return (pics || []).filter((p) => p?.name?.trim());
}

function SitesListPage() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [filterProfile, setFilterProfile] = useState("all");
  const filterType = "L2TP"; // Locked to L2TP for Desa

  const [hasReadAccess, setHasReadAccess] = useState(true);

  useEffect(() => {
    const user = getStoredUser();
    if (user && user.role && !hasAccess(user, "sites", "read")) {
      setHasReadAccess(false);
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

  const filtered = items.filter((d) => {
    const term = search.toLowerCase();
    const matchesSearch =
      !term ||
      (d.prefix && d.prefix.toLowerCase().includes(term)) ||
      (d.ruijie_alias && d.ruijie_alias.toLowerCase().includes(term)) ||
      (d.mikrotik_alias && d.mikrotik_alias.toLowerCase().includes(term)) ||
      (d.site?.vendor && d.site.vendor.toLowerCase().includes(term)) ||
      (d.site?.full_address &&
        d.site.full_address.toLowerCase().includes(term));

    if (!matchesSearch) return false;
    if (filterProfile === "filled" && !d.has_site_profile) return false;
    if (filterProfile === "empty" && d.has_site_profile) return false;
    if (d.connection_type !== filterType) return false;
    return true;
  });

  const typeItems = items.filter((d) => d.connection_type === filterType);
  const withProfile = typeItems.filter((d) => d.has_site_profile).length;

  if (!hasReadAccess) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4">
        <AlertTriangle size={48} className="text-red-500/50" />
        <p>Akses Ditolak: Anda tidak memiliki izin (Read) ke Data Wilayah.</p>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col gap-4 overflow-hidden">
      <div className="flex-shrink-0 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-3">
            <MapPin size={24} className="text-orange-400" />
            Sites / Wilayah Desa
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Data profil per site Desa — prefix, vendor, PIC, dan alamat / lokasi
          </p>
        </div>
        <button
          type="button"
          onClick={fetchData}
          disabled={loading}
          className="cursor-pointer flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 border border-blue-500 text-white shadow-lg shadow-blue-500/20 disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Muat Ulang
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 flex-shrink-0">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
            <MapPin size={16} className="text-orange-400" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase">
              Total L2TP
            </p>
            <p className="text-xl font-bold text-slate-100">
              {typeItems.length}
            </p>
          </div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <Building2 size={16} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase">
              Profil Terisi
            </p>
            <p className="text-xl font-bold text-slate-100">{withProfile}</p>
          </div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 flex items-center gap-3 col-span-2 lg:col-span-1">
          <div className="w-10 h-10 rounded-full bg-slate-700/50 flex items-center justify-center">
            <Wifi size={16} className="text-slate-400" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase">
              Belum Ada Profil
            </p>
            <p className="text-xl font-bold text-slate-100">
              {typeItems.length - withProfile}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-700/30 flex items-center gap-3 flex-shrink-0 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              type="text"
              placeholder="Cari prefix, vendor, alamat..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 focus:border-blue-500 outline-none w-full"
            />
          </div>
          <select
            value={filterProfile}
            onChange={(e) => setFilterProfile(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-300 outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="all">Semua</option>
            <option value="filled">Profil sudah diisi</option>
            <option value="empty">Belum ada profil</option>
          </select>
          <span className="text-xs text-slate-500 ml-auto">
            {filtered.length} dari {typeItems.length}
          </span>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {loading && items.length === 0 ? (
            <div className="p-6 space-y-2">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="h-16 bg-slate-700/30 rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : error && items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-red-400">
              <WifiOff size={28} />
              <p className="text-xs">{error}</p>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center py-16 text-slate-500">Tidak ada data</p>
          ) : (
            <>
              {/* Mobile card view */}
              <div className="lg:hidden divide-y divide-slate-700/30">
                {filtered.map((d) => {
                  const loc = getSiteLocationDisplay(d.site);
                  const vendor = d.site?.vendor;
                  const customerId = d.site?.customer_id;
                  const pics = getValidPics(d.site?.pics);

                  return (
                    <div
                      key={d.ruijie_mac}
                      className="px-5 py-4 flex flex-col gap-3 hover:bg-slate-700/20 transition cursor-default"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-bold text-slate-100 text-sm truncate">
                              {d.prefix || "—"}
                            </span>
                            <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded border font-bold bg-blue-500/10 text-blue-400 border-blue-500/20">
                              Desa
                            </span>
                            {!d.has_site_profile && (
                              <span className="text-[10px] text-amber-400/90 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 w-max">
                                Baru
                              </span>
                            )}
                            <button
                              type="button"
                              className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded border border-blue-500/20 transition"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(
                                  `/sites/desa/${encodeMac(d.ruijie_mac)}`,
                                );
                              }}
                            >
                              Detail Wilayah <ChevronRight size={14} />
                            </button>
                          </div>
                          <div className="flex flex-col gap-1.5 mt-1">
                            {/* Vendor */}
                            <div className="flex items-start gap-2">
                              <span className="text-[10px] font-medium bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded w-[60px] text-center mt-0.5 uppercase tracking-wider">
                                Vendor
                              </span>
                              <span className="text-xs text-slate-300">
                                {vendor ? (
                                  <span>
                                    {vendor}
                                    {customerId && (
                                      <span className="text-slate-400 font-mono text-xs ml-2">
                                        ({customerId})
                                      </span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-slate-600 italic">
                                    Belum diisi
                                  </span>
                                )}
                              </span>
                            </div>

                            {/* PIC */}
                            <div className="flex items-start gap-2">
                              <span className="text-[10px] font-medium bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded w-[60px] text-center mt-0.5 uppercase tracking-wider">
                                PIC
                              </span>
                              <div className="flex flex-col gap-1 flex-1 min-w-0">
                                {pics.length > 0 ? (
                                  pics.map((p, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-center gap-2 text-xs text-slate-300"
                                    >
                                      <span className="truncate">{p.name}</span>
                                      {p.phone && (
                                        <span className="text-slate-500 font-mono text-xs truncate">
                                          • {p.phone}
                                        </span>
                                      )}
                                    </div>
                                  ))
                                ) : (
                                  <span className="text-slate-600 italic text-xs">
                                    Belum diisi
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Lokasi */}
                            <div className="flex items-start gap-2">
                              <span className="text-[10px] font-medium bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded w-[60px] text-center mt-0.5 uppercase tracking-wider">
                                Lokasi
                              </span>
                              <div className="flex-1 min-w-0 text-xs">
                                {loc.label ? (
                                  <span
                                    className={
                                      loc.kind === "coords"
                                        ? "text-orange-300/90 font-mono text-xs"
                                        : "text-slate-300"
                                    }
                                  >
                                    {loc.kind === "coords" && (
                                      <span className="text-[10px] text-slate-500 font-sans mr-1">
                                        Koordinat:
                                      </span>
                                    )}
                                    {loc.label}
                                  </span>
                                ) : (
                                  <span className="text-slate-600 italic">
                                    Belum diisi
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop table view */}
              <div className="hidden lg:block min-h-0 overflow-x-auto">
                <table className="w-full text-xs min-w-[900px]">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-slate-700/30 bg-slate-800/95 backdrop-blur">
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Prefix Sites
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Vendor / ID Pelanggan
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        PIC
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Alamat / Lokasi
                      </th>
                      <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-24">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((d) => {
                      const loc = getSiteLocationDisplay(d.site);
                      const vendor = d.site?.vendor;
                      const customerId = d.site?.customer_id;
                      return (
                        <tr
                          key={d.ruijie_mac}
                          className="border-b border-slate-700/20 hover:bg-slate-700/20 transition cursor-default group"
                        >
                          <td className="px-4 py-3 font-bold text-slate-100 max-w-[200px]">
                            <div className="flex items-center gap-2">
                              <span
                                className="truncate"
                                title={d.prefix || undefined}
                              >
                                {d.prefix || "—"}
                              </span>
                              <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded border font-bold bg-blue-500/10 text-blue-400 border-blue-500/20">
                                Desa
                              </span>
                            </div>
                          </td>
                          <td className="uppercase px-4 py-3 max-w-[220px]">
                            <span
                              className="block truncate text-slate-300"
                              title={vendor || undefined}
                            >
                              {vendor ? (
                                <span>
                                  {vendor}
                                  {customerId && (
                                    <span className="text-slate-400 font-mono text-xs ml-2">
                                      ({customerId})
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-slate-600 italic">
                                  Belum diisi
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="uppercase px-4 py-3 max-w-[220px]">
                            {getValidPics(d.site?.pics).length > 0 ? (
                              <div className="flex flex-col gap-1 min-w-0">
                                {getValidPics(d.site.pics).map((p, idx) => (
                                  <div
                                    key={idx}
                                    className="flex flex-col sm:flex-row sm:items-center sm:gap-2 min-w-0"
                                    title={[p.name, p.phone]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  >
                                    <span className="text-slate-200 truncate text-xs">
                                      {p.name}
                                    </span>
                                    {p.phone ? (
                                      <span className="text-slate-500 font-mono text-xs truncate">
                                        {p.phone}
                                      </span>
                                    ) : (
                                      <span className="text-slate-600 italic text-xs">
                                        Tanpa nomor
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 min-w-[200px] max-w-[320px] align-top">
                            <div className="flex flex-col gap-1 min-w-0">
                              {loc.label ? (
                                <span
                                  className={`whitespace-pre-line ${
                                    loc.kind === "coords"
                                      ? "text-orange-300/90 font-mono text-xs"
                                      : "text-slate-300"
                                  }`}
                                  title={loc.label}
                                  style={{
                                    wordBreak: "break-word",
                                    whiteSpace: "pre-line",
                                    display: "block",
                                  }}
                                >
                                  {loc.kind === "coords" && (
                                    <span className="text-[10px] text-slate-500 font-sans mr-1">
                                      Koordinat:
                                    </span>
                                  )}
                                  {loc.label}
                                </span>
                              ) : (
                                <span className="text-slate-600 italic">
                                  Belum diisi
                                </span>
                              )}
                              {!d.has_site_profile && (
                                <span className="text-[10px] text-amber-400/90 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 w-max">
                                  Baru
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 group-hover:text-blue-400 transition cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(
                                  `/sites/desa/${encodeMac(d.ruijie_mac)}`,
                                );
                              }}
                            >
                              Detail
                              <ChevronRight size={16} />
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SitesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-400 text-xs">Loading data...</div>}>
      <SitesListPage />
    </Suspense>
  );
}
