"use client";

export const PRESET_THEMES = [
   {
    id: "blue-nocr",
    name: "Blue NOCR",
    category: "dark",
    bg: "#0F172A",
    card: "#1E293B",
    header: "#1E293B",
    text: "#F8FAFC",
    muted: "#94A3B8",
    border: "#334155",
    primary: "#3B82F6",
    success: "#10B981",
    warning: "#F59E0B",
    danger: "#EF4444",
    purple: "#8B5CF6",
    tagOpd: "#A855F7",
    tagDesa: "#3B82F6",
  },
  {
    id: "notion-light",
    name: "Notion Light",
    category: "light",
    bg: "#F6F5F4",
    card: "#FFFFFF",
    header: "#FFFFFF",
    text: "#111111",
    muted: "#615D59",
    border: "#DFDCD9",
    primary: "#097FE8",
    success: "#1AAE39",
    warning: "#FFB110",
    danger: "#F64932",
    purple: "#AD6DED",
    tagOpd: "#AD6DED",
    tagDesa: "#097FE8",
  },

  {
    id: "netflix-dark",
    name: "Netflix Dark",
    category: "dark",
    bg: "#161616",
    card: "#232323",
    header: "#161616",
    text: "#FFFFFF",
    muted: "#A9A9A9",
    border: "#414141",
    primary: "#E50914",
    success: "#2BB871",
    warning: "#D89D31",
    danger: "#EB3942",
    purple: "#99161D",
    tagOpd: "#C11119",
    tagDesa: "#E50914",
  },
  {
    id: "emerald-mint",
    name: "Emerald Mint",
    category: "light",
    bg: "#F2F9F5",
    card: "#FFFFFF",
    header: "#FFFFFF",
    text: "#064E3B",
    muted: "#4B5563",
    border: "#D1E7DD",
    primary: "#059669",
    success: "#10B981",
    warning: "#D97706",
    danger: "#DC2626",
    purple: "#7C3AED",
    tagOpd: "#8B5CF6",
    tagDesa: "#059669",
  },
  {
    id: "linear-dark",
    name: "Linear Dark",
    category: "dark",
    bg: "#08090A",
    card: "#191D20",
    header: "#08090A",
    text: "#FFFFFF",
    muted: "#9C9DA1",
    border: "#383B3F",
    primary: "#6366F1",
    success: "#10B981",
    warning: "#E4F222",
    danger: "#EB5757",
    purple: "#8B5CF6",
    tagOpd: "#8B5CF6",
    tagDesa: "#02B8CC",
  },
  {
    id: "sunset-amber",
    name: "Sunset Amber",
    category: "light",
    bg: "#FDFBF7",
    card: "#FFFFFF",
    header: "#FFFFFF",
    text: "#451A03",
    muted: "#78350F",
    border: "#F3E8D8",
    primary: "#D97706",
    success: "#16A34A",
    warning: "#F59E0B",
    danger: "#E11D48",
    purple: "#9333EA",
    tagOpd: "#A855F7",
    tagDesa: "#D97706",
  },
];

export function getStoredThemeConfig() {
  if (typeof window === "undefined") return PRESET_THEMES[1];
  try {
    const raw = localStorage.getItem("nocr_custom_theme");
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error("Gagal membaca tema dari localStorage", e);
  }
  return PRESET_THEMES[1];
}

export function applyThemeConfig(config) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const body = document.body;

  const isLight = config.category === "light";

  if (isLight) {
    root.classList.add("light");
    root.classList.remove("dark");
    root.setAttribute("data-theme", "light");
    if (body) {
      body.classList.add("light");
      body.classList.remove("dark");
    }
  } else {
    root.classList.add("dark");
    root.classList.remove("light");
    root.setAttribute("data-theme", "dark");
    if (body) {
      body.classList.add("dark");
      body.classList.remove("light");
    }
  }

  // Set CSS Variables on root for dynamic custom color system
  root.style.setProperty("--color-app-bg", config.bg || "#F6F5F4");
  root.style.setProperty("--color-card-bg", config.card || "#FFFFFF");
  root.style.setProperty(
    "--color-header-bg",
    config.header || config.card || "#FFFFFF",
  );
  root.style.setProperty("--color-border-main", config.border || "#DFDCD9");
  root.style.setProperty("--color-text-main", config.text || "#111111");
  root.style.setProperty("--color-text-muted", config.muted || "#615D59");
  root.style.setProperty("--color-primary", config.primary || "#097FE8");
  root.style.setProperty("--color-success", config.success || "#1AAE39");
  root.style.setProperty("--color-warning", config.warning || "#FFB110");
  root.style.setProperty("--color-danger", config.danger || "#F64932");
  root.style.setProperty("--color-purple", config.purple || "#AD6DED");
  root.style.setProperty("--color-tag-opd", config.tagOpd || config.purple || "#AD6DED");
  root.style.setProperty("--color-tag-desa", config.tagDesa || config.primary || "#097FE8");

  // Legacy fallback properties
  root.style.setProperty("--color-light-bg", config.bg || "#F6F5F4");
  root.style.setProperty("--color-light-card", config.card || "#FFFFFF");
  root.style.setProperty("--color-light-border", config.border || "#DFDCD9");
  root.style.setProperty("--color-light-text", config.text || "#111111");
  root.style.setProperty("--color-light-muted", config.muted || "#615D59");
  root.style.setProperty("--color-brand-blue", config.primary || "#097FE8");

  // Save config in localStorage
  localStorage.setItem("nocr_custom_theme", JSON.stringify(config));
  localStorage.setItem("nocr_theme", isLight ? "light" : "dark");

  // Dispatch custom event to notify all listeners
  window.dispatchEvent(
    new CustomEvent("nocr-theme-changed", { detail: config }),
  );
}
