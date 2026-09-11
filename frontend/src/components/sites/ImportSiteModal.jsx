"use client";
import { useState, useMemo } from "react";
import {
  FileSpreadsheet,
  Lightbulb,
  X,
  CheckCircle2,
  MapPin,
  Building2,
  Check,
} from "lucide-react";

function normalizeKey(str) {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Format date value into YYYY-MM-DD
 */
function parseDateValue(val) {
  if (!val) return "";
  if (typeof val === "number") {
    const date = new Date((val - (25567 + 2)) * 86400 * 1000);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split("T")[0];
    }
  }
  const s = String(val).trim();
  if (!s) return "";

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, "0");
    const month = dmyMatch[2].padStart(2, "0");
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // YYYY/MM/DD or YYYY-MM-DD
  const ymdMatch = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, "0");
    const day = ymdMatch[3].padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split("T")[0];
  }

  return s;
}

/**
 * Parse PIC names & phones into array of { name, phone }
 */
function parsePics(nameRaw, phoneRaw) {
  if (!nameRaw && !phoneRaw) return [];

  const names = String(nameRaw || "")
    .split(/[\|\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const phones = String(phoneRaw || "")
    .split(/[\|\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const maxLen = Math.max(names.length, phones.length);
  const result = [];

  for (let i = 0; i < maxLen; i++) {
    const n = names[i] || names[0] || "PIC";
    const p = phones[i] || phones[0] || "";
    if (n || p) {
      result.push({ name: n, phone: p });
    }
  }

  return result;
}

/**
 * Combine Vendor & Provider if Provider exists (e.g. BABBAGE + ICONNET -> BABBAGE (ICONNET))
 */
function formatVendor(vendorRaw, providerRaw) {
  const v = String(vendorRaw || "").trim();
  const p = String(providerRaw || "").trim();

  if (!v && !p) return "";
  if (!v) return p;
  if (!p) return v;

  if (v.toLowerCase().includes(p.toLowerCase()) || v.includes("(")) {
    return v;
  }

  return `${v} (${p})`;
}

/**
 * Smart single-site row parser from copied TSV/CSV text
 */
function parseSingleSiteText(text) {
  if (!text || !text.trim()) return null;

  const lines = text
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return null;

  let targetLine = lines[0];
  let delimiter = "\t";
  if (targetLine.includes("\t")) delimiter = "\t";
  else if (targetLine.includes(",")) delimiter = ",";
  else if (targetLine.includes(";")) delimiter = ";";

  const firstCols = targetLine.split(delimiter).map((c) => c.trim());
  const isHeader =
    normalizeKey(firstCols[0]).includes("vendor") ||
    normalizeKey(firstCols[0]).includes("no") ||
    normalizeKey(firstCols[0]).includes("kecamatan") ||
    normalizeKey(firstCols[1]).includes("provider") ||
    normalizeKey(firstCols[1]).includes("kecamatan");

  if (isHeader && lines.length > 1) {
    targetLine = lines[1];
  }

  const cols = targetLine.split(delimiter).map((c) => c.trim());
  if (cols.length === 0) return null;

  let vendorRaw = "";
  let providerRaw = "";
  let customerId = "";
  let activationRaw = "";
  let picPhoneRaw = "";
  let picNameRaw = "";
  let address = "";

  let offset = 0;
  if (/^\d+$/.test(cols[0])) {
    offset = 3;
  } else if (
    cols.length >= 7 &&
    (normalizeKey(cols[0]).includes("arjasari") ||
      normalizeKey(cols[0]).includes("baleendah") ||
      normalizeKey(cols[0]).includes("banjaran") ||
      normalizeKey(cols[1]).includes("arjasari") ||
      normalizeKey(cols[1]).includes("baleendah"))
  ) {
    offset = 2;
  }

  if (cols.length >= 6 + offset) {
    vendorRaw = cols[offset] || "";
    providerRaw = cols[offset + 1] || "";
    customerId = cols[offset + 2] || "";
    activationRaw = cols[offset + 3] || "";
    picPhoneRaw = cols[offset + 4] || "";
    picNameRaw = cols[offset + 5] || "";
    address = cols.slice(offset + 6).join(" ") || "";
  } else {
    vendorRaw = cols[offset] || cols[0] || "";
    customerId = cols[offset + 1] || cols[1] || "";
    activationRaw = cols[offset + 2] || cols[2] || "";
    picPhoneRaw = cols[offset + 3] || cols[3] || "";
    picNameRaw = cols[offset + 4] || cols[4] || "";
    address = cols.slice(offset + 5).join(" ") || cols.slice(5).join(" ") || "";
  }

  const vendorFormatted = formatVendor(vendorRaw, providerRaw);
  const activationDate = parseDateValue(activationRaw);
  const pics = parsePics(picNameRaw, picPhoneRaw);

  return {
    vendor: vendorFormatted,
    customer_id: String(customerId).trim(),
    activation_date: activationDate,
    pics,
    full_address: String(address).trim(),
  };
}

export default function ImportSiteModal({
  isOpen,
  onClose,
  sitePrefix = "",
  siteType = "Desa",
  onApply,
}) {
  const [pastedText, setPastedText] = useState("");

  const parsed = useMemo(() => {
    return parseSingleSiteText(pastedText);
  }, [pastedText]);

  if (!isOpen) return null;

  const handleApply = () => {
    if (!parsed) return;
    if (onApply) {
      onApply(parsed);
    }
    setPastedText("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden text-slate-200">
        {/* Modal Header */}
        <div className="px-5 py-3.5 flex items-center justify-between border-b border-slate-700/50 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <FileSpreadsheet size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">
                Impor Data Site dari Sheet / Excel
              </h2>
              <p className="text-[11px] text-slate-400">
                Salin baris data dari spreadsheet untuk site ini
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[80dvh] overflow-y-auto">
          {/* Target Site Bar */}
          <div className="flex items-center justify-between bg-slate-800/50 border border-slate-700/50 p-3 rounded-lg">
            <div className="flex items-center gap-2">
              <MapPin size={15} className="text-orange-400" />
              <span className="text-xs text-slate-400">Site Tujuan:</span>
              <strong className="text-xs font-bold text-slate-100">
                {sitePrefix || "Site Saat Ini"}
              </strong>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded font-bold border tag-desa">
              {siteType}
            </span>
          </div>

          {/* Steps Box */}
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3.5 space-y-2">
            <h3 className="text-xs font-bold text-slate-200">
              Langkah-langkah:
            </h3>
            <ol className="text-xs text-slate-300 space-y-1 pl-1 leading-relaxed">
              <li>1. Buka lembar Google Sheets / Excel Anda.</li>
              <li>
                2. Salin (Ctrl+C) baris data untuk site ini dengan urutan kolom:{" "}
                <strong className="text-slate-100 font-semibold">
                  VENDOR, Provider, ID Pelanggan, AKTIVASI, Nomor Telepon PIC, NAMA PIC, Alamat
                </strong>
                .
              </li>
              <li>3. Tempelkan (Ctrl+V) ke kolom teks di bawah ini.</li>
            </ol>

            {/* Info Callout */}
            <div className="flex items-start gap-2 text-amber-300/90 text-[11px] bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-lg font-medium mt-2">
              <Lightbulb size={15} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <p>
                INFO: Data akan langsung mengisi form Vendor, ID Pelanggan, Aktivasi, PIC & Alamat untuk site ini.
              </p>
            </div>
          </div>

          {/* Textarea Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Tempel Data di Sini (Format Kolom Tab / TSV)
            </label>
            <textarea
              rows={4}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder={`Contoh:\nINDIBIZ\t\t131150146203\t09/11/2025\t082315700049\tRendi\tWJXP+9MG, Banjaran...\n\natau:\nBABBAGE\tICONNET\t2060091033892809\t23/02/2026\t0818931805\tDiki\tWJQH+JW6, Baros...`}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs font-mono text-slate-200 placeholder-slate-600 outline-none focus:border-blue-500 transition resize-none leading-relaxed"
            />
          </div>

          {/* Parsed Live Preview Card */}
          {parsed && (
            <div className="bg-slate-800/50 border border-blue-500/30 rounded-lg p-3.5 space-y-2.5 animate-in fade-in duration-150">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-100 border-b border-slate-700/50 pb-2">
                <CheckCircle2 size={15} className="text-emerald-400" />
                Hasil Parsing Data:
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">
                    Vendor
                  </span>
                  <span className="text-slate-100 font-semibold">
                    {parsed.vendor || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">
                    ID Pelanggan
                  </span>
                  <span className="text-slate-100 font-mono">
                    {parsed.customer_id || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">
                    Aktivasi
                  </span>
                  <span className="text-slate-100 font-mono">
                    {parsed.activation_date || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">
                    PIC ({parsed.pics.length})
                  </span>
                  <div className="text-slate-100">
                    {parsed.pics.length > 0
                      ? parsed.pics.map((p) => `${p.name} (${p.phone})`).join(", ")
                      : "—"}
                  </div>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">
                    Alamat Lengkap
                  </span>
                  <span className="text-slate-300 truncate block" title={parsed.full_address}>
                    {parsed.full_address || "—"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-slate-900 border-t border-slate-700/50 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!parsed}
            className="px-5 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 border border-blue-500 disabled:opacity-50 text-white shadow-lg shadow-blue-500/20 transition cursor-pointer flex items-center gap-1.5"
          >
            <Check size={15} />
            Mulai Impor & Terapkan
          </button>
        </div>
      </div>
    </div>
  );
}
