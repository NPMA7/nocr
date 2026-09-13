"use client";
import React, { useState, useEffect } from "react";
import axios from "axios";
import { Building2, Phone, MapPin, Save, Globe } from "lucide-react";
import { useAppState } from "@/App";

export default function CompanyProfileSettings({ canUpdate = true }) {
  const { showToast } = useAppState();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "PT Milenial Inti Telekomunikasi",
    code: "MIT",
    region: "Kabupaten Bandung",
    region_code: "KAB-BDG",
    phone: "+62 881 0827 99999 / (021) 21693078",
    email: "support@milenetwork.co.id",
    website: "https://milenetwork.co.id",
    address: "Jalan Biak No. 19 C RT 002 RW 005 Kel. Cideng Kec. Gambir Jakarta Pusat 10150",
    coverage_area: "31 Kecamatan, Wilayah Desa & Instansi OPD Kabupaten Bandung",
    description: "Penyelenggara Jasa Internet, Monitoring Jaringan Terpadu, dan Pengelolaan Jaringan Telekomunikasi."
  });

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/settings/company");
      if (res.data) {
        setForm((prev) => ({ ...prev, ...res.data }));
      }
    } catch (err) {
      console.error("Gagal memuat profil perusahaan:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!canUpdate) return;
    setSaving(true);
    try {
      const res = await axios.post("/api/settings/company", form);
      if (showToast) {
        showToast(res.data?.message || "Profil perusahaan berhasil disimpan", "success");
      }
      window.dispatchEvent(new Event("nocr-company-updated"));
    } catch (err) {
      if (showToast) {
        showToast(err.response?.data?.error || "Gagal menyimpan profil perusahaan", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-6 text-center text-slate-400 text-xs animate-pulse">
        Memuat data profil perusahaan...
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-3.5">
      {/* ─── 1. Identitas & Wilayah Operasional ─── */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3.5 md:p-4 backdrop-blur-sm transition-all">
        <div className="flex items-center justify-between pb-2.5 mb-3.5 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-slate-800/90 border border-slate-700/60 flex items-center justify-center text-sky-400 flex-shrink-0">
              <Building2 size={14} />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-200 tracking-wide uppercase">
                Identitas & Wilayah Operasional
              </span>
              <p className="text-[10px] text-slate-400 font-mono">
                Legalitas nama organisasi dan penamaan sistem
              </p>
            </div>
          </div>
          <span className="text-[9px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/50 text-slate-300">
            TENANT: {form.code || "MIT"}
          </span>
        </div>

        <div className="space-y-3">
          {/* Row 1: Nama Perusahaan & Singkatan */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Nama Perusahaan / Organisasi <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={form.name || ""}
                onChange={handleChange}
                disabled={!canUpdate}
                placeholder="Contoh: PT Milenial Inti Telekomunikasi"
                required
                className="bg-slate-950/70 border border-slate-800 hover:border-slate-700 focus:border-sky-500 rounded-md px-3 py-2 text-xs text-slate-100 placeholder-slate-600 outline-none transition w-full disabled:opacity-60"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Singkatan / Kode <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                name="code"
                value={form.code || ""}
                onChange={handleChange}
                disabled={!canUpdate}
                placeholder="MIT"
                required
                className="bg-slate-950/70 border border-slate-800 hover:border-slate-700 focus:border-sky-500 rounded-md px-3 py-2 text-xs text-slate-100 placeholder-slate-600 font-mono outline-none transition w-full disabled:opacity-60"
              />
            </div>
          </div>

          {/* Row 2: Wilayah Operasional & Kode Wilayah */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Wilayah Operasional
              </label>
              <input
                type="text"
                name="region"
                value={form.region || ""}
                onChange={handleChange}
                disabled={!canUpdate}
                placeholder="Contoh: Kabupaten Bandung"
                className="bg-slate-950/70 border border-slate-800 hover:border-slate-700 focus:border-sky-500 rounded-md px-3 py-2 text-xs text-slate-100 placeholder-slate-600 outline-none transition w-full disabled:opacity-60"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Kode Wilayah
              </label>
              <input
                type="text"
                name="region_code"
                value={form.region_code || ""}
                onChange={handleChange}
                disabled={!canUpdate}
                placeholder="KAB-BDG"
                className="bg-slate-950/70 border border-slate-800 hover:border-slate-700 focus:border-sky-500 rounded-md px-3 py-2 text-xs text-slate-100 placeholder-slate-600 font-mono outline-none transition w-full disabled:opacity-60"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ─── 2. Kontak & Saluran Komunikasi ─── */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3.5 md:p-4 backdrop-blur-sm transition-all">
        <div className="flex items-center justify-between pb-2.5 mb-3.5 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-slate-800/90 border border-slate-700/60 flex items-center justify-center text-sky-400 flex-shrink-0">
              <Phone size={14} />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-200 tracking-wide uppercase">
                Kontak & Saluran Komunikasi
              </span>
              <p className="text-[10px] text-slate-400 font-mono">
                Hotline 24/7, email dispatch, dan portal web resmi
              </p>
            </div>
          </div>
          <span className="text-[9px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/50 text-slate-400">
            CHANNELS
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Email Resmi
            </label>
            <input
              type="email"
              name="email"
              value={form.email || ""}
              onChange={handleChange}
              disabled={!canUpdate}
              placeholder="support@milenetwork.co.id"
              className="bg-slate-950/70 border border-slate-800 hover:border-slate-700 focus:border-sky-500 rounded-md px-3 py-2 text-xs text-slate-100 placeholder-slate-600 outline-none transition w-full disabled:opacity-60"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Nomor Telepon / Hotline
            </label>
            <input
              type="text"
              name="phone"
              value={form.phone || ""}
              onChange={handleChange}
              disabled={!canUpdate}
              placeholder="+62 881 0827 99999 / (021) 21693078"
              className="bg-slate-950/70 border border-slate-800 hover:border-slate-700 focus:border-sky-500 rounded-md px-3 py-2 text-xs text-slate-100 placeholder-slate-600 outline-none transition w-full disabled:opacity-60"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Website / Portal
            </label>
            <input
              type="url"
              name="website"
              value={form.website || ""}
              onChange={handleChange}
              disabled={!canUpdate}
              placeholder="https://milenetwork.co.id"
              className="bg-slate-950/70 border border-slate-800 hover:border-slate-700 focus:border-sky-500 rounded-md px-3 py-2 text-xs text-slate-100 placeholder-slate-600 outline-none transition w-full disabled:opacity-60"
            />
          </div>
        </div>
      </div>

      {/* ─── 3. Domisili & Cakupan Layanan ─── */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3.5 md:p-4 backdrop-blur-sm transition-all">
        <div className="flex items-center justify-between pb-2.5 mb-3.5 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-slate-800/90 border border-slate-700/60 flex items-center justify-center text-sky-400 flex-shrink-0">
              <MapPin size={14} />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-200 tracking-wide uppercase">
                Domisili & Cakupan Jaringan
              </span>
              <p className="text-[10px] text-slate-400 font-mono">
                Lokasi kantor operasional dan cakupan infrastruktur
              </p>
            </div>
          </div>
          <span className="text-[9px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/50 text-slate-400">
            COVERAGE
          </span>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Alamat Kantor / Domisili
            </label>
            <textarea
              name="address"
              rows={2}
              value={form.address || ""}
              onChange={handleChange}
              disabled={!canUpdate}
              placeholder="Alamat kantor domisili resmi..."
              className="bg-slate-950/70 border border-slate-800 hover:border-slate-700 focus:border-sky-500 rounded-md px-3 py-2 text-xs text-slate-100 placeholder-slate-600 outline-none transition w-full resize-none disabled:opacity-60"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Cakupan Wilayah & Sektor Distribusi
            </label>
            <input
              type="text"
              name="coverage_area"
              value={form.coverage_area || ""}
              onChange={handleChange}
              disabled={!canUpdate}
              placeholder="Contoh: 31 Kecamatan, Wilayah Desa & Instansi OPD"
              className="bg-slate-950/70 border border-slate-800 hover:border-slate-700 focus:border-sky-500 rounded-md px-3 py-2 text-xs text-slate-100 placeholder-slate-600 outline-none transition w-full disabled:opacity-60"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Deskripsi Singkat Profil Organisasi
            </label>
            <textarea
              name="description"
              rows={2}
              value={form.description || ""}
              onChange={handleChange}
              disabled={!canUpdate}
              placeholder="Deskripsi singkat profil dan peranan organisasi..."
              className="bg-slate-950/70 border border-slate-800 hover:border-slate-700 focus:border-sky-500 rounded-md px-3 py-2 text-xs text-slate-100 placeholder-slate-600 outline-none transition w-full resize-none disabled:opacity-60"
            />
          </div>
        </div>
      </div>

      {/* ─── Bottom Action ─── */}
      {canUpdate && (
        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={saving}
            className="cursor-pointer bg-sky-600 hover:bg-sky-500 text-white px-5 py-2 rounded-md text-xs font-semibold flex items-center gap-2 transition duration-150 shadow-sm disabled:opacity-50"
          >
            <Save size={14} />
            <span>{saving ? "Menyimpan..." : "Simpan Profil"}</span>
          </button>
        </div>
      )}
    </form>
  );
}
