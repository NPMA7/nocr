import React from "react";
import {
  MapPin,
  Plus,
  GitCommit,
  Trash2,
  Search,
  Settings,
  RefreshCw,
  Save,
} from "lucide-react";

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
  return (
    <div className="flex-shrink-0 bg-slate-800 border-b border-slate-700/50 px-3 py-2 xl:px-6 xl:py-3 flex flex-col xl:flex-row justify-between items-start xl:items-center z-[1000] gap-3 xl:gap-4 overflow-visible relative">
      <div className="flex flex-col xl:flex-row items-start xl:items-center gap-2 xl:gap-3 w-full xl:w-auto">
        {/* Main Buttons */}
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
                      : "text-slate-400 hover:text-white hover:bg-red-500/10"
                  }`}
                >
                  <Trash2 size={14} /> Hapus Kabel
                </button>
              )}
              <div className="w-px bg-slate-700/50 mx-1 hidden sm:block"></div>
            </div>
          ) : null}

          <div className="cursor-pointer flex flex-wrap bg-slate-900 rounded-lg p-1 border border-slate-700">
            <div className="w-px bg-slate-700/50 mx-1 hidden sm:block"></div>
              <button
              onClick={() => {
                setFlyToTarget({ lat: -7.065, lng: 107.55, zoom: 11 });
                setNetworkMode("l2tp");
              }}
              className={`cursor-pointer flex-1 min-w-fit px-2 py-1 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                networkMode === "l2tp"
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <MapPin size={14} /> Zoom Desa
            </button>
             <button
              onClick={() => {
                setFlyToTarget({ lat: -7.0225, lng: 107.527, zoom: 16.5 });
                setNetworkMode("pppoe");
              }}
              className={`cursor-pointer flex-1 min-w-fit px-2 py-1 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                networkMode === "pppoe"
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Search size={14} /> Zoom OPD
            </button>
         
            <button
              onClick={() => setShowMobileMode((prev) => !prev)}
              className={`cursor-pointer lg:hidden flex-1 min-w-fit px-2 py-1 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                showMobileMode
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Settings size={14} /> Mode
            </button>
          </div>
        </div>

        {/* Node Type Selector (Floating) */}
        {canCreate && interactionMode === "add_node" && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 xl:left-6 xl:translate-x-0 mt-2 z-[1001] shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-1.5 bg-slate-900 border border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.15)] rounded-lg p-1.5 w-max">
              <span className="text-[10px] text-slate-400 uppercase font-bold px-2 whitespace-nowrap">
                PILIH TIPE:
              </span>
              {["olt", "odc", "odp", "client"].map((t) => (
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
          <span className="text-xs text-amber-400 animate-pulse font-medium whitespace-nowrap flex-shrink-0">
            Klik node tujuan...
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
          onClick={() => fetchTopology(true)}
          className="flex items-center justify-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold transition bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 cursor-pointer whitespace-nowrap"
        >
          <RefreshCw size={13} /> Refresh Peta
        </button>
        <button
          onClick={fetchCoreData}
          disabled={coreLoading}
          className="flex items-center justify-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold transition bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 cursor-pointer whitespace-nowrap"
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
            className="flex items-center justify-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold transition bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 cursor-pointer whitespace-nowrap"
          >
            {saving ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <Save size={16} />
                Simpan
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
