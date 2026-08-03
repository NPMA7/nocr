"use client";

import { MapPin, X, Clock, Trash2, ExternalLink, Users } from "lucide-react";

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
  if (!currentSelectedNode) return null;

  return (
    <div
      className={`absolute top-0 right-0 bottom-0 w-80 bg-slate-800/95 backdrop-blur-md border-l border-slate-700/50 flex flex-col z-[1000] shadow-2xl transition-transform duration-300 ease-out ${
        currentSelectedNode ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="p-4 border-b border-slate-700/50 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h3 className="font-bold text-slate-100">Properties Node</h3>
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
              <MapPin size={14} />{" "}
              <span className="font-bold text-xs text-slate-100 ml-1 cursor-pointer">
                Zoom Lokasi
              </span>
            </button>
          )}
        </div>
        <button
          className="cursor-pointer text-slate-400 hover:text-white"
          onClick={() => setSelectedNode(null)}
        >
          <X size={20} />
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

      <div className="p-5 flex-1 overflow-auto flex flex-col gap-4">
        <div className="flex justify-between items-center border-b border-slate-700/30">
          <span className="text-xs text-slate-400">Tipe Node</span>
          <span className="text-xs font-semibold text-blue-400 uppercase">
            {currentSelectedNode.type}
          </span>
        </div>

        {/* Link node to core MikroTik interface */}
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
                          <span className="text-slate-400 text-[10px] uppercase tracking-wider">
                            Status Ruijie {mData.ruijie_mac || "-"} :
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
                          <span className="text-slate-400 text-[10px] uppercase tracking-wider">
                            Status Mikrotik {mData.remote_address || "-"} :
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
                  readOnly ? "opacity-70 cursor-default" : ""
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
            className="bg-slate-900/60 border border-slate-700/50 rounded-lg p-2.5 text-xs text-slate-300 focus:outline-none w-full opacity-80 cursor-not-allowed"
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
        {currentSelectedNode.device_id && nodeDetail?.loading && (
          <p className="text-xs text-slate-500">Memuat status perangkat...</p>
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
            className="bg-slate-900/60 border border-slate-700/50 rounded-lg p-2.5 text-xs text-slate-300 focus:outline-none w-full opacity-80 cursor-not-allowed"
          />
        </div>

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
              readOnly ? "opacity-70 cursor-default" : ""
            }`}
            style={{ minWidth: 0 }}
          />
        </div>

        {(() => {
          const linkedMap = (mappings || []).find(
            (m) => m.prefix === currentSelectedNode.linked_interface,
          );
          const mac =
            currentSelectedNode.site?.ruijie_mac || linkedMap?.ruijie_mac;
          if (!mac) return null;
          const siteCategory = (currentSelectedNode.linked_interface || "")
            .toUpperCase()
            .includes("OPD")
            ? "opd"
            : "desa";
          return (
            <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-between text-xs text-blue-300">
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
          );
        })()}

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
            className="cursor-pointer mt-4 flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white py-2.5 rounded-lg text-xs font-semibold transition"
          >
            <Trash2 size={16} /> Hapus Node
          </button>
        )}
      </div>
    </div>
  );
}
