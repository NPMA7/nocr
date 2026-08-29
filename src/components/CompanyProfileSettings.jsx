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
    <div className="bg-slate-800 border border-slate-700/50 rounded-xl overflow-hidden shadow-lg w-full">
      {/* Header */}
      <div className="p-5 border-b border-slate-700/50 flex items-center gap-3">
        <Building2 size={20} className="text-blue-500 dark:text-blue-400" />
        <div>
          <h2 className="text-base font-bold text-slate-100">
            Identitas & Profil Perusahaan
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Informasi resmi organisasi untuk laporan dan branding
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="p-5">
        <form onSubmit={handleSave} className="space-y-4">
          {/* Nama Perusahaan */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400">
              Nama Perusahaan / Organisasi <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={form.name || ""}
              onChange={handleChange}
              disabled={!canUpdate}
              placeholder="PT Milenial Inti Telekomunikasi"
              required
              className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:border-blue-500 outline-none w-full disabled:opacity-60"
            />
          </div>

          {/* 2 Cols: Singkatan & Telepon */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400">
                Singkatan / Kode Organisasi
              </label>
              <input
                type="text"
                name="code"
                value={form.code || ""}
                onChange={handleChange}
                disabled={!canUpdate}
                placeholder="MIT"
                className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:border-blue-500 outline-none w-full disabled:opacity-60"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400">
                Nomor Telepon / Hotline
              </label>
              <input
                type="text"
                name="phone"
                value={form.phone || ""}
                onChange={handleChange}
                disabled={!canUpdate}
                placeholder="+62 881 0827 99999 / (021) 21693078"
                className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:border-blue-500 outline-none w-full disabled:opacity-60"
              />
            </div>
          </div>

          {/* Email Resmi */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400">
              Email Resmi
            </label>
            <input
              type="email"
              name="email"
              value={form.email || ""}
              onChange={handleChange}
              disabled={!canUpdate}
              placeholder="support@milenetwork.co.id"
              className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:border-blue-500 outline-none w-full disabled:opacity-60"
            />
          </div>

          {/* Alamat Kantor / Domisili */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400">
              Alamat Kantor / Domisili
            </label>
            <textarea
              name="address"
              rows={3}
              value={form.address || ""}
              onChange={handleChange}
              disabled={!canUpdate}
              placeholder="Jalan Biak No. 19 C RT 002 RW 005 Kel. Cideng Kec. Gambir Jakarta Pusat 10150"
              className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:border-blue-500 outline-none w-full resize-none disabled:opacity-60"
            />
          </div>

          {canUpdate && (
            <div className="flex justify-end pt-3">
              <button
                type="submit"
                disabled={saving}
                className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition shadow-lg shadow-blue-500/20 disabled:opacity-50"
              >
                <Save size={16} />
                <span>{saving ? "Menyimpan..." : "Simpan Profil"}</span>
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
