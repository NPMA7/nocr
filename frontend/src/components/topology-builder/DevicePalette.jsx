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

export const isSameAggregate = (node, aggKey) => {
  if (!node || !aggKey) return false;
  return Boolean(node.is_aggregate && node.aggregate_type === aggKey);
};

export const computeNocrAggregates = (liveMappings = []) => {
  const desaMappings = (liveMappings || []).filter(
    (m) => (m.connection_type || "L2TP").toUpperCase() === "L2TP"
  );
  const opdMappings = (liveMappings || []).filter(
    (m) => (m.connection_type || "").toUpperCase() === "PPPOE"
  );

  // 1. Modem ONT Desa (diambil Dari Final Status desa/l2tp)
  const desaOntOnline = desaMappings.filter(
    (m) => (m.final_status || "").toLowerCase() === "online" || (m.final_status || "").toLowerCase() === "up"
  ).length;
  const desaOntTotal = desaMappings.length;
  const desaOntOffline = Math.max(0, desaOntTotal - desaOntOnline);

  // 2. Mikrotik Desa (diambil dari status mikrotik desa/l2tp)
  const desaMikrotikOnline = desaMappings.filter(
    (m) => (m.status_mikrotik || "").toLowerCase() === "online" || (m.status_mikrotik || "").toLowerCase() === "up"
  ).length;
  const desaMikrotikTotal = desaMappings.length;
  const desaMikrotikOffline = Math.max(0, desaMikrotikTotal - desaMikrotikOnline);

  // 3. Ruijie Desa (diambil dari status ruijie desa/l2tp)
  const desaRuijieOnline = desaMappings.filter(
    (m) => (m.status_ruijie || "").toLowerCase() === "online" || (m.status_ruijie || "").toLowerCase() === "up"
  ).length;
  const desaRuijieTotal = desaMappings.length;
  const desaRuijieOffline = Math.max(0, desaRuijieTotal - desaRuijieOnline);

  // 4. Modem ONT OPD (diambil dari status mikrotik PPPoE OPD)
  const opdOntOnline = opdMappings.filter(
    (m) => (m.status_mikrotik || "").toLowerCase() === "online" || (m.status_mikrotik || "").toLowerCase() === "up"
  ).length;
  const opdOntTotal = opdMappings.length;
  const opdOntOffline = Math.max(0, opdOntTotal - opdOntOnline);

  // 5. Ruijie OPD (diambil dari status ruijie OPD/PPPoE)
  const opdRuijieOnline = opdMappings.filter(
    (m) => (m.status_ruijie || "").toLowerCase() === "online" || (m.status_ruijie || "").toLowerCase() === "up"
  ).length;
  const opdRuijieTotal = opdMappings.length;
  const opdRuijieOffline = Math.max(0, opdRuijieTotal - opdRuijieOnline);

  return {
    desa_ont: {
      key: "desa_ont",
      label: "Modem ONT Desa",
      sublabel: `${desaOntTotal} Unit • ${desaOntOnline} Online • ${desaOntOffline} Offline`,
      vendor: "Modem ONT (Final Status Desa)",
      type: "ont",
      nocr_hw_type: "ont",
      total: desaOntTotal,
      online: desaOntOnline,
      offline: desaOntOffline,
      nocr_category: "desa",
      is_aggregate: true,
      icon: Box,
    },
    desa_mikrotik: {
      key: "desa_mikrotik",
      label: "MikroTik Desa",
      sublabel: `${desaMikrotikTotal} Unit • ${desaMikrotikOnline} Online • ${desaMikrotikOffline} Offline`,
      vendor: "MikroTik Router Desa",
      type: "router",
      nocr_hw_type: "mikrotik",
      total: desaMikrotikTotal,
      online: desaMikrotikOnline,
      offline: desaMikrotikOffline,
      nocr_category: "desa",
      is_aggregate: true,
      icon: Router,
    },
    desa_ruijie: {
      key: "desa_ruijie",
      label: "Ruijie Desa",
      sublabel: `${desaRuijieTotal} Unit • ${desaRuijieOnline} Online • ${desaRuijieOffline} Offline`,
      vendor: "Ruijie AP Desa",
      type: "ap",
      nocr_hw_type: "ruijie",
      total: desaRuijieTotal,
      online: desaRuijieOnline,
      offline: desaRuijieOffline,
      nocr_category: "desa",
      is_aggregate: true,
      icon: Wifi,
    },
    opd_ont: {
      key: "opd_ont",
      label: "Modem ONT OPD",
      sublabel: `${opdOntTotal} Unit • ${opdOntOnline} Online • ${opdOntOffline} Offline`,
      vendor: "Modem ONT (PPPoE OPD)",
      type: "ont",
      nocr_hw_type: "ont",
      total: opdOntTotal,
      online: opdOntOnline,
      offline: opdOntOffline,
      nocr_category: "opd",
      is_aggregate: true,
      icon: Box,
    },
    opd_ruijie: {
      key: "opd_ruijie",
      label: "Ruijie OPD",
      sublabel: `${opdRuijieTotal} Unit • ${opdRuijieOnline} Online • ${opdRuijieOffline} Offline`,
      vendor: "Ruijie AP OPD",
      type: "ap",
      nocr_hw_type: "ruijie",
      total: opdRuijieTotal,
      online: opdRuijieOnline,
      offline: opdRuijieOffline,
      nocr_category: "opd",
      is_aggregate: true,
      icon: Wifi,
    },
  };
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
  const [isAggregatesCollapsed, setIsAggregatesCollapsed] = useState(false);
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

  const nocrAggregates = useMemo(() => computeNocrAggregates(liveMappings), [liveMappings]);

  const aggregateItems = useMemo(() => {
    const list = Object.values(nocrAggregates);
    if (liveFilter === "desa") {
      return list.filter((item) => item.nocr_category === "desa");
    }
    if (liveFilter === "opd") {
      return list.filter((item) => item.nocr_category === "opd");
    }
    return list;
  }, [nocrAggregates, liveFilter]);

  const filteredAggregates = useMemo(() => {
    if (!search) return aggregateItems;
    const q = search.toLowerCase();
    return aggregateItems.filter(
      (a) =>
        a.label.toLowerCase().includes(q) ||
        a.sublabel.toLowerCase().includes(q) ||
        a.vendor.toLowerCase().includes(q)
    );
  }, [aggregateItems, search]);

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
    if (liveFilter === "aggregate") {
      return [];
    }

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
    () => (liveMappings || []).filter((m) => m.connection_type !== "PPPOE").length,
    [liveMappings]
  );
  const opdCount = useMemo(
    () => (liveMappings || []).filter((m) => m.connection_type === "PPPOE").length,
    [liveMappings]
  );

  const handleDragStart = (e, item) => {
    if (!isEditable) return;
    e.dataTransfer.setData(
      "application/nocr-topology-node",
      JSON.stringify({
        type: item.type,
        nocr_hw_type: item.nocr_hw_type || item.type,
        nocr_category: item.nocr_category,
        status_source: item.status_source,
        label: item.label,
        sublabel: item.sublabel,
        vendor: item.vendor,
        ports: item.ports,
        ip: item.ip || "",
        status: item.status || (item.is_aggregate ? (item.online > 0 ? "online" : "offline") : "online"),
        mapping_prefix: item.mapping_prefix,
        mapping_mac: item.mapping_mac,
        is_live_nocr: item.is_live_nocr,
        is_aggregate: Boolean(item.is_aggregate),
        aggregate_type: item.key || item.aggregate_type,
        total_count: item.total ?? item.total_count,
        online_count: item.online ?? item.online_count,
        offline_count: item.offline ?? item.offline_count,
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
            Hardware NOCR ({(liveMappings || []).length})
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
                ? "Cari nama Desa, OPD, Agregator..."
                : "Cari router, OLT, switch, AP..."
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
          />
        </div>

        {/* Sub-filter untuk Data NOCR */}
        {activeTab === "live" && (
          <div className="flex items-center gap-1 text-[10px] font-semibold pt-0.5 flex-wrap">
            <button
              onClick={() => setLiveFilter("all")}
              className={`cursor-pointer px-2 py-0.5 rounded-md transition ${
                liveFilter === "all"
                  ? "bg-slate-800 text-white border border-slate-700 font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Semua ({(liveMappings || []).length})
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
                  ? "bg-slate-800 text-white border border-slate-600 font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Building2 size={10} />
              <span>OPD ({opdCount})</span>
            </button>
            <button
              onClick={() => setLiveFilter("aggregate")}
              className={`cursor-pointer px-2 py-0.5 rounded-md transition flex items-center gap-1 ${
                liveFilter === "aggregate"
                  ? "bg-sky-900/60 text-sky-300 border border-sky-500/50 font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sparkles size={10} className="text-sky-400" />
              <span>Agregator ({filteredAggregates.length})</span>
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
            {/* 1. MASTER AGREGATOR SECTION (Live Totals for Desa, OPD) */}
            {filteredAggregates.length > 0 && (
              <div className="space-y-1.5 p-2 rounded-xl bg-slate-950 border border-slate-800 shadow-md">
                <button
                  onClick={() => setIsAggregatesCollapsed((prev) => !prev)}
                  className="cursor-pointer w-full flex items-center justify-between text-[11px] font-extrabold text-sky-400 uppercase tracking-wider px-1 py-0.5 hover:text-white transition"
                >
                  <div className="flex items-center gap-1.5">
                    <Sparkles size={13} className="text-sky-400 animate-pulse" />
                    <span>Master Agregator ({filteredAggregates.length})</span>
                  </div>
                  {isAggregatesCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                </button>

                {!isAggregatesCollapsed && (
                  <div className="space-y-1.5 pt-1">
                    {filteredAggregates.map((agg) => {
                      const Icon = agg.icon || Wifi;
                      const isAlreadyOnCanvas = (canvasNodes || []).some(
                        (n) => n.is_aggregate && n.aggregate_type === agg.key
                      );

                      const aggPayload = {
                        type: agg.type,
                        nocr_hw_type: agg.nocr_hw_type,
                        nocr_category: agg.nocr_category,
                        label: agg.label,
                        sublabel: agg.sublabel,
                        vendor: agg.vendor,
                        is_aggregate: true,
                        aggregate_type: agg.key,
                        total_count: agg.total,
                        online_count: agg.online,
                        offline_count: agg.offline,
                        status: agg.online > 0 ? "online" : "offline",
                      };

                      return (
                        <div
                          key={agg.key}
                          draggable={isEditable}
                          onDragStart={(e) => handleDragStart(e, aggPayload)}
                          onClick={() => isEditable && onAddNodeDirect?.(aggPayload)}
                          title={
                            isEditable
                              ? isAlreadyOnCanvas
                                ? "Perangkat ini sudah ada di kanvas"
                                : "Tarik ke kanvas atau klik untuk menambahkan"
                              : "Mode Hanya Lihat"
                          }
                          className={`flex flex-col gap-1 p-2 rounded-xl border transition group shadow-sm ${
                            isAlreadyOnCanvas
                              ? "bg-slate-950/80 border-slate-800 opacity-60 cursor-pointer"
                              : isEditable
                              ? "cursor-grab active:cursor-grabbing bg-slate-900/90 hover:bg-slate-800 border-slate-700/70 hover:border-sky-500/60 hover:shadow-[0_0_15px_rgba(14,165,233,0.2)]"
                              : "cursor-default bg-slate-900/80 border-slate-800 opacity-80"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-6 h-6 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform shadow-[0_0_8px_rgba(14,165,233,0.2)]">
                                <Icon size={13} />
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-100 group-hover:text-white truncate">
                                  {agg.label}
                                </div>
                                <div className="text-[9px] text-sky-400/80 font-semibold uppercase">
                                  {agg.vendor}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 flex-shrink-0">
                              {isAlreadyOnCanvas ? (
                                <span className="text-[8px] px-1 py-0.2 rounded font-bold uppercase bg-slate-900 text-slate-500 border border-slate-800">
                                  Di Kanvas
                                </span>
                              ) : (
                                isEditable && (
                                  <Plus size={13} className="text-sky-400 group-hover:scale-125 transition-transform" />
                                )
                              )}
                            </div>
                          </div>

                          {/* Status Stats Bar */}
                          <div className="flex items-center justify-between text-[9px] pt-1 border-t border-slate-800/80 font-mono">
                            <div className="flex items-center gap-1.5">
                              <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                {agg.online} Online
                              </span>
                              <span className="px-1.5 py-0.2 rounded bg-red-500/20 text-red-400 font-bold border border-red-500/30 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                                {agg.offline} Offline
                              </span>
                            </div>
                            <span className="text-slate-400 font-semibold">Total {agg.total}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 2. SITES LIST HEADER */}
            {liveFilter !== "aggregate" && (
              <div className="text-[10px] text-slate-400 px-1 font-semibold flex items-center justify-between pt-1">
                <span>Pilih & tarik hardware per lokasi:</span>
                <span className="text-emerald-400 text-[9px] font-mono font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Sync
                </span>
              </div>
            )}

            {liveFilter !== "aggregate" && filteredLiveMappings.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                {(liveMappings || []).length === 0
                  ? "Memuat data monitoring NOCR..."
                  : "Tidak ada site yang cocok dengan pencarian"}
              </div>
            ) : null}

            {liveFilter !== "aggregate" &&
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
                              ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
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
                              ? "bg-cyan-950 text-cyan-300 border border-cyan-700/50"
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
              })}
          </div>
        )}
      </div>
    </div>
  );
}
