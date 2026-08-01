"use client";

import { MapPin, X, Search, RefreshCw } from "lucide-react";
import { IfaceBadge } from "./StatusBadge";

export default function ManualAddNodeModal({
  canCreate,
  showManualAddModal,
  setShowManualAddModal,
  manualAddData,
  setManualAddData,
  manualIfaceSearch,
  setManualIfaceSearch,
  showManualIfaceDropdown,
  setShowManualIfaceDropdown,
  searchSuggestions,
  setSearchSuggestions,
  isSearching,
  extractCoordinates,
  handleAddNode,
  setFlyToTarget,
  addToast,
  combinedInterfaceOptions,
  nodes,
}) {
  if (!canCreate || !showManualAddModal) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setShowManualAddModal(false);
          setManualIfaceSearch("");
        }
      }}
      className="absolute inset-0 z-[3000] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md max-h-[min(90dvh,100%)] my-auto flex flex-col overflow-hidden animate-fade-in-up">
        <div className="flex-shrink-0 p-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/50">
          <h3 className="font-bold text-slate-100 flex items-center gap-2">
            <MapPin size={18} className="text-emerald-400" /> Tambah Titik Node
            Manual
          </h3>
          <button
            onClick={() => setShowManualAddModal(false)}
            className="cursor-pointer text-slate-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5 border-b border-slate-700/50 pb-4 mb-2 relative">
            <label className="text-xs font-semibold text-slate-400">
              Pencarian Lokasi & Koordinat
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ketik nama tempat atau paste koordinat..."
                value={manualAddData.addressSearch || ""}
                onChange={(e) => {
                  setManualAddData({
                    ...manualAddData,
                    addressSearch: e.target.value,
                  });
                  if (e.target.value === "") setSearchSuggestions([]);
                }}
                onKeyDown={(e) => e.key === "Enter" && extractCoordinates()}
                className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 flex-1"
              />
              <button
                onClick={extractCoordinates}
                disabled={isSearching}
                className="cursor-pointer bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 rounded-lg flex items-center justify-center gap-1.5 transition text-xs font-semibold whitespace-nowrap disabled:opacity-50"
              >
                {isSearching ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <Search size={16} />
                )}
                Cari
              </button>
            </div>

            {/* Suggestions Dropdown */}
            {searchSuggestions.length > 0 && (
              <div className="absolute top-[68px] left-0 right-0 z-[5000] bg-slate-800 border border-slate-700 rounded-lg shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
                {searchSuggestions.map((place, idx) => (
                  <div
                    key={idx}
                    className="px-3 py-2 text-xs border-b border-slate-700/50 hover:bg-slate-700 cursor-pointer text-slate-200"
                    onClick={() => {
                      setManualAddData((prev) => ({
                        ...prev,
                        lat: place.lat,
                        lng: place.lon,
                        label: place.display_name.split(",")[0],
                        addressSearch: place.display_name,
                      }));
                      setSearchSuggestions([]);
                      addToast("Lokasi berhasil dipilih", "success");
                    }}
                  >
                    <p className="font-semibold text-emerald-400">
                      {place.display_name.split(",")[0]}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {place.display_name}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[10px] text-slate-500 leading-tight">
              Tekan Enter atau klik Cari untuk mencari lokasi atau paste
              koordinat.
            </p>
          </div>

          <div className="flex flex-col gap-1.5 relative">
            <label className="text-xs font-semibold text-slate-400">
              Prefix (Gabungan) / Interface MikroTik
            </label>
            <input
              type="text"
              placeholder="Ketik untuk mencari prefix/interface..."
              value={manualIfaceSearch}
              onChange={(e) => {
                setManualIfaceSearch(e.target.value);
                setManualAddData((prev) => ({
                  ...prev,
                  label: e.target.value,
                  linked_interface: "",
                }));
                setShowManualIfaceDropdown(true);
              }}
              onFocus={() => setShowManualIfaceDropdown(true)}
              onBlur={() =>
                setTimeout(() => setShowManualIfaceDropdown(false), 200)
              }
              className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 w-full"
            />
            {showManualIfaceDropdown &&
              combinedInterfaceOptions.length > 0 && (
                <div className="absolute top-[64px] left-0 right-0 z-[4000] bg-slate-800 border border-slate-700 rounded-lg shadow-2xl max-h-52 overflow-auto">
                  <div
                    className="px-3 py-2.5 text-xs text-slate-400 hover:bg-slate-700 cursor-pointer"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setManualAddData((prev) => ({
                        ...prev,
                        label: "",
                        linked_interface: "",
                      }));
                      setManualIfaceSearch("");
                      setShowManualIfaceDropdown(false);
                    }}
                  >
                    -- Tidak ada (manual) --
                  </div>
                  {combinedInterfaceOptions
                    .filter(
                      (i) =>
                        !manualIfaceSearch ||
                        i.name
                          .toLowerCase()
                          .includes(manualIfaceSearch.toLowerCase()),
                    )
                    .map((iface, idx) => {
                      const isUsed = nodes.some(
                        (n) => n.linked_interface === iface.name,
                      );
                      return (
                        <div
                          key={idx}
                          className={`px-3 py-2.5 text-xs border-t border-slate-700/30 flex justify-between items-center ${
                            isUsed
                              ? "text-slate-500 bg-slate-800/50 cursor-not-allowed"
                              : "text-slate-200 hover:bg-slate-700 cursor-pointer"
                          }`}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            if (isUsed) return;
                            setManualAddData((prev) => ({
                              ...prev,
                              label: iface.name,
                              linked_interface: iface.name,
                            }));
                            setManualIfaceSearch(iface.name);
                            setShowManualIfaceDropdown(false);
                          }}
                        >
                          <span className="font-medium flex items-center gap-1.5">
                            {iface.name}
                            {isUsed && (
                              <span className="text-[9px] bg-slate-700 text-[#94A3B8] px-1.5 py-0.5 rounded">
                                Terpakai
                              </span>
                            )}
                          </span>
                          <div className="flex items-center gap-2">
                            {!iface.isMapping && (
                              <IfaceBadge
                                running={iface.running}
                                disabled={iface.disabled}
                              />
                            )}
                            <span className="text-[10px] text-slate-500 uppercase">
                              {iface.type}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  {manualIfaceSearch &&
                    combinedInterfaceOptions.filter((i) =>
                      i.name
                        .toLowerCase()
                        .includes(manualIfaceSearch.toLowerCase()),
                    ).length === 0 && (
                      <div className="px-3 py-3 text-xs text-slate-500 text-center">
                        Tidak ditemukan
                      </div>
                    )}
                </div>
              )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400">
              Tipe Node
            </label>
            <select
              value={manualAddData.type}
              onChange={(e) =>
                setManualAddData({
                  ...manualAddData,
                  type: e.target.value,
                })
              }
              className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 w-full appearance-none"
            >
              <option value="client">Client (Rumah)</option>
              <option value="odp">ODP (Kotak Distribusi)</option>
              <option value="odc">ODC (Kabinet)</option>
              <option value="pole">Tiang (Pole)</option>
              <option value="olt">OLT (Pusat)</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400">
              Vendor / Merek ISP (Opsional)
            </label>
            <input
              type="text"
              placeholder="Contoh: Indibiz, Megavision, etc.."
              value={manualAddData.vendor}
              onChange={(e) =>
                setManualAddData({
                  ...manualAddData,
                  vendor: e.target.value,
                })
              }
              className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 w-full"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400">
                Latitude
              </label>
              <input
                type="number"
                step="any"
                placeholder="-7.02222"
                value={manualAddData.lat}
                onChange={(e) =>
                  setManualAddData({
                    ...manualAddData,
                    lat: e.target.value,
                  })
                }
                className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 w-full"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400">
                Longitude
              </label>
              <input
                type="number"
                step="any"
                placeholder="107.5274"
                value={manualAddData.lng}
                onChange={(e) =>
                  setManualAddData({
                    ...manualAddData,
                    lng: e.target.value,
                  })
                }
                className="bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 w-full"
              />
            </div>
          </div>
        </div>
        <div className="flex-shrink-0 p-4 border-t border-slate-700/50 bg-slate-800/50 flex justify-end gap-2">
          <button
            onClick={() => {
              setShowManualAddModal(false);
              setManualIfaceSearch("");
            }}
            className="cursor-pointer px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            Batal
          </button>
          <button
            onClick={() => {
              if (!manualAddData.lat || !manualAddData.lng) {
                addToast("Latitude dan Longitude harus diisi", "error");
                return;
              }
              handleAddNode(
                manualAddData.lat,
                manualAddData.lng,
                manualAddData.type,
                manualAddData.label || manualIfaceSearch || "Titik Manual",
                manualAddData.linked_interface || null,
                manualAddData.vendor || null,
              );
              setFlyToTarget({
                lat: parseFloat(manualAddData.lat),
                lng: parseFloat(manualAddData.lng),
              });
              setShowManualAddModal(false);
              setManualAddData({
                label: "",
                type: "client",
                lat: "",
                lng: "",
                addressSearch: "",
                linked_interface: "",
                vendor: "",
              });
              setManualIfaceSearch("");
              addToast("Titik berhasil ditambahkan!", "success");
            }}
            className="cursor-pointer px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-lg shadow-emerald-500/20"
          >
            Tambah Titik
          </button>
        </div>
      </div>
    </div>
  );
}
