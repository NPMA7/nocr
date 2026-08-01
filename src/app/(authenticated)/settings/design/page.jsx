"use client";

import { useState, useEffect } from "react";
import {
  Palette,
  Check,
  RotateCcw,
  Save,
  Sun,
  Moon,
  Sparkles,
  Layout,
  Cpu,
  Router,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import {
  PRESET_THEMES,
  getStoredThemeConfig,
  applyThemeConfig,
} from "@/lib/themeEngine";

export default function DesignSettingsPage() {
  const [currentConfig, setCurrentConfig] = useState(PRESET_THEMES[0]);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const config = getStoredThemeConfig();
    setCurrentConfig(config);
  }, []);

  const handleSelectPreset = (preset) => {
    setCurrentConfig(preset);
    applyThemeConfig(preset);
    setIsSaved(false);
  };

  const handleColorChange = (key, value) => {
    const updated = {
      ...currentConfig,
      id: "custom",
      name: "Kustom Pengguna",
      category: currentConfig.category || "light",
      [key]: value,
    };
    setCurrentConfig(updated);
    applyThemeConfig(updated);
    setIsSaved(false);
  };
  const handleReset = () => {
    const defaultConfig = PRESET_THEMES[0]; // Notion Light default
    setCurrentConfig(defaultConfig);
    applyThemeConfig(defaultConfig);
    setIsSaved(false);
  };

  return (
    <div className="h-full min-h-0 flex flex-col gap-6 overflow-y-auto p-2 md:p-4 max-w-6xl mx-auto">
      {/* Header Halaman */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700/50 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Palette className="text-blue-500" size={24} />
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
              Pengaturan Desain & Kustomisasi Warna
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Sesuaikan skema warna tema, tampilan latar belakang, dan tombol
            aplikasi sesuai selera Anda.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            className="cursor-pointer text-xs font-semibold px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1.5"
          >
            <RotateCcw size={14} /> Reset Default
          </button>
        </div>
      </div>

      {/* Grid Utama: Preset Themes & Color Customizer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kolom Kiri: Pilihan Preset Tema */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-200 flex items-center gap-2">
            <Sparkles size={16} className="text-amber-500" /> Pilihan Preset
            Tema
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PRESET_THEMES.map((theme) => {
              const isSelected = currentConfig.id === theme.id;
              return (
                <div
                  key={theme.id}
                  onClick={() => handleSelectPreset(theme)}
                  style={{
                    borderColor: isSelected
                      ? "var(--color-primary)"
                      : undefined,
                  }}
                  className={`cursor-pointer p-4 rounded-xl border transition-all duration-200 flex flex-col justify-between gap-3 relative overflow-hidden ${
                    isSelected
                      ? "ring-2 ring-blue-500/20 shadow-md bg-white dark:bg-slate-800"
                      : "border-slate-200 dark:border-slate-700/60 hover:border-slate-400 dark:hover:border-slate-500 bg-white dark:bg-slate-800/60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {theme.category === "light" ? (
                        <Sun size={16} className="text-amber-500" />
                      ) : (
                        <Moon
                          size={16}
                          style={{
                            color: isSelected
                              ? "var(--color-primary)"
                              : undefined,
                          }}
                          className={!isSelected ? "text-blue-400" : ""}
                        />
                      )}
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {theme.name}
                      </span>
                    </div>
                    {isSelected && (
                      <span
                        className="text-white rounded-full p-0.5"
                        style={{ backgroundColor: "var(--color-primary)" }}
                      >
                        <Check size={12} />
                      </span>
                    )}
                  </div>

                  {/* Visual Color Palette Swatches */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <div
                      className="w-6 h-6 rounded-md border border-slate-300/60 shadow-xs"
                      style={{ backgroundColor: theme.bg }}
                      title={`Latar Belakang: ${theme.bg}`}
                    />
                    <div
                      className="w-6 h-6 rounded-md border border-slate-300/60 shadow-xs"
                      style={{ backgroundColor: theme.card }}
                      title={`Kartu Surface: ${theme.card}`}
                    />
                    <div
                      className="w-6 h-6 rounded-md border border-slate-300/60 shadow-xs"
                      style={{ backgroundColor: theme.primary }}
                      title={`Aksen Utama: ${theme.primary}`}
                    />
                    <div
                      className="w-6 h-6 rounded-md border border-slate-300/60 shadow-xs"
                      style={{ backgroundColor: theme.success }}
                      title={`Status Online: ${theme.success}`}
                    />
                    <div
                      className="w-6 h-6 rounded-md border border-slate-300/60 shadow-xs"
                      style={{ backgroundColor: theme.danger }}
                      title={`Status Offline: ${theme.danger}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Kustomisasi Manual Warna (Custom Color Pickers) */}
          <div className="mt-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl p-4 md:p-5 flex flex-col gap-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-200 flex items-center gap-2">
              <Palette size={16} className="text-blue-500" /> Kustomisasi Warna
              Manual
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900/40">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Warna Latar Belakang (App Bg)
                </span>
                <input
                  type="color"
                  value={currentConfig.bg || "#F6F5F4"}
                  onChange={(e) => handleColorChange("bg", e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900/40">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Warna Kartu / Card Surface
                </span>
                <input
                  type="color"
                  value={currentConfig.card || "#FFFFFF"}
                  onChange={(e) => handleColorChange("card", e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900/40">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Warna Header & Sidebar
                </span>
                <input
                  type="color"
                  value={
                    currentConfig.header || currentConfig.card || "#FFFFFF"
                  }
                  onChange={(e) => handleColorChange("header", e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900/40">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Warna Aksen Utama (Primary)
                </span>
                <input
                  type="color"
                  value={currentConfig.primary || "#097FE8"}
                  onChange={(e) => handleColorChange("primary", e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900/40">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Warna Teks Utama
                </span>
                <input
                  type="color"
                  value={currentConfig.text || "#111111"}
                  onChange={(e) => handleColorChange("text", e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900/40">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Warna Teks Subtitle / Muted
                </span>
                <input
                  type="color"
                  value={currentConfig.muted || "#615D59"}
                  onChange={(e) => handleColorChange("muted", e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900/40">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Warna Garis Border
                </span>
                <input
                  type="color"
                  value={currentConfig.border || "#DFDCD9"}
                  onChange={(e) => handleColorChange("border", e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900/40">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Warna Status Online (UP)
                </span>
                <input
                  type="color"
                  value={currentConfig.success || "#1AAE39"}
                  onChange={(e) => handleColorChange("success", e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900/40">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Warna Status Warning
                </span>
                <input
                  type="color"
                  value={currentConfig.warning || "#FFB110"}
                  onChange={(e) => handleColorChange("warning", e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900/40">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Warna Status Offline (DOWN)
                </span>
                <input
                  type="color"
                  value={currentConfig.danger || "#F64932"}
                  onChange={(e) => handleColorChange("danger", e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900/40">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Warna Tag OPD
                </span>
                <input
                  type="color"
                  value={
                    currentConfig.tagOpd || currentConfig.purple || "#AD6DED"
                  }
                  onChange={(e) => handleColorChange("tagOpd", e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900/40">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Warna Tag DESA
                </span>
                <input
                  type="color"
                  value={
                    currentConfig.tagDesa || currentConfig.primary || "#097FE8"
                  }
                  onChange={(e) => handleColorChange("tagDesa", e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Pratinjau Langsung (Live Interactive Preview) */}
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-200 flex items-center gap-2">
            <Layout size={16} className="text-purple-500" /> Pratinjau Tampilan
            Langsung
          </h2>

          <div
            className="p-4 rounded-xl border flex flex-col gap-4 transition-all duration-300 shadow-md"
            style={{
              backgroundColor: currentConfig.bg,
              borderColor: currentConfig.border,
              color: currentConfig.text,
            }}
          >
            {/* Header Mini Preview */}
            <div
              className="p-3 rounded-lg border flex justify-between items-center shadow-xs"
              style={{
                backgroundColor: currentConfig.header,
                borderColor: currentConfig.border,
              }}
            >
              <div
                className="flex items-center gap-2 text-xs font-bold"
                style={{ color: currentConfig.text }}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: currentConfig.primary }}
                />
                NOCR Preview Panel
              </div>
              <button
                className="text-[10px] font-bold px-2.5 py-1 rounded text-white shadow-xs"
                style={{ backgroundColor: currentConfig.primary }}
              >
                Aksi Utama
              </button>
            </div>

            {/* Mini Stat Card Preview */}
            <div className="grid grid-cols-2 gap-2">
              <div
                className="p-3 rounded-lg border flex flex-col gap-1 shadow-xs"
                style={{
                  backgroundColor: currentConfig.card,
                  borderColor: currentConfig.border,
                }}
              >
                <div
                  className="flex items-center gap-1.5 text-[10px]"
                  style={{ color: currentConfig.muted }}
                >
                  <Cpu size={12} style={{ color: currentConfig.primary }} /> CPU
                  Load
                </div>
                <span
                  className="text-sm font-extrabold"
                  style={{ color: currentConfig.text }}
                >
                  14%
                </span>
              </div>

              <div
                className="p-3 rounded-lg border flex flex-col gap-1 shadow-xs"
                style={{
                  backgroundColor: currentConfig.card,
                  borderColor: currentConfig.border,
                }}
              >
                <div
                  className="flex items-center gap-1.5 text-[10px]"
                  style={{ color: currentConfig.muted }}
                >
                  <Router size={12} style={{ color: currentConfig.success }} />{" "}
                  Interfaces
                </div>
                <span
                  className="text-sm font-extrabold"
                  style={{ color: currentConfig.text }}
                >
                  505
                </span>
              </div>
            </div>

            {/* Status Badges & Tag OPD/DESA Preview */}
            <div
              className="p-3 rounded-lg border flex flex-col gap-2 shadow-xs"
              style={{
                backgroundColor: currentConfig.card,
                borderColor: currentConfig.border,
              }}
            >
              <span
                className="text-[11px] font-bold"
                style={{ color: currentConfig.muted }}
              >
                Indikator Status & Badge Pemisah
              </span>
              <div className="flex items-center gap-2 flex-wrap text-[10px]">
                <span
                  className="px-2 py-0.5 rounded-full font-bold flex items-center gap-1"
                  style={{
                    backgroundColor: `${currentConfig.success}20`,
                    color: currentConfig.success,
                  }}
                >
                  <CheckCircle2 size={10} /> Online (UP)
                </span>
                <span
                  className="px-2 py-0.5 rounded-full font-bold flex items-center gap-1"
                  style={{
                    backgroundColor: `${currentConfig.danger}20`,
                    color: currentConfig.danger,
                  }}
                >
                  <AlertTriangle size={10} /> Offline (DOWN)
                </span>
                <span
                  className="px-2 py-0.5 rounded font-bold border"
                  style={{
                    backgroundColor: `${currentConfig.tagOpd || currentConfig.purple || "#AD6DED"}20`,
                    color:
                      currentConfig.tagOpd || currentConfig.purple || "#AD6DED",
                    borderColor: `${currentConfig.tagOpd || currentConfig.purple || "#AD6DED"}40`,
                  }}
                >
                  OPD
                </span>
                <span
                  className="px-2 py-0.5 rounded font-bold border"
                  style={{
                    backgroundColor: `${currentConfig.tagDesa || currentConfig.primary || "#097FE8"}20`,
                    color:
                      currentConfig.tagDesa ||
                      currentConfig.primary ||
                      "#097FE8",
                    borderColor: `${currentConfig.tagDesa || currentConfig.primary || "#097FE8"}40`,
                  }}
                >
                  Desa
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
