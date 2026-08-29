"use client";

import { useState, useRef } from "react";
import axios from "axios";
import {
  Camera,
  Upload,
  Link as LinkIcon,
  Trash2,
  Eye,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Wifi,
  Cpu,
  Radio,
  Box,
  Image as ImageIcon,
  ExternalLink,
} from "lucide-react";
import EvidenceLightboxModal from "./EvidenceLightboxModal";

const SLOTS = [
  {
    key: "ap",
    label: "Access Point (AP)",
    subtitle: "Ruijie / Reyee AP Terpasang",
    icon: Wifi,
    color: "blue",
  },
  {
    key: "mikrotik",
    label: "Router MikroTik",
    subtitle: "Routerboard & Power Supply",
    icon: Cpu,
    color: "purple",
  },
  {
    key: "ont",
    label: "Modem ONT",
    subtitle: "Status PON/LOS & Patchcord",
    icon: Radio,
    color: "emerald",
  },
  {
    key: "panel",
    label: "Panel / Lokasi",
    subtitle: "Tampak Keseluruhan Site",
    icon: Box,
    color: "amber",
  },
];

export default function SiteEvidencePhotos({
  ruijieMac,
  sitePrefix,
  evidencePhotos = {},
  onPhotosUpdated,
  canEdit = true,
  showToast,
}) {
  const [photos, setPhotos] = useState(evidencePhotos || {});
  const [uploadingSlot, setUploadingSlot] = useState(null);
  const [activeLightbox, setActiveLightbox] = useState(null); // { photo, deviceLabel, slotKey }
  const [linkModalSlot, setLinkModalSlot] = useState(null); // slot key being edited via link
  const [linkInput, setLinkInput] = useState("");
  const [savingLink, setSavingLink] = useState(false);

  const fileInputRefs = {
    ap: useRef(null),
    mikrotik: useRef(null),
    ont: useRef(null),
    panel: useRef(null),
  };

  const handleFileUpload = async (slotKey, file) => {
    if (!file) return;

    // Validate size (< 25MB)
    if (file.size > 25 * 1024 * 1024) {
      if (showToast) showToast("Ukuran foto maksimal 25 MB", "error");
      return;
    }

    setUploadingSlot(slotKey);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("device_type", slotKey);

    try {
      const res = await axios.post(
        `/api/sites/${encodeURIComponent(ruijieMac)}/evidence`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      if (res.data?.success) {
        const updated = res.data.evidence_photos;
        setPhotos(updated);
        if (onPhotosUpdated) onPhotosUpdated(updated);
        if (showToast) showToast(`Foto ${slotKey.toUpperCase()} berhasil disimpan ke Google Drive`, "success");
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || "Gagal mengunggah foto";
      if (showToast) showToast(msg, "error");
    } finally {
      setUploadingSlot(null);
      if (fileInputRefs[slotKey]?.current) {
        fileInputRefs[slotKey].current.value = "";
      }
    }
  };

  const handleSaveDriveLink = async () => {
    if (!linkInput.trim() || !linkModalSlot) return;

    setSavingLink(true);
    try {
      const res = await axios.post(
        `/api/sites/${encodeURIComponent(ruijieMac)}/evidence`,
        {
          device_type: linkModalSlot,
          drive_url: linkInput.trim(),
        }
      );

      if (res.data?.success) {
        const updated = res.data.evidence_photos;
        setPhotos(updated);
        if (onPhotosUpdated) onPhotosUpdated(updated);
        if (showToast) showToast(`Link foto ${linkModalSlot.toUpperCase()} berhasil disimpan`, "success");
        setLinkModalSlot(null);
        setLinkInput("");
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || "Gagal menyimpan link foto";
      if (showToast) showToast(msg, "error");
    } finally {
      setSavingLink(false);
    }
  };

  const handleDeletePhoto = async (slotKey) => {
    try {
      const res = await axios.delete(
        `/api/sites/${encodeURIComponent(ruijieMac)}/evidence?device_type=${slotKey}`
      );

      if (res.data?.success) {
        const updated = res.data.evidence_photos;
        setPhotos(updated);
        if (onPhotosUpdated) onPhotosUpdated(updated);
        if (showToast) showToast(`Foto ${slotKey.toUpperCase()} berhasil dihapus`, "success");
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || "Gagal menghapus foto";
      if (showToast) showToast(msg, "error");
    }
  };

  // Sync state if props change
  if (evidencePhotos && JSON.stringify(evidencePhotos) !== JSON.stringify(photos)) {
    setPhotos(evidencePhotos);
  }

  const uploadedCount = Object.keys(photos || {}).filter((k) => photos[k]?.url || photos[k]?.drive_id).length;

  return (
    <section className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 flex flex-col gap-4">
      {/* Section Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Camera size={18} />
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
              Evidence Foto Perangkat
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700/80 text-slate-300 font-normal">
                {uploadedCount} / {SLOTS.length} Terpasang
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">
              Dokumentasi visual fisik perangkat di lokasi (AP, MikroTik, ONT, Panel)
            </p>
          </div>
        </div>
      </div>

      {/* Grid 4 Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {SLOTS.map((slot) => {
          const photo = photos?.[slot.key];
          const hasPhoto = Boolean(photo && (photo.url || photo.drive_id || photo.preview_url));
          const isUploading = uploadingSlot === slot.key;
          const IconComponent = slot.icon;

          const previewSrc =
            photo?.preview_url ||
            photo?.url ||
            photo?.thumbnail_url ||
            (photo?.drive_id ? `/api/drive/image/${photo.drive_id}` : "");

          return (
            <div
              key={slot.key}
              className={`relative rounded-xl border transition-all duration-200 flex flex-col overflow-hidden bg-slate-900/60 ${
                hasPhoto
                  ? "border-slate-700/80 hover:border-slate-600 shadow-md"
                  : "border-dashed border-slate-700/70 hover:border-slate-600"
              }`}
            >
              {/* Card Top Banner / Icon */}
              <div className="p-3 bg-slate-800/40 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`p-1.5 rounded-md ${
                      slot.color === "blue"
                        ? "bg-blue-500/20 text-blue-400"
                        : slot.color === "purple"
                        ? "bg-purple-500/20 text-purple-400"
                        : slot.color === "emerald"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-amber-500/20 text-amber-400"
                    }`}
                  >
                    <IconComponent size={14} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-semibold text-slate-200 truncate">
                      {slot.label}
                    </h3>
                    <p className="text-[10px] text-slate-400 truncate">
                      {slot.subtitle}
                    </p>
                  </div>
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

              {/* Card Image Area */}
              <div className="relative h-44 w-full bg-slate-950/70 flex items-center justify-center overflow-hidden group">
                {isUploading ? (
                  <div className="flex flex-col items-center gap-2 text-blue-400">
                    <RefreshCw size={24} className="animate-spin" />
                    <span className="text-xs font-medium">Mengunggah ke Drive...</span>
                  </div>
                ) : hasPhoto ? (
                  <>
                    <img
                      src={previewSrc}
                      alt={slot.label}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => {
                        if (photo?.drive_id && !e.target.src.includes('/api/drive/image')) {
                          e.target.src = `/api/drive/image/${photo.drive_id}`;
                        }
                      }}
                    />
                    {/* Hover Overlay with Preview Trigger */}
                    <div
                      onClick={() =>
                        setActiveLightbox({
                          photo,
                          deviceLabel: slot.label,
                          slotKey: slot.key,
                        })
                      }
                      className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 cursor-pointer"
                    >
                      <div className="p-2.5 rounded-full bg-blue-600/90 text-white shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform">
                        <Eye size={18} />
                      </div>
                      <span className="text-xs font-bold text-white tracking-wide">
                        Klik untuk Preview HD
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center p-4 text-center">
                    <div className="p-3 rounded-full bg-slate-800/80 text-slate-500 mb-2">
                      <ImageIcon size={24} />
                    </div>
                    <p className="text-xs text-slate-400 font-medium">Belum ada foto</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Upload foto perangkat di lokasi
                    </p>
                  </div>
                )}
              </div>

              {/* Card Footer Actions */}
              <div className="p-2.5 bg-slate-900/90 border-t border-slate-800/80 flex items-center justify-between gap-1.5">
                <input
                  type="file"
                  ref={fileInputRefs[slot.key]}
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(slot.key, file);
                  }}
                />

                {canEdit ? (
                  <>
                    <button
                      type="button"
                      disabled={isUploading}
                      onClick={() => fileInputRefs[slot.key]?.current?.click()}
                      className="flex-1 cursor-pointer flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-medium transition disabled:opacity-50"
                      title="Upload Foto dari Kamera / File"
                    >
                      <Upload size={12} />
                      {hasPhoto ? "Ganti Foto" : "Upload Foto"}
                    </button>

                    <button
                      type="button"
                      disabled={isUploading}
                      onClick={() => {
                        setLinkModalSlot(slot.key);
                        setLinkInput(photo?.raw_input || (photo?.drive_id ? `https://drive.google.com/file/d/${photo.drive_id}/view` : ""));
                      }}
                      className="cursor-pointer p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                      title="Input Link Google Drive"
                    >
                      <LinkIcon size={13} />
                    </button>

                    {hasPhoto && (
                      <button
                        type="button"
                        disabled={isUploading}
                        onClick={() => {
                          if (window.confirm(`Hapus foto ${slot.label}?`)) {
                            handleDeletePhoto(slot.key);
                          }
                        }}
                        className="cursor-pointer p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition"
                        title="Hapus Foto"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </>
                ) : hasPhoto ? (
                  <button
                    type="button"
                    onClick={() =>
                      setActiveLightbox({
                        photo,
                        deviceLabel: slot.label,
                        slotKey: slot.key,
                      })
                    }
                    className="cursor-pointer w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition"
                  >
                    <Eye size={13} /> Lihat Foto
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-500 py-1 text-center w-full">
                    Read-only
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Lightbox Modal */}
      {activeLightbox && (
        <EvidenceLightboxModal
          isOpen={Boolean(activeLightbox)}
          onClose={() => setActiveLightbox(null)}
          photo={activeLightbox.photo}
          deviceLabel={activeLightbox.deviceLabel}
          sitePrefix={sitePrefix}
          canEdit={canEdit}
          onDelete={() => handleDeletePhoto(activeLightbox.slotKey)}
        />
      )}

      {/* Google Drive Link Modal */}
      {linkModalSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-700 shadow-2xl rounded-xl w-full max-w-md overflow-hidden animate-modal">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="font-bold text-slate-100 flex items-center gap-2 text-sm">
                <LinkIcon size={16} className="text-blue-400" />
                Input Link Google Drive ({linkModalSlot.toUpperCase()})
              </h3>
              <button
                type="button"
                onClick={() => setLinkModalSlot(null)}
                className="cursor-pointer text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="p-5 flex flex-col gap-3">
              <p className="text-xs text-slate-300 leading-relaxed">
                Paste link share file Google Drive (contoh: <code>https://drive.google.com/file/d/1abc.../view</code>). Sistem otomatis mengekstrak gambar untuk ditampilkan sebagai preview.
              </p>
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                  Link / URL Google Drive
                </label>
                <input
                  type="text"
                  placeholder="https://drive.google.com/file/d/..."
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-xs text-slate-100 outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-700 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setLinkModalSlot(null)}
                className="cursor-pointer px-4 py-2 text-xs text-slate-300 hover:text-white"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={savingLink || !linkInput.trim()}
                onClick={handleSaveDriveLink}
                className="cursor-pointer px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium flex items-center gap-2 disabled:opacity-50"
              >
                {savingLink ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Simpan Link
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
