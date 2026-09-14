"use client";

export const PRESET_THEMES = [
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
    primary: "#3296FF",
    success: "#10B981",
    warning: "#E4F222",
    danger: "#EB5757",
    purple: "#8B5CF6",
    tagOpd: "#B5B5B5",
    tagDesa: "#02B8CC",
  },
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
  const defaultTheme = PRESET_THEMES[0];
  if (typeof window === "undefined") return defaultTheme;
  try {
    const raw = localStorage.getItem("nocr_custom_theme");
    if (raw && raw !== "undefined" && raw !== "null") {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        // If old default (blue-nocr or previous linear-dark) is stored, migrate to new Linear Dark with #3296FF
        if (
          parsed.id === "blue-nocr" ||
          parsed.id === "linear-dark" ||
          parsed.primary === "#3B82F6" ||
          parsed.primary === "#6366F1" ||
          parsed.primary === "#3232FB"
        ) {
          const merged = {
            ...defaultTheme,
            ...parsed,
            id: "linear-dark",
            name: "Linear Dark",
            primary: (parsed.primary === "#6366F1" || parsed.primary === "#3B82F6" || parsed.primary === "#3232FB" || !parsed.primary) ? defaultTheme.primary : parsed.primary,
            tagOpd: (parsed.tagOpd === "#8B5CF6" || parsed.tagOpd === "#A855F7" || !parsed.tagOpd) ? defaultTheme.tagOpd : parsed.tagOpd,
            tagDesa: parsed.tagDesa || defaultTheme.tagDesa,
          };
          localStorage.setItem("nocr_custom_theme", JSON.stringify(merged));
          return merged;
        }
        return parsed;
      }
    }
  } catch (e) {
    console.error("Gagal membaca tema dari localStorage", e);
  }
  return defaultTheme;
}

export function applyThemeConfig(config) {
  if (typeof document === "undefined") return;

  const safeConfig = (config && typeof config === "object") ? config : PRESET_THEMES[0];
  const root = document.documentElement;
  const body = document.body;

  const isLight = safeConfig.category === "light";

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

  // Set CSS Variables on root for dynamic custom color system (Default: Linear Dark)
  root.style.setProperty("--color-app-bg", safeConfig.bg || "#08090A");
  root.style.setProperty("--color-card-bg", safeConfig.card || "#191D20");
  root.style.setProperty(
    "--color-header-bg",
    safeConfig.header || safeConfig.card || "#08090A",
  );
  root.style.setProperty("--color-border-main", safeConfig.border || "#383B3F");
  root.style.setProperty("--color-text-main", safeConfig.text || "#FFFFFF");
  root.style.setProperty("--color-text-muted", safeConfig.muted || "#9C9DA1");
  root.style.setProperty("--color-primary", safeConfig.primary || "#3296FF");
  root.style.setProperty("--color-success", safeConfig.success || "#10B981");
  root.style.setProperty("--color-warning", safeConfig.warning || "#E4F222");
  root.style.setProperty("--color-danger", safeConfig.danger || "#EB5757");
  root.style.setProperty("--color-purple", safeConfig.purple || "#8B5CF6");
  root.style.setProperty("--color-tag-opd", safeConfig.tagOpd || "#B5B5B5");
  root.style.setProperty("--color-tag-desa", safeConfig.tagDesa || "#02B8CC");

  // Legacy fallback properties
  root.style.setProperty("--color-light-bg", safeConfig.bg || "#F6F5F4");
  root.style.setProperty("--color-light-card", safeConfig.card || "#FFFFFF");
  root.style.setProperty("--color-light-border", safeConfig.border || "#DFDCD9");
  root.style.setProperty("--color-light-text", safeConfig.text || "#111111");
  root.style.setProperty("--color-light-muted", safeConfig.muted || "#615D59");
  root.style.setProperty("--color-brand-blue", safeConfig.primary || "#3296FF");

  // Save config in localStorage
  localStorage.setItem("nocr_custom_theme", JSON.stringify(safeConfig));
  localStorage.setItem("nocr_theme", isLight ? "light" : "dark");

  // Dispatch custom event to notify all listeners
  window.dispatchEvent(
    new CustomEvent("nocr-theme-changed", { detail: safeConfig }),
  );
}
