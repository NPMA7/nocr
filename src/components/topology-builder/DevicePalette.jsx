"use client";
import React, { useState, useMemo, useCallback } from "react";
import {
  Search,
  Cloud,
  Server,
  Router,
  Wifi,
  Shield,
  Monitor,
  Database,
  Radio,
  Box,
  Layers,
  Laptop,
  Plus,
  Tv,
  Camera,
  PhoneCall,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Layers3,
  PanelLeftClose,
  RadioTower,
  Globe,
  Building2,
  Home,
  CheckCircle2,
  XCircle,
  Network,
  Lock,
} from "lucide-react";

export const DEVICE_CATALOG = [
  {
    category: "Perangkat Aktif (Active)",
    items: [
      {
        type: "cloud",
        label: "ISP Cloud",
        sublabel: "Internet Gateway",
        vendor: "ISP",
        icon: Cloud,
      },
      {
        type: "router",
        label: "MikroTik Router",
        sublabel: "Core Router / Gateway",
        vendor: "MikroTik",
        icon: Router,
      },
      {
        type: "vpn",
        label: "VPN Tunneling",
        sublabel: "WireGuard / L2TP / IPSec",
        vendor: "VPN Gateway",
        icon: Network,
      },
      {
        type: "olt",
        label: "HSGQ OLT",
        sublabel: "Optical Line Terminal",
        vendor: "HSGQ",
        icon: Layers,
      },
      {
        type: "switch",
        label: "Switch",
        sublabel: "Switch L2 / L3 / PoE",
        vendor: "Switch",
        icon: Layers,
      },
      {
        type: "firewall",
        label: "Firewall",
        sublabel: "Security Gateway",
        vendor: "Firewall",
        icon: Shield,
      },
      {
        type: "ap",
        label: "Access Point",
        sublabel: "Wi-Fi AP / Hotspot",
        vendor: "Ruijie",
        icon: Wifi,
      },
      {
        type: "wireless",
        label: "Radio Wireless",
        sublabel: "Antena PTP / PtMP",
        vendor: "Wireless",
        icon: Radio,
      },
    ],
  },
  {
    category: "FTTH Pasif (Fiber Pasif)",
    items: [
      {
        type: "odc",
        label: "ODC",
        sublabel: "Optical Distribution Cabinet",
        vendor: "ODC",
        icon: Database,
      },
      {
        type: "odp",
        label: "ODP",
        sublabel: "Optical Distribution Point",
        vendor: "ODP",
        icon: Box,
      },
    ],
  },
  {
    category: "Endpoints & Client",
    items: [
      {
        type: "server",
        label: "Server",
        sublabel: "Server Rack / Datacenter",
        vendor: "Server",
        icon: Server,
      },
      {
        type: "client",
        label: "PC Client",
        sublabel: "Workstation / Laptop",
        vendor: "Client",
        icon: Monitor,
      },
    ],
  },
];

export const matchHardwareType = (node, hwKey) => {
  if (!node || !hwKey) return false;
  const nodeHw = (node.nocr_hw_type || "").toLowerCase();
  const nodeType = (node.type || "").toLowerCase();
  const nodeVendor = (node.vendor || "").toLowerCase();
  const nodeSublabel = (node.sublabel || "").toLowerCase();
  const key = hwKey.toLowerCase();

  if (key === "ont") {
    return (
      nodeHw === "ont" ||
      nodeType === "ont" ||
      nodeType === "modem" ||
      nodeVendor.includes("ont") ||
      nodeSublabel.includes("ont") ||
      nodeSublabel.includes("modem")
    );
  }

  if (key === "mikrotik") {
    return (
      nodeHw === "mikrotik" ||
      nodeType === "router" ||
      nodeVendor.includes("mikrotik") ||
      nodeSublabel.includes("mikrotik")
    );
  }

  if (key === "ruijie") {
    return (
      nodeHw === "ruijie" ||
      nodeType === "ap" ||
      nodeType === "wifi" ||
      nodeVendor.includes("ruijie") ||
      nodeSublabel.includes("ruijie")
    );
  }

  return false;
};

export const isSameSite = (node, siteMapping) => {
  if (!node || !siteMapping) return false;
  if (node.mapping_prefix && siteMapping.prefix) {
    if (node.mapping_prefix.toLowerCase() === siteMapping.prefix.toLowerCase()) return true;
  }
  if (node.mapping_mac && siteMapping.ruijie_mac) {
    if (node.mapping_mac.toLowerCase() === siteMapping.ruijie_mac.toLowerCase()) return true;
  }
  if (node.label && siteMapping.site_name) {
    if (node.label.trim().toLowerCase() === siteMapping.site_name.trim().toLowerCase()) return true;
  }
  if (node.label && siteMapping.prefix) {
    if (node.label.trim().toLowerCase() === siteMapping.prefix.trim().toLowerCase()) return true;
  }
  return false;
};

export default function DevicePalette({
  onAddNodeDirect,
  liveMappings = [],
  liveDevices = [],
  canvasNodes = [],
  onClose,
  readOnly = false,
  canCreate = true,
}) {
  const [search, setSearch] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [activeTab, setActiveTab] = useState("live");
  const [liveFilter, setLiveFilter] = useState("all");

  const isEditable = !readOnly && canCreate;

  const toggleCategory = (cat) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }));
  };

  const getSiteCanvasStatus = useCallback(
    (m) => {
      const isOPD = m.connection_type === "PPPOE";
      const keys = isOPD ? ["ont", "ruijie"] : ["ont", "mikrotik", "ruijie"];
      const total = keys.length;
      let used = 0;
      for (const k of keys) {
        if ((canvasNodes || []).some((n) => isSameSite(n, m) && matchHardwareType(n, k))) {
          used++;
        }
      }
      return {
        total,
        used,
        isAllUsed: used >= total,
        unused: total - used,
      };
    },
    [canvasNodes]
  );

  const filteredCatalog = useMemo(() => {
    if (!search) return DEVICE_CATALOG;
    return DEVICE_CATALOG.map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (item) =>
          item.label.toLowerCase().includes(search.toLowerCase()) ||
          item.sublabel.toLowerCase().includes(search.toLowerCase()) ||
          item.vendor.toLowerCase().includes(search.toLowerCase())
      ),
    })).filter((cat) => cat.items.length > 0);
  }, [search]);

  const filteredLiveMappings = useMemo(() => {
    let list = liveMappings;

    if (liveFilter === "desa") {
      list = list.filter((m) => m.connection_type !== "PPPOE");
    } else if (liveFilter === "opd") {
      list = list.filter((m) => m.connection_type === "PPPOE");
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          (m.prefix && m.prefix.toLowerCase().includes(q)) ||
          (m.site_name && m.site_name.toLowerCase().includes(q)) ||
          (m.ip && m.ip.toLowerCase().includes(q)) ||
          (m.remote_address && m.remote_address.toLowerCase().includes(q)) ||
          (m.ruijie_mac && m.ruijie_mac.toLowerCase().includes(q))
      );
    }

    return [...list].sort((a, b) => {
      const statusA = getSiteCanvasStatus(a);
      const statusB = getSiteCanvasStatus(b);

      if (statusA.isAllUsed !== statusB.isAllUsed) {
        return statusA.isAllUsed ? 1 : -1;
      }

      if (statusA.unused !== statusB.unused) {
        return statusB.unused - statusA.unused;
      }

      const nameA = (a.site_name || a.prefix || "").toLowerCase();
      const nameB = (b.site_name || b.prefix || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [liveMappings, liveFilter, search, getSiteCanvasStatus]);

  const desaCount = useMemo(
    () => liveMappings.filter((m) => m.connection_type !== "PPPOE").length,
    [liveMappings]
  );
  const opdCount = useMemo(
    () => liveMappings.filter((m) => m.connection_type === "PPPOE").length,
    [liveMappings]
  );

  const handleDragStart = (e, item) => {
    if (!isEditable) return;
    e.dataTransfer.setData(
      "application/nocr-topology-node",
      JSON.stringify({
        type: item.type,
        nocr_hw_type: item.nocr_hw_type,
        nocr_category: item.nocr_category,
        status_source: item.status_source,
        label: item.label,
        sublabel: item.sublabel,
        vendor: item.vendor,
        ports: item.ports,
        ip: item.ip || "",
        status: item.status || "online",
        mapping_prefix: item.mapping_prefix,
        mapping_mac: item.mapping_mac,
        is_live_nocr: item.is_live_nocr,
      })
    );
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div className="w-72 bg-slate-900 border-r border-slate-700/60 flex flex-col h-full select-none flex-shrink-0 z-30">
      {/* Header Palette */}
      <div className="p-3 border-b border-slate-700/60 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.3)]">
              <Sparkles size={13} />
            </div>
            <span className="text-xs font-bold text-slate-100 uppercase tracking-wider">
              Katalog Perangkat
            </span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              title="Sembunyikan Panel Perangkat"
              className="cursor-pointer p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition border border-transparent hover:border-slate-700"
            >
              <PanelLeftClose size={15} />
            </button>
          )}
        </div>

        {!isEditable && (
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-semibold text-center">
            Mode Hanya Lihat (Read-Only)
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px] font-semibold">
          <button
            onClick={() => setActiveTab("live")}
            className={`cursor-pointer flex-1 py-1 rounded-md transition ${
              activeTab === "live"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Hardware NOCR ({liveMappings.length})
          </button>
          <button
            onClick={() => setActiveTab("catalog")}
            className={`cursor-pointer flex-1 py-1 rounded-md transition ${
              activeTab === "catalog"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Hardware Lainnya
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            type="text"
            placeholder={
              activeTab === "live"
                ? "Cari nama Desa, OPD, IP..."
                : "Cari router, OLT, switch, AP..."
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
          />
        </div>

        {/* Sub-filter untuk Data NOCR */}
        {activeTab === "live" && (
          <div className="flex items-center gap-1 text-[10px] font-semibold pt-0.5">
            <button
              onClick={() => setLiveFilter("all")}
              className={`cursor-pointer px-2 py-0.5 rounded-md transition ${
                liveFilter === "all"
                  ? "bg-slate-800 text-white border border-slate-700 font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Semua ({liveMappings.length})
            </button>
            <button
              onClick={() => setLiveFilter("desa")}
              className={`cursor-pointer px-2 py-0.5 rounded-md transition flex items-center gap-1 ${
                liveFilter === "desa"
                  ? "bg-blue-900/60 text-blue-300 border border-blue-600/50 font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Home size={10} />
              <span>Desa ({desaCount})</span>
            </button>
            <button
              onClick={() => setLiveFilter("opd")}
              className={`cursor-pointer px-2 py-0.5 rounded-md transition flex items-center gap-1 ${
                liveFilter === "opd"
                  ? "bg-purple-900/60 text-purple-300 border border-purple-600/50 font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Building2 size={10} />
              <span>OPD ({opdCount})</span>
            </button>
          </div>
        )}
      </div>

      {/* List Items */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2 custom-scrollbar">
        {activeTab === "catalog" ? (
          filteredCatalog.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">
              Tidak ada perangkat yang cocok
            </div>
          ) : (
            filteredCatalog.map((cat) => {
              const isCollapsed = collapsedCategories[cat.category];
              return (
                <div key={cat.category} className="space-y-1.5">
                  <button
                    onClick={() => toggleCategory(cat.category)}
                    className="w-full flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1.5 py-1 hover:text-slate-200 transition"
                  >
                    <span>{cat.category}</span>
                    {isCollapsed ? (
                      <ChevronRight size={13} />
                    ) : (
                      <ChevronDown size={13} />
                    )}
                  </button>

                  {!isCollapsed && (
                    <div className="space-y-1">
                      {cat.items.map((item, idx) => {
                        const Icon = item.icon;
                        return (
                          <div
                            key={idx}
                            draggable={isEditable}
                            onDragStart={(e) => handleDragStart(e, item)}
                            onClick={() => isEditable && onAddNodeDirect?.(item)}
                            title={isEditable ? "Tarik ke kanvas atau klik untuk menambahkan" : "Mode Hanya Lihat"}
                            className={`flex items-center gap-2.5 p-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/40 hover:border-blue-500/60 transition duration-150 group shadow-sm ${
                              isEditable ? "cursor-grab active:cursor-grabbing" : "cursor-default opacity-80"
                            }`}
                          >
                            <div className="w-7 h-7 rounded-md bg-slate-900 flex items-center justify-center text-blue-400 group-hover:text-emerald-400 border border-slate-700/60 transition-colors flex-shrink-0">
                              <Icon size={14} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-semibold text-slate-200 group-hover:text-white truncate">
                                {item.label}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate">
                                {item.sublabel}
                              </div>
                            </div>
                            {isEditable && (
                              <Plus
                                size={13}
                                className="text-slate-500 group-hover:text-blue-400 transition"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )
        ) : (
          /* Live Devices from NOCR Database (/api/mappings) */
          <div className="space-y-2">
            <div className="text-[10px] text-slate-400 px-1 font-semibold flex items-center justify-between">
              <span>Pilih & tarik tipe hardware:</span>
              <span className="text-emerald-400 text-[9px] font-mono font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Sync
              </span>
            </div>

            {filteredLiveMappings.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                {liveMappings.length === 0
                  ? "Memuat data monitoring NOCR..."
                  : "Tidak ada site yang cocok dengan pencarian"}
              </div>
            ) : (
              filteredLiveMappings.slice(0, 60).map((m, idx) => {
                const isOPD = m.connection_type === "PPPOE";
                const label = m.prefix || m.site_name || m.mikrotik_alias || m.ruijie_mac;
                const ip = m.ip || m.ip_address || "";

                // Hardware items definition according to user rules:
                // Desa (3): Modem ONT (final_status), MikroTik (status_mikrotik), Ruijie (status_ruijie)
                // OPD (2): Ruijie (status_ruijie), Modem ONT (status_mikrotik)
                const hwItems = isOPD
                  ? [
                      {
                        hwKey: "ruijie",
                        type: "ap",
                        name: "Ruijie",
                        vendor: "Ruijie AP",
                        icon: Wifi,
                        isOnline: m.status_ruijie === "Online",
                        statusSrc: "Ruijie",
                      },
                      {
                        hwKey: "ont",
                        type: "ont",
                        name: "Modem ONT",
                        vendor: "Modem ONT",
                        icon: Box,
                        isOnline: m.status_mikrotik === "Online",
                        statusSrc: "MikroTik",
                      },
                    ]
                  : [
                      {
                        hwKey: "ont",
                        type: "ont",
                        name: "Modem ONT",
                        vendor: "Modem ONT",
                        icon: Box,
                        isOnline: m.final_status === "Online",
                        statusSrc: "Final Status",
                      },
                      {
                        hwKey: "mikrotik",
                        type: "router",
                        name: "MikroTik",
                        vendor: "MikroTik",
                        icon: Router,
                        isOnline: m.status_mikrotik === "Online",
                        statusSrc: "MikroTik",
                      },
                      {
                        hwKey: "ruijie",
                        type: "ap",
                        name: "Ruijie",
                        vendor: "Ruijie AP",
                        icon: Wifi,
                        isOnline: m.status_ruijie === "Online",
                        statusSrc: "Ruijie",
                      },
                    ];

                const siteStatus = getSiteCanvasStatus(m);
                const isAllUsed = siteStatus.isAllUsed;

                return (
                  <div
                    key={m.id || m.ruijie_mac || idx}
                    className={`p-2 rounded-xl bg-slate-950/80 border space-y-2 shadow-sm transition-opacity ${
                      isAllUsed ? "border-slate-900/80 opacity-60" : "border-slate-800/80"
                    }`}
                  >
                    {/* Site Header */}
                    <div className="flex items-center justify-between gap-1.5 pb-1 border-b border-slate-800/60">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${
                            isOPD
                              ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                              : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                          }`}
                        >
                          {isOPD ? <Building2 size={11} /> : <Home size={11} />}
                        </div>
                        <span
                          className="text-xs font-bold text-slate-200 truncate"
                          title={label}
                        >
                          {label}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        {isAllUsed && (
                          <span className="text-[8px] px-1 py-0.2 rounded font-semibold uppercase bg-slate-900 text-slate-500 border border-slate-800">
                            Semua di Kanvas
                          </span>
                        )}
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                            isOPD
                              ? "bg-purple-950 text-purple-300 border border-purple-700/50"
                              : "bg-blue-950 text-blue-300 border border-blue-700/50"
                          }`}
                        >
                          {isOPD ? "OPD" : "Desa"}
                        </span>
                      </div>
                    </div>

                    {/* Hardware Items List (3 for Desa, 2 for OPD) */}
                    <div className="grid grid-cols-1 gap-1.5">
                      {hwItems.map((hw) => {
                        const Icon = hw.icon;
                        // Determine IP / Host / MAC based on user rules:
                        // - Ruijie: MAC Address from Ruijie Cloud (e.g. 9cce.881e.3d28)
                        // - MikroTik: Remote IP / Alias from MikroTik
                        // - Modem ONT (OPD): Remote IP from MikroTik PPPoE
                        // - Modem ONT (Desa): Empty string (Manual)
                        let assignedIp = "";
                        if (hw.hwKey === "ruijie") {
                          assignedIp = m.ruijie_mac || m.mac_address || m.ip || m.remote_address || "";
                        } else if (hw.hwKey === "mikrotik") {
                          assignedIp = m.remote_address || m.ip || m.mikrotik_alias || "";
                        } else if (hw.hwKey === "ont") {
                          assignedIp = isOPD ? (m.remote_address || m.ip || m.mikrotik_alias || "") : "";
                        }

                        const isAlreadyOnCanvas = (canvasNodes || []).some(
                          (n) => isSameSite(n, m) && matchHardwareType(n, hw.hwKey)
                        );

                        const payload = {
                          type: hw.type,
                          nocr_hw_type: hw.hwKey,
                          nocr_category: isOPD ? "opd" : "desa",
                          label: label, // Pure site name without hardware prefix
                          sublabel: `${isOPD ? "OPD" : "Desa"} • ${hw.name}`,
                          vendor: hw.vendor,
                          ip: assignedIp,
                          status: hw.isOnline ? "online" : "offline",
                          mapping_prefix: m.prefix,
                          mapping_mac: m.ruijie_mac,
                          is_live_nocr: true,
                        };

                        return (
                          <div
                            key={hw.hwKey}
                            draggable={isEditable && !isAlreadyOnCanvas}
                            onDragStart={(e) => handleDragStart(e, payload)}
                            onClick={() => (isAlreadyOnCanvas || isEditable) && onAddNodeDirect?.(payload)}
                            title={
                              isAlreadyOnCanvas
                                ? `${hw.name} untuk ${label} sudah ada di kanvas (Klik untuk fokus)`
                                : isEditable
                                ? `Tarik atau klik untuk menambahkan ${hw.name} (${hw.isOnline ? "Online" : "Mati"})`
                                : "Mode Hanya Lihat"
                            }
                            className={`flex items-center justify-between p-1.5 rounded-lg border transition duration-150 group/hw ${
                              isAlreadyOnCanvas
                                ? "bg-slate-950/60 border-slate-800/80 opacity-60 cursor-pointer"
                                : !isEditable
                                ? "bg-slate-900/60 border-slate-800 opacity-80 cursor-default"
                                : hw.isOnline
                                ? "bg-slate-900 hover:bg-slate-800/90 border-slate-700/70 hover:border-emerald-500/60 cursor-grab active:cursor-grabbing"
                                : "bg-slate-900/90 hover:bg-slate-800/90 border-red-950 hover:border-red-500/50 cursor-grab active:cursor-grabbing"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className={`w-6 h-6 rounded-md flex items-center justify-center border flex-shrink-0 ${
                                  hw.isOnline
                                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                    : "bg-red-500/15 text-red-400 border-red-500/30"
                                }`}
                              >
                                <Icon size={12} />
                              </div>

                              <div className="min-w-0 flex-1">
                                <span className="text-[11px] font-semibold text-slate-200 group-hover/hw:text-white truncate">
                                  {hw.name}
                                </span>
                                <span className="text-[9px] text-slate-500 truncate">
                                  {assignedIp ? `• ${assignedIp}` : ""}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {isAlreadyOnCanvas ? (
                                <span className="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase text-slate-400 bg-slate-800 border border-slate-700/50">
                                  Di Kanvas
                                </span>
                              ) : (
                                <>
                                  <span
                                    className={`text-[9px] px-1 py-0.2 rounded font-bold uppercase flex items-center gap-1 ${
                                      hw.isOnline
                                        ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
                                        : "text-red-400 bg-red-500/10 border border-red-500/20"
                                    }`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${
                                        hw.isOnline
                                          ? "bg-emerald-400 animate-pulse"
                                          : "bg-red-500"
                                      }`}
                                    />
                                    {hw.isOnline ? "Online" : "Mati"}
                                  </span>
                                  {isEditable && (
                                    <Plus
                                      size={12}
                                      className="text-slate-500 group-hover/hw:text-emerald-400 transition"
                                    />
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
