"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import {
  ClipboardList,
  Calendar,
  Download,
  RefreshCw,
  Copy,
  Check,
  Info,
  Pencil,
  Trash2,
  Plus,
  Shield,
} from "lucide-react";
import { useAppState } from "@/App";
import { hasAccess, getStoredUser } from "@/lib/roles";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { FileText } from "lucide-react";
export default function DailyReportPage() {
  const [reports, setReports] = useState([]);
  const [standardIssues, setStandardIssues] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [date, setDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );
  const [dateMode, setDateMode] = useState("today"); // today, 7d, 30d, custom
  const [startDate, setStartDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );
  const [endDate, setEndDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );
  const [type, setType] = useState("L2TP");
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [editingDate, setEditingDate] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [importType, setImportType] = useState("L2TP");
  const [importing, setImporting] = useState(false);
  const [newReportForm, setNewReportForm] = useState({
    kecamatan: "",
    desa: "",
    dinas: "",
    lokasi: "",
    status_progress: "Progress",
    offline_since: "",
    online_since: "",
    issue: "",
    tindakan: "",
  });
  const { showToast, socket, sessionUser } = useAppState();
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    setCurrentUser(getStoredUser());
    const onRole = (e) => setCurrentUser(e.detail);
    window.addEventListener("nocr-role-updated", onRole);
    return () => window.removeEventListener("nocr-role-updated", onRole);
  }, []);

  useEffect(() => {
    axios
      .get("/api/settings/server")
      .then((res) => {
        if (res.data && Array.isArray(res.data.standard_issues)) {
          setStandardIssues(res.data.standard_issues);
        }
      })
      .catch((err) => {
        console.error("Gagal memuat issue standar dari server:", err);
      });
  }, []);

  useEffect(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    if (dateMode === "today") {
      setStartDate(todayStr);
      setEndDate(todayStr);
      setDate(todayStr);
    } else if (dateMode === "7d") {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      setStartDate(d.toISOString().split("T")[0]);
      setEndDate(todayStr);
      setDate(todayStr);
    } else if (dateMode === "30d") {
      const d = new Date();
      d.setDate(d.getDate() - 29);
      setStartDate(d.toISOString().split("T")[0]);
      setEndDate(todayStr);
      setDate(todayStr);
    }
  }, [dateMode]);

  const canRead = hasAccess(currentUser, "laporan-harian", "read");
  const canCreate = hasAccess(currentUser, "laporan-harian", "create");
  const canUpdate = hasAccess(currentUser, "laporan-harian", "update");
  const canDelete = hasAccess(currentUser, "laporan-harian", "delete");

  const fetchReports = async (
    sDate,
    eDate,
    selectedType,
    isPolling = false,
  ) => {
    if (!isPolling) setLoading(true);
    setError(null);
    try {
      const res = await axios.get(
        `/api/reports?startDate=${sDate}&endDate=${eDate}&type=${selectedType}`,
      );
      setReports(res.data || []);
    } catch (err) {
      setError(
        err.response?.data?.error || err.message || "Gagal memuat laporan",
      );
    } finally {
      if (!isPolling) setLoading(false);
    }
  };

  useEffect(() => {
    if (!canRead) return;

    fetchReports(startDate, endDate, type);

    // Segarkan otomatis setiap 15 detik (realtime fallback)
    const interval = setInterval(() => {
      fetchReports(startDate, endDate, type, true);
    }, 15000);

    return () => clearInterval(interval);
  }, [startDate, endDate, type, canRead]);

  useEffect(() => {
    if (!socket) return;

    const handleDbChange = (payload) => {
      if (payload.table === "daily_reports") {
        fetchReports(startDate, endDate, type, true);
      }
    };

    socket.on("db_change", handleDbChange);
    return () => socket.off("db_change", handleDbChange);
  }, [socket, startDate, endDate, type]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortConfig, startDate, endDate, type]);

  const updateReport = async (id, field, value) => {
    // Pembaruan optimis (Optimistic update)
    setReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    );

    setSavingId(id);
    try {
      const report = reports.find((r) => r.id === id);
      const payload = { id, ...report, [field]: value };
      await axios.put("/api/reports", payload);
    } catch (err) {
      showToast("Gagal menyimpan perubahan", "error");
      // Kembalikan jika gagal (versi sederhana: ambil ulang)
      fetchReports(startDate, endDate, type);
    } finally {
      setSavingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await axios.delete(`/api/reports?id=${deleteConfirmId}`);
      setReports((prev) => prev.filter((r) => r.id !== deleteConfirmId));
      showToast("Laporan berhasil dihapus", "success");
    } catch (err) {
      showToast("Gagal menghapus laporan", "error");
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleAddReport = async () => {
    const part1 =
      type === "PPPOE"
        ? newReportForm.dinas.trim()
        : newReportForm.kecamatan.trim();
    const part2 =
      type === "PPPOE"
        ? newReportForm.lokasi.trim()
        : newReportForm.desa.trim();

    if (!part1 || !part2) {
      showToast(
        type === "PPPOE"
          ? "Nama Dinas dan Lokasi harus diisi"
          : "Nama Kecamatan dan Desa harus diisi",
        "error",
      );
      return;
    }

    const prefix_name = `${part1}-${part2}`.toUpperCase();

    try {
      const payload = {
        date: new Date().toISOString().split("T")[0],
        type,
        prefix_name,
        status_progress: newReportForm.status_progress,
        offline_since: newReportForm.offline_since
          ? new Date(newReportForm.offline_since).toISOString()
          : null,
        online_since: newReportForm.online_since
          ? new Date(newReportForm.online_since).toISOString()
          : null,
        issue: newReportForm.issue,
        tindakan: newReportForm.tindakan,
      };
      await axios.post("/api/reports", payload);
      showToast("Laporan berhasil ditambahkan", "success");
      setShowAddModal(false);
      setNewReportForm({
        kecamatan: "",
        desa: "",
        dinas: "",
        lokasi: "",
        status_progress: "Progress",
        offline_since: "",
        online_since: "",
        issue: "",
        tindakan: "",
      });
      fetchReports(startDate, endDate, type);
    } catch (err) {
      showToast("Gagal menambahkan laporan", "error");
    }
  };

  const handleDateUpdate = (id, field, value) => {
    setEditingDate(null);
    if (!value) return;
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      updateReport(id, field, d.toISOString());
    }
  };

  const toLocalDateTimeString = (isoString) => {
    if (!isoString) return "";
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 19);
  };

  const formatTimeWIB = (isoString) => {
    if (!isoString) return "-";
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "-";
    try {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      });
      const parts = formatter.formatToParts(d);
      const partObj = {};
      parts.forEach((p) => {
        partObj[p.type] = p.value;
      });
      return `${partObj.year}-${partObj.month}-${partObj.day} ${partObj.hour}:${partObj.minute}:${partObj.second}`;
    } catch (e) {
      return "-";
    }
  };

  const formatFriendlyDate = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Jakarta",
    }).format(d);
  };

  const handleImport = async () => {
    if (!importText.trim()) {
      showToast(
        "Silakan tempel data dari Google Sheets terlebih dahulu",
        "error",
      );
      return;
    }
    setImporting(true);
    try {
      const lines = importText.split("\n");
      const reportsList = [];

      for (const line of lines) {
        if (!line.trim()) continue;
        const columns = line.split("\t").map((col) => col.trim());

        // Skip header row if it matches known column names exactly
        const col0 = columns[0].toLowerCase().trim();
        if (
          col0 === "nama dinas" ||
          col0 === "nama kecamatan" ||
          col0 === "no" ||
          col0 === "no." ||
          col0 === "tanggal"
        ) {
          continue;
        }

        // We need at least Nama Dinas/Kecamatan & Jam Offline
        if (columns.length < 3) continue;

        const nameCol = columns[0] || "";
        const locCol = columns[1] || "";
        const offlineCol = columns[2] || "";
        const onlineCol = columns[3] || "";
        const statusCol = columns[4] || "";
        const issueCol = columns[5] || "";
        const tindakanCol = columns[6] || "";

        // Parse date from offline_since or fallback to today
        let offlineDate = null;
        let onlineDate = null;
        let reportDate = date; // Default to currently selected date on calendar

        if (offlineCol && offlineCol !== "-") {
          const parsedOffline = new Date(offlineCol);
          if (!isNaN(parsedOffline.getTime())) {
            offlineDate = parsedOffline.toISOString();
          }
        }

        if (onlineCol && onlineCol !== "-") {
          const parsedOnline = new Date(onlineCol);
          if (!isNaN(parsedOnline.getTime())) {
            onlineDate = parsedOnline.toISOString();
          }
        }

        let status = "Progress";
        if (
          statusCol.toLowerCase().includes("done") ||
          statusCol.toLowerCase().includes("selesai")
        ) {
          status = "Done";
        } else if (onlineDate) {
          status = "Done";
        }

        reportsList.push({
          date: reportDate,
          type: importType,
          prefix_name: `${nameCol}-${locCol}`.toUpperCase(),
          location: locCol.toUpperCase(),
          offline_since: offlineDate,
          online_since: onlineDate,
          status_progress: status,
          issue: issueCol,
          tindakan: tindakanCol,
        });
      }

      if (reportsList.length === 0) {
        showToast("Tidak ada data valid yang berhasil dibaca", "error");
        setImporting(false);
        return;
      }

      const res = await axios.post("/api/reports", reportsList);
      if (res.data.count === 0) {
        showToast(
          res.data.message || "Semua data sudah ada di database",
          "info",
        );
      } else {
        showToast(
          `Berhasil mengimpor ${res.data.count} data laporan baru`,
          "success",
        );
      }
      setShowImportModal(false);
      setImportText("");
      fetchReports(startDate, endDate, type);
    } catch (err) {
      showToast(
        err.response?.data?.error || err.message || "Gagal mengimpor data",
        "error",
      );
    } finally {
      setImporting(false);
    }
  };

  const handleCopyTable = () => {
    // Buat format TSV (Tab Separated Values) agar mudah disalin ke Excel/Google Sheets
    const header = [
      "No",
      type === "PPPOE" ? "Nama Dinas" : "Nama Kecamatan",
      type === "PPPOE" ? "Lokasi" : "Nama Desa",
      "Jam Offline",
      "Jam Online",
      "Status",
      "Issue",
      "Tindakan",
      "Cek Data Terduplikat",
    ];
    const rows = filteredReports.map((r, i) => {
      const col1 = r.prefix_name ? r.prefix_name.split("-")[0] : "";
      const col2 =
        r.prefix_name && r.prefix_name.includes("-")
          ? r.prefix_name.split("-").slice(1).join("-")
          : r.prefix_name || "";

      return [
        i + 1,
        col1,
        col2,
        formatTimeWIB(r.offline_since),
        formatTimeWIB(r.online_since),
        r.status_progress || "",
        r.issue ? r.issue.replace(/\n/g, " ") : "", // hindari multiline agar tidak merusak format saat disalin
        r.tindakan ? r.tindakan.replace(/\n/g, " ") : "",
        "", // Cek Data Terduplikat
      ].join("\t");
    });

    const tsv = [header.join("\t"), ...rows].join("\n");

    navigator.clipboard
      .writeText(tsv)
      .then(() => {
        setCopied(true);
        showToast(
          "Data berhasil disalin, silakan paste ke Google Sheet",
          "success",
        );
        setTimeout(() => setCopied(false), 2000);
      })
      .catch((err) => {
        console.error("Failed to copy", err);
        showToast("Gagal menyalin data", "error");
      });
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF("p");

    doc.setFontSize(16);
    doc.text(`Laporan Harian ${type === "PPPOE" ? "OPD" : "Desa"}`, 14, 15);
    doc.setFontSize(11);
    doc.text(
      `Tanggal: ${startDate === endDate ? formatFriendlyDate(startDate) : `${formatFriendlyDate(startDate)} - ${formatFriendlyDate(endDate)}`}`,
      14,
      22,
    );

    const tableColumn = [
      "No",
      type === "PPPOE" ? "Nama Dinas" : "Nama Kecamatan",
      type === "PPPOE" ? "Lokasi" : "Nama Desa",
      "Jam Offline",
      "Jam Online",
      "Status",
      "Issue",
      "Tindakan",
    ];

    const tableRows = filteredReports.map((r, i) => {
      const col1 = r.prefix_name ? r.prefix_name.split("-")[0] : "";
      const col2 =
        r.prefix_name && r.prefix_name.includes("-")
          ? r.prefix_name.split("-").slice(1).join("-")
          : r.prefix_name || "";

      return [
        i + 1,
        col1,
        col2,
        formatTimeWIB(r.offline_since),
        formatTimeWIB(r.online_since),
        r.status_progress || "",
        r.issue || "",
        r.tindakan || "",
      ];
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 28,
      theme: "grid",
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] },
    });

    doc.save(
      `Laporan_${type === "PPPOE" ? "OPD" : "Desa"}_${startDate === endDate ? startDate : `${startDate}_to_${endDate}`}.pdf`,
    );
  };

  const formatLocalDate = (dateString) => {
    const options = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    return new Date(dateString).toLocaleDateString("id-ID", options);
  };

  // Saring perangkat yang online dan tidak pernah offline baru-baru ini?
  // Berdasarkan: "Total Offline", "Total Online Kembali"
  // Jika kita mengambil SEMUA PPPoE, kita mungkin hanya ingin menampilkan yang bermasalah atau sempat offline.
  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const processedReports = reports
    .filter((r) => {
      if (!searchQuery) return true;
      const lowerQuery = searchQuery.toLowerCase();
      const col1 = r.prefix_name
        ? r.prefix_name.split("-")[0].toLowerCase()
        : "";
      const col2 =
        r.prefix_name && r.prefix_name.includes("-")
          ? r.prefix_name.split("-").slice(1).join("-").toLowerCase()
          : r.prefix_name
            ? r.prefix_name.toLowerCase()
            : "";
      const issue = (r.issue || "").toLowerCase();
      const tindakan = (r.tindakan || "").toLowerCase();
      return (
        col1.includes(lowerQuery) ||
        col2.includes(lowerQuery) ||
        issue.includes(lowerQuery) ||
        tindakan.includes(lowerQuery)
      );
    })
    .sort((a, b) => {
      if (!sortConfig.key) return 0;
      let valA, valB;

      if (sortConfig.key === "col1") {
        valA = a.prefix_name ? a.prefix_name.split("-")[0] : "";
        valB = b.prefix_name ? b.prefix_name.split("-")[0] : "";
      } else if (sortConfig.key === "col2") {
        valA =
          a.prefix_name && a.prefix_name.includes("-")
            ? a.prefix_name.split("-").slice(1).join("-")
            : a.prefix_name || "";
        valB =
          b.prefix_name && b.prefix_name.includes("-")
            ? b.prefix_name.split("-").slice(1).join("-")
            : b.prefix_name || "";
      } else if (
        sortConfig.key === "offline_since" ||
        sortConfig.key === "online_since"
      ) {
        valA = a[sortConfig.key] ? new Date(a[sortConfig.key]).getTime() : 0;
        valB = b[sortConfig.key] ? new Date(b[sortConfig.key]).getTime() : 0;
      } else {
        valA = a[sortConfig.key] || "";
        valB = b[sortConfig.key] || "";
      }

      if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
      if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

  const filteredReports = processedReports;
  const totalPages = Math.ceil(filteredReports.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedReports = filteredReports.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  const totalOffline = reports.filter(
    (r) =>
      r.status_progress === "Progress" || (!r.online_since && r.offline_since),
  ).length;
  const totalOnlineKembali = reports.filter(
    (r) => r.status_progress === "Done" || (r.online_since && r.offline_since),
  ).length;

  if (currentUser && !canRead) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 py-20">
        <Shield size={64} className="mb-4 text-red-500 opacity-80" />
        <h2 className="text-xl font-bold text-slate-300">Akses Ditolak</h2>
        <p className="mt-2 text-slate-400">
          Anda tidak memiliki izin untuk melihat modul ini.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col gap-4 overflow-hidden">
      <style>{`
        .custom-date-picker::-webkit-calendar-picker-indicator {
          filter: invert(0.85);
          cursor: pointer;
          transform: scale(1.2);
          padding: 1px;
        }
      `}</style>
      <div className="flex-shrink-0 flex flex-col gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-3">
            <ClipboardList size={24} className="text-blue-400" />
            Laporan Harian {type === "PPPOE" ? "OPD" : "Desa"}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Kelola dan pantau laporan harian perangkat{" "}
            {type === "PPPOE" ? "OPD" : "Desa"}
          </p>
        </div>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 lg:gap-3">
            <div className="flex items-center bg-slate-800/80 p-1 rounded-lg border border-slate-700">
              <button
                onClick={() => setType("PPPOE")}
                className={`cursor-pointer px-4 py-1.5 rounded-md text-xs font-medium transition ${type === "PPPOE" ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"}`}
              >
                OPD
              </button>
              <button
                onClick={() => setType("L2TP")}
                className={`cursor-pointer px-4 py-1.5 rounded-md text-xs font-medium transition ${type === "L2TP" ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"}`}
              >
                Desa
              </button>
            </div>

            {/* Quick Date Range Selector */}
            <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg">
              <Calendar size={16} className="text-slate-400" />
              <select
                value={dateMode}
                onChange={(e) => setDateMode(e.target.value)}
                className="bg-transparent text-slate-200 text-xs outline-none cursor-pointer font-medium"
              >
                <option value="today" className="bg-slate-800 text-slate-200">
                  Hari Ini
                </option>
                <option value="7d" className="bg-slate-800 text-slate-200">
                  7 Hari
                </option>
                <option value="30d" className="bg-slate-800 text-slate-200">
                  30 Hari
                </option>
                <option value="custom" className="bg-slate-800 text-slate-200">
                  Custom
                </option>
              </select>
            </div>

            {/* Date Inputs */}
            {dateMode === "custom" ? (
              <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg">
                <Calendar size={16} className="text-slate-400" />
                <input
                  type="date"
                  value={startDate}
                  max={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent text-slate-200 text-xs outline-none cursor-pointer custom-date-picker"
                />
                <span className="text-slate-500 text-xs">-</span>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  max={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent text-slate-200 text-xs outline-none cursor-pointer custom-date-picker"
                />
              </div>
            ) : null}
            {canCreate && (
              <>
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="cursor-pointer flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 border border-blue-500 text-white shadow-lg shadow-blue-500/20 transition whitespace-nowrap"
                >
                  <Plus size={16} />
                  Tambah Data
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImportType(type);
                    setShowImportModal(true);
                  }}
                  className="cursor-pointer flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-medium bg-purple-600 hover:bg-purple-700 border border-purple-500 text-white shadow-lg shadow-purple-500/20 transition whitespace-nowrap"
                >
                  <ClipboardList size={16} />
                  Impor dari Sheet
                </button>
              </>
            )}
            <button
              type="button"
              onClick={handleCopyTable}
              className="cursor-pointer flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-700 border border-emerald-500 text-white shadow-lg shadow-emerald-500/20 transition whitespace-nowrap"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              Salin ke Sheet
            </button>
            <button
              type="button"
              onClick={handleDownloadPDF}
              className="cursor-pointer flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-medium bg-red-600 hover:bg-red-700 border border-red-500 text-white shadow-lg shadow-red-500/20 transition whitespace-nowrap"
            >
              <FileText size={16} />
              Download PDF
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 px-3 py-2.5 rounded-lg w-full">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-slate-400"
          >
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            placeholder="Cari laporan berdasarkan nama kecamatan, desa, atau tindakan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-slate-200 text-xs outline-none w-full placeholder:text-slate-500"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
        {/* Header Stats like in Sheet */}
        <div className="p-4 border-b border-slate-700/30 flex flex-wrap gap-6 bg-slate-800/80">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
              Tanggal
            </span>
            <span className="text-xs text-slate-200 font-bold">
              {startDate === endDate
                ? formatFriendlyDate(startDate)
                : `${formatFriendlyDate(startDate)} - ${formatFriendlyDate(endDate)}`}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
              Total Offline
            </span>
            <span className="text-xs text-red-400 font-bold">
              {totalOffline}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
              Total Online Kembali
            </span>
            <span className="text-xs text-emerald-400 font-bold">
              {totalOnlineKembali}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
              Total
            </span>
            <span className="text-xs text-slate-400 font-bold">
              {totalOnlineKembali + totalOffline}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 hidden sm:inline">
                Tampilkan:
              </span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-slate-700/50 border border-slate-600 text-slate-200 text-xs rounded-md px-2 py-1.5 outline-none cursor-pointer hover:bg-slate-700 transition"
              >
                <option value={10}>10</option>
                <option value={30}>30</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={1000000}>Semua</option>
              </select>
            </div>
            {totalPages > 1 && (
              <>
                <span className="text-xs text-slate-400 hidden sm:inline border-l border-slate-700 pl-4">
                  Halaman {currentPage} dari {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-2.5 py-1.5 bg-slate-700/50 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-slate-200 transition text-xs cursor-pointer border border-slate-600"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="px-2.5 py-1.5 bg-slate-700/50 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-slate-200 transition text-xs cursor-pointer border border-slate-600"
                  >
                    Next
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          {loading ? (
            <div className="p-6 space-y-2">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="h-12 bg-slate-700/30 rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-red-400">
              <p className="text-xs">{error}</p>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <ClipboardList size={32} className="mb-2 opacity-50" />
              <p>Tidak ada data laporan untuk tanggal ini.</p>
            </div>
          ) : (
            <table className="w-full text-xs min-w-[1000px]">
              <thead className="sticky top-0 z-10 bg-slate-900 border-b border-slate-700/50">
                <tr>
                  <th className="text-center px-3 py-3 text-xs font-bold text-slate-400 uppercase w-10 border-r border-slate-700/50">
                    No
                  </th>
                  <th
                    onClick={() => handleSort("col1")}
                    className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase border-r border-slate-700/50 cursor-pointer hover:bg-slate-800 transition"
                  >
                    <div className="flex items-center justify-between">
                      {type === "PPPOE" ? "Nama Dinas" : "Nama Kecamatan"}
                      {sortConfig.key === "col1" && (
                        <span>
                          {sortConfig.direction === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("col2")}
                    className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase border-r border-slate-700/50 cursor-pointer hover:bg-slate-800 transition"
                  >
                    <div className="flex items-center justify-between">
                      {type === "PPPOE" ? "Lokasi" : "Nama Desa"}
                      {sortConfig.key === "col2" && (
                        <span>
                          {sortConfig.direction === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("offline_since")}
                    className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase border-r border-slate-700/50 w-40 cursor-pointer hover:bg-slate-800 transition"
                  >
                    <div className="flex items-center justify-between">
                      Jam Offline
                      {sortConfig.key === "offline_since" && (
                        <span>
                          {sortConfig.direction === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("online_since")}
                    className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase border-r border-slate-700/50 w-40 cursor-pointer hover:bg-slate-800 transition"
                  >
                    <div className="flex items-center justify-between">
                      Jam Online
                      {sortConfig.key === "online_since" && (
                        <span>
                          {sortConfig.direction === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("status_progress")}
                    className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase border-r border-slate-700/50 w-32 cursor-pointer hover:bg-slate-800 transition"
                  >
                    <div className="flex items-center justify-between">
                      Status
                      {sortConfig.key === "status_progress" && (
                        <span>
                          {sortConfig.direction === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("issue")}
                    className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase border-r border-slate-700/50 cursor-pointer hover:bg-slate-800 transition"
                  >
                    <div className="flex items-center justify-between">
                      Issue
                      {sortConfig.key === "issue" && (
                        <span>
                          {sortConfig.direction === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("tindakan")}
                    className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase border-r border-slate-700/50 cursor-pointer hover:bg-slate-800 transition"
                  >
                    <div className="flex items-center justify-between">
                      Tindakan
                      {sortConfig.key === "tindakan" && (
                        <span>
                          {sortConfig.direction === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </div>
                  </th>
                  <th className="text-center px-3 py-3 text-xs font-bold text-slate-400 uppercase w-12">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {paginatedReports.map((r, i) => (
                  <tr
                    key={r.id}
                    className="hover:bg-slate-700/20 transition group"
                  >
                    <td className="px-3 py-3 text-center text-slate-500 border-r border-slate-700/30">
                      {startIndex + i + 1}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-200 border-r border-slate-700/30">
                      {r.prefix_name ? r.prefix_name.split("-")[0] : "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-300 border-r border-slate-700/30">
                      {r.prefix_name && r.prefix_name.includes("-")
                        ? r.prefix_name.split("-").slice(1).join("-")
                        : r.prefix_name || "-"}
                    </td>
                    <td className="px-3 py-3 text-slate-400 font-mono text-xs border-r border-slate-700/30 group/time min-w-[140px]">
                      {editingDate?.id === r.id &&
                      editingDate?.field === "offline_since" ? (
                        <input
                          type="datetime-local"
                          step="1"
                          className="w-full bg-slate-900/50 border border-slate-700/50 hover:border-slate-600 focus:border-blue-500 rounded px-1 py-1 text-xs text-slate-300 outline-none transition"
                          autoFocus
                          disabled={!canUpdate}
                          defaultValue={toLocalDateTimeString(r.offline_since)}
                          onBlur={(e) =>
                            handleDateUpdate(
                              r.id,
                              "offline_since",
                              e.target.value,
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.target.blur();
                            else if (e.key === "Escape") setEditingDate(null);
                          }}
                        />
                      ) : (
                        <div className="flex items-center justify-between">
                          <span>{formatTimeWIB(r.offline_since)}</span>
                          {canUpdate && (
                            <button
                              onClick={() =>
                                setEditingDate({
                                  id: r.id,
                                  field: "offline_since",
                                })
                              }
                              className="opacity-0 group-hover/time:opacity-100 hover:text-blue-400 transition p-1 cursor-pointer"
                            >
                              <Pencil size={12} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-slate-400 font-mono text-xs border-r border-slate-700/30 group/time min-w-[140px]">
                      {editingDate?.id === r.id &&
                      editingDate?.field === "online_since" ? (
                        <input
                          type="datetime-local"
                          step="1"
                          className="w-full bg-slate-900/50 border border-slate-700/50 hover:border-slate-600 focus:border-blue-500 rounded px-1 py-1 text-xs text-slate-300 outline-none transition"
                          autoFocus
                          disabled={!canUpdate}
                          defaultValue={toLocalDateTimeString(r.online_since)}
                          onBlur={(e) =>
                            handleDateUpdate(
                              r.id,
                              "online_since",
                              e.target.value,
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.target.blur();
                            else if (e.key === "Escape") setEditingDate(null);
                          }}
                        />
                      ) : (
                        <div className="flex items-center justify-between">
                          <span>{formatTimeWIB(r.online_since)}</span>
                          {canUpdate && (
                            <button
                              onClick={() =>
                                setEditingDate({
                                  id: r.id,
                                  field: "online_since",
                                })
                              }
                              className="opacity-0 group-hover/time:opacity-100 hover:text-blue-400 transition p-1 cursor-pointer"
                            >
                              <Pencil size={12} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 border-r border-slate-700/30">
                      <select
                        value={r.status_progress || "Progress"}
                        onChange={(e) =>
                          updateReport(r.id, "status_progress", e.target.value)
                        }
                        disabled={!canUpdate}
                        className={`w-full bg-slate-900/50 border rounded px-2 py-1.5 text-xs font-bold outline-none cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed
                          ${r.status_progress === "Done" ? "text-emerald-400 border-emerald-500/30" : "text-amber-400 border-amber-500/30"}
                        `}
                      >
                        <option value="Progress">Progress</option>
                        <option value="Done">Done</option>
                      </select>
                    </td>
                    <td className="px-2 py-2 border-r border-slate-700/30 min-w-[200px]">
                      <div className="flex flex-col gap-1.5">
                        <select
                          disabled={!canUpdate}
                          value={
                            standardIssues.includes(r.issue)
                              ? r.issue
                              : !r.issue
                                ? ""
                                : "Lain-lain"
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "Lain-lain") {
                              updateReport(r.id, "issue", "Ketik manual...");
                            } else {
                              updateReport(r.id, "issue", val);
                            }
                          }}
                          className="w-full bg-slate-900/50 border border-slate-700/50 rounded px-2 py-1 text-xs text-slate-300 outline-none cursor-pointer disabled:opacity-70"
                        >
                          <option value="">- Pilih Issue -</option>
                          {standardIssues.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                          <option value="Lain-lain">Lain-lain (Custom)</option>
                        </select>
                        {!standardIssues.includes(r.issue) && r.issue ? (
                          <input
                            type="text"
                            value={r.issue === "Ketik manual..." ? "" : r.issue}
                            onChange={(e) =>
                              updateReport(r.id, "issue", e.target.value)
                            }
                            disabled={!canUpdate}
                            className="w-full bg-slate-900 border border-slate-700/50 focus:border-blue-500 rounded px-2 py-1 text-xs text-slate-300 outline-none"
                            placeholder="Tulis issue Custom..."
                          />
                        ) : null}
                      </div>
                    </td>
                    <td className="px-2 py-2 border-r border-slate-700/30">
                      <input
                        type="text"
                        value={r.tindakan || ""}
                        onChange={(e) =>
                          updateReport(r.id, "tindakan", e.target.value)
                        }
                        disabled={!canUpdate}
                        className="w-full bg-transparent border border-transparent hover:border-slate-600 focus:border-blue-500 rounded px-2 py-1.5 text-xs text-slate-300 outline-none transition disabled:opacity-70 disabled:cursor-not-allowed"
                        placeholder={!canUpdate ? "-" : "Ketik tindakan..."}
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      {canDelete && (
                        <button
                          onClick={() => setDeleteConfirmId(r.id)}
                          className="text-slate-500 hover:text-red-400 transition p-1 cursor-pointer"
                          title="Hapus Laporan"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-700/50">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Trash2 size={20} className="text-red-400" />
                Konfirmasi Hapus
              </h3>
            </div>
            <div className="p-5">
              <p className="text-xs text-slate-300">
                Apakah Anda yakin ingin menghapus laporan ini? Tindakan ini
                tidak dapat dibatalkan.
              </p>
            </div>
            <div className="p-4 bg-slate-800/80 border-t border-slate-700/50 flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-slate-100 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-xs font-medium text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20 rounded-lg transition cursor-pointer"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-700/50 flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <ClipboardList size={20} className="text-purple-400" />
                Impor Laporan dari Google Sheets / Excel
              </h3>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-purple-950/20 border border-purple-900/55 rounded-lg p-3 text-xs text-purple-300 space-y-1">
                <p className="font-semibold">Langkah-langkah:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Buka lembar Google Sheets Anda.</li>
                  <li>
                    Salin (Ctrl+C) kolom berurutan:{" "}
                    <strong>
                      Nama Dinas/Kecamatan, Lokasi/Desa, Jam Offline, Jam
                      Online, Status, Issue, Tindakan
                    </strong>
                    .
                  </li>
                  <li>Tempelkan (Ctrl+V) ke kolom teks di bawah ini.</li>
                </ol>
                <div className="mt-2.5 pt-2 border-t border-purple-900/40 text-[11px] text-amber-300 flex items-center gap-1.5 font-semibold">
                  <span>⚠️</span>
                  <span>
                    PENTING: Pastikan data yang Anda salin adalah untuk tanggal:{" "}
                    <span className="underline decoration-wavy decoration-amber-500 font-extrabold text-white text-xs">
                      {startDate === endDate
                        ? formatFriendlyDate(startDate)
                        : `${formatFriendlyDate(startDate)} - ${formatFriendlyDate(endDate)}`}
                    </span>
                  </span>
                </div>
              </div>

              {/* Import Type selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Tipe Laporan Tujuan
                </label>

                <span className="inline-flex items-center rounded-full bg-purple-500/10 border border-purple-500/30 px-3 py-1 text-sm font-medium text-purple-300">
                  {importType === "L2TP" ? "Desa" : "OPD"}
                </span>
                <span className="ml-2 inline-flex items-center rounded-full bg-amber-500/10 border border-amber-500/30 px-3 py-1 text-sm font-medium text-amber-300">
                  {startDate === endDate
                    ? formatFriendlyDate(startDate)
                    : `${formatFriendlyDate(startDate)} - ${formatFriendlyDate(endDate)}`}
                </span>
              </div>

              {/* Paste Textarea */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Tempel Data di Sini (Format Kolom Tab / TSV)
                </label>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="Contoh:&#10;ARJASARI&#9;MEKARJAYA&#9;2025-06-25 08:25:09&#9;2025-06-25 12:11:13&#9;Done&#9;kabel putus&#9;perbaikan kabel"
                  rows={8}
                  className="w-full bg-slate-900 text-slate-200 border border-slate-700 rounded-lg p-2.5 text-xs outline-none focus:border-purple-500 font-mono transition resize-none"
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="p-5 bg-slate-900/40 border-t border-slate-700/50 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-slate-100 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={importing}
                onClick={handleImport}
                className="px-5 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:opacity-50 shadow-lg shadow-purple-600/20 rounded-lg transition cursor-pointer flex items-center gap-2"
              >
                {importing && <RefreshCw size={12} className="animate-spin" />}
                {importing ? "Mengimpor..." : "Mulai Impor"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-700/50">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Plus size={20} className="text-blue-400" />
                Tambah Laporan Manual
              </h3>
            </div>
            <div className="p-5 space-y-4">
              {type === "PPPOE" ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Nama Dinas
                    </label>
                    <input
                      type="text"
                      value={newReportForm.dinas}
                      onChange={(e) =>
                        setNewReportForm((p) => ({
                          ...p,
                          dinas: e.target.value.toUpperCase(),
                        }))
                      }
                      className="w-full uppercase bg-slate-900/50 border border-slate-700/50 hover:border-slate-600 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none transition"
                      placeholder="DISKOMINFO"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Lokasi
                    </label>
                    <input
                      type="text"
                      value={newReportForm.lokasi}
                      onChange={(e) =>
                        setNewReportForm((p) => ({
                          ...p,
                          lokasi: e.target.value.toUpperCase(),
                        }))
                      }
                      className="w-full uppercase bg-slate-900/50 border border-slate-700/50 hover:border-slate-600 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none transition"
                      placeholder="SERVER"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Nama Kecamatan
                    </label>
                    <input
                      type="text"
                      value={newReportForm.kecamatan}
                      onChange={(e) =>
                        setNewReportForm((p) => ({
                          ...p,
                          kecamatan: e.target.value.toUpperCase(),
                        }))
                      }
                      className="w-full uppercase bg-slate-900/50 border border-slate-700/50 hover:border-slate-600 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none transition"
                      placeholder="BALEENDAH"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Nama Desa
                    </label>
                    <input
                      type="text"
                      value={newReportForm.desa}
                      onChange={(e) =>
                        setNewReportForm((p) => ({
                          ...p,
                          desa: e.target.value.toUpperCase(),
                        }))
                      }
                      className="w-full uppercase bg-slate-900/50 border border-slate-700/50 hover:border-slate-600 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none transition"
                      placeholder="JELEKONG"
                    />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Jam Offline
                  </label>
                  <input
                    type="datetime-local"
                    step="1"
                    value={newReportForm.offline_since}
                    onChange={(e) =>
                      setNewReportForm((p) => ({
                        ...p,
                        offline_since: e.target.value,
                      }))
                    }
                    className="w-full bg-slate-900/50 border border-slate-700/50 hover:border-slate-600 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Jam Online
                  </label>
                  <input
                    type="datetime-local"
                    step="1"
                    value={newReportForm.online_since}
                    onChange={(e) =>
                      setNewReportForm((p) => ({
                        ...p,
                        online_since: e.target.value,
                      }))
                    }
                    className="w-full bg-slate-900/50 border border-slate-700/50 hover:border-slate-600 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none transition"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Status
                </label>
                <select
                  value={newReportForm.status_progress}
                  onChange={(e) =>
                    setNewReportForm((p) => ({
                      ...p,
                      status_progress: e.target.value,
                    }))
                  }
                  className="w-full bg-slate-900/50 border border-slate-700/50 hover:border-slate-600 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none transition cursor-pointer"
                >
                  <option value="Progress">Progress</option>
                  <option value="Done">Done</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Issue
                </label>
                <select
                  value={
                    standardIssues.includes(newReportForm.issue)
                      ? newReportForm.issue
                      : !newReportForm.issue
                        ? ""
                        : "Lain-lain"
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "Lain-lain") {
                      setNewReportForm((p) => ({
                        ...p,
                        issue: "Ketik manual...",
                      }));
                    } else {
                      setNewReportForm((p) => ({ ...p, issue: val }));
                    }
                  }}
                  className="w-full bg-slate-900/50 border border-slate-700/50 hover:border-slate-600 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none transition cursor-pointer mb-2"
                >
                  <option value="">- Pilih Issue -</option>
                  {standardIssues.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                  <option value="Lain-lain">Lain-lain (Custom)</option>
                </select>
                {!standardIssues.includes(newReportForm.issue) &&
                newReportForm.issue ? (
                  <input
                    type="text"
                    value={
                      newReportForm.issue === "Ketik manual..."
                        ? ""
                        : newReportForm.issue
                    }
                    onChange={(e) =>
                      setNewReportForm((p) => ({ ...p, issue: e.target.value }))
                    }
                    className="w-full bg-slate-900/50 border border-slate-700/50 hover:border-slate-600 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none transition"
                    placeholder="Ketik issue Custom..."
                  />
                ) : null}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Tindakan
                </label>
                <input
                  type="text"
                  value={newReportForm.tindakan}
                  onChange={(e) =>
                    setNewReportForm((p) => ({
                      ...p,
                      tindakan: e.target.value,
                    }))
                  }
                  className="w-full bg-slate-900/50 border border-slate-700/50 hover:border-slate-600 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none transition"
                  placeholder="Opsional..."
                />
              </div>
            </div>
            <div className="p-4 bg-slate-800/80 border-t border-slate-700/50 flex justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-slate-100 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleAddReport}
                className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20 rounded-lg transition cursor-pointer"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
