"use client";
import { useState, useEffect, useMemo } from "react";
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
  FileSpreadsheet,
  CheckCircle2,
  Lightbulb,
  X,
  Search,
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
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
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
    const fetchServerSettings = () => {
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
    };

    fetchServerSettings();

    const onSettingsUpdate = (e) => {
      if (e.detail && Array.isArray(e.detail.standard_issues)) {
        setStandardIssues(e.detail.standard_issues);
      } else {
        fetchServerSettings();
      }
      fetchReports(startDate, endDate, type, true);
    };

    window.addEventListener("server-settings-updated", onSettingsUpdate);
    return () => window.removeEventListener("server-settings-updated", onSettingsUpdate);
  }, [startDate, endDate, type]);

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

  const confirmBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      const ids = Array.from(selectedIds);
      await Promise.all(ids.map((id) => axios.delete(`/api/reports?id=${id}`)));
      setReports((prev) => prev.filter((r) => !selectedIds.has(r.id)));
      showToast(`${ids.length} laporan berhasil dihapus`, "success");
      setSelectedIds(new Set());
    } catch (err) {
      showToast("Gagal menghapus beberapa laporan", "error");
    } finally {
      setShowBatchDeleteConfirm(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedReports.length && paginatedReports.every(r => selectedIds.has(r.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedReports.map((r) => r.id)));
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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

  const monthNamesMap = {
    jan: "01", januari: "01", january: "01",
    feb: "02", februari: "02", february: "02",
    mar: "03", maret: "03", march: "03",
    apr: "04", april: "04",
    mei: "05", may: "05",
    jun: "06", juni: "06", june: "06",
    jul: "07", juli: "07", july: "07",
    agu: "08", agust: "08", agustus: "08", aug: "08", august: "08",
    sep: "09", september: "09",
    okt: "10", oktober: "10", oct: "10", october: "10",
    nov: "11", november: "11",
    des: "12", desember: "12", dec: "12", december: "12",
  };

  const parseDateToISO = (str) => {
    if (!str || typeof str !== "string") return null;
    let s = str.trim();
    if (!s || s === "-") return null;

    // Fix 5-digit year typos in string (e.g. 20226-02-11 -> 2026-02-11)
    s = s.replace(/\b20\d{3}\b/g, (match) => "20" + match.slice(-2));

    // Pattern 1: DD/MM/YYYY or DD-MM-YYYY with optional time HH:mm:ss
    const dmyMatch = s.match(
      /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4,5})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
    );
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, "0");
      const month = dmyMatch[2].padStart(2, "0");
      let year = dmyMatch[3];
      if (year.length > 4) year = "20" + year.slice(-2);
      const hour = dmyMatch[4] ? dmyMatch[4].padStart(2, "0") : "00";
      const min = dmyMatch[5] ? dmyMatch[5].padStart(2, "0") : "00";
      const sec = dmyMatch[6] ? dmyMatch[6].padStart(2, "0") : "00";
      const isoStr = `${year}-${month}-${day}T${hour}:${min}:${sec}+07:00`;
      const d = new Date(isoStr);
      return isNaN(d.getTime()) ? null : d.toISOString();
    }

    // Pattern 2: 19April2026, 19 April 2026, 19-April-2026 with optional time
    const textMonthMatch = s.match(
      /^(\d{1,2})[\s\-]?([A-Za-z]+)[\s\-]?(\d{4,5})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
    );
    if (textMonthMatch) {
      const day = textMonthMatch[1].padStart(2, "0");
      const monthKey = textMonthMatch[2].toLowerCase();
      let year = textMonthMatch[3];
      if (year.length > 4) year = "20" + year.slice(-2);
      const month = monthNamesMap[monthKey];
      if (month) {
        const hour = textMonthMatch[4]
          ? textMonthMatch[4].padStart(2, "0")
          : "00";
        const min = textMonthMatch[5]
          ? textMonthMatch[5].padStart(2, "0")
          : "00";
        const sec = textMonthMatch[6]
          ? textMonthMatch[6].padStart(2, "0")
          : "00";
        const isoStr = `${year}-${month}-${day}T${hour}:${min}:${sec}+07:00`;
        const d = new Date(isoStr);
        return isNaN(d.getTime()) ? null : d.toISOString();
      }
    }

    // Pattern 3: YYYY-MM-DD or YYYY/MM/DD with optional time
    const ymdMatch = s.match(
      /^(\d{4,5})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
    );
    if (ymdMatch) {
      let year = ymdMatch[1];
      if (year.length > 4) year = "20" + year.slice(-2);
      const month = ymdMatch[2].padStart(2, "0");
      const day = ymdMatch[3].padStart(2, "0");
      const hour = ymdMatch[4] ? ymdMatch[4].padStart(2, "0") : "00";
      const min = ymdMatch[5] ? ymdMatch[5].padStart(2, "0") : "00";
      const sec = ymdMatch[6] ? ymdMatch[6].padStart(2, "0") : "00";
      const isoStr = `${year}-${month}-${day}T${hour}:${min}:${sec}+07:00`;
      const d = new Date(isoStr);
      return isNaN(d.getTime()) ? null : d.toISOString();
    }

    // Fallback standard new Date
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      if (d.getFullYear() > 2099) {
        d.setFullYear(2026);
      }
      return d.toISOString();
    }

    return null;
  };

  const parseDateToYYYYMMDD = (str, fallbackDate) => {
    const iso = parseDateToISO(str);
    if (!iso) return fallbackDate;
    const d = new Date(iso);
    return d.toLocaleDateString("sv", { timeZone: "Asia/Jakarta" });
  };

  const parsedImportReports = useMemo(() => {
    if (!importText || !importText.trim()) return [];
    const lines = importText.split("\n");
    const reportsList = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      const columns = line.split("\t").map((col) => col.trim());

      const col0 = columns[0].toLowerCase().trim();
      if (
        col0 === "tanggal sheet" ||
        col0 === "tanggal" ||
        col0 === "nama dinas" ||
        col0 === "nama kecamatan" ||
        col0 === "no" ||
        col0 === "no."
      ) {
        continue;
      }

      let sheetDateCol = "";
      let nameCol = "";
      let locCol = "";
      let offlineCol = "";
      let onlineCol = "";
      let statusCol = "";
      let issueCol = "";
      let tindakanCol = "";

      const parsedCol0Date = parseDateToYYYYMMDD(columns[0], null);

      if (columns.length >= 8 || (columns.length >= 7 && parsedCol0Date)) {
        sheetDateCol = columns[0] || "";
        nameCol = columns[1] || "";
        locCol = columns[2] || "";
        offlineCol = columns[3] || "";
        onlineCol = columns[4] || "";
        statusCol = columns[5] || "";
        issueCol = columns[6] || "";
        tindakanCol = columns[7] || "";
      } else {
        nameCol = columns[0] || "";
        locCol = columns[1] || "";
        offlineCol = columns[2] || "";
        onlineCol = columns[3] || "";
        statusCol = columns[4] || "";
        issueCol = columns[5] || "";
        tindakanCol = columns[6] || "";
      }

      if (!nameCol) continue;

      const reportDate = sheetDateCol
        ? parseDateToYYYYMMDD(sheetDateCol, startDate)
        : startDate;

      const offlineDate = parseDateToISO(offlineCol);
      const onlineDate = parseDateToISO(onlineCol);

      let status = "Progress";
      if (
        statusCol.toLowerCase().includes("done") ||
        statusCol.toLowerCase().includes("selesai")
      ) {
        status = "Done";
      } else if (onlineDate) {
        status = "Done";
      }

      const prefix_name = locCol
        ? `${nameCol}-${locCol}`.toUpperCase()
        : nameCol.toUpperCase();

      reportsList.push({
        date: reportDate,
        type: importType,
        prefix_name,
        offlineCol,
        onlineCol,
        status_progress: status,
        issue: issueCol,
        tindakan: tindakanCol,
      });
    }

    return reportsList;
  }, [importText, importType, startDate]);

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
          col0 === "tanggal sheet" ||
          col0 === "tanggal" ||
          col0 === "nama dinas" ||
          col0 === "nama kecamatan" ||
          col0 === "no" ||
          col0 === "no."
        ) {
          continue;
        }

        let sheetDateCol = "";
        let nameCol = "";
        let locCol = "";
        let offlineCol = "";
        let onlineCol = "";
        let statusCol = "";
        let issueCol = "";
        let tindakanCol = "";

        const parsedCol0Date = parseDateToYYYYMMDD(columns[0], null);

        if (columns.length >= 8 || (columns.length >= 7 && parsedCol0Date)) {
          sheetDateCol = columns[0] || "";
          nameCol = columns[1] || "";
          locCol = columns[2] || "";
          offlineCol = columns[3] || "";
          onlineCol = columns[4] || "";
          statusCol = columns[5] || "";
          issueCol = columns[6] || "";
          tindakanCol = columns[7] || "";
        } else {
          nameCol = columns[0] || "";
          locCol = columns[1] || "";
          offlineCol = columns[2] || "";
          onlineCol = columns[3] || "";
          statusCol = columns[4] || "";
          issueCol = columns[5] || "";
          tindakanCol = columns[6] || "";
        }

        // Skip row if Nama Dinas / Kecamatan is missing
        if (!nameCol) continue;

        const reportDate = sheetDateCol
          ? parseDateToYYYYMMDD(sheetDateCol, startDate)
          : startDate;

        const offlineDate = parseDateToISO(offlineCol);
        const onlineDate = parseDateToISO(onlineCol);

        let status = "Progress";
        if (
          statusCol.toLowerCase().includes("done") ||
          statusCol.toLowerCase().includes("selesai")
        ) {
          status = "Done";
        } else if (onlineDate) {
          status = "Done";
        }

        const prefix_name = locCol
          ? `${nameCol}-${locCol}`.toUpperCase()
          : nameCol.toUpperCase();

        reportsList.push({
          date: reportDate,
          type: importType,
          prefix_name,
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

      const importedDates = reportsList
        .map((r) => r.date)
        .filter(Boolean)
        .sort();

      if (importedDates.length > 0) {
        const minImportDate = importedDates[0];
        const maxImportDate = importedDates[importedDates.length - 1];
        setStartDate(minImportDate);
        setEndDate(maxImportDate);
        fetchReports(minImportDate, maxImportDate, type);
      } else {
        fetchReports(startDate, endDate, type);
      }
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
    <div className="flex-1 flex flex-col gap-4 min-w-0 pb-4">
      <style>{`
        .custom-date-picker::-webkit-calendar-picker-indicator {
          filter: invert(0.85);
          cursor: pointer;
          transform: scale(1.1);
          padding: 1px;
        }
      `}</style>

      {/* Header & Controls */}
      <div className="flex-shrink-0 flex flex-col gap-3.5">
        {/* Title Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                <ClipboardList size={18} />
              </div>
              <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Laporan Harian
                <span className="text-[11px] px-2 py-0.5 rounded font-mono font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  {type === "PPPOE" ? "OPD" : "Desa"}
                </span>
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Rekapitulasi dan monitoring insiden jaringan perangkat {type === "PPPOE" ? "OPD" : "Desa"}
            </p>
          </div>

          {/* Action Buttons (Impor dari Sheet REMOVED) */}
          <div className="flex flex-wrap items-center gap-2">
            {canCreate && (
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="cursor-pointer flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white shadow-sm border border-sky-500/30 transition whitespace-nowrap"
              >
                <Plus size={14} />
                Tambah Data
              </button>
            )}
            <button
              type="button"
              onClick={handleCopyTable}
              className="cursor-pointer flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm border border-emerald-500/30 transition whitespace-nowrap"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              Salin ke Sheet
            </button>
            <button
              type="button"
              onClick={handleDownloadPDF}
              className="cursor-pointer flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-sm border border-rose-500/30 transition whitespace-nowrap"
            >
              <FileText size={14} />
              Download PDF
            </button>
          </div>
        </div>

        {/* Filter Bar: Segmented Switcher, Date Mode, Date Inputs, Search */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* Segmented OPD / Desa Switcher */}
            <div className="inline-flex p-1 rounded-lg bg-slate-950/80 border border-slate-800">
              <button
                type="button"
                onClick={() => setType("PPPOE")}
                className={`cursor-pointer px-3.5 py-1 rounded-md text-xs font-semibold transition ${
                  type === "PPPOE"
                    ? "bg-sky-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                OPD
              </button>
              <button
                type="button"
                onClick={() => setType("L2TP")}
                className={`cursor-pointer px-3.5 py-1 rounded-md text-xs font-semibold transition ${
                  type === "L2TP"
                    ? "bg-sky-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Desa
              </button>
            </div>

            {/* Quick Date Range Selector */}
            <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-lg">
              <Calendar size={14} className="text-slate-400" />
              <select
                value={dateMode}
                onChange={(e) => setDateMode(e.target.value)}
                className="bg-transparent text-slate-200 text-xs outline-none cursor-pointer font-medium"
              >
                <option value="today" className="bg-slate-900 text-slate-200">
                  Hari Ini
                </option>
                <option value="7d" className="bg-slate-900 text-slate-200">
                  7 Hari
                </option>
                <option value="30d" className="bg-slate-900 text-slate-200">
                  30 Hari
                </option>
                <option value="custom" className="bg-slate-900 text-slate-200">
                  Custom
                </option>
              </select>
            </div>

            {/* Date Inputs for Custom Mode */}
            {dateMode === "custom" && (
              <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-lg animate-in fade-in duration-150">
                <Calendar size={14} className="text-slate-400" />
                <input
                  type="date"
                  value={startDate}
                  max={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent text-slate-200 text-xs outline-none cursor-pointer custom-date-picker font-mono"
                />
                <span className="text-slate-600 text-xs">-</span>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  max={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent text-slate-200 text-xs outline-none cursor-pointer custom-date-picker font-mono"
                />
              </div>
            )}
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-md">
            <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-lg w-full focus-within:border-sky-500/80 transition">
              <Search size={14} className="text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Cari dinas, kecamatan, desa, issue, atau tindakan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-slate-200 text-xs outline-none w-full placeholder:text-slate-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="text-slate-400 hover:text-slate-200 p-0.5 rounded cursor-pointer"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
              Periode Laporan
            </span>
            <Calendar size={13} className="text-slate-500" />
          </div>
          <span className="text-xs font-semibold text-slate-200 mt-2 truncate font-mono">
            {startDate === endDate
              ? formatFriendlyDate(startDate)
              : `${formatFriendlyDate(startDate)} - ${formatFriendlyDate(endDate)}`}
          </span>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              Total Offline
            </span>
            <span className="text-[10px] font-mono text-slate-500">Saat ini</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-lg font-bold text-rose-400 font-mono">
              {totalOffline}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">perangkat</span>
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Online Kembali
            </span>
            <span className="text-[10px] font-mono text-slate-500">Selesai</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-lg font-bold text-emerald-400 font-mono">
              {totalOnlineKembali}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">perangkat</span>
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-500"></span>
              Total Insiden
            </span>
            <span className="text-[10px] font-mono text-slate-500">Akumulasi</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-lg font-bold text-slate-200 font-mono">
              {totalOnlineKembali + totalOffline}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">rekaman data</span>
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="flex flex-col min-w-0 bg-slate-900/70 border border-slate-800 rounded-lg overflow-hidden shadow-xl backdrop-blur-sm">
        {/* Table Subheader Bar */}
        <div className="px-4 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">
              Total <span className="font-semibold text-slate-200 font-mono">{filteredReports.length}</span> baris
              {searchQuery ? ` (filter: "${searchQuery}")` : ""}
            </span>

            {canDelete && selectedIds.size > 0 && (
              <button
                type="button"
                onClick={() => setShowBatchDeleteConfirm(true)}
                className="cursor-pointer flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-600 hover:bg-rose-500 border border-rose-500/40 text-white shadow-sm transition animate-in fade-in duration-150"
              >
                <Trash2 size={12} />
                Hapus {selectedIds.size} Data
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 hidden sm:inline">
                Tampilkan:
              </span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                  setSelectedIds(new Set());
                }}
                className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-md px-2.5 py-1 outline-none cursor-pointer hover:border-slate-700 transition"
              >
                <option value={10}>10</option>
                <option value={30}>30</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={1000000}>Semua</option>
              </select>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-2 pl-3 border-l border-slate-800">
                <span className="text-xs text-slate-400 hidden sm:inline font-mono">
                  {currentPage}/{totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-2.5 py-1 bg-slate-950 hover:bg-slate-850 disabled:opacity-40 disabled:cursor-not-allowed rounded text-slate-300 text-xs font-medium border border-slate-800 transition cursor-pointer"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="px-2.5 py-1 bg-slate-950 hover:bg-slate-850 disabled:opacity-40 disabled:cursor-not-allowed rounded text-slate-300 text-xs font-medium border border-slate-800 transition cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Scrollable Table Content */}
        <div className="overflow-x-auto overflow-y-visible min-w-0 touch-auto">
          {loading ? (
            <div className="p-6 space-y-2">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="h-10 bg-slate-800/40 rounded animate-pulse"
                />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-rose-400">
              <p className="text-xs">{error}</p>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <ClipboardList size={36} className="mb-2 opacity-30 text-slate-400" />
              <p className="text-xs font-medium text-slate-400">Tidak ada data laporan untuk rentang tanggal ini.</p>
            </div>
          ) : (
            <table className="w-full text-xs min-w-[1000px]">
              <thead className="sticky top-0 z-10 bg-slate-950/90 text-slate-400 font-mono text-[10px] uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="text-center px-3 py-3 w-12 border-r border-slate-800/60">
                    No
                  </th>
                  <th
                    onClick={() => handleSort("col1")}
                    className="text-left px-4 py-3 border-r border-slate-800/60 cursor-pointer hover:bg-slate-900/60 hover:text-slate-200 transition"
                  >
                    <div className="flex items-center justify-between">
                      <span>{type === "PPPOE" ? "Nama Dinas" : "Nama Kecamatan"}</span>
                      {sortConfig.key === "col1" && (
                        <span className="text-sky-400">
                          {sortConfig.direction === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("col2")}
                    className="text-left px-4 py-3 border-r border-slate-800/60 cursor-pointer hover:bg-slate-900/60 hover:text-slate-200 transition"
                  >
                    <div className="flex items-center justify-between">
                      <span>{type === "PPPOE" ? "Lokasi" : "Nama Desa"}</span>
                      {sortConfig.key === "col2" && (
                        <span className="text-sky-400">
                          {sortConfig.direction === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("offline_since")}
                    className="text-left px-4 py-3 border-r border-slate-800/60 w-44 cursor-pointer hover:bg-slate-900/60 hover:text-slate-200 transition"
                  >
                    <div className="flex items-center justify-between">
                      <span>Jam Offline</span>
                      {sortConfig.key === "offline_since" && (
                        <span className="text-sky-400">
                          {sortConfig.direction === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("online_since")}
                    className="text-left px-4 py-3 border-r border-slate-800/60 w-44 cursor-pointer hover:bg-slate-900/60 hover:text-slate-200 transition"
                  >
                    <div className="flex items-center justify-between">
                      <span>Jam Online</span>
                      {sortConfig.key === "online_since" && (
                        <span className="text-sky-400">
                          {sortConfig.direction === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("status_progress")}
                    className="text-left px-4 py-3 border-r border-slate-800/60 w-32 cursor-pointer hover:bg-slate-900/60 hover:text-slate-200 transition"
                  >
                    <div className="flex items-center justify-between">
                      <span>Status</span>
                      {sortConfig.key === "status_progress" && (
                        <span className="text-sky-400">
                          {sortConfig.direction === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("issue")}
                    className="text-left px-4 py-3 border-r border-slate-800/60 cursor-pointer hover:bg-slate-900/60 hover:text-slate-200 transition"
                  >
                    <div className="flex items-center justify-between">
                      <span>Issue</span>
                      {sortConfig.key === "issue" && (
                        <span className="text-sky-400">
                          {sortConfig.direction === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("tindakan")}
                    className="text-left px-4 py-3 border-r border-slate-800/60 cursor-pointer hover:bg-slate-900/60 hover:text-slate-200 transition"
                  >
                    <div className="flex items-center justify-between">
                      <span>Tindakan</span>
                      {sortConfig.key === "tindakan" && (
                        <span className="text-sky-400">
                          {sortConfig.direction === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </div>
                  </th>
                  <th className="text-center px-3 py-3 w-12">
                    {canDelete ? (
                      <input
                        type="checkbox"
                        checked={
                          paginatedReports.length > 0 &&
                          paginatedReports.every((r) => selectedIds.has(r.id))
                        }
                        onChange={toggleSelectAll}
                        className="cursor-pointer w-4 h-4 rounded border-slate-700 bg-slate-950 text-sky-500 accent-sky-500"
                        title="Pilih semua di halaman ini"
                      />
                    ) : (
                      "Aksi"
                    )}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {paginatedReports.map((r, i) => (
                  <tr
                    key={r.id}
                    className={`hover:bg-slate-800/40 transition group ${
                      selectedIds.has(r.id)
                        ? "bg-sky-950/20 border-l-2 border-l-sky-500"
                        : ""
                    }`}
                  >
                    <td className="px-3 py-2.5 text-center text-slate-500 font-mono text-[11px] border-r border-slate-800/60">
                      {startIndex + i + 1}
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-slate-100 border-r border-slate-800/60">
                      {r.prefix_name ? r.prefix_name.split("-")[0] : "-"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-300 border-r border-slate-800/60">
                      {r.prefix_name && r.prefix_name.includes("-")
                        ? r.prefix_name.split("-").slice(1).join("-")
                        : r.prefix_name || "-"}
                    </td>
                    <td className="px-3 py-2.5 text-slate-300 font-mono text-xs border-r border-slate-800/60 group/time min-w-[140px]">
                      {editingDate?.id === r.id &&
                      editingDate?.field === "offline_since" ? (
                        <input
                          type="datetime-local"
                          step="1"
                          className="w-full bg-slate-950 border border-sky-500 rounded px-2 py-1 text-xs font-mono text-slate-200 outline-none transition"
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
                          <span className={r.offline_since ? "text-rose-400 font-medium" : "text-slate-500"}>
                            {formatTimeWIB(r.offline_since)}
                          </span>
                          {canUpdate && (
                            <button
                              onClick={() =>
                                setEditingDate({
                                  id: r.id,
                                  field: "offline_since",
                                })
                              }
                              className="opacity-0 group-hover/time:opacity-100 hover:text-sky-400 text-slate-500 transition p-1 cursor-pointer"
                              title="Edit jam offline"
                            >
                              <Pencil size={12} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-slate-300 font-mono text-xs border-r border-slate-800/60 group/time min-w-[140px]">
                      {editingDate?.id === r.id &&
                      editingDate?.field === "online_since" ? (
                        <input
                          type="datetime-local"
                          step="1"
                          className="w-full bg-slate-950 border border-sky-500 rounded px-2 py-1 text-xs font-mono text-slate-200 outline-none transition"
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
                          <span className={r.online_since ? "text-emerald-400 font-medium" : "text-slate-600"}>
                            {formatTimeWIB(r.online_since)}
                          </span>
                          {canUpdate && (
                            <button
                              onClick={() =>
                                setEditingDate({
                                  id: r.id,
                                  field: "online_since",
                                })
                              }
                              className="opacity-0 group-hover/time:opacity-100 hover:text-sky-400 text-slate-500 transition p-1 cursor-pointer"
                              title="Edit jam online"
                            >
                              <Pencil size={12} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 border-r border-slate-800/60">
                      <select
                        value={r.status_progress || "Progress"}
                        onChange={(e) =>
                          updateReport(r.id, "status_progress", e.target.value)
                        }
                        disabled={!canUpdate}
                        className={`w-full border rounded-md px-2.5 py-1 text-xs font-bold outline-none cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed transition ${
                          r.status_progress === "Done"
                            ? "bg-emerald-950/60 text-emerald-300 border-emerald-800/80"
                            : "bg-amber-950/60 text-amber-300 border-amber-800/80"
                        }`}
                      >
                        <option value="Progress" className="bg-slate-900 text-amber-300">Progress</option>
                        <option value="Done" className="bg-slate-900 text-emerald-300">Done</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 border-r border-slate-800/60 min-w-[200px]">
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
                          className="w-full bg-slate-950/80 border border-slate-800 hover:border-slate-700 focus:border-sky-500 rounded-md px-2.5 py-1 text-xs text-slate-200 outline-none cursor-pointer disabled:opacity-70 transition"
                        >
                          <option value="" className="bg-slate-900 text-slate-400">- Pilih Issue -</option>
                          {standardIssues.map((opt) => (
                            <option key={opt} value={opt} className="bg-slate-900 text-slate-200">
                              {opt}
                            </option>
                          ))}
                          <option value="Lain-lain" className="bg-slate-900 text-sky-400">Lain-lain (Custom)</option>
                        </select>
                        {!standardIssues.includes(r.issue) && r.issue ? (
                          <input
                            type="text"
                            value={r.issue === "Ketik manual..." ? "" : r.issue}
                            onChange={(e) =>
                              updateReport(r.id, "issue", e.target.value)
                            }
                            disabled={!canUpdate}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-md px-2.5 py-1 text-xs text-slate-200 outline-none transition"
                            placeholder="Tulis issue Custom..."
                          />
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2 border-r border-slate-800/60">
                      <input
                        type="text"
                        value={r.tindakan || ""}
                        onChange={(e) =>
                          updateReport(r.id, "tindakan", e.target.value)
                        }
                        disabled={!canUpdate}
                        className="w-full bg-slate-950/30 border border-transparent hover:border-slate-800 focus:border-sky-500 focus:bg-slate-950 rounded-md px-2.5 py-1 text-xs text-slate-200 outline-none transition disabled:opacity-70 disabled:cursor-not-allowed placeholder:text-slate-600"
                        placeholder={!canUpdate ? "-" : "Ketik tindakan..."}
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      {canDelete && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(r.id)}
                          onChange={() => toggleSelect(r.id)}
                          className="cursor-pointer w-4 h-4 rounded border-slate-700 bg-slate-950 text-sky-500 accent-sky-500"
                          title="Pilih baris"
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Delete Single Item Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-800 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">
                  Konfirmasi Hapus
                </h3>
                <p className="text-[11px] text-slate-400">
                  Tindakan ini tidak dapat dibatalkan
                </p>
              </div>
            </div>
            <div className="p-4">
              <p className="text-xs text-slate-300">
                Apakah Anda yakin ingin menghapus baris laporan ini dari database?
              </p>
            </div>
            <div className="p-3.5 bg-slate-950/50 border-t border-slate-800 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 rounded-lg border border-slate-700/60 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition cursor-pointer shadow-sm border border-rose-500/40"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Delete Confirmation Modal */}
      {showBatchDeleteConfirm && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-800 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">
                  Hapus {selectedIds.size} Laporan
                </h3>
                <p className="text-[11px] text-slate-400">
                  Operasi penghapusan massal
                </p>
              </div>
            </div>
            <div className="p-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                Anda akan menghapus{" "}
                <span className="font-bold text-rose-400">
                  {selectedIds.size} laporan
                </span>{" "}
                secara permanen. Apakah Anda yakin?
              </p>
            </div>
            <div className="p-3.5 bg-slate-950/50 border-t border-slate-800 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowBatchDeleteConfirm(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 rounded-lg border border-slate-700/60 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmBatchDelete}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition cursor-pointer shadow-sm border border-rose-500/40"
              >
                Ya, Hapus Semua
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tambah Laporan Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                  <Plus size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">
                    Tambah Laporan Manual
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Kategori: {type === "PPPOE" ? "OPD" : "Desa"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-850 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-3.5">
              {type === "PPPOE" ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
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
                      className="w-full uppercase bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none transition"
                      placeholder="DISKOMINFO"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
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
                      className="w-full uppercase bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none transition"
                      placeholder="SERVER"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
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
                      className="w-full uppercase bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none transition"
                      placeholder="BALEENDAH"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
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
                      className="w-full uppercase bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none transition"
                      placeholder="JELEKONG"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
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
                    className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none transition font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
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
                    className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none transition font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
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
                  className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none transition cursor-pointer"
                >
                  <option value="Progress">Progress</option>
                  <option value="Done">Done</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
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
                  className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none transition cursor-pointer mb-2"
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
                    className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none transition"
                    placeholder="Ketik issue Custom..."
                  />
                ) : null}
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
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
                  className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none transition placeholder:text-slate-600"
                  placeholder="Opsional..."
                />
              </div>
            </div>

            <div className="p-3.5 bg-slate-950/50 border-t border-slate-800 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 rounded-lg border border-slate-700/60 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleAddReport}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition cursor-pointer shadow-sm border border-sky-500/40"
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
