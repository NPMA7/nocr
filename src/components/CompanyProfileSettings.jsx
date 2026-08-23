"use client";
import React, { useState, useEffect } from "react";
import axios from "axios";
import { Building2, Save } from "lucide-react";
import { useAppState } from "@/App";

export default function CompanyProfileSettings({ canUpdate = true }) {
  const { showToast } = useAppState();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "PT Milenial Inti Telekomunikasi",
    code: "MIT",
    phone: "+62 881 0827 99999 / (021) 21693078",
    email: "support@milenetwork.co.id",
    address: "Jalan Biak No. 19 C RT 002 RW 005 Kel. Cideng Kec. Gambir Jakarta Pusat 10150",
    region: "Kabupaten Bandung",
    region_code: "KAB-BDG"
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
      <div className="p-8 text-center text-slate-400 animate-pulse">
        Memuat data profil perusahaan...
      </div>
    );
  }

  return (
    <div className="bg-[#0b1322] border border-slate-800/80 rounded-2xl p-6 lg:p-8 shadow-xl max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 pb-6 border-b border-slate-800/80 mb-6">
        <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-sm shrink-0">
          <Building2 size={24} />
        </div>
        <div>
          <h2 className="text-base lg:text-lg font-bold text-slate-100">
            Identitas & Profil Perusahaan
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Informasi resmi organisasi untuk laporan dan branding
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSave} className="space-y-5">
        {/* Nama Perusahaan */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            NAMA PERUSAHAAN / ORGANISASI <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            name="name"
            value={form.name || ""}
            onChange={handleChange}
            disabled={!canUpdate}
            placeholder="PT Milenial Inti Telekomunikasi"
            required
            className="w-full bg-[#070c16] border border-slate-800/90 rounded-xl px-4 py-3 text-xs lg:text-sm text-slate-200 focus:border-blue-500 focus:outline-none transition disabled:opacity-60"
          />
        </div>

        {/* 2 Cols: Singkatan & Telepon */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <label className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              SINGKATAN / KODE ORGANISASI
            </label>
            <input
              type="text"
              name="code"
              value={form.code || ""}
              onChange={handleChange}
              disabled={!canUpdate}
              placeholder="MIT"
              className="w-full bg-[#070c16] border border-slate-800/90 rounded-xl px-4 py-3 text-xs lg:text-sm text-slate-200 focus:border-blue-500 focus:outline-none transition disabled:opacity-60"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              NOMOR TELEPON / HOTLINE
            </label>
            <input
              type="text"
              name="phone"
              value={form.phone || ""}
              onChange={handleChange}
              disabled={!canUpdate}
              placeholder="+62 881 0827 99999 / (021) 21693078"
              className="w-full bg-[#070c16] border border-slate-800/90 rounded-xl px-4 py-3 text-xs lg:text-sm text-slate-200 focus:border-blue-500 focus:outline-none transition disabled:opacity-60"
            />
          </div>
        </div>

        {/* Email Resmi */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            EMAIL RESMI
          </label>
          <input
            type="email"
            name="email"
            value={form.email || ""}
            onChange={handleChange}
            disabled={!canUpdate}
            placeholder="support@milenetwork.co.id"
            className="w-full bg-[#070c16] border border-slate-800/90 rounded-xl px-4 py-3 text-xs lg:text-sm text-slate-200 focus:border-blue-500 focus:outline-none transition disabled:opacity-60"
          />
        </div>

        {/* Alamat Kantor / Domisili */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            ALAMAT KANTOR / DOMISILI
          </label>
          <textarea
            name="address"
            rows={3}
            value={form.address || ""}
            onChange={handleChange}
            disabled={!canUpdate}
            placeholder="Jalan Biak No. 19 C RT 002 RW 005 Kel. Cideng Kec. Gambir Jakarta Pusat 10150"
            className="w-full bg-[#070c16] border border-slate-800/90 rounded-xl p-4 text-xs lg:text-sm text-slate-200 focus:border-blue-500 focus:outline-none transition resize-none disabled:opacity-60"
          />
        </div>

        {canUpdate && (
          <div className="flex justify-end pt-3">
            <button
              type="submit"
              disabled={saving}
              className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-blue-900/30 transition disabled:opacity-50"
            >
              <Save size={15} />
              <span>{saving ? "Menyimpan..." : "Simpan Profil"}</span>
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
