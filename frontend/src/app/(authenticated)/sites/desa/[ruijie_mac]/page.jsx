"use client";
import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import axios from "axios";
import {
  MapPin,
  ArrowLeft,
  Save,
  RefreshCw,
  Building2,
  UserPlus,
  Trash2,
  X,
  Copy,
  Check,
  Phone,
  Wifi,
  ExternalLink,
  Globe,
} from "lucide-react";
import { getStoredUser, hasAccess } from "@/lib/roles";
import { useAppState } from "@/App";
import ImportSiteModal from "@/components/sites/ImportSiteModal";
import SiteEvidencePhotos from "@/components/sites/SiteEvidencePhotos";

const SiteCoordinateMap = dynamic(
  () => import("@/components/SiteCoordinateMap"),
  {
    ssr: false,
    loading: () => (
      <div className="h-56 w-full rounded-xl bg-slate-950 border border-slate-800 animate-pulse" />
    ),
  },
);

const emptyPic = () => ({ name: "", phone: "" });

function formatDateInput(val) {
  if (!val) return "";
  const s = String(val);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

export default function SiteDetailPage() {
  const params = useParams();
  const mac = decodeURIComponent(params.ruijie_mac || "");
  const { showToast } = useAppState();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [vendorModalOpen, setVendorModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [allSitesList, setAllSitesList] = useState([]);

  const [vendor, setVendor] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [activationDate, setActivationDate] = useState("");
  const [fullAddress, setFullAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [coordsFromTopology, setCoordsFromTopology] = useState(false);
  const [pics, setPics] = useState([emptyPic()]);
  const [evidencePhotos, setEvidencePhotos] = useState({});

  const [canEdit, setCanEdit] = useState(false);
  const [copiedState, setCopiedState] = useState({});

  const copyToClipboard = (text, id) => {
    if (!text) return;
    navigator.clipboard.writeText(text.trim());
    setCopiedState((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setCopiedState((prev) => ({ ...prev, [id]: false }));
    }, 2000);
  };

  const applyForm = useCallback((item) => {
    const site = item?.site;
    setVendor(site?.vendor || "");
    setCustomerId(site?.customer_id || "");
    setActivationDate(formatDateInput(site?.activation_date));
    setFullAddress(site?.full_address || "");
    setLatitude(site?.latitude != null ? String(site.latitude) : "");
    setLongitude(site?.longitude != null ? String(site.longitude) : "");
    setCoordsFromTopology(!!site?.coords_from_topology);
    setEvidencePhotos(site?.evidence_photos || {});
    setPics(
      site?.pics?.length
        ? site.pics.map((p) => ({ name: p.name || "", phone: p.phone || "" }))
        : [emptyPic()],
    );
  }, []);

  const fetchDetail = useCallback(async () => {
    if (!mac) return;
    setLoading(true);
    setError(null);
    try {
      const [resDetail, resList] = await Promise.all([
        axios.get(`/api/sites/${encodeURIComponent(mac)}`),
        axios.get("/api/sites").catch(() => ({ data: [] })),
      ]);
      setData(resDetail.data);
      applyForm(resDetail.data);
      if (resList?.data) setAllSitesList(resList.data);
    } catch (e) {
      setError(
        e.response?.data?.error || e.message || "Gagal memuat detail site",
      );
    } finally {
      setLoading(false);
    }
  }, [mac, applyForm]);

  useEffect(() => {
    setCanEdit(hasAccess(getStoredUser(), "sites", "update"));
    const onRole = () =>
      setCanEdit(hasAccess(getStoredUser(), "sites", "update"));
    window.addEventListener("nocr-role-updated", onRole);
    return () => window.removeEventListener("nocr-role-updated", onRole);
  }, []);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await axios.patch(`/api/sites/${encodeURIComponent(mac)}`, {
        vendor,
        customer_id: customerId,
        activation_date: activationDate || null,
        full_address: fullAddress,
        pics,
        connection_type: "l2tp", // L2TP for Desa
      });
      setData(res.data);
      applyForm(res.data);
      if (showToast) showToast("Profil wilayah berhasil disimpan", "success");
    } catch (e) {
      const msg = e.response?.data?.error || e.message || "Gagal menyimpan";
      if (showToast) showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleImportApplied = async (imported) => {
    if (!imported) return;
    const nextVendor = imported.vendor || vendor;
    const nextCustomerId = imported.customer_id || customerId;
    const nextActivation = imported.activation_date || activationDate || null;
    const nextAddress = imported.full_address || fullAddress;
    const nextPics = imported.pics?.length ? imported.pics : pics;

    setVendor(nextVendor);
    setCustomerId(nextCustomerId);
    setActivationDate(nextActivation);
    setFullAddress(nextAddress);
    setPics(nextPics);

    setSaving(true);
    try {
      const res = await axios.patch(`/api/sites/${encodeURIComponent(mac)}`, {
        vendor: nextVendor,
        customer_id: nextCustomerId,
        activation_date: nextActivation,
        full_address: nextAddress,
        pics: nextPics,
        connection_type: "l2tp",
      });
      setData(res.data);
      applyForm(res.data);
      if (showToast)
        showToast("Data site berhasil diperbarui dari Sheet!", "success");
    } catch (e) {
      const msg =
        e.response?.data?.error || e.message || "Gagal menyimpan data";
      if (showToast) showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const addPic = () => setPics([...pics, emptyPic()]);
  const removePic = (idx) => {
    if (pics.length <= 1) {
      setPics([emptyPic()]);
      return;
    }
    setPics(pics.filter((_, i) => i !== idx));
  };

  const updatePic = (idx, field, value) => {
    setPics(pics.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  };

  if (loading && !data) {
    return (
      <div className="h-full flex flex-col gap-4 animate-pulse p-4">
        <div className="h-14 w-full bg-slate-900 border border-slate-800 rounded-xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-slate-900 border border-slate-800 rounded-xl" />
          ))}
        </div>
        <div className="h-64 bg-slate-900 border border-slate-800 rounded-xl" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-red-400 p-8">
        <p className="text-sm font-medium">{error}</p>
        <Link
          href="/sites/desa"
          className="text-blue-400 hover:underline text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800"
        >
          <ArrowLeft size={14} /> Kembali ke daftar Desa
        </Link>
      </div>
    );
  }

  const isOnline = data?.final_status === "Online";

  return (
    <div className="flex-1 flex flex-col gap-4 min-w-0 pb-8 custom-scrollbar">
      {/* 1. TOP HEADER BAR */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/sites/desa"
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition shrink-0"
            title="Kembali ke Daftar Desa"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm sm:text-base font-bold text-slate-100 truncate">
                {data?.prefix || "Detail Wilayah Desa"}
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold tag-desa">
                DESA
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                L2TP VPN
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1.5 ${
                  isOnline
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isOnline ? "bg-emerald-400 animate-pulse" : "bg-rose-400"
                  }`}
                />
                {data?.final_status || "—"}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
              {data?.ruijie_alias || "—"} ↔ {data?.mikrotik_alias || "—"}
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={fetchDetail}
            disabled={loading}
            className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition disabled:opacity-50"
          >
            <RefreshCw
              size={13}
              className={loading ? "animate-spin text-blue-400" : "text-slate-400"}
            />
            <span>{loading ? "Memuat..." : "Muat Ulang"}</span>
          </button>

          {canEdit && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="cursor-pointer flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition disabled:opacity-50"
            >
              {saving ? (
                <RefreshCw size={13} className="animate-spin" />
              ) : (
                <Save size={13} />
              )}
              <span>{saving ? "Menyimpan..." : "Simpan"}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. COMPACT SYSTEM OVERVIEW CARDS (4 Columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Prefix & MAC */}
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
              Prefix Site
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded font-bold tag-desa">
              DESA
            </span>
          </div>
          <p className="text-sm font-bold text-slate-100 mt-1 truncate" title={data?.prefix}>
            {data?.prefix || "—"}
          </p>
          {data?.ruijie_mac && (
            <div className="flex items-center gap-1.5 mt-1 text-[11px] font-mono text-slate-400">
              <span className="truncate">{data.ruijie_mac}</span>
              <button
                type="button"
                onClick={() => copyToClipboard(data.ruijie_mac, "mac_header")}
                className="cursor-pointer text-slate-500 hover:text-slate-300"
                title="Salin MAC Address"
              >
                {copiedState["mac_header"] ? (
                  <Check size={11} className="text-emerald-400" />
                ) : (
                  <Copy size={11} />
                )}
              </button>
            </div>
          )}
        </div>

        {/* Card 2: Perangkat Ruijie (AP) */}
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
              Ruijie (AP)
            </span>
            <span
              className={`flex items-center gap-1 text-[10px] font-mono font-semibold ${
                data?.status_ruijie === "Online"
                  ? "text-emerald-400"
                  : "text-rose-400"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  data?.status_ruijie === "Online"
                    ? "bg-emerald-400"
                    : "bg-rose-400"
                }`}
              />
              {data?.status_ruijie || "—"}
            </span>
          </div>
          <p className="text-xs font-semibold text-slate-200 mt-1 font-mono truncate" title={data?.ruijie_alias}>
            {data?.ruijie_alias || "—"}
          </p>
          <p className="text-[10px] text-slate-500 mt-1 truncate">
            {data?.sn ? `SN: ${data.sn}` : "Akses Point Lapangan"}
          </p>
        </div>

        {/* Card 3: MikroTik (DESA) */}
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
              MikroTik (Desa)
            </span>
            <span
              className={`flex items-center gap-1 text-[10px] font-mono font-semibold ${
                data?.status_mikrotik === "Online"
                  ? "text-emerald-400"
                  : "text-rose-400"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  data?.status_mikrotik === "Online"
                    ? "bg-emerald-400"
                    : "bg-rose-400"
                }`}
              />
              {data?.status_mikrotik || "—"}
            </span>
          </div>
          <p className="text-xs font-semibold text-slate-200 mt-1 font-mono truncate" title={data?.mikrotik_alias}>
            {data?.mikrotik_alias || "—"}
          </p>
          <p className="text-[10px] text-slate-500 mt-1 truncate">
            {data?.issue && data.issue !== "Normal" ? (
              <span className="text-amber-400 font-semibold">Issue: {data.issue}</span>
            ) : (
              "Koneksi Routerboard Normal"
            )}
          </p>
        </div>

        {/* Card 4: Jalur & Topologi */}
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
              Jalur & Topologi
            </span>
            <span className="text-[10px] font-mono font-bold text-blue-400">
              L2TP VPN
            </span>
          </div>
          {data?.site?.topology_node_id ? (
            <Link
              href={`/maps?focus=${encodeURIComponent(data.site.topology_node_id)}`}
              className="inline-flex items-center gap-1 text-xs font-mono text-blue-400 hover:text-blue-300 hover:underline mt-1 truncate"
              title="Buka node di Peta Wilayah"
            >
              <Globe size={12} className="shrink-0" />
              <span className="truncate">{data.site.topology_node_id}</span>
              <ExternalLink size={10} className="shrink-0" />
            </Link>
          ) : (
            <p className="text-xs text-slate-400 mt-1">Belum Terhubung Node</p>
          )}
          <p className="text-[10px] text-slate-500 mt-1 truncate">
            Sinkronisasi data 2 arah aktif
          </p>
        </div>
      </div>

      {/* 3. DUAL COLUMN: VENDOR ISP & KONTAK PIC */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Kolom 1: Profil Vendor & Kontrak Pelanggan */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Wifi size={16} />
                </div>
                <div>
                  <h2 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono">
                    Vendor ISP & Kontrak Pelanggan
                  </h2>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Data penyedia internet, ID pelanggan, dan tanggal aktivasi
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-4">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono mb-1.5 block">
                  Nama Vendor ISP
                </label>
                <input
                  type="text"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  disabled={!canEdit}
                  placeholder="Contoh: MEGAVISION / INDIBIZ / BABBAGE"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-600 outline-none focus:border-blue-500 disabled:opacity-60 transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono mb-1.5 block">
                    ID Pelanggan (Customer ID)
                  </label>
                  <input
                    type="text"
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    disabled={!canEdit}
                    placeholder="Contoh: 131175137140"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono placeholder-slate-600 outline-none focus:border-blue-500 disabled:opacity-60 transition"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono mb-1.5 block">
                    Tanggal Aktivasi
                  </label>
                  <input
                    type="date"
                    value={activationDate}
                    onChange={(e) => setActivationDate(e.target.value)}
                    disabled={!canEdit}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 outline-none focus:border-blue-500 disabled:opacity-60 transition"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
            <span>Jalur: L2TP VPN</span>
            <span>Site Desa</span>
          </div>
        </section>

        {/* Kolom 2: Kontak PIC Lapangan */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Phone size={16} />
                </div>
                <div>
                  <h2 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono">
                    Kontak PIC (Person In Charge)
                  </h2>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Kontak teknisi atau penanggung jawab operasional di lokasi Desa
                  </p>
                </div>
              </div>

              {canEdit && (
                <button
                  type="button"
                  onClick={addPic}
                  className="cursor-pointer flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-blue-400 hover:text-white bg-blue-500/10 hover:bg-blue-600 border border-blue-500/20 transition"
                >
                  <UserPlus size={13} />
                  <span>Tambah PIC</span>
                </button>
              )}
            </div>

            <div className="space-y-2.5 pt-4">
              {pics.map((pic, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800"
                >
                  <input
                    type="text"
                    placeholder="Nama PIC"
                    value={pic.name}
                    onChange={(e) => updatePic(idx, "name", e.target.value)}
                    disabled={!canEdit}
                    className="w-1/2 min-w-0 bg-transparent border border-slate-800 rounded-md px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-600 outline-none focus:border-blue-500 disabled:opacity-60"
                  />
                  <input
                    type="text"
                    placeholder="No. Telepon / WhatsApp"
                    value={pic.phone}
                    onChange={(e) => updatePic(idx, "phone", e.target.value)}
                    disabled={!canEdit}
                    className="w-1/2 min-w-0 bg-transparent border border-slate-800 rounded-md px-2.5 py-1.5 text-xs text-slate-100 font-mono placeholder-slate-600 outline-none focus:border-blue-500 disabled:opacity-60"
                  />

                  {pic.phone && (
                    <a
                      href={`https://wa.me/${pic.phone.replace(/[^0-9]/g, "").replace(/^0/, "62")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cursor-pointer p-1.5 rounded-md bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition shrink-0"
                      title="Kirim Pesan WhatsApp"
                    >
                      <Phone size={13} />
                    </a>
                  )}

                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => removePic(idx)}
                      className="cursor-pointer p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition shrink-0"
                      title="Hapus PIC"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-500">
            Total {pics.filter((p) => p.name).length} kontak terdata
          </div>
        </section>
      </div>

      {/* 4. EVIDENCE FOTO PERANGKAT */}
      <SiteEvidencePhotos
        ruijieMac={mac}
        sitePrefix={data?.prefix || data?.ruijie_alias || mac}
        category="desa"
        isOpd={false}
        evidencePhotos={evidencePhotos}
        onPhotosUpdated={(newPhotos) => setEvidencePhotos(newPhotos)}
        canEdit={canEdit}
        showToast={showToast}
      />

      {/* 5. LOKASI WILAYAH & KOORDINAT GIS */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <MapPin size={16} />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono">
                Lokasi Wilayah & Koordinat GIS
              </h2>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Alamat lengkap operasional dan titik pemetaan satelit
              </p>
            </div>
          </div>

          {latitude && longitude && (
            <a
              href={`https://www.google.com/maps?q=${latitude},${longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-400 hover:text-white bg-blue-500/10 hover:bg-blue-600 border border-blue-500/20 transition cursor-pointer"
            >
              <Globe size={13} />
              <span>Buka di Google Maps</span>
              <ExternalLink size={10} />
            </a>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono mb-1.5 block">
                Alamat Lengkap Site
              </label>
              <textarea
                value={fullAddress}
                onChange={(e) => setFullAddress(e.target.value)}
                disabled={!canEdit}
                rows={3}
                placeholder="Jl. ..., RT/RW, Kelurahan, Kecamatan, Kabupaten"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-600 outline-none focus:border-blue-500 disabled:opacity-60 resize-y min-h-[90px] transition"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono mb-1 block">
                  Latitude
                </label>
                <input
                  type="text"
                  readOnly
                  value={latitude || "—"}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono cursor-text select-text"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono mb-1 block">
                  Longitude
                </label>
                <input
                  type="text"
                  readOnly
                  value={longitude || "—"}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono cursor-text select-text"
                />
              </div>
            </div>

            {coordsFromTopology && latitude && longitude && (
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded w-max">
                ✓ Koordinat Sinkron dari Peta Topologi
              </span>
            )}

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Titik koordinat terhubung langsung dengan modul GIS{" "}
              <Link
                href={
                  data?.site?.topology_node_id
                    ? `/maps?focus=${encodeURIComponent(data.site.topology_node_id)}`
                    : "/maps"
                }
                className="text-blue-400 hover:underline"
              >
                Peta Wilayah
              </Link>
              {data?.site?.topology_node_id && (
                <span> (node: {data.site.topology_node_id})</span>
              )}
              .
            </p>
          </div>

          <div className="rounded-xl overflow-hidden border border-slate-800">
            <SiteCoordinateMap
              latitude={latitude}
              longitude={longitude}
              readOnly
            />
          </div>
        </div>
      </section>

      {/* Modal Detail Vendor (Opsional) */}
      {vendorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 shadow-2xl rounded-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-xs font-bold font-mono text-slate-100 flex items-center gap-2 uppercase tracking-wider">
                <Building2 size={15} className="text-blue-400" />
                Detail Vendor
              </h3>
              <button
                type="button"
                onClick={() => setVendorModalOpen(false)}
                className="cursor-pointer text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 flex flex-col gap-3 text-xs">
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">
                  Nama Vendor
                </label>
                <input
                  type="text"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  disabled={!canEdit}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">
                  ID Pelanggan
                </label>
                <input
                  type="text"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  disabled={!canEdit}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">
                  Tanggal Aktivasi
                </label>
                <input
                  type="date"
                  value={activationDate}
                  onChange={(e) => setActivationDate(e.target.value)}
                  disabled={!canEdit}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div className="p-3 border-t border-slate-800 flex justify-end gap-2 bg-slate-950">
              <button
                type="button"
                onClick={() => setVendorModalOpen(false)}
                className="cursor-pointer px-3 py-1.5 text-xs text-slate-300 hover:text-white"
              >
                Tutup
              </button>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setVendorModalOpen(false);
                    handleSave();
                  }}
                  disabled={saving}
                  className="cursor-pointer px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
                >
                  <Save size={13} />
                  <span>Simpan</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <ImportSiteModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        sitePrefix={data?.prefix || ""}
        siteType="Desa"
        onApply={handleImportApplied}
      />
    </div>
  );
}
