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
export default function LaporanHarianPage() {
  const [reports, setReports] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [date, setDate] = useState(
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
  const [newReportForm, setNewReportForm] = useState({
    prefix_name: "",
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

  const canRead = hasAccess(currentUser, "laporan-harian", "read");
  const canCreate = hasAccess(currentUser, "laporan-harian", "create");
  const canUpdate = hasAccess(currentUser, "laporan-harian", "update");
  const canDelete = hasAccess(currentUser, "laporan-harian", "delete");

  const fetchReports = async (
    selectedDate,
    selectedType,
    isPolling = false,
  ) => {
    if (!isPolling) setLoading(true);
    setError(null);
    try {
      const res = await axios.get(
        `/api/laporan?date=${selectedDate}&type=${selectedType}`,
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

    fetchReports(date, type);

    // Segarkan otomatis setiap 15 detik (realtime fallback)
    const interval = setInterval(() => {
      fetchReports(date, type, true);
    }, 15000);

    return () => clearInterval(interval);
  }, [date, type, canRead]);

  useEffect(() => {
    if (!socket) return;

    const handleDbChange = (payload) => {
      if (payload.table === "daily_reports") {
        fetchReports(date, type, true);
      }
    };

    socket.on("db_change", handleDbChange);
    return () => socket.off("db_change", handleDbChange);
  }, [socket, date, type]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortConfig, date, type]);

  const updateReport = async (id, field, value) => {
    // Pembaruan optimis (Optimistic update)
    setReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    );

    setSavingId(id);
    try {
      const report = reports.find((r) => r.id === id);
      const payload = { id, ...report, [field]: value };
      await axios.put("/api/laporan", payload);
    } catch (err) {
      showToast("Gagal menyimpan perubahan", "error");
      // Kembalikan jika gagal (versi sederhana: ambil ulang)
      fetchReports(date, type);
    } finally {
      setSavingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await axios.delete(`/api/laporan?id=${deleteConfirmId}`);
      setReports((prev) => prev.filter((r) => r.id !== deleteConfirmId));
      showToast("Laporan berhasil dihapus", "success");
    } catch (err) {
      showToast("Gagal menghapus laporan", "error");
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleAddReport = async () => {
    if (!newReportForm.prefix_name) {
      showToast("Nama harus diisi", "error");
      return;
    }
    try {
      const payload = {
        date,
        type,
        ...newReportForm,
        offline_since: newReportForm.offline_since
          ? new Date(newReportForm.offline_since).toISOString()
          : null,
        online_since: newReportForm.online_since
          ? new Date(newReportForm.online_since).toISOString()
          : null,
      };
      await axios.post("/api/laporan", payload);
      showToast("Laporan berhasil ditambahkan", "success");
      setShowAddModal(false);
      setNewReportForm({
        prefix_name: "",
        status_progress: "Progress",
        offline_since: "",
        online_since: "",
        issue: "",
        tindakan: "",
      });
      fetchReports(date, type);
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

  const formatTimeWIB = (isoString) => {
    if (!isoString) return "-";
    const d = new Date(isoString);
    return isNaN(d.getTime())
      ? "-"
      : d.toLocaleString("id-ID", {
          year: "numeric",
          month: "numeric",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
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
    doc.text(`Tanggal: ${formatLocalDate(date)}`, 14, 22);

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

    doc.save(`Laporan_${type === "PPPOE" ? "OPD" : "Desa"}_${date}.pdf`);
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

            <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg">
              <Calendar size={16} className="text-slate-400" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-transparent text-slate-200 text-xs outline-none cursor-pointer"
              />
            </div>
            {canCreate && (
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="cursor-pointer flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 border border-blue-500 text-white shadow-lg shadow-blue-500/20 transition whitespace-nowrap"
              >
                <Plus size={16} />
                Tambah Data
              </button>
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
              {formatLocalDate(date)}
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
                          className="w-full bg-slate-900/50 border border-slate-700/50 hover:border-slate-600 focus:border-blue-500 rounded px-1 py-1 text-xs text-slate-300 outline-none transition"
                          autoFocus
                          disabled={!canUpdate}
                          defaultValue={
                            r.offline_since
                              ? r.offline_since.substring(0, 16)
                              : ""
                          }
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
                          className="w-full bg-slate-900/50 border border-slate-700/50 hover:border-slate-600 focus:border-blue-500 rounded px-1 py-1 text-xs text-slate-300 outline-none transition"
                          autoFocus
                          disabled={!canUpdate}
                          defaultValue={
                            r.online_since
                              ? r.online_since.substring(0, 16)
                              : ""
                          }
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
                    <td className="px-2 py-2 border-r border-slate-700/30">
                      <input
                        type="text"
                        value={r.issue || ""}
                        onChange={(e) =>
                          updateReport(r.id, "issue", e.target.value)
                        }
                        disabled={!canUpdate}
                        className="w-full bg-transparent border border-transparent hover:border-slate-600 focus:border-blue-500 rounded px-2 py-1.5 text-xs text-slate-300 outline-none transition disabled:opacity-70 disabled:cursor-not-allowed"
                        placeholder={!canUpdate ? "-" : "Ketik issue..."}
                      />
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
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Nama {type === "PPPOE" ? "Dinas/Lokasi" : "Kecamatan-Desa"}
                </label>
                <input
                  type="text"
                  value={newReportForm.prefix_name}
                  onChange={(e) =>
                    setNewReportForm((p) => ({
                      ...p,
                      prefix_name: e.target.value,
                    }))
                  }
                  className="w-full bg-slate-900/50 border border-slate-700/50 hover:border-slate-600 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none transition"
                  placeholder={
                    type === "PPPOE"
                      ? "Contoh: DISKOMINFO-SERVER"
                      : "Contoh: BALEENDAH-JELEKONG"
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Jam Offline
                  </label>
                  <input
                    type="datetime-local"
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
                <input
                  type="text"
                  value={newReportForm.issue}
                  onChange={(e) =>
                    setNewReportForm((p) => ({ ...p, issue: e.target.value }))
                  }
                  className="w-full bg-slate-900/50 border border-slate-700/50 hover:border-slate-600 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none transition"
                  placeholder="Opsional..."
                />
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
