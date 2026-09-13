"use client";

import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Server,
  Network,
  Save,
  Monitor,
  Terminal,
  Pencil,
  Trash2,
  Check,
  X,
  Plus,
  RotateCcw,
  Radio,
  Eye,
  EyeOff,
  Bell,
  Volume2,
  Sliders,
  FileText,
  Activity,
  Clock,
  ShieldAlert,
  HardDrive,
  RefreshCw,
} from "lucide-react";
import { API_URL, useAppState } from "@/App";

export default function SystemConfigSettings({
  canUpdate = true,
  perms = {},
  coreDevice = {},
  setCoreDevice,
  showCorePassword,
  setShowCorePassword,
  handleSaveCore,
  vpnConfig = {},
  setVpnConfig,
  showVpnPassword,
  setShowVpnPassword,
  handleSaveVpn,
  testVpnConnect,
  testVpnDisconnect,
  vpnConnecting = false,
  vpnMsg = "",
  existingId = null,
  initialSubTab = "gateway",
}) {
  const { showToast, testAlarm } = useAppState();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState(initialSubTab);

  // Issues management
  const [newIssue, setNewIssue] = useState("");
  const [editingIssue, setEditingIssue] = useState(null);
  const [renamedIssues, setRenamedIssues] = useState([]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/settings/server");
      setSettings(res.data);
    } catch (err) {
      console.error(err);
      if (showToast) showToast("Gagal memuat pengaturan server", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!canUpdate) return;
    setSaving(true);
    try {
      const payload = {
        ...settings,
        renamed_issues: renamedIssues,
      };
      const res = await axios.post("/api/settings/server", payload);
      if (showToast) showToast("Pengaturan server berhasil disimpan!", "success");
      if (res.data?.renamed_count > 0 && showToast) {
        showToast(
          `Berhasil memperbarui ${res.data.renamed_count} data laporan harian yang menggunakan issue lama!`,
          "success"
        );
      }
      setRenamedIssues([]);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("server-settings-updated", { detail: settings }));
      }
    } catch (err) {
      console.error(err);
      if (showToast) showToast("Gagal menyimpan pengaturan server", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleAddIssue = () => {
    if (!newIssue.trim()) return;
    const trimmed = newIssue.trim();
    if (settings.standard_issues.includes(trimmed)) {
      if (showToast) showToast("Issue ini sudah ada di daftar", "warning");
      return;
    }
    setSettings({
      ...settings,
      standard_issues: [...settings.standard_issues, trimmed],
    });
    setNewIssue("");
  };

  const handleSaveEditIssue = (oldName, newName) => {
    const trimmedNew = newName.trim();
    if (!trimmedNew) {
      if (showToast) showToast("Nama issue tidak boleh kosong", "error");
      return;
    }
    if (trimmedNew === oldName) {
      setEditingIssue(null);
      return;
    }
    if (settings.standard_issues.includes(trimmedNew)) {
      if (showToast) showToast("Nama issue tersebut sudah digunakan", "warning");
      return;
    }

    const updated = settings.standard_issues.map((i) => (i === oldName ? trimmedNew : i));
    setSettings({
      ...settings,
      standard_issues: updated,
    });

    setRenamedIssues((prev) => {
      const existing = prev.find((r) => r.new === oldName);
      const filtered = prev.filter((r) => r.new !== oldName && r.old !== oldName);
      if (existing) {
        return [...filtered, { old: existing.old, new: trimmedNew }];
      } else {
        return [...filtered, { old: oldName, new: trimmedNew }];
      }
    });

    setEditingIssue(null);
    if (showToast) showToast(`Issue "${oldName}" diubah menjadi "${trimmedNew}"`, "info");
  };

  const handleRemoveIssue = (issue) => {
    setSettings({
      ...settings,
      standard_issues: settings.standard_issues.filter((i) => i !== issue),
    });
  };

  if (loading) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-6 text-center text-xs text-slate-500 animate-pulse">
        Memuat konfigurasi server...
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-6 text-center text-xs text-rose-400">
        Gagal memuat konfigurasi server.
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {/* ─── Compact Segmented Navigation Tabs ─── */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-950/70 border border-slate-800 rounded-lg overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveSubTab("gateway")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
            activeSubTab === "gateway"
              ? "bg-sky-600 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <Server size={13} />
          <span>Gateway MikroTik & VPN</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("report")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
            activeSubTab === "report"
              ? "bg-sky-600 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <FileText size={13} />
          <span>Parameter Laporan & Issue</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("sync")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
            activeSubTab === "sync"
              ? "bg-sky-600 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
          }`}
        >
          <Activity size={13} />
          <span>Monitoring & Sinkronisasi</span>
        </button>
      </div>

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* SUBTAB 1: MIKROTIK & VPN GATEWAY                              */}
      {/* ═════════════════════════════════════════════════════════════ */}
      {activeSubTab === "gateway" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
          {/* Card 1: MikroTik Gateway (7 cols) */}
          <div className="lg:col-span-6 bg-slate-900/70 border border-slate-800 rounded-lg p-3.5 md:p-4 backdrop-blur-sm transition-all space-y-3.5">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-slate-800/90 border border-slate-700/60 flex items-center justify-center text-sky-400 flex-shrink-0">
                  <Server size={14} />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-200 tracking-wide uppercase">
                    MikroTik Core Gateway
                  </span>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Router pusat monitoring PPPoE, ONT, & interface pelanggan
                  </p>
                </div>
              </div>

              <span className="text-[9px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/50 text-sky-300">
                {coreDevice?.ip_address || "NOT CONFIGURED"}
              </span>
            </div>

            <form onSubmit={handleSaveCore} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                  Nama Router <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  readOnly={!perms?.mikrotikUpdate}
                  value={coreDevice?.name || ""}
                  onChange={(e) =>
                    setCoreDevice && setCoreDevice({ ...coreDevice, name: e.target.value })
                  }
                  placeholder="Contoh: Diskominfo Server"
                  className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-sky-500 rounded-md px-3 py-1.5 text-xs text-slate-100 placeholder-slate-600 outline-none transition disabled:opacity-50"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <div className="sm:col-span-8 space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                    IP Address Host <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    readOnly={!perms?.mikrotikUpdate}
                    value={coreDevice?.ip_address || ""}
                    onChange={(e) =>
                      setCoreDevice && setCoreDevice({ ...coreDevice, ip_address: e.target.value })
                    }
                    placeholder="Contoh: 10.16.25.1"
                    className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-sky-500 rounded-md px-3 py-1.5 text-xs text-slate-100 font-mono placeholder-slate-600 outline-none transition disabled:opacity-50"
                    required
                  />
                </div>

                <div className="sm:col-span-4 space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                    Port API <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    readOnly={!perms?.mikrotikUpdate}
                    value={coreDevice?.port || 8728}
                    onChange={(e) =>
                      setCoreDevice &&
                      setCoreDevice({ ...coreDevice, port: parseInt(e.target.value) || 8728 })
                    }
                    className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-sky-500 rounded-md px-3 py-1.5 text-xs text-slate-100 font-mono outline-none transition disabled:opacity-50"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                    Username API <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    readOnly={!perms?.mikrotikUpdate}
                    value={coreDevice?.username || ""}
                    onChange={(e) =>
                      setCoreDevice && setCoreDevice({ ...coreDevice, username: e.target.value })
                    }
                    placeholder="Username API..."
                    className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-sky-500 rounded-md px-3 py-1.5 text-xs text-slate-100 placeholder-slate-600 outline-none transition disabled:opacity-50"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                    Password API
                  </label>
                  <div className="relative">
                    <input
                      type={showCorePassword && perms?.mikrotikUpdate ? "text" : "password"}
                      readOnly={!perms?.mikrotikUpdate}
                      value={coreDevice?.password || ""}
                      onChange={(e) =>
                        setCoreDevice && setCoreDevice({ ...coreDevice, password: e.target.value })
                      }
                      placeholder={existingId ? "Kosongkan jika tidak diubah" : "Password API..."}
                      className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-sky-500 rounded-md pl-3 pr-8 py-1.5 text-xs text-slate-100 placeholder-slate-600 outline-none transition disabled:opacity-50"
                    />
                    <button
                      type="button"
                      disabled={!perms?.mikrotikUpdate}
                      onClick={() =>
                        perms?.mikrotikUpdate &&
                        setShowCorePassword &&
                        setShowCorePassword(!showCorePassword)
                      }
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                    >
                      {showCorePassword && perms?.mikrotikUpdate ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                </div>
              </div>

              {perms?.mikrotikUpdate && (
                <div className="pt-2 flex justify-end border-t border-slate-800/80">
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 text-xs text-white font-semibold flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                  >
                    <Save size={13} />
                    <span>Simpan MikroTik</span>
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* Card 2: VPN Connection (6 cols) */}
          <div className="lg:col-span-6 bg-slate-900/70 border border-slate-800 rounded-lg p-3.5 md:p-4 backdrop-blur-sm transition-all space-y-3.5">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-slate-800/90 border border-slate-700/60 flex items-center justify-center text-emerald-400 flex-shrink-0">
                  <Network size={14} />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-200 tracking-wide uppercase">
                    VPN Client Connection
                  </span>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Koneksi otomatis saat jaringan tunnel terputus
                  </p>
                </div>
              </div>

              {/* Platform Switcher */}
              <div className="flex items-center gap-1 p-0.5 bg-slate-950 rounded-md border border-slate-800">
                <button
                  type="button"
                  onClick={() =>
                    setVpnConfig && setVpnConfig({ ...vpnConfig, active_platform: "windows" })
                  }
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 transition cursor-pointer ${
                    vpnConfig?.active_platform === "windows"
                      ? "bg-sky-600 text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Monitor size={10} />
                  <span>Windows</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setVpnConfig && setVpnConfig({ ...vpnConfig, active_platform: "linux" })
                  }
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 transition cursor-pointer ${
                    vpnConfig?.active_platform === "linux"
                      ? "bg-sky-600 text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Terminal size={10} />
                  <span>Linux</span>
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveVpn} className="space-y-3">
              {vpnConfig?.active_platform === "windows" ? (
                <>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                      Nama Profil VPN (rasdial) <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      readOnly={!perms?.vpnUpdate}
                      value={vpnConfig?.windows_name || ""}
                      onChange={(e) =>
                        setVpnConfig && setVpnConfig({ ...vpnConfig, windows_name: e.target.value })
                      }
                      placeholder="Contoh: VPN_DISKOMINFO_KABBDG"
                      className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-sky-500 rounded-md px-3 py-1.5 text-xs text-slate-100 placeholder-slate-600 outline-none transition disabled:opacity-50"
                      required={vpnConfig?.active_platform === "windows"}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                        Username VPN
                      </label>
                      <input
                        type="text"
                        readOnly={!perms?.vpnUpdate}
                        value={vpnConfig?.windows_username || ""}
                        onChange={(e) =>
                          setVpnConfig &&
                          setVpnConfig({ ...vpnConfig, windows_username: e.target.value })
                        }
                        placeholder="Opsional..."
                        className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-sky-500 rounded-md px-3 py-1.5 text-xs text-slate-100 placeholder-slate-600 outline-none transition disabled:opacity-50"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                        Password VPN
                      </label>
                      <div className="relative">
                        <input
                          type={showVpnPassword && perms?.vpnUpdate ? "text" : "password"}
                          readOnly={!perms?.vpnUpdate}
                          value={vpnConfig?.windows_password || ""}
                          onChange={(e) =>
                            setVpnConfig &&
                            setVpnConfig({ ...vpnConfig, windows_password: e.target.value })
                          }
                          placeholder="Opsional..."
                          className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-sky-500 rounded-md pl-3 pr-8 py-1.5 text-xs text-slate-100 placeholder-slate-600 outline-none transition disabled:opacity-50"
                        />
                        <button
                          type="button"
                          disabled={!perms?.vpnUpdate}
                          onClick={() =>
                            perms?.vpnUpdate &&
                            setShowVpnPassword &&
                            setShowVpnPassword(!showVpnPassword)
                          }
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                        >
                          {showVpnPassword && perms?.vpnUpdate ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                      Nama Provider Interface (pon &lt;name&gt;) <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      readOnly={!perms?.vpnUpdate}
                      value={vpnConfig?.linux_name || ""}
                      onChange={(e) =>
                        setVpnConfig && setVpnConfig({ ...vpnConfig, linux_name: e.target.value })
                      }
                      placeholder="Contoh: vpn-provider"
                      className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-sky-500 rounded-md px-3 py-1.5 text-xs text-slate-100 placeholder-slate-600 outline-none transition disabled:opacity-50"
                      required={vpnConfig?.active_platform === "linux"}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                        Username PPP
                      </label>
                      <input
                        type="text"
                        readOnly={!perms?.vpnUpdate}
                        value={vpnConfig?.linux_username || ""}
                        onChange={(e) =>
                          setVpnConfig &&
                          setVpnConfig({ ...vpnConfig, linux_username: e.target.value })
                        }
                        placeholder="Opsional..."
                        className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-sky-500 rounded-md px-3 py-1.5 text-xs text-slate-100 placeholder-slate-600 outline-none transition disabled:opacity-50"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                        Password PPP
                      </label>
                      <div className="relative">
                        <input
                          type={showVpnPassword && perms?.vpnUpdate ? "text" : "password"}
                          readOnly={!perms?.vpnUpdate}
                          value={vpnConfig?.linux_password || ""}
                          onChange={(e) =>
                            setVpnConfig &&
                            setVpnConfig({ ...vpnConfig, linux_password: e.target.value })
                          }
                          placeholder="Opsional..."
                          className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-sky-500 rounded-md pl-3 pr-8 py-1.5 text-xs text-slate-100 placeholder-slate-600 outline-none transition disabled:opacity-50"
                        />
                        <button
                          type="button"
                          disabled={!perms?.vpnUpdate}
                          onClick={() =>
                            perms?.vpnUpdate &&
                            setShowVpnPassword &&
                            setShowVpnPassword(!showVpnPassword)
                          }
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                        >
                          {showVpnPassword && perms?.vpnUpdate ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Status and Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 border-t border-slate-800/80">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={vpnConnecting || !perms?.vpnUpdate}
                    onClick={testVpnConnect}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer disabled:opacity-40"
                  >
                    {vpnConnecting ? "Menghubungkan..." : "Tes Hubungkan"}
                  </button>
                  <button
                    type="button"
                    disabled={vpnConnecting || !perms?.vpnUpdate}
                    onClick={testVpnDisconnect}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer disabled:opacity-40"
                  >
                    Putuskan
                  </button>
                  {vpnMsg && (
                    <span className="text-[11px] font-mono text-sky-400 truncate max-w-[140px]" title={vpnMsg}>
                      {vpnMsg}
                    </span>
                  )}
                </div>

                {perms?.vpnUpdate && (
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 text-xs text-white font-semibold flex items-center justify-center gap-1.5 transition shadow-sm cursor-pointer"
                  >
                    <Save size={13} />
                    <span>Simpan VPN</span>
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* SUBTAB 2: PARAMETER LAPORAN & ISSUE STANDAR                   */}
      {/* ═════════════════════════════════════════════════════════════ */}
      {activeSubTab === "report" && (
        <form onSubmit={handleSave} className="space-y-3.5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
            {/* Left Card: Thresholds (5 cols) */}
            <div className="lg:col-span-5 bg-slate-900/70 border border-slate-800 rounded-lg p-3.5 md:p-4 backdrop-blur-sm transition-all space-y-3">
              <div className="flex items-center gap-2 pb-2.5 border-b border-slate-800/80">
                <div className="w-7 h-7 rounded-md bg-slate-800/90 border border-slate-700/60 flex items-center justify-center text-amber-400 flex-shrink-0">
                  <Clock size={14} />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-200 tracking-wide uppercase">
                    Parameter Durasi Laporan
                  </span>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Batas waktu kalkulasi data offline & log
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                    <span>Min. Durasi Offline Laporan Harian</span>
                    <span className="text-[10px] font-mono text-sky-400">Menit</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    readOnly={!canUpdate}
                    value={settings.min_offline_duration_minutes}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        min_offline_duration_minutes: parseInt(e.target.value) || 1,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-sky-500 rounded-md px-3 py-1.5 text-xs text-slate-100 font-mono outline-none transition disabled:opacity-50"
                    required
                  />
                  <p className="text-[10px] text-slate-500 leading-tight">
                    Perangkat offline di bawah durasi ini tidak otomatis dicatat ke laporan harian.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                    <span>Batas Flapping Log Aktivitas</span>
                    <span className="text-[10px] font-mono text-sky-400">Menit</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    readOnly={!canUpdate}
                    value={settings.activity_log_flapping_minutes ?? 10}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        activity_log_flapping_minutes: parseInt(e.target.value) || 1,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-sky-500 rounded-md px-3 py-1.5 text-xs text-slate-100 font-mono outline-none transition disabled:opacity-50"
                    required
                  />
                  <p className="text-[10px] text-slate-500 leading-tight">
                    Flapping status singkat (on/off) otomatis dibersihkan agar log tidak kotor.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Card: Standard Issues Tag List (7 cols) */}
            <div className="lg:col-span-7 bg-slate-900/70 border border-slate-800 rounded-lg p-3.5 md:p-4 backdrop-blur-sm transition-all space-y-3">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-md bg-slate-800/90 border border-slate-700/60 flex items-center justify-center text-sky-400 flex-shrink-0">
                    <FileText size={14} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-200 tracking-wide uppercase">
                      Daftar Pilihan Issue Standar
                    </span>
                    <p className="text-[10px] text-slate-400 font-mono">
                      Kamus kendala gangguan untuk opsi dropdown laporan harian
                    </p>
                  </div>
                </div>

                <span className="text-[9px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/50 text-slate-300">
                  {settings.standard_issues?.length || 0} ITEM
                </span>
              </div>

              {/* Add New Issue Input */}
              {canUpdate && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newIssue}
                    onChange={(e) => setNewIssue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddIssue();
                      }
                    }}
                    placeholder="Tambah issue baru (Contoh: Kabel Digigit Tikus...)"
                    className="flex-1 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-sky-500 rounded-md px-3 py-1.5 text-xs text-slate-100 placeholder-slate-600 outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={handleAddIssue}
                    className="px-3.5 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 text-xs text-white font-semibold flex items-center gap-1 transition shadow-sm cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>Tambah</span>
                  </button>
                </div>
              )}

              {/* Tag Cloud / Badges */}
              <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto custom-scrollbar p-2 bg-slate-950/60 border border-slate-800/80 rounded-lg">
                {settings.standard_issues.map((issue) => {
                  const isEditing = editingIssue?.oldName === issue;
                  return (
                    <div
                      key={issue}
                      className="flex items-center gap-1 bg-slate-900 border border-slate-800 text-slate-200 text-xs px-2.5 py-1 rounded-md transition hover:border-slate-700"
                    >
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={editingIssue.value}
                            onChange={(e) =>
                              setEditingIssue({ ...editingIssue, value: e.target.value })
                            }
                            className="bg-slate-950 border border-sky-500 rounded px-1.5 py-0.5 text-xs text-white outline-none w-40"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleSaveEditIssue(issue, editingIssue.value);
                              }
                              if (e.key === "Escape") {
                                setEditingIssue(null);
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEditIssue(issue, editingIssue.value)}
                            className="text-emerald-400 hover:text-emerald-300 transition cursor-pointer p-0.5"
                          >
                            <Check size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingIssue(null)}
                            className="text-slate-400 hover:text-slate-200 transition cursor-pointer p-0.5"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="font-medium text-[11px] text-slate-200">{issue}</span>
                          {canUpdate && (
                            <div className="flex items-center gap-1 ml-1 pl-1 border-l border-slate-800 text-slate-400">
                              <button
                                type="button"
                                onClick={() => setEditingIssue({ oldName: issue, value: issue })}
                                className="hover:text-sky-400 transition cursor-pointer"
                                title="Edit nama issue"
                              >
                                <Pencil size={10} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveIssue(issue)}
                                className="hover:text-rose-400 transition cursor-pointer"
                                title="Hapus issue"
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {canUpdate && (
            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 text-xs text-white font-semibold flex items-center gap-1.5 transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Save size={13} />
                    <span>Simpan Parameter Laporan</span>
                  </>
                )}
              </button>
            </div>
          )}
        </form>
      )}

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* SUBTAB 3: PARAMETER SINKRONISASI & MONITORING                 */}
      {/* ═════════════════════════════════════════════════════════════ */}
      {activeSubTab === "sync" && (
        <form onSubmit={handleSave} className="space-y-3.5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 items-start">
            {/* Block 1: Ping & Broadcast Core */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3.5 md:p-4 backdrop-blur-sm transition-all space-y-3">
              <div className="flex items-center gap-2 pb-2.5 border-b border-slate-800/80">
                <div className="w-7 h-7 rounded-md bg-slate-800/90 border border-slate-700/60 flex items-center justify-center text-sky-400 flex-shrink-0">
                  <Radio size={14} />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-200 tracking-wide uppercase">
                    Ping & Broadcast
                  </span>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Parameter frekuensi ICMP & polling core
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                    <span>Interval Ping Perangkat</span>
                    <span className="text-[10px] font-mono text-sky-400">Detik</span>
                  </label>
                  <input
                    type="number"
                    min="2"
                    readOnly={!canUpdate}
                    value={settings.ping_interval_seconds}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        ping_interval_seconds: parseInt(e.target.value) || 5,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-sky-500 rounded-md px-3 py-1.5 text-xs text-slate-100 font-mono outline-none transition disabled:opacity-50"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                    <span>Timeout Ping Perangkat</span>
                    <span className="text-[10px] font-mono text-sky-400">Detik</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    readOnly={!canUpdate}
                    value={settings.ping_timeout_seconds}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        ping_timeout_seconds: parseInt(e.target.value) || 15,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-sky-500 rounded-md px-3 py-1.5 text-xs text-slate-100 font-mono outline-none transition disabled:opacity-50"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                    <span>Interval Broadcast Core</span>
                    <span className="text-[10px] font-mono text-sky-400">Detik</span>
                  </label>
                  <input
                    type="number"
                    min="2"
                    readOnly={!canUpdate}
                    value={settings.core_broadcast_interval_seconds || 10}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        core_broadcast_interval_seconds: parseInt(e.target.value) || 10,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-sky-500 rounded-md px-3 py-1.5 text-xs text-slate-100 font-mono outline-none transition disabled:opacity-50"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Block 2: Sinkronisasi Daemon */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3.5 md:p-4 backdrop-blur-sm transition-all space-y-3">
              <div className="flex items-center gap-2 pb-2.5 border-b border-slate-800/80">
                <div className="w-7 h-7 rounded-md bg-slate-800/90 border border-slate-700/60 flex items-center justify-center text-emerald-400 flex-shrink-0">
                  <RefreshCw size={14} />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-200 tracking-wide uppercase">
                    Sinkronisasi Daemon
                  </span>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Interval background sync per integrasi
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                    <span>Sync Ruijie Cloud</span>
                    <span className="text-[10px] font-mono text-sky-400">Detik</span>
                  </label>
                  <input
                    type="number"
                    min="5"
                    readOnly={!canUpdate}
                    value={settings.sync_ruijie_interval_seconds || 60}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        sync_ruijie_interval_seconds: parseInt(e.target.value) || 60,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-sky-500 rounded-md px-3 py-1.5 text-xs text-slate-100 font-mono outline-none transition disabled:opacity-50"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                    <span>Sync MikroTik Router</span>
                    <span className="text-[10px] font-mono text-sky-400">Detik</span>
                  </label>
                  <input
                    type="number"
                    min="5"
                    readOnly={!canUpdate}
                    value={settings.sync_mikrotik_interval_seconds || 60}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        sync_mikrotik_interval_seconds: parseInt(e.target.value) || 60,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-sky-500 rounded-md px-3 py-1.5 text-xs text-slate-100 font-mono outline-none transition disabled:opacity-50"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                      <span>Sync HSGQ OLT</span>
                    </label>
                    <input
                      type="number"
                      min="5"
                      readOnly={!canUpdate}
                      value={settings.sync_hsgq_interval_seconds || 60}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          sync_hsgq_interval_seconds: parseInt(e.target.value) || 60,
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-sky-500 rounded-md px-3 py-1.5 text-xs text-slate-100 font-mono outline-none transition disabled:opacity-50"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                      <span>Sync Mappings</span>
                    </label>
                    <input
                      type="number"
                      min="5"
                      readOnly={!canUpdate}
                      value={settings.sync_mappings_interval_seconds || 60}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          sync_mappings_interval_seconds: parseInt(e.target.value) || 60,
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-sky-500 rounded-md px-3 py-1.5 text-xs text-slate-100 font-mono outline-none transition disabled:opacity-50"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Block 3: Alarm Offline & Sound */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3.5 md:p-4 backdrop-blur-sm transition-all space-y-3">
              <div className="flex items-center gap-2 pb-2.5 border-b border-slate-800/80">
                <div className="w-7 h-7 rounded-md bg-slate-800/90 border border-slate-700/60 flex items-center justify-center text-rose-400 flex-shrink-0">
                  <Bell size={14} />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-200 tracking-wide uppercase">
                    Alarm & Notifikasi
                  </span>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Delay anti-flapping & jenis audio alarm
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                    <span>Delay Alarm Offline</span>
                    <span className="text-[10px] font-mono text-rose-400">ms (Milidetik)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    readOnly={!canUpdate}
                    value={settings.alarm_delay_ms ?? 1500}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        alarm_delay_ms: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-sky-500 rounded-md px-3 py-1.5 text-xs text-slate-100 font-mono outline-none transition disabled:opacity-50"
                    required
                  />
                  <p className="text-[10px] text-slate-500 leading-tight">
                    Jeda sebelum alarm audio berbunyi untuk menghindari false-positive.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                    <span>Jenis Suara Alarm</span>
                    {testAlarm && (
                      <button
                        type="button"
                        onClick={testAlarm}
                        className="text-[10px] text-sky-400 hover:text-sky-300 hover:underline flex items-center gap-1 transition cursor-pointer"
                      >
                        <Volume2 size={11} />
                        <span>Tes Suara</span>
                      </button>
                    )}
                  </label>
                  <select
                    disabled={!canUpdate}
                    value={settings.alarm_sound || "beep"}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        alarm_sound: e.target.value,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-sky-500 rounded-md px-3 py-1.5 text-xs text-slate-100 outline-none transition cursor-pointer"
                    required
                  >
                    <option value="beep">Beep (Default - Nada Kotak 4x)</option>
                    <option value="siren">Siren (Nada Naik-Turun Sawtooth)</option>
                    <option value="alert">Alert (3 Nada Kotak Cepat)</option>
                    <option value="ping">Ping (Nada Sine Lembut)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {canUpdate && (
            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 text-xs text-white font-semibold flex items-center gap-1.5 transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Save size={13} />
                    <span>Simpan Parameter Sinkronisasi</span>
                  </>
                )}
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
