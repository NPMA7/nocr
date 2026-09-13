"use client";
import React from "react";
import {
  X,
  Sliders,
  Power,
  Trash2,
  Copy,
  Activity,
  Layers,
  Network,
  Tag,
  Hash,
  Sparkles,
  Zap,
  Globe,
  ShieldAlert,
  Settings,
  Grid,
  PanelRightClose,
} from "lucide-react";

export default function PropertiesDrawer({
  selectedNode,
  selectedLink,
  nodes = [],
  liveMappings = [],
  onUpdateNode,
  onUpdateLink,
  onDeleteNode,
  onDeleteLink,
  onDuplicateNode,
  onClose,
  onCloseDrawer,
  nodesCount = 0,
  linksCount = 0,
  onlineNodesCount = 0,
  offlineNodesCount = 0,
  gridStyle = "dots",
  setGridStyle,
  snapToGrid = false,
  setSnapToGrid,
  readOnly = false,
  canDelete = true,
}) {
  // Find matching mapping data for selected node if any
  const matchingMapping = liveMappings.find(
    (m) =>
      (selectedNode?.mapping_prefix && m.prefix && selectedNode.mapping_prefix.toLowerCase() === m.prefix.toLowerCase()) ||
      (selectedNode?.mapping_mac && m.ruijie_mac && selectedNode.mapping_mac.toLowerCase() === m.ruijie_mac.toLowerCase()) ||
      (selectedNode?.ip && m.ip && selectedNode.ip === m.ip) ||
      (selectedNode?.label && m.prefix && selectedNode.label.toLowerCase() === m.prefix.toLowerCase()) ||
      (selectedNode?.label && m.site_name && selectedNode.label.toLowerCase().includes(m.site_name.toLowerCase()))
  );

  const isOPD = matchingMapping
    ? matchingMapping.connection_type === "PPPOE"
    : selectedNode?.nocr_category === "opd" ||
      selectedNode?.sublabel?.toLowerCase().includes("opd") ||
      selectedNode?.label?.toLowerCase().includes("opd") ||
      selectedNode?.label?.toLowerCase().includes("dinas") ||
      selectedNode?.label?.toLowerCase().includes("badan") ||
      selectedNode?.label?.toLowerCase().includes("dpmptsp") ||
      selectedNode?.label?.toLowerCase().includes("dispora") ||
      selectedNode?.label?.toLowerCase().includes("dukcapil") ||
      selectedNode?.label?.toLowerCase().includes("setda");
  return (
    <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col h-full z-30 select-none shadow-2xl">
      {/* Header */}
      <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
            <Sliders size={13} />
          </div>
          <span className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono">
            {selectedNode
              ? "Detail Perangkat"
              : selectedLink
              ? "Detail Jalur Kabel"
              : "Ringkasan Topologi"}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {(selectedNode || selectedLink) && (
            <button
              onClick={onClose}
              title="Tutup Detail Pilihan"
              className="cursor-pointer text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition"
            >
              <X size={15} />
            </button>
          )}

          {onCloseDrawer && (
            <button
              onClick={onCloseDrawer}
              title="Sembunyikan Panel Ringkasan & Properti"
              className="cursor-pointer p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition border border-transparent hover:border-slate-700"
            >
              <PanelRightClose size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar text-xs">
        {selectedNode ? (
          /* ========================================================
             NODE PROPERTIES
             ======================================================== */
          <div className="space-y-4">
            {readOnly && (
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-semibold text-center">
                Mode Hanya Lihat (Read-Only)
              </div>
            )}
            {/* Real-time Status Badge (Otomatis dari Monitoring NOCR) */}
            <div className="p-3 rounded-xl border bg-slate-950/70 border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <span>Status Real-time</span>
                <span className="text-emerald-400 font-mono flex items-center gap-1 font-semibold normal-case">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Sync
                </span>
              </div>

              <div
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border font-bold text-xs ${
                  selectedNode.status === "online"
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                    : "bg-red-500/15 border-red-500/40 text-red-300 shadow-[0_0_12px_rgba(239,68,68,0.25)]"
                }`}
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    selectedNode.status === "online"
                      ? "bg-emerald-400 shadow-[0_0_8px_#10b981] animate-pulse"
                      : "bg-red-400 shadow-[0_0_8px_#ef4444]"
                  }`}
                />
                <span className="uppercase tracking-wider">
                  {selectedNode.status === "online" ? "MENYALA (ONLINE)" : "MATI (OFFLINE)"}
                </span>

                {selectedNode.mapping_prefix && (
                  <span className="ml-auto text-[10px] font-normal text-slate-400 font-mono truncate max-w-[100px]">
                    {selectedNode.mapping_prefix}
                  </span>
                )}
              </div>
            </div>

            {/* Label / Nama Node */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-300">
                Nama Perangkat / Label
              </label>
              <input
                type="text"
                readOnly={readOnly}
                value={selectedNode.label || ""}
                onChange={(e) =>
                  !readOnly && onUpdateNode?.(selectedNode.id, { label: e.target.value })
                }
                className={`w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-1.5 text-slate-100 focus:outline-none focus:border-blue-500 ${readOnly ? "opacity-70 cursor-not-allowed" : ""}`}
              />
            </div>

            {/* Tipe Perangkat */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-300">
                  Tipe Hardware
                </label>
                {(selectedNode.mapping_prefix || selectedNode.is_live_nocr) && (
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                      isOPD
                        ? "bg-cyan-950 text-cyan-300 border border-cyan-700/50"
                        : "bg-blue-950 text-blue-300 border border-blue-700/50"
                    }`}
                  >
                    {isOPD ? "OPD (PPPoE)" : "Desa (L2TP)"}
                  </span>
                )}
              </div>

              {selectedNode.is_live_nocr || selectedNode.mapping_prefix ? (
                /* NOCR Device Options: 3 for Desa, 2 for OPD */
                <select
                  disabled={readOnly}
                  value={selectedNode.nocr_hw_type || (selectedNode.vendor?.toLowerCase().includes("ruijie") ? "ruijie" : selectedNode.type === "ont" ? "ont" : isOPD ? "ont" : "mikrotik")}
                  onChange={(e) => {
                    if (readOnly) return;
                    const val = e.target.value;
                    let newType = "router";
                    let newVendor = "MikroTik";
                    let newStatus = "offline";
                    let newIp = selectedNode.ip;
                    if (val === "ruijie" || val === "ap") {
                      newType = "ap";
                      newVendor = "Ruijie AP";
                      newStatus = matchingMapping ? (matchingMapping.status_ruijie === "Online" ? "online" : "offline") : selectedNode.status;
                      newIp = matchingMapping ? (matchingMapping.ruijie_mac || matchingMapping.ip || "") : selectedNode.ip;
                    } else if (val === "ont") {
                      newType = "ont";
                      newVendor = "Modem ONT";
                      newStatus = matchingMapping
                        ? (isOPD
                            ? (matchingMapping.status_mikrotik === "Online" ? "online" : "offline")
                            : (matchingMapping.final_status === "Online" ? "online" : "offline"))
                        : selectedNode.status;
                      newIp = isOPD && matchingMapping ? (matchingMapping.remote_address || matchingMapping.ip || "") : "";
                    } else if (val === "mikrotik" || val === "router") {
                      newType = "router";
                      newVendor = "MikroTik";
                      newStatus = matchingMapping ? (matchingMapping.status_mikrotik === "Online" ? "online" : "offline") : selectedNode.status;
                      newIp = matchingMapping ? (matchingMapping.remote_address || matchingMapping.ip || matchingMapping.mikrotik_alias || "") : selectedNode.ip;
                    }
                    onUpdateNode?.(selectedNode.id, {
                      nocr_hw_type: val,
                      nocr_category: isOPD ? "opd" : "desa",
                      type: newType,
                      vendor: newVendor,
                      status: newStatus,
                      ip: newIp,
                    });
                  }}
                  className={`w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-1.5 text-slate-100 focus:outline-none focus:border-blue-500 font-semibold ${readOnly ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  {isOPD ? (
                    <>
                      <option value="ruijie">Ruijie AP (Status: Ruijie Cloud)</option>
                      <option value="ont">Modem ONT (Status: MikroTik PPPoE)</option>
                    </>
                  ) : (
                    <>
                      <option value="ont">Modem ONT (Status: Final Status)</option>
                      <option value="mikrotik">MikroTik Router (Status: MikroTik L2TP)</option>
                      <option value="ruijie">Ruijie AP (Status: Ruijie Cloud)</option>
                    </>
                  )}
                </select>
              ) : (
                /* Standard Generic Hardware */
                <select
                  disabled={readOnly}
                  value={selectedNode.type || "router"}
                  onChange={(e) =>
                    !readOnly && onUpdateNode?.(selectedNode.id, { type: e.target.value })
                  }
                  className={`w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-1.5 text-slate-100 focus:outline-none focus:border-blue-500 capitalize ${readOnly ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <option value="cloud">Cloud / ISP Gateway</option>
                  <option value="router">Core Router (MikroTik)</option>
                  <option value="vpn">VPN Tunneling (WireGuard / L2TP / IPSec)</option>
                  <option value="ont">Modem ONT (Optical Network)</option>
                  <option value="olt">HSGQ OLT (GPON/EPON)</option>
                  <option value="odc">ODC (Optical Cabinet)</option>
                  <option value="odp">ODP (Optical Distribution Point)</option>
                  <option value="switch">Switch (L2 / L3 / PoE)</option>
                  <option value="firewall">Firewall / Security</option>
                  <option value="server">Server Rack / Database</option>
                  <option value="ap">Access Point (Ruijie/Wi-Fi)</option>
                  <option value="wireless">Wireless Radio (PTP/PtMP)</option>
                  <option value="client">Client Router (Desa / OPD)</option>
                  <option value="pc">Workstation PC</option>
                  <option value="laptop">Laptop</option>
                </select>
              )}
            </div>

            {/* IP / MAC Address (Disembunyikan untuk ODP, ODC, dan perangkat pasif) */}
            {!["odp", "odc", "splitter", "closure", "joint_box", "patch_panel", "passive", "fiber_box"].includes(selectedNode.type?.toLowerCase()) && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-300">
                  {selectedNode.nocr_hw_type === "ruijie" || selectedNode.type === "ap" ? "MAC Address / Host" : "IP Address / Host"}
                </label>
                <input
                  type="text"
                  readOnly={readOnly}
                  placeholder={selectedNode.nocr_hw_type === "ruijie" || selectedNode.type === "ap" ? "misal: 9cce.881e.3d28" : "misal: 192.168.10.1 / 10.0.0.1"}
                  value={selectedNode.ip || ""}
                  onChange={(e) =>
                    !readOnly && onUpdateNode?.(selectedNode.id, { ip: e.target.value })
                  }
                  className={`w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-1.5 text-slate-100 font-mono focus:outline-none focus:border-blue-500 ${readOnly ? "opacity-70 cursor-not-allowed" : ""}`}
                />
              </div>
            )}

            {/* Vendor / Merk */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-300">
                Vendor / Merek
              </label>
              <input
                type="text"
                readOnly={readOnly}
                placeholder="misal: Mikrotik, Ruijie, HSGQ, Cisco"
                value={selectedNode.vendor || ""}
                onChange={(e) =>
                  !readOnly && onUpdateNode?.(selectedNode.id, { vendor: e.target.value })
                }
                className={`w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-1.5 text-slate-100 focus:outline-none focus:border-blue-500 ${readOnly ? "opacity-70 cursor-not-allowed" : ""}`}
              />
            </div>

            {/* Sub-label / Catatan */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-300">
                Sub-label / Keterangan
              </label>
              <input
                type="text"
                readOnly={readOnly}
                placeholder="misal: Ruang Server Lt. 2, Tray A"
                value={selectedNode.sublabel || ""}
                onChange={(e) =>
                  !readOnly && onUpdateNode?.(selectedNode.id, { sublabel: e.target.value })
                }
                className={`w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-1.5 text-slate-100 focus:outline-none focus:border-blue-500 ${readOnly ? "opacity-70 cursor-not-allowed" : ""}`}
              />
            </div>

            {/* Port / Interface Specification */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-300">
                Port / Kapasitas
              </label>
              <input
                type="text"
                readOnly={readOnly}
                placeholder="misal: 16x 10G SFP+, 8 Dropcore"
                value={selectedNode.ports || ""}
                onChange={(e) =>
                  !readOnly && onUpdateNode?.(selectedNode.id, { ports: e.target.value })
                }
                className={`w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-1.5 text-slate-100 focus:outline-none focus:border-blue-500 ${readOnly ? "opacity-70 cursor-not-allowed" : ""}`}
              />
            </div>

            {/* Actions */}
            {!readOnly && (
              <div className={`pt-3 border-t border-slate-800 ${selectedNode.is_live_nocr || selectedNode.mapping_prefix ? "flex" : "grid grid-cols-2 gap-2"}`}>
                {!selectedNode.is_live_nocr && !selectedNode.mapping_prefix && (
                  <button
                    onClick={() => onDuplicateNode?.(selectedNode)}
                    className="cursor-pointer flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition"
                  >
                    <Copy size={13} />
                    Duplikasi
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => onDeleteNode?.(selectedNode.id)}
                    className="w-full cursor-pointer flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-red-600/20 hover:bg-red-600 border border-red-500/30 text-red-300 hover:text-white font-semibold transition"
                  >
                    <Trash2 size={13} />
                    Hapus
                  </button>
                )}
              </div>
            )}
          </div>
        ) : selectedLink ? (
          /* ========================================================
             LINK / CABLE PROPERTIES
             ======================================================== */
          <div className="space-y-4">
            {readOnly && (
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-semibold text-center">
                Mode Hanya Lihat (Read-Only)
              </div>
            )}

            {/* Status Jalur Kabel Otomatis */}
            {(() => {
              const fromNode = nodes.find((n) => n.id === selectedLink.from);
              const toNode = nodes.find((n) => n.id === selectedLink.to);
              const isLinkActive =
                fromNode &&
                toNode &&
                fromNode.status === "online" &&
                toNode.status === "online";

              return (
                <div className="p-3 rounded-xl border bg-slate-950/70 border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <span>Status Jalur Kabel</span>
                    <span className="text-emerald-400 font-mono text-[9px] flex items-center gap-1 font-semibold normal-case">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Otomatis
                    </span>
                  </div>

                  <div
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border font-bold text-xs ${
                      isLinkActive
                        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                        : "bg-red-500/15 border-red-500/40 text-red-300 shadow-[0_0_12px_rgba(239,68,68,0.25)]"
                    }`}
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        isLinkActive
                          ? "bg-emerald-400 shadow-[0_0_8px_#10b981] animate-pulse"
                          : "bg-red-400 shadow-[0_0_8px_#ef4444]"
                      }`}
                    />
                    <span className="uppercase tracking-wider">
                      {isLinkActive ? "MENYALA (ONLINE)" : "TERPUTUS (OFFLINE)"}
                    </span>
                  </div>

                  <div className="text-[10px] text-slate-400 space-y-1 pt-1 border-t border-slate-800/80">
                    <div className="flex justify-between items-center">
                      <span className="truncate max-w-[140px]">
                        Dari: <strong className="text-slate-200">{fromNode?.label || "Node Asal"}</strong>
                      </span>
                      <span className={`font-semibold ${fromNode?.status === "online" ? "text-emerald-400" : "text-red-400"}`}>
                        {fromNode?.status === "online" ? "● Online" : "● Offline"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="truncate max-w-[140px]">
                        Ke: <strong className="text-slate-200">{toNode?.label || "Node Tujuan"}</strong>
                      </span>
                      <span className={`font-semibold ${toNode?.status === "online" ? "text-emerald-400" : "text-red-400"}`}>
                        {toNode?.status === "online" ? "● Online" : "● Offline"}
                      </span>
                    </div>
                    <p className="text-[9px] text-slate-500 italic pt-0.5">
                      {isLinkActive
                        ? "Kedua perangkat aktif sehingga kabel otomatis menyala (hijau)."
                        : "Kabel otomatis mati (merah) karena salah satu/kedua perangkat terputus."}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Label Jalur */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-300">
                Label / Keterangan Jalur
              </label>
              <input
                type="text"
                readOnly={readOnly}
                placeholder="misal: 10 Gbps SFP+, VLAN 100, Dropcore"
                value={selectedLink.label || ""}
                onChange={(e) =>
                  !readOnly && onUpdateLink?.(selectedLink.id, { label: e.target.value })
                }
                className={`w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-1.5 text-slate-100 focus:outline-none focus:border-blue-500 ${readOnly ? "opacity-70 cursor-not-allowed" : ""}`}
              />
            </div>

            {/* Tipe Kabel */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-300">
                Jenis Media Transmisi
              </label>
              <select
                disabled={readOnly}
                value={selectedLink.type || "fiber"}
                onChange={(e) =>
                  !readOnly && onUpdateLink?.(selectedLink.id, { type: e.target.value })
                }
                className={`w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-1.5 text-slate-100 focus:outline-none focus:border-blue-500 capitalize ${readOnly ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <option value="fiber">⚡ Fiber Optic (FO - Hijau/Cyan)</option>
                <option value="ethernet">🔌 Ethernet LAN Cat6 (Biru)</option>
                <option value="vpn">🔒 VPN Tunnel L2TP(Oranye)</option>
              </select>
            </div>

            {/* Actions */}
            {!readOnly && canDelete && (
              <div className="pt-3 border-t border-slate-800">
                <button
                  onClick={() => onDeleteLink?.(selectedLink.id)}
                  className="w-full cursor-pointer flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-red-600/20 hover:bg-red-600 border border-red-500/30 text-red-300 hover:text-white font-semibold transition"
                >
                  <Trash2 size={13} />
                  Hapus Kabel
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ========================================================
             TOPOLOGY SUMMARY / CANVAS SETTINGS
             ======================================================== */
          <div className="space-y-4">
            {/* Realtime Stats */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">
                  Total Node
                </span>
                <span className="text-xl font-extrabold text-slate-100 font-mono">
                  {nodesCount}
                </span>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">
                  Total Kabel
                </span>
                <span className="text-xl font-extrabold text-slate-100 font-mono">
                  {linksCount}
                </span>
              </div>

              <div className="bg-slate-950/70 border border-emerald-950/60 rounded-xl p-3 flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Menyala (ON)
                </span>
                <span className="text-xl font-extrabold text-emerald-400 font-mono">
                  {onlineNodesCount}
                </span>
              </div>

              <div className="bg-slate-950/70 border border-red-950/60 rounded-xl p-3 flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-red-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  Mati (OFF)
                </span>
                <span className="text-xl font-extrabold text-red-400 font-mono">
                  {offlineNodesCount}
                </span>
              </div>
            </div>

            {/* Grid & Canvas Config */}
            <div className="space-y-3 p-3 bg-slate-950/50 border border-slate-800 rounded-xl">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
                <Grid size={13} /> Pengaturan Kanvas
              </span>

              {/* Grid Style */}
              <div className="space-y-1">
                <label className="text-[11px] text-slate-300 font-medium">
                  Model Garis Kisi (Grid)
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {["dots", "lines", "none"].map((style) => (
                    <button
                      key={style}
                      onClick={() => setGridStyle?.(style)}
                      className={`cursor-pointer py-1 text-[10px] font-semibold uppercase rounded-md border transition ${
                        gridStyle === style
                          ? "bg-blue-600 text-white border-blue-500"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      {style === "dots"
                        ? "Titik"
                        : style === "lines"
                        ? "Garis"
                        : "Polos"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Snap to grid */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-300 font-medium">
                  Kunci ke Kisi (Snap Grid)
                </span>
                <input
                  type="checkbox"
                  checked={snapToGrid}
                  onChange={(e) => setSnapToGrid?.(e.target.checked)}
                  className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                />
              </div>
            </div>

            {/* Quick Instructions */}
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl space-y-1 text-slate-300 text-[11px]">
              <div className="font-bold text-blue-300 flex items-center gap-1.5">
                <Zap size={13} /> Cara Menggambar Kabel:
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Arahkan kursor ke node, klik tombol <span className="text-emerald-400 font-bold">(+)</span> pada salah satu sisinya, lalu klik node tujuan untuk menyambungkan kabel data.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
