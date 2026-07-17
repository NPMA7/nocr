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
  Info,
  X,
} from "lucide-react";
import { getStoredUser, hasAccess } from "@/lib/roles";
import { useAppState } from "@/App";

const SiteCoordinateMap = dynamic(
  () => import("@/components/SiteCoordinateMap"),
  {
    ssr: false,
    loading: () => (
      <div className="h-56 w-full rounded-lg bg-slate-800/50 border border-slate-700/50 animate-pulse" />
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

  const [vendor, setVendor] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [activationDate, setActivationDate] = useState("");
  const [fullAddress, setFullAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [coordsFromTopology, setCoordsFromTopology] = useState(false);
  const [pics, setPics] = useState([emptyPic()]);

  const [canEdit, setCanEdit] = useState(false);

  const applyForm = useCallback((item) => {
    const site = item?.site;
    setVendor(site?.vendor || "");
    setCustomerId(site?.customer_id || "");
    setActivationDate(formatDateInput(site?.activation_date));
    setFullAddress(site?.full_address || "");
    setLatitude(site?.latitude != null ? String(site.latitude) : "");
    setLongitude(site?.longitude != null ? String(site.longitude) : "");
    setCoordsFromTopology(!!site?.coords_from_topology);
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
      const res = await axios.get(`/api/sites/${encodeURIComponent(mac)}`);
      setData(res.data);
      applyForm(res.data);
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
      <div className="h-full flex flex-col gap-4 animate-pulse">
        <div className="h-10 w-48 bg-slate-700/40 rounded" />
        <div className="flex-1 bg-slate-800/50 rounded-xl" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-red-400">
        <p>{error}</p>
        <Link
          href="/sites/desa"
          className="text-blue-400 hover:underline text-xs flex items-center gap-1"
        >
          <ArrowLeft size={16} /> Kembali ke daftar
        </Link>
      </div>
    );
  }

  const online = data?.final_status === "Online";

  return (
    <div className="h-full min-h-0 flex flex-col gap-4 overflow-hidden">
      <div className="flex-shrink-0 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Link
            href="/sites/desa"
            className="text-xs text-slate-400 hover:text-blue-400 flex items-center gap-1 mb-2 transition"
          >
            <ArrowLeft size={14} /> Wilayah Desa
          </Link>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-3 flex-wrap">
            <MapPin size={24} className="text-orange-400" />
            {data?.prefix || "Detail Wilayah"}
            <span className="text-xs font-normal px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
              Desa
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            {data?.ruijie_alias} ↔ {data?.mikrotik_alias}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-bold ${
              online
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-slate-700 text-slate-400"
            }`}
          >
            {data?.final_status || "—"}
          </span>
          {canEdit && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="cursor-pointer flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
            >
              {saving ? (
                <RefreshCw size={15} className="animate-spin" />
              ) : (
                <Save size={15} />
              )}
              Simpan
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1 space-y-4 pb-4">
        {/* Ringkasan mapping */}
        <section className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">
              Prefix Gabungan
            </p>
            <p className="text-base font-bold text-slate-100">
              {data?.prefix || "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">
              Ruijie (AP)
            </p>
            <p className="text-xs text-slate-200 font-mono">
              {data?.ruijie_alias || "—"}
            </p>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">
              {data?.ruijie_mac}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">
              Mikrotik (Desa)
            </p>
            <p className="text-xs text-slate-200 font-mono">
              {data?.mikrotik_alias || "—"}
            </p>
          </div>
          {(data?.site?.topology_node_id ||
            data?.status_ruijie ||
            data?.status_mikrotik) && (
            <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-8 col-span-full">
              {data?.site?.topology_node_id && (
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Node Topologi Terhubung
                  </p>
                  <p className="text-xs text-blue-400 font-mono break-words">
                    {data.site.topology_node_id}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Vendor & PIC disinkronkan dua arah dengan node peta topologi
                  </p>
                </div>
              )}
              <div className="flex-1 min-w-0 sm:mt-0 mt-0">
                <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Status Sumber
                </p>
                <p className="text-xs text-slate-400">
                  Ruijie:{" "}
                  <span
                    className={
                      data?.status_ruijie === "Online"
                        ? "text-emerald-400"
                        : data?.status_ruijie === "Offline"
                          ? "text-red-400"
                          : "text-slate-200"
                    }
                  >
                    {data?.status_ruijie}
                  </span>{" "}
                  · Mikrotik:{" "}
                  <span
                    className={
                      data?.status_mikrotik === "Online"
                        ? "text-emerald-400"
                        : data?.status_mikrotik === "Offline"
                          ? "text-red-400"
                          : "text-slate-200"
                    }
                  >
                    {data?.status_mikrotik}
                  </span>
                </p>
                {data?.issue && (
                  <p className="text-xs text-orange-400 mt-1">
                    Issue: {data.issue}
                  </p>
                )}
              </div>
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Vendor */}
          <section className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <h2 className="text-xs font-bold text-slate-200 flex items-center gap-2 mb-2">
              <Building2 size={16} className="text-blue-400" />
              Vendor / ID Pelanggan
            </h2>
            <p className="text-[12px] text-blue-400 mb-2">
              ID:{" "}
              <span className="text-slate-200 font-mono">
                {customerId || "—"}
              </span>{" "}
              · Aktivasi:{" "}
              <span className="text-slate-200 font-mono">
                {activationDate || "—"}
              </span>
            </p>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                  Nama Vendor
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    disabled={!canEdit}
                    placeholder="Nama vendor / ISP"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 outline-none focus:border-blue-500 disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setVendorModalOpen(true)}
                    className="cursor-pointer flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-700/50 hover:bg-slate-700 text-slate-300 border border-slate-600 transition"
                    title="Detail vendor"
                  >
                    <Info size={14} />
                    Detail
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* PIC */}
          <section className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-slate-200">
                PIC (Person In Charge)
              </h2>
              {canEdit && (
                <button
                  type="button"
                  onClick={addPic}
                  className="cursor-pointer flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                >
                  <UserPlus size={14} /> Tambah PIC
                </button>
              )}
            </div>
            <div className="space-y-3">
              {pics.map((pic, idx) => (
                <div
                  key={idx}
                  className="relative flex items-center gap-2 p-3 rounded-lg bg-slate-900/50 border border-slate-700/40 overflow-hidden"
                >
                  <div className="flex flex-1 gap-2">
                    <input
                      type="text"
                      placeholder="Nama PIC"
                      value={pic.name}
                      onChange={(e) => updatePic(idx, "name", e.target.value)}
                      disabled={!canEdit}
                      className="w-1/2 min-w-0 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 outline-none focus:border-blue-500 disabled:opacity-60"
                    />
                    <input
                      type="text"
                      placeholder="Nomor telepon"
                      value={pic.phone}
                      onChange={(e) => updatePic(idx, "phone", e.target.value)}
                      disabled={!canEdit}
                      className="w-1/2 min-w-0 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 outline-none focus:border-blue-500 disabled:opacity-60"
                    />
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => removePic(idx)}
                      className="ml-2 cursor-pointer p-2 text-red-400/80 hover:bg-red-500/10 rounded-lg flex-shrink-0"
                      title="Hapus PIC"
                      style={{ zIndex: 1, position: "relative" }}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Alamat & peta (koordinat hanya dari Topologi) */}
        <section className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <h2 className="text-xs font-bold text-slate-200 flex items-center gap-2 mb-4">
            <MapPin size={16} className="text-orange-400" />
            Lokasi Wilayah
          </h2>
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">
                Alamat Lengkap
              </label>
              <textarea
                value={fullAddress}
                onChange={(e) => setFullAddress(e.target.value)}
                disabled={!canEdit}
                rows={3}
                placeholder="Jl. ..., RT/RW, Kelurahan, Kecamatan, Kota"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 outline-none focus:border-blue-500 disabled:opacity-60 resize-y min-h-[80px]"
              />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="flex flex-col gap-3">
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Titik koordinat diatur di{" "}
                  <Link
                    href="/topology"
                    className="text-blue-400 hover:text-blue-300"
                  >
                    Peta Topologi
                  </Link>
                  {data?.site?.topology_node_id && (
                    <>
                      {" "}
                      (node:{" "}
                      <span className="inline text-blue-400 font-mono">
                        {data.site.topology_node_id}
                      </span>
                      )
                    </>
                  )}
                  .
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">
                      Latitude
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={latitude || "—"}
                      className="w-full bg-slate-900/60 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-400 font-mono cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">
                      Longitude
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={longitude || "—"}
                      className="w-full bg-slate-900/60 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-400 font-mono cursor-not-allowed"
                    />
                  </div>
                </div>
                {coordsFromTopology && latitude && longitude && (
                  <span className="text-[10px] text-orange-400/90 bg-orange-500/10 border border-orange-500/20 px-2 py-1 rounded w-max">
                    Sinkron dari Peta Topologi
                  </span>
                )}
              </div>
              <SiteCoordinateMap
                latitude={latitude}
                longitude={longitude}
                readOnly
              />
            </div>
          </div>
        </section>
      </div>

      {/* Modal detail vendor */}
      {vendorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-700 shadow-2xl rounded-xl w-full max-w-md overflow-hidden animate-modal">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="font-bold text-slate-100 flex items-center gap-2">
                <Building2 size={16} className="text-blue-400" />
                Detail Vendor
              </h3>
              <button
                type="button"
                onClick={() => setVendorModalOpen(false)}
                className="cursor-pointer text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">
                  Nama Vendor
                </label>
                <input
                  type="text"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  disabled={!canEdit}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-xs text-slate-100 outline-none focus:border-blue-500 disabled:opacity-60"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">
                  ID Pelanggan
                </label>
                <input
                  type="text"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  disabled={!canEdit}
                  placeholder="Contoh: PLG-00123"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-xs text-slate-100 outline-none focus:border-blue-500 disabled:opacity-60"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">
                  Tanggal Aktivasi
                </label>
                <input
                  type="date"
                  value={activationDate}
                  onChange={(e) => setActivationDate(e.target.value)}
                  disabled={!canEdit}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-xs text-slate-100 outline-none focus:border-blue-500 disabled:opacity-60"
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-700 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setVendorModalOpen(false)}
                className="cursor-pointer px-4 py-2 text-xs text-slate-300 hover:text-white"
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
                  className="cursor-pointer px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium flex items-center gap-2 disabled:opacity-50"
                >
                  <Save size={14} /> Simpan
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
