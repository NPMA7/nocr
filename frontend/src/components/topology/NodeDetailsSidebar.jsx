"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import {
  MapPin,
  X,
  Clock,
  Trash2,
  ExternalLink,
  Users,
  Camera,
  Eye,
  Activity,
  CheckCircle2,
  Wifi,
  Cpu,
  Radio,
  Box,
  Image as ImageIcon,
  HardDrive,
  Calendar,
} from "lucide-react";
import EvidenceLightboxModal from "@/components/sites/EvidenceLightboxModal";

export default function NodeDetailsSidebar({
  currentSelectedNode,
  setSelectedNode,
  setFlyToTarget,
  readOnly,
  canDelete,
  nodePresenceMap,
  sessionUser,
  combinedInterfaceOptions,
  mappings,
  coreInterfaces,
  nodeIfaceSearch,
  setNodeIfaceSearch,
  showNodeIfaceDropdown,
  setShowNodeIfaceDropdown,
  setNodesFromUser,
  setEdgesFromUser,
  nodeDetail,
  markNodeDeleted,
  nodes,
}) {
  const [activeTab, setActiveTab] = useState("status"); // "status" | "evidence"
  const [activeLightbox, setActiveLightbox] = useState(null);
  const [liveEvidencePhotos, setLiveEvidencePhotos] = useState(null);

  const linkedMap = (mappings || []).find(
    (m) => m.prefix === currentSelectedNode?.linked_interface,
  );
  const mac = currentSelectedNode?.site?.ruijie_mac || linkedMap?.ruijie_mac;

  useEffect(() => {
    if (!mac) {
      setLiveEvidencePhotos(null);
      return;
    }
    if (currentSelectedNode?.site?.evidence_photos) {
      setLiveEvidencePhotos(currentSelectedNode.site.evidence_photos);
    }
    let isMounted = true;
    axios
      .get(`/api/sites/${encodeURIComponent(mac)}/evidence`)
      .then((res) => {
        if (isMounted && res.data?.evidence_photos) {
          setLiveEvidencePhotos(res.data.evidence_photos);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [mac, currentSelectedNode?.id]);

  if (!currentSelectedNode) return null;

  const siteCategory = (
    currentSelectedNode?.site?.category ||
    currentSelectedNode?.site?.site_type ||
    currentSelectedNode?.linked_interface ||
    currentSelectedNode?.label ||
    ""
  )
    .toUpperCase()
    .includes("OPD")
    ? "opd"
    : "desa";
  const isOpd = siteCategory === "opd";

  const slots = isOpd
    ? [
        { key: "ap", label: "Access Point (AP)", subtitle: "Ruijie / Reyee", icon: Wifi, color: "blue" },
        { key: "ont", label: "Modem ONT", subtitle: "PON/LOS & Fiber", icon: Radio, color: "emerald" },
        { key: "panel", label: "Panel / Lokasi", subtitle: "Tampak Site", icon: Box, color: "amber" },
      ]
    : [
        { key: "ap", label: "Access Point (AP)", subtitle: "Ruijie / Reyee", icon: Wifi, color: "blue" },
        { key: "mikrotik", label: "Router MikroTik", subtitle: "Routerboard", icon: Cpu, color: "purple" },
        { key: "ont", label: "Modem ONT", subtitle: "PON/LOS & Fiber", icon: Radio, color: "emerald" },
        { key: "panel", label: "Panel / Lokasi", subtitle: "Tampak Site", icon: Box, color: "amber" },
      ];

  const photos = liveEvidencePhotos || currentSelectedNode?.site?.evidence_photos || {};
  const photoKeys = Object.keys(photos).filter(
    (k) => slots.some((s) => s.key === k) && (photos[k]?.url || photos[k]?.drive_id || photos[k]?.preview_url),
  );

  return (
    <div
      className={`absolute top-0 right-0 bottom-0 w-84 bg-slate-800/95 backdrop-blur-md border-l border-slate-700/50 flex flex-col z-[1000] shadow-2xl transition-transform duration-300 ease-out ${
        currentSelectedNode ? "translate-x-0" : "translate-x-full"
      }`}
    >
      {/* Header */}
      <div className="p-3.5 border-b border-slate-700/50 flex justify-between items-center bg-slate-900/60">
        <div className="flex items-center gap-2.5">
          <h3 className="font-bold text-sm text-slate-100">Properties Node</h3>
          {currentSelectedNode && (
            <button
              onClick={() =>
                setFlyToTarget({
                  lat: currentSelectedNode.latitude,
                  lng: currentSelectedNode.longitude,
                  zoom: 17,
                })
              }
              className="bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 p-1.5 rounded-md transition-colors flex items-center justify-center cursor-pointer"
              title="Zoom ke Lokasi"
            >
              <MapPin size={13} />
              <span className="font-bold text-[11px] text-slate-100 ml-1">
                Zoom Lokasi
              </span>
            </button>
          )}
        </div>
        <button
          className="cursor-pointer text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700/50 transition"
          onClick={() => setSelectedNode(null)}
        >
          <X size={18} />
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-700/60 bg-slate-900/50 p-1 mx-3 mt-2.5 rounded-lg gap-1 shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab("status")}
          className={`flex-1 py-1.5 px-2.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
            activeTab === "status"
              ? "bg-blue-600 text-white shadow"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
          }`}
        >
          <Activity size={13} />
          <span>Status & Info</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("evidence")}
          className={`flex-1 py-1.5 px-2.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
            activeTab === "evidence"
              ? "bg-blue-600 text-white shadow"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
          }`}
        >
          <Camera size={13} />
          <span>Evidence ({photoKeys.length}/{slots.length})</span>
        </button>
      </div>

      {/* Indikator: node ini sedang diedit user lain */}
      {currentSelectedNode &&
        nodePresenceMap[currentSelectedNode.id] &&
        nodePresenceMap[currentSelectedNode.id].userId !==
          (sessionUser?.id?.toString() || sessionUser?.username) && (
          <div className="mx-3 mt-2 flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
            <span className="text-amber-400 text-xs">🔒</span>
            <p className="text-xs text-amber-300 font-medium leading-snug">
              Sedang diedit oleh&nbsp;
              <span className="font-bold text-amber-200">
                {nodePresenceMap[currentSelectedNode.id].username}
              </span>
            </p>
          </div>
        )}

      {/* TAB 1: STATUS & INFO */}
      {activeTab === "status" && (
        <div className="p-4 flex-1 overflow-auto flex flex-col gap-3.5 animate-fadeIn">
          <div className="flex justify-between items-center border-b border-slate-700/30 pb-2">
            <span className="text-xs text-slate-400">Tipe Node</span>
            <span className="text-xs font-semibold text-blue-400 uppercase">
              {currentSelectedNode.type}
            </span>
          </div>

          {(() => {
            const nodeType = (currentSelectedNode.type || "").toLowerCase();
            const isInfrastructure = ["odp", "odc", "olt"].includes(nodeType);

            if (isInfrastructure) {
              return (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400">
                    Nama Node ({currentSelectedNode.type?.toUpperCase()})
                  </label>
                  <input
                    type="text"
                    readOnly={readOnly}
                    placeholder={`Nama ${currentSelectedNode.type?.toUpperCase()}...`}
                    value={currentSelectedNode.label || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNodesFromUser((prev) =>
                        prev.map((n) =>
                          n.id === currentSelectedNode.id
                            ? { ...n, label: val }
                            : n,
                        ),
                      );
                    }}
                    className={`bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500 w-full ${
                      readOnly ? "opacity-80 cursor-text select-text" : ""
                    }`}
                  />
                </div>
              );
            }

            return (
              <>
                {/* Status Interface Box */}
                {combinedInterfaceOptions.length > 0 && (
                  <div className="flex flex-col gap-1.5 relative">
                    {currentSelectedNode.linked_interface &&
                      (() => {
                        const linked = combinedInterfaceOptions.find(
                          (i) => i.name === currentSelectedNode.linked_interface,
                        );
                        if (!linked) return null;

                        let isUp = false;
                        let isDown = false;
                        let statusText = "Unknown";
                        let offlineSince = null;

                        let mData = null;
                        if (linked.isMapping) {
                          const m = mappings.find((x) => x.prefix === linked.name);
                          if (m) {
                            isUp = m.final_status === "Online";
                            isDown = m.final_status === "Offline";
                            statusText = m.final_status;
                            offlineSince = m.offline_since;
                            mData = m;
                          }
                        } else {
                          const c = coreInterfaces.find((x) => x.name === linked.name);
                          if (c) {
                            isUp = c.running === "true";
                            isDown = c.running !== "true";
                            statusText =
                              c.disabled === "true" ? "Disabled" : isUp ? "Up" : "Down";
                          }
                        }

                        return (
                          <div
                            className={`flex flex-col gap-1.5 p-2.5 rounded-lg text-xs border ${
                              isUp
                                ? "bg-emerald-500/10 border-emerald-500/30"
                                : "bg-red-500/10 border-red-500/30"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">Status Interface</span>

                              <span
                                className={`font-bold px-2 py-0.5 rounded ${
                                  isUp
                                    ? "bg-emerald-500/20 text-emerald-400"
                                    : "bg-red-500/20 text-red-400"
                                }`}
                              >
                                {statusText}{" "}
                                {mData?.clients != null && (
                                  <span className="">{mData.clients} Client</span>
                                )}
                              </span>
                            </div>
                            {isDown && offlineSince && (
                              <div className="text-[10px] text-red-400 flex items-center justify-end gap-1">
                                <Clock size={10} /> Sejak {offlineSince}
                              </div>
                            )}

                            {mData && (
                              <div className="mt-2 pt-2 border-t border-slate-700/50 flex flex-col gap-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-400 text-[10px] uppercase tracking-wider truncate">
                                    STATUS RUIJIE {mData.ruijie_mac || "-"} :
                                  </span>
                                  <span
                                    className={`text-[10px] font-bold ${
                                      mData.status_ruijie === "Online"
                                        ? "text-emerald-400"
                                        : mData.status_ruijie === "Offline"
                                          ? "text-red-500"
                                          : "text-slate-500"
                                    }`}
                                  >
                                    {mData.status_ruijie === "Online"
                                      ? "UP"
                                      : mData.status_ruijie === "Offline"
                                        ? "DOWN"
                                        : "-"}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-400 text-[10px] uppercase tracking-wider truncate">
                                    STATUS MIKROTIK {mData.remote_address || "-"} :
                                  </span>
                                  <span
                                    className={`text-[10px] font-bold ${
                                      mData.status_mikrotik === "Online"
                                        ? "text-emerald-400"
                                        : mData.status_mikrotik === "Offline"
                                          ? "text-red-500"
                                          : "text-slate-500"
                                    }`}
                                  >
                                    {mData.status_mikrotik === "Online"
                                      ? "UP"
                                      : mData.status_mikrotik === "Offline"
                                        ? "DOWN"
                                        : "-"}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                    <div className="flex flex-col gap-1.5 relative">
                      <label className="text-xs font-semibold text-slate-400">
                        Interface / Prefix
                      </label>
                      <input
                        type="text"
                        readOnly={readOnly}
                        placeholder="Ketik untuk mencari prefix/interface..."
                        value={nodeIfaceSearch}
                        onChange={(e) => {
                          setNodeIfaceSearch(e.target.value);
                          setShowNodeIfaceDropdown(true);
                        }}
                        onFocus={() => !readOnly && setShowNodeIfaceDropdown(true)}
                        onBlur={() =>
                          setTimeout(() => setShowNodeIfaceDropdown(false), 200)
                        }
                        className={`bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500 w-full ${
                          readOnly ? "opacity-80 cursor-text select-text" : ""
                        }`}
                      />

                      {!readOnly && showNodeIfaceDropdown && (
                        <div className="absolute top-[64px] left-0 right-0 z-[2000] bg-slate-800 border border-slate-700 rounded-lg shadow-2xl max-h-52 overflow-auto">
                          <div
                            className="px-3 py-2.5 text-xs text-slate-400 hover:bg-slate-700 cursor-pointer"
                            onClick={() => {
                              setNodesFromUser((prev) =>
                                prev.map((n) =>
                                  n.id === currentSelectedNode.id
                                    ? { ...n, linked_interface: "" }
                                    : n,
                                ),
                              );
                              setNodeIfaceSearch("");
                              setShowNodeIfaceDropdown(false);
                            }}
                          >
                            -- Tidak ada (manual) --
                          </div>
                          {combinedInterfaceOptions
                            .filter(
                              (i) =>
                                !nodeIfaceSearch ||
                                i.name
                                  .toLowerCase()
                                  .includes(nodeIfaceSearch.toLowerCase()) ||
                                (currentSelectedNode.linked_interface &&
                                  nodeIfaceSearch ===
                                    currentSelectedNode.linked_interface),
                            )
                            .map((iface, i) => {
                              const isUsedByOther = nodes.some(
                                (n) =>
                                  n.id !== currentSelectedNode.id &&
                                  n.linked_interface === iface.name,
                              );
                              return (
                                <div
                                  key={i}
                                  className={`px-3 py-2.5 text-xs border-t border-slate-700/30 flex justify-between items-center ${
                                    isUsedByOther
                                      ? "text-slate-500 bg-slate-800/50 cursor-not-allowed"
                                      : "text-slate-200 hover:bg-slate-700 cursor-pointer"
                                  }`}
                                  onClick={() => {
                                    if (isUsedByOther) return;
                                    setNodesFromUser((prev) =>
                                      prev.map((n) =>
                                        n.id === currentSelectedNode.id
                                          ? {
                                              ...n,
                                              linked_interface: iface.name,
                                              label: iface.name,
                                            }
                                          : n,
                                      ),
                                    );
                                    setNodeIfaceSearch(iface.name);
                                    setShowNodeIfaceDropdown(false);
                                  }}
                                >
                                  <div className="flex flex-col">
                                    <span className="font-semibold text-slate-100">
                                      {iface.label}
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                      {iface.type}
                                    </span>
                                  </div>
                                  {isUsedByOther && (
                                    <span className="text-[10px] text-amber-500">
                                      Sudah dipakai
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400">
                    Vendor Perangkat - ID Pelanggan
                  </label>
                  <input
                    type="text"
                    readOnly
                    placeholder="-"
                    value={(() => {
                      const vendor =
                        currentSelectedNode.vendor ||
                        currentSelectedNode.site?.vendor ||
                        "";
                      const custId =
                        currentSelectedNode.customer_id !== undefined
                          ? currentSelectedNode.customer_id
                          : currentSelectedNode.site?.customer_id || "";
                      if (vendor && custId) return `${vendor} - ${custId}`;
                      return vendor || custId || "";
                    })()}
                    className="bg-slate-900/60 border border-slate-700/50 rounded-lg p-2.5 text-xs text-slate-300 focus:outline-none w-full opacity-80 cursor-text select-text"
                  />
                </div>

                {/* Metrics if linked to device */}
                {currentSelectedNode.device_id &&
                  nodeDetail &&
                  !nodeDetail.loading &&
                  !nodeDetail.error && (
                    <div className="flex flex-col gap-3 mt-1 bg-slate-900/40 p-3 rounded-lg border border-slate-700/40">
                      <p className="text-[10px] text-slate-500 uppercase font-bold">
                        Live Metrics
                      </p>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">Uptime</span>
                        <span className="text-slate-200">
                          {nodeDetail?.uptime || "-"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">PPPoE Aktif</span>
                        <span className="text-emerald-400 font-semibold">
                          {nodeDetail?.pppoe_active || 0} user
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">CPU</span>
                        <span className="text-slate-200">{nodeDetail?.cpu || 0}%</span>
                      </div>
                    </div>
                  )}

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400">
                    Nama PIC - Nomor PIC
                  </label>
                  <input
                    type="text"
                    readOnly
                    placeholder="-"
                    value={(() => {
                      const name =
                        currentSelectedNode.pic_name ||
                        currentSelectedNode.site?.pics?.[0]?.name ||
                        "";
                      const phone =
                        currentSelectedNode.pic_phone ||
                        currentSelectedNode.site?.pics?.[0]?.phone ||
                        "";
                      if (name && phone) return `${name} - ${phone}`;
                      return name || phone || "";
                    })()}
                    className="bg-slate-900/60 border border-slate-700/50 rounded-lg p-2.5 text-xs text-slate-300 focus:outline-none w-full opacity-80 cursor-text select-text"
                  />
                </div>
              </>
            );
          })()}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400">
              Lat, Long (Lintang, Bujur)
            </label>
            <input
              type="text"
              readOnly={readOnly}
              placeholder="-7.154376768491, 107.69818606047"
              value={`${currentSelectedNode.latitude ?? ""}${
                currentSelectedNode.latitude && currentSelectedNode.longitude
                  ? ", "
                  : ""
              }${currentSelectedNode.longitude ?? ""}`}
              onChange={(e) => {
                const [lat = "", lng = ""] = e.target.value
                  .split(",")
                  .map((v) => v.trim());
                setNodesFromUser((prev) =>
                  prev.map((n) =>
                    n.id === currentSelectedNode.id
                      ? { ...n, latitude: lat, longitude: lng }
                      : n,
                  ),
                );
              }}
              className={`bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500 w-full ${
                readOnly ? "opacity-80 cursor-text select-text" : ""
              }`}
              style={{ minWidth: 0 }}
            />
          </div>

          {mac && (
            <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-between text-xs text-blue-300 mt-1">
              <span className="text-[11px] text-blue-200">
                Kelola detail site ini di Halaman Site
              </span>
              <a
                href={`/sites/${siteCategory}/${encodeURIComponent(mac)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 shrink-0 cursor-pointer"
              >
                Detail Site <ExternalLink size={12} />
              </a>
            </div>
          )}

          {canDelete && (
            <button
              onClick={() => {
                markNodeDeleted(currentSelectedNode.id);
                setNodesFromUser((prev) =>
                  prev.filter((n) => n.id !== currentSelectedNode.id),
                );
                setEdgesFromUser((prev) =>
                  prev.filter(
                    (e) =>
                      e.from_node !== currentSelectedNode.id &&
                      e.to_node !== currentSelectedNode.id &&
                      e.from !== currentSelectedNode.id &&
                      e.to !== currentSelectedNode.id,
                  ),
                );
                setSelectedNode(null);
              }}
              className="cursor-pointer mt-2 flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white py-2.5 rounded-lg text-xs font-semibold transition"
            >
              <Trash2 size={16} /> Hapus Node
            </button>
          )}
        </div>
      )}

      {/* TAB 2: EVIDENCE FOTO */}
      {activeTab === "evidence" && (
        <div className="p-4 flex-1 overflow-auto flex flex-col gap-3.5 animate-fadeIn">
          {/* Cards Grid */}
          <div className="grid grid-cols-1 gap-3">
            {slots.map((slot) => {
              const photo = photos?.[slot.key];
              const hasPhoto = Boolean(photo && (photo.url || photo.drive_id || photo.preview_url));
              const IconComponent = slot.icon;

              const previewSrc =
                photo?.preview_url ||
                photo?.url ||
                photo?.thumbnail_url ||
                (photo?.drive_id ? `/api/drive/image/${photo.drive_id}` : "");

              return (
                <div
                  key={slot.key}
                  className={`rounded-xl border overflow-hidden transition-all bg-slate-900/60 flex flex-col ${
                    hasPhoto
                      ? "border-slate-700/80 shadow-md"
                      : "border-dashed border-slate-700/60 opacity-75"
                  }`}
                >
                  {/* Card Header */}
                  <div className="px-3 py-2 bg-slate-800/50 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`p-1 rounded ${
                          slot.color === "blue"
                            ? "bg-blue-500/20 text-blue-400"
                            : slot.color === "purple"
                            ? "bg-purple-500/20 text-purple-400"
                            : slot.color === "emerald"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-amber-500/20 text-amber-400"
                        }`}
                      >
                        <IconComponent size={13} />
                      </div>
                      <span className="text-xs font-semibold text-slate-200 truncate">
                        {slot.label}
                      </span>
                    </div>

                    {hasPhoto ? (
                      <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        <CheckCircle2 size={10} /> Ada
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
                        Kosong
                      </span>
                    )}
                  </div>

                  {/* Card Image Thumbnail */}
                  <div className="relative h-36 w-full bg-slate-950/80 flex items-center justify-center overflow-hidden group">
                    {hasPhoto ? (
                      <>
                        <img
                          src={previewSrc}
                          alt={slot.label}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          onError={(e) => {
                            if (photo?.drive_id && !e.target.src.includes("/api/drive/image")) {
                              e.target.src = `/api/drive/image/${photo.drive_id}`;
                            }
                          }}
                        />
                        {/* Hover Overlay */}
                        <div
                          onClick={() =>
                            setActiveLightbox({
                              photo,
                              deviceLabel: slot.label,
                            })
                          }
                          className="cursor-pointer absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1"
                        >
                          <div className="p-2 rounded-full bg-blue-600/90 text-white shadow-lg">
                            <Eye size={16} />
                          </div>
                          <span className="text-xs font-bold text-white tracking-wide">
                            Lihat Foto HD
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-3 text-center">
                        <div className="p-2.5 rounded-full bg-slate-800/80 text-slate-500 mb-1">
                          <ImageIcon size={20} />
                        </div>
                        <p className="text-xs text-slate-400 font-medium">Belum ada foto</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {activeLightbox && (
        <EvidenceLightboxModal
          isOpen={Boolean(activeLightbox)}
          onClose={() => setActiveLightbox(null)}
          photo={activeLightbox.photo}
          deviceLabel={activeLightbox.deviceLabel}
          sitePrefix={currentSelectedNode.label || currentSelectedNode.linked_interface || "Site"}
          canEdit={false}
        />
      )}
    </div>
  );
};
