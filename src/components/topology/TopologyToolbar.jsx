import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  MapPin,
  Plus,
  GitCommit,
  Trash2,
  Search,
  RefreshCw,
  Save,
  Layers,
} from "lucide-react";

export function maskIpAddress(ipString, isReadOnly = false) {
  if (!ipString || typeof ipString !== "string") return "";
  if (!isReadOnly) return ipString;

  let mainIp = ipString.trim();
  let portSuffix = "";

  if (mainIp.includes(":")) {
    const colonIdx = mainIp.lastIndexOf(":");
    const portPart = mainIp.substring(colonIdx + 1);
    if (!isNaN(portPart) || portPart.length > 0) {
      mainIp = mainIp.substring(0, colonIdx);
      portSuffix = ":xxx";
    }
  }

  let subnetSuffix = "";
  if (mainIp.includes("/")) {
    const slashIdx = mainIp.lastIndexOf("/");
    subnetSuffix = mainIp.substring(slashIdx);
    mainIp = mainIp.substring(0, slashIdx);
  }

  const octets = mainIp.split(".");
  if (octets.length === 4) {
    octets[2] = "xxx";
    return `${octets.join(".")}${subnetSuffix}${portSuffix}`;
  }

  return `${mainIp}${portSuffix}`;
}

function checkIsPPPoENode(node, mappings = []) {
  if (!node) return false;
  if (node.type === "pppoe-client") return true;

  const iface = (node.linked_interface || node.label || "").toLowerCase();
  if (iface.includes("pppoe")) return true;

  if (node.linked_interface) {
    const m = mappings.find(
      (map) =>
        map.prefix &&
        map.prefix.toLowerCase() === node.linked_interface.toLowerCase(),
    );
    if (m && m.connection_type === "PPPOE") return true;
    if (m && m.connection_type === "L2TP") return false;
  }

  if (
    iface.includes("-opd") ||
    iface.includes("opd") ||
    iface.includes("dinas") ||
    iface.includes("badan") ||
    iface.includes("kantor") ||
    iface.includes("bag-") ||
    iface.includes("bagian") ||
    iface.includes("setda") ||
    iface.includes("diskominfo") ||
    iface.includes("satpol") ||
    iface.includes("bapperida") ||
    iface.includes("bkpsdm") ||
    iface.includes("kesbangpol") ||
    iface.includes("inspektorat") ||
    iface.includes("sekwan") ||
    iface.includes("dishub") ||
    iface.includes("disperindag") ||
    iface.includes("dispar") ||
    iface.includes("dispakan") ||
    iface.includes("distan") ||
    iface.includes("dinkes") ||
    iface.includes("disdik") ||
    iface.includes("disdukcapil") ||
    iface.includes("dinsos") ||
    iface.includes("dpmd") ||
    iface.includes("putr") ||
    iface.includes("bapenda") ||
    iface.includes("bkad")
  ) {
    return true;
  }

  return false;
}

export default function TopologyToolbar({
  readOnly,
  canEdit,
  canCreate,
  canUpdate,
  canDelete,
  interactionMode,
  setInteractionMode,
  setLinkStartNode,
  setShowManualAddModal,
  setManualIfaceSearch,
  setShowManualIfaceDropdown,
  networkMode,
  setNetworkMode,
  setFlyToTarget,
  setSelectedNode,
  nodes = [],
  mappings = [],
  showMobileMode,
  setShowMobileMode,
  newNodeType,
  setNewNodeType,
  linkStartNode,
  fetchTopology,
  fetchCoreData,
  coreLoading,
  saveLayout,
  saving,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchContainerRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter nodes matching search query
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || q.length < 2) return [];

    return nodes
      .filter((n) => {
        const label = (n.label || "").toLowerCase();
        const iface = (n.linked_interface || "").toLowerCase();
        const ip = (n.ip || "").toLowerCase();
        const vendor = (n.vendor || "").toLowerCase();
        const siteName = (n.site_name || "").toLowerCase();
        const prefix = (n.prefix || "").toLowerCase();
        return (
          label.includes(q) ||
          iface.includes(q) ||
          ip.includes(q) ||
          vendor.includes(q) ||
          siteName.includes(q) ||
          prefix.includes(q)
        );
      })
      .slice(0, 15);
  }, [searchQuery, nodes]);

  const handleSelectSearchResult = (node) => {
    // 1. Auto switch networkMode jika node yang dicari berada di tipe jaringan berbeda (OPD vs Desa)
    const isPPPoE = checkIsPPPoENode(node, mappings);
    const requiredMode = isPPPoE ? "pppoe" : "l2tp";
    if (setNetworkMode && networkMode !== requiredMode) {
      setNetworkMode(requiredMode);
    }

    // 2. Zoom dan arahkan peta ke koordinat node yang dituju
    const lat = parseFloat(node.latitude ?? node.lat);
    const lng = parseFloat(node.longitude ?? node.lng);
    if (!isNaN(lat) && !isNaN(lng)) {
      setFlyToTarget?.({ lat, lng, zoom: 18 });
    }

    // 3. Pilih node dan tutup dropdown pencarian
    setSelectedNode?.(node);
    setShowSearchDropdown(false);
    setSearchQuery(node.label || node.linked_interface || "");
  };

  return (
    <div className="flex-shrink-0 bg-slate-800 border-b border-slate-700/50 px-3 py-2 xl:px-6 xl:py-3 flex flex-col xl:flex-row justify-between items-start xl:items-center z-[1000] gap-3 xl:gap-4 overflow-visible relative">
      <div className="flex flex-col xl:flex-row items-start xl:items-center gap-2 xl:gap-3 w-full xl:w-auto">
        {/* Main Action Buttons */}
        <div className="w-full xl:w-auto flex-shrink-0">
          {readOnly ? (
            <></>
          ) : canEdit ? (
            <div className="flex flex-wrap bg-slate-900 rounded-lg p-1 border border-slate-700">
              {canUpdate && (
                <button
                  onClick={() => {
                    setInteractionMode("select");
                    setLinkStartNode(null);
                  }}
                  className={`cursor-pointer flex-1 min-w-fit px-2 py-1 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                    interactionMode === "select"
                      ? "bg-blue-600 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <MapPin size={14} /> Geser & Pilih
                </button>
              )}
              {canCreate && (
                <>
                  <button
                    onClick={() => {
                      setInteractionMode("add_node");
                      setLinkStartNode(null);
                    }}
                    className={`cursor-pointer flex-1 min-w-fit px-2 py-1 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                      interactionMode === "add_node"
                        ? "bg-blue-600 text-white"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <Plus size={14} /> + Node
                  </button>
                  <button
                    onClick={() => {
                      setShowManualAddModal(true);
                      setManualIfaceSearch("");
                      setShowManualIfaceDropdown(false);
                    }}
                    className={`cursor-pointer flex-1 min-w-fit px-2 py-1 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                      interactionMode === "node"
                        ? "bg-blue-600 text-white"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <MapPin size={14} /> Titik Lokasi
                  </button>
                  <button
                    onClick={() => {
                      setInteractionMode("add_edge");
                      setLinkStartNode(null);
                    }}
                    className={`cursor-pointer flex-1 min-w-fit px-2 py-1 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                      interactionMode === "add_edge"
                        ? "bg-blue-600 text-white"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <GitCommit size={14} /> + Kabel FO
                  </button>
                </>
              )}
              {canDelete && (
                <button
                  onClick={() => {
                    setInteractionMode("delete_edge");
                    setLinkStartNode(null);
                  }}
                  className={`cursor-pointer flex-1 min-w-fit px-2 py-1 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                    interactionMode === "delete_edge"
                      ? "bg-red-600 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Trash2 size={14} /> Hapus Kabel
                </button>
              )}
            </div>
          ) : null}
        </div>

        {/* Search Bar directly inside Map Toolbar */}
        <div ref={searchContainerRef} className="relative w-full xl:w-72 flex-shrink-0 z-[1010]">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchDropdown(true);
              }}
              onFocus={() => setShowSearchDropdown(true)}
              placeholder="Cari interface atau nama titik..."
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg py-1.5 pl-8 pr-7 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setShowSearchDropdown(false);
                }}
                className="cursor-pointer absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs p-0.5"
              >
                ✕
              </button>
            )}
          </div>

          {/* Search Suggestions Dropdown */}
          {showSearchDropdown && searchResults.length > 0 && (
            <div className="absolute top-full mt-1.5 left-0 w-80 max-w-[90vw] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-[1050] max-h-72 overflow-y-auto custom-scrollbar">
              <div className="p-2 border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-950/80 flex items-center justify-between">
                <span>Hasil Pencarian ({searchResults.length})</span>
                <span className="text-[9px] text-blue-400">Klik untuk lompat</span>
              </div>
              {searchResults.map((node) => (
                <div
                  key={node.id}
                  onClick={() => handleSelectSearchResult(node)}
                  className="p-2.5 border-b border-slate-800/60 hover:bg-slate-800/90 cursor-pointer flex items-center justify-between transition gap-2 group"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-slate-200 group-hover:text-blue-300 transition truncate">
                      {node.label || "Tanpa Nama"}
                    </span>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 truncate mt-0.5">
                      {node.linked_interface && (
                        <span className="text-blue-400 font-mono">
                          {node.linked_interface}
                        </span>
                      )}
                      {node.ip && (
                        <span className="text-emerald-400 font-mono">
                          {maskIpAddress(node.ip, readOnly)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-[9px] uppercase font-bold text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                      {node.type || "node"}
                    </span>
                    <MapPin size={13} className="text-slate-400 group-hover:text-blue-400 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Preset Node Types when in add_node mode */}
        {interactionMode === "add_node" && canCreate && (
          <div className="flex items-center gap-1.5 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-700 flex-shrink-0">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
              Tipe:
            </span>
            <div className="flex gap-1">
              {["odp", "odc", "olt", "client", "custom"].map((t) => (
                <button
                  key={t}
                  onClick={() => setNewNodeType(t)}
                  className={`cursor-pointer px-2 py-1 rounded-md text-xs uppercase font-medium whitespace-nowrap transition ${
                    newNodeType === t
                      ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}
        {canCreate && linkStartNode && (
          <span className="text-xs text-amber-300 font-medium whitespace-nowrap flex-shrink-0 flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/40 px-2.5 py-1 rounded-lg shadow-md">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
            <span>Pen Tool: Klik peta untuk titik belokan, lalu klik node tujuan (Esc untuk batal)</span>
          </span>
        )}
        {canDelete && interactionMode === "delete_edge" && (
          <span className="text-xs text-red-400 font-medium bg-red-500/10 px-2 py-1 rounded-lg border border-red-500/20 whitespace-nowrap flex-shrink-0">
            Klik kabel untuk menghapus
          </span>
        )}
      </div>

      <div className="flex flex-wrap justify-center xl:justify-end items-center gap-2 xl:gap-3 w-full xl:w-auto border-t border-slate-700/50 xl:border-0 xl:pt-0">
        <button
          type="button"
          onClick={() => setShowMobileMode?.((prev) => !prev)}
          className={`md:hidden flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
            showMobileMode
              ? "bg-blue-600 border border-blue-500 text-white shadow-md shadow-blue-500/20"
              : "bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200"
          }`}
        >
          <Layers size={13} /> {showMobileMode ? "Tutup Mode" : "Mode"}
        </button>
        <button
          onClick={() => fetchTopology(true)}
          className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 cursor-pointer whitespace-nowrap"
        >
          <RefreshCw size={13} /> Refresh Peta
        </button>
        <button
          onClick={fetchCoreData}
          disabled={coreLoading}
          className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 cursor-pointer whitespace-nowrap"
        >
          <RefreshCw
            size={13}
            className={coreLoading ? "animate-spin" : ""}
          />{" "}
          Sync Sekarang
        </button>
        {canEdit && (
          <button
            onClick={() => saveLayout()}
            disabled={saving}
            className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition bg-blue-600 hover:bg-blue-500 text-white cursor-pointer whitespace-nowrap shadow-md shadow-blue-500/20"
          >
            {saving ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <Save size={14} />
                Simpan
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
