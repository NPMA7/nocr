"use client";
import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import {
  Key,
  Plus,
  Copy,
  Check,
  Trash2,
  Power,
  Shield,
  Clock,
  Calendar,
  AlertCircle,
  ExternalLink,
  Code2,
  Terminal,
  Activity,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Info,
  Lock,
  Send,
  Download,
  Search,
  Play,
  ShieldCheck,
  Globe,
} from "lucide-react";
import { useAppState } from "@/App";

export default function ApiKeySettings({
  canCreate = true,
  canUpdate = true,
  canDelete = true,
}) {
  const { showToast } = useAppState();

  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "active" | "inactive" | "expired"

  // Modal Create
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    role: "superadmin",
    expires_in_days: "0",
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Modal Created Success (Show Full Key once)
  const [newKeyData, setNewKeyData] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [copiedState, setCopiedState] = useState({});

  // Action states
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Documentation tab & snippet tab
  const [docTab, setDocTab] = useState("overview"); // "overview" | "sites" | "auth"
  const [snippetTab, setSnippetTab] = useState("curl"); // "curl" | "javascript" | "python" | "php"

  // Live Tester / Playground State
  const [selectedTesterKey, setSelectedTesterKey] = useState("");
  const [testerParams, setTesterParams] = useState({
    status: "all",
    type: "all",
    limit: "10",
    search: "",
  });
  const [testingEndpoint, setTestingEndpoint] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testError, setTestError] = useState(null);
  const [testLatency, setTestLatency] = useState(null);

  const fetchKeys = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await axios.get("/api/settings/api-keys");
      if (res.data?.data) {
        setKeys(res.data.data);
      }
    } catch (err) {
      console.error("Gagal memuat daftar API Key:", err);
      if (showToast) {
        showToast(
          err.response?.data?.error || "Gagal memuat daftar API Key",
          "error"
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  // Compute KPI Statistics
  const stats = useMemo(() => {
    const total = keys.length;
    let active = 0;
    let inactive = 0;
    let expired = 0;
    let latestUsedTime = null;
    let latestUsedName = null;

    const now = new Date();

    keys.forEach((k) => {
      const isExp = k.expires_at && new Date(k.expires_at) < now;
      if (isExp) {
        expired++;
      } else if (k.is_active) {
        active++;
      } else {
        inactive++;
      }

      if (k.last_used_at) {
        const uDate = new Date(k.last_used_at);
        if (!latestUsedTime || uDate > latestUsedTime) {
          latestUsedTime = uDate;
          latestUsedName = k.name;
        }
      }
    });

    return {
      total,
      active,
      inactive,
      expired,
      latestUsedTime,
      latestUsedName,
    };
  }, [keys]);

  // Filtered keys
  const filteredKeys = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const now = new Date();

    return keys.filter((k) => {
      const matchSearch =
        !q ||
        k.name.toLowerCase().includes(q) ||
        (k.masked_key && k.masked_key.toLowerCase().includes(q)) ||
        (k.key_prefix && k.key_prefix.toLowerCase().includes(q)) ||
        (k.created_by && k.created_by.toLowerCase().includes(q));

      if (!matchSearch) return false;

      const isExp = k.expires_at && new Date(k.expires_at) < now;
      if (statusFilter === "active") {
        return k.is_active && !isExp;
      }
      if (statusFilter === "inactive") {
        return !k.is_active && !isExp;
      }
      if (statusFilter === "expired") {
        return isExp;
      }
      return true;
    });
  }, [keys, searchQuery, statusFilter]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!createForm.name.trim()) {
      setCreateError("Nama klien / deskripsi API Key wajib diisi");
      return;
    }

    setCreating(true);
    setCreateError("");
    try {
      const res = await axios.post("/api/settings/api-keys", {
        name: createForm.name.trim(),
        role: createForm.role,
        expires_in_days: parseInt(createForm.expires_in_days, 10),
      });

      if (res.data?.success && res.data?.data) {
        setNewKeyData(res.data.data);
        setShowCreateModal(false);
        setCreateForm({ name: "", role: "superadmin", expires_in_days: "0" });
        fetchKeys();
        if (showToast) {
          showToast("API Key berhasil dibuat!", "success");
        }
      }
    } catch (err) {
      setCreateError(
        err.response?.data?.error || err.message || "Gagal membuat API Key"
      );
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (keyItem) => {
    if (!canUpdate) return;
    setActionLoadingId(keyItem.id);
    try {
      await axios.patch(`/api/settings/api-keys/${keyItem.id}`, {
        is_active: !keyItem.is_active,
      });
      if (showToast) {
        showToast(
          `API Key ${keyItem.name} berhasil ${
            keyItem.is_active ? "dinonaktifkan" : "diaktifkan"
          }`,
          "success"
        );
      }
      fetchKeys();
    } catch (err) {
      if (showToast) {
        showToast(
          err.response?.data?.error || "Gagal mengubah status API Key",
          "error"
        );
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!canDelete) return;
    setActionLoadingId(id);
    try {
      await axios.delete(`/api/settings/api-keys/${id}`);
      if (showToast) {
        showToast("API Key berhasil dihapus", "success");
      }
      setDeleteConfirmId(null);
      fetchKeys();
    } catch (err) {
      if (showToast) {
        showToast(
          err.response?.data?.error || "Gagal menghapus API Key",
          "error"
        );
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const copyToClipboard = (text, id = "key") => {
    if (!text) return;
    const cleanText = text.trim();
    navigator.clipboard.writeText(cleanText);
    if (id === "key") {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } else if (id === "curl") {
      setCopiedCurl(true);
      setTimeout(() => setCopiedCurl(false), 2000);
    } else {
      setCopiedState((prev) => ({ ...prev, [id]: true }));
      setTimeout(() => {
        setCopiedState((prev) => ({ ...prev, [id]: false }));
      }, 2000);
    }
    if (showToast) {
      showToast("Tersalin ke clipboard!", "success");
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return "-";
    try {
      const d = new Date(isoString);
      return d.toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  const formatRelativeTime = (isoString) => {
    if (!isoString) return "Belum pernah";
    try {
      const diffMs = new Date() - new Date(isoString);
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return "Baru saja";
      if (diffMin < 60) return `${diffMin} mnt lalu`;
      const diffHour = Math.floor(diffMin / 60);
      if (diffHour < 24) return `${diffHour} jam lalu`;
      const diffDay = Math.floor(diffHour / 24);
      if (diffDay < 30) return `${diffDay} hari lalu`;
      return formatDate(isoString);
    } catch {
      return isoString;
    }
  };

  const handleDownloadPostmanCollection = () => {
    const baseUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://nocrnetwork.com";

    const postmanData = {
      info: {
        _postman_id: "a918f723-5e92-4927-b50a-3c582f34e6b1",
        name: "NOCR REST API",
        description:
          "Koleksi Postman resmi untuk integrasi REST API NOCR Network. Berisi endpoint ringkasan kesehatan sistem dan data sebaran wilayah (Desa & OPD) lengkap dengan koordinat GIS.",
        schema:
          "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
      },
      item: [
        {
          name: "1. Ringkasan Sistem (Overview)",
          request: {
            method: "GET",
            header: [
              {
                key: "X-API-Key",
                value: "{{apiKey}}",
                type: "text",
                description: "Kunci API Klien NOCR",
              },
              {
                key: "Accept",
                value: "application/json",
                type: "text",
              },
            ],
            url: {
              raw: "{{baseUrl}}/api/nocr/overview",
              host: ["{{baseUrl}}"],
              path: ["api", "nocr", "overview"],
            },
          },
        },
        {
          name: "2. Data Wilayah - Semua Titik",
          request: {
            method: "GET",
            header: [
              {
                key: "X-API-Key",
                value: "{{apiKey}}",
                type: "text",
              },
              {
                key: "Accept",
                value: "application/json",
                type: "text",
              },
            ],
            url: {
              raw: "{{baseUrl}}/api/nocr/sites?status=all&type=all&page=1&limit=50",
              host: ["{{baseUrl}}"],
              path: ["api", "nocr", "sites"],
            },
          },
        },
      ],
      variable: [
        { key: "baseUrl", value: baseUrl, type: "string" },
        { key: "apiKey", value: "YOUR_API_KEY_HERE", type: "string" },
      ],
    };

    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(postmanData, null, 2)
    )}`;
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", jsonString);
    downloadAnchor.setAttribute("download", "NOCR_API.postman_collection.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExecuteLiveTest = async () => {
    setTestingEndpoint(true);
    setTestResult(null);
    setTestError(null);
    setTestLatency(null);

    const startTime = performance.now();

    try {
      let targetUrl = "";
      if (docTab === "overview") {
        targetUrl = "/api/nocr/overview";
      } else {
        const params = new URLSearchParams();
        if (testerParams.status !== "all") params.append("status", testerParams.status);
        if (testerParams.type !== "all") params.append("type", testerParams.type);
        if (testerParams.limit) params.append("limit", testerParams.limit);
        if (testerParams.search.trim()) params.append("search", testerParams.search.trim());
        targetUrl = `/api/nocr/sites?${params.toString()}`;
      }

      const headers = {};
      if (selectedTesterKey.trim()) {
        headers["X-API-Key"] = selectedTesterKey.trim();
      }

      const res = await axios.get(targetUrl, { headers });
      const endTime = performance.now();
      setTestLatency(Math.round(endTime - startTime));
      setTestResult(res.data);
    } catch (err) {
      const endTime = performance.now();
      setTestLatency(Math.round(endTime - startTime));
      setTestError(
        err.response?.data || {
          status: err.response?.status || 500,
          error: err.message || "Gagal mengeksekusi request",
        }
      );
    } finally {
      setTestingEndpoint(false);
    }
  };

  const currentOrigin =
    typeof window !== "undefined" ? window.location.origin : "https://nocrnetwork.com";

  const getActiveSampleUrl = (endpointType) => {
    if (endpointType === "overview") {
      return `${currentOrigin}/api/nocr/overview`;
    }
    const params = new URLSearchParams();
    if (testerParams.status !== "all") params.append("status", testerParams.status);
    if (testerParams.type !== "all") params.append("type", testerParams.type);
    if (testerParams.limit) params.append("limit", testerParams.limit);
    if (testerParams.search.trim()) params.append("search", testerParams.search.trim());
    const qStr = params.toString();
    return `${currentOrigin}/api/nocr/sites${qStr ? `?${qStr}` : "?status=all&type=desa&page=1&limit=50"}`;
  };

  const presetSuggestions = [
    "Dashboard Eksternal Kominfo",
    "Sistem GIS Pemkab Bandung",
    "Mobile App Monitoring NOC",
    "Integrasi Dashboard OPD",
  ];

  return (
    <div className="space-y-4 w-full">
      {/* 1. COMPACT ACTION TOOLBAR (No giant redundant banner) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <Key size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-100">
                Akses Kunci API & Integrasi Eksternal
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                REST JSON
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <Lock size={9} /> Read-Only
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Autentikasi sinkronisasi data ke Dashboard Klien, GIS, dan platform pihak ketiga
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => fetchKeys(true)}
            disabled={refreshing}
            className="cursor-pointer px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition"
            title="Segarkan Data"
          >
            <RefreshCw
              size={13}
              className={refreshing ? "animate-spin text-blue-400" : "text-slate-400"}
            />
            <span>{refreshing ? "..." : "Segarkan"}</span>
          </button>

          <button
            onClick={handleDownloadPostmanCollection}
            className="cursor-pointer px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition"
            title="Unduh Postman Collection (.json)"
          >
            <Download size={13} className="text-blue-400" />
            <span>Postman (.json)</span>
          </button>

          {canCreate && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="cursor-pointer px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition active:scale-95"
            >
              <Plus size={14} />
              <span>Buat API Key</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. COMPACT KPI STAT CARDS (Flat, no gradients, no purple) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Card 1: Total */}
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
              Total Kunci
            </div>
            <div className="text-xl font-bold font-mono text-slate-100 mt-0.5">
              {stats.total}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {stats.active} aktif • {stats.inactive + stats.expired} nonaktif
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-400">
            <Key size={15} />
          </div>
        </div>

        {/* Card 2: Active */}
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
              Kunci Aktif
            </div>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">
              {stats.active}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Siap melayani request
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 size={15} />
          </div>
        </div>

        {/* Card 3: Nonaktif / Expired */}
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
              Nonaktif / Kedaluwarsa
            </div>
            <div className="text-xl font-bold font-mono text-slate-300 mt-0.5">
              {stats.inactive + stats.expired}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {stats.expired > 0 ? `${stats.expired} kedaluwarsa` : "Akses dinonaktifkan"}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
            <Clock size={15} />
          </div>
        </div>

        {/* Card 4: Last Activity (No purple - using clean Blue/Slate) */}
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl shadow-sm flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
              Aktivitas Terakhir
            </div>
            <div className="text-xs font-bold text-slate-200 mt-1 truncate">
              {stats.latestUsedTime ? formatRelativeTime(stats.latestUsedTime) : "Belum Ada"}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5 truncate">
              {stats.latestUsedName ? `Oleh: ${stats.latestUsedName}` : "Belum ada panggilan"}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-400 shrink-0">
            <Activity size={15} />
          </div>
        </div>
      </div>

      {/* 3. API KEYS TABLE SECTION */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-sm overflow-hidden">
        {/* Table Toolbar */}
        <div className="px-4 py-3 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <Shield size={14} className="text-blue-400" />
            <h3 className="text-xs font-bold text-slate-200">
              Daftar Kunci API Terdaftar
            </h3>
            <span className="px-2 py-0.2 text-[10px] font-mono rounded bg-slate-800 text-slate-400 border border-slate-700">
              {filteredKeys.length} / {keys.length}
            </span>
          </div>

          {/* Search & Filter */}
          <div className="flex items-center gap-2">
            <div className="relative min-w-[170px]">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Cari nama/token..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-7 pr-2.5 py-1 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex p-0.5 bg-slate-950 border border-slate-800 rounded-lg">
              <button
                onClick={() => setStatusFilter("all")}
                className={`cursor-pointer px-2 py-0.5 rounded text-[11px] font-medium transition ${
                  statusFilter === "all"
                    ? "bg-blue-600 text-white font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Semua
              </button>
              <button
                onClick={() => setStatusFilter("active")}
                className={`cursor-pointer px-2 py-0.5 rounded text-[11px] font-medium transition ${
                  statusFilter === "active"
                    ? "bg-emerald-600 text-white font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Aktif
              </button>
              <button
                onClick={() => setStatusFilter("inactive")}
                className={`cursor-pointer px-2 py-0.5 rounded text-[11px] font-medium transition ${
                  statusFilter === "inactive"
                    ? "bg-slate-700 text-white font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Nonaktif
              </button>
              <button
                onClick={() => setStatusFilter("expired")}
                className={`cursor-pointer px-2 py-0.5 rounded text-[11px] font-medium transition ${
                  statusFilter === "expired"
                    ? "bg-amber-600 text-white font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Kedaluwarsa
              </button>
            </div>
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="p-10 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <RefreshCw size={20} className="animate-spin text-blue-400" />
            <span className="text-xs">Memuat data kunci API...</span>
          </div>
        ) : filteredKeys.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-xs text-slate-400">
              {searchQuery || statusFilter !== "all"
                ? "Tidak ada kunci API yang cocok dengan filter pencarian."
                : 'Belum ada kunci API. Klik tombol "Buat API Key" di atas.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono text-[11px]">
                  <th className="py-2.5 px-3.5 font-semibold">Nama / Klien</th>
                  <th className="py-2.5 px-3 font-semibold">Token Prefix</th>
                  <th className="py-2.5 px-3 font-semibold">Hak Akses</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  <th className="py-2.5 px-3 font-semibold">Terakhir Digunakan</th>
                  <th className="py-2.5 px-3 font-semibold">Masa Berlaku</th>
                  <th className="py-2.5 px-3.5 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredKeys.map((k) => {
                  const isExpired =
                    k.expires_at && new Date(k.expires_at) < new Date();
                  const tokenDisplay = k.masked_key || k.key_prefix || "nocr_live_...";

                  return (
                    <tr key={k.id} className="hover:bg-slate-800/30 transition-colors">
                      {/* Name & Creator */}
                      <td className="py-2.5 px-3.5">
                        <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                          <Key size={12} className="text-blue-400 shrink-0" />
                          <span>{k.name}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {formatDate(k.created_at)} • oleh {k.created_by}
                        </div>
                      </td>

                      {/* Token Prefix with Quick Copy */}
                      <td className="py-2.5 px-3">
                        <div className="inline-flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded px-2 py-0.5">
                          <code className="text-[11px] font-mono text-blue-300">
                            {tokenDisplay}
                          </code>
                          <button
                            onClick={() => copyToClipboard(tokenDisplay, `pref_${k.id}`)}
                            className="cursor-pointer text-slate-500 hover:text-slate-200 transition"
                            title="Salin Prefix"
                          >
                            {copiedState[`pref_${k.id}`] ? (
                              <Check size={11} className="text-emerald-400" />
                            ) : (
                              <Copy size={11} />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Role Permission */}
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <Lock size={9} /> READ-ONLY
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3">
                        {isExpired ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Clock size={10} /> Kedaluwarsa
                          </span>
                        ) : k.is_active ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                            <XCircle size={10} /> Dinonaktifkan
                          </span>
                        )}
                      </td>

                      {/* Last Used */}
                      <td className="py-2.5 px-3 text-slate-300 font-mono text-[11px]">
                        <div>{formatRelativeTime(k.last_used_at)}</div>
                        {k.last_used_at && (
                          <div className="text-[10px] text-slate-500 font-sans">
                            {formatDate(k.last_used_at)}
                          </div>
                        )}
                      </td>

                      {/* Expiration */}
                      <td className="py-2.5 px-3 text-[11px]">
                        {k.expires_at ? (
                          <span className="text-slate-300 font-mono">
                            {formatDate(k.expires_at)}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">Permanen</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canUpdate && (
                            <button
                              onClick={() => handleToggleActive(k)}
                              disabled={actionLoadingId === k.id}
                              className={`cursor-pointer p-1.5 rounded border transition ${
                                k.is_active
                                  ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                  : "bg-slate-950 hover:bg-slate-800 text-slate-500 hover:text-slate-300 border-slate-800"
                              }`}
                              title={k.is_active ? "Nonaktifkan Kunci" : "Aktifkan Kunci"}
                            >
                              <Power size={12} />
                            </button>
                          )}

                          {canDelete && (
                            <>
                              {deleteConfirmId === k.id ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleDelete(k.id)}
                                    disabled={actionLoadingId === k.id}
                                    className="cursor-pointer px-2 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold"
                                  >
                                    Hapus
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirmId(null)}
                                    className="cursor-pointer px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]"
                                  >
                                    Batal
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setDeleteConfirmId(k.id)}
                                  className="cursor-pointer p-1.5 rounded bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition"
                                  title="Hapus Kunci"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. DEVELOPER HUB & COMPACT PLAYGROUND */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-4">
        {/* Header & Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Code2 size={16} className="text-blue-400" />
            <h3 className="text-xs font-bold text-slate-100">
              Dokumentasi Integrasi & REST API Playground
            </h3>
          </div>

          <div className="flex p-0.5 bg-slate-950 border border-slate-800 rounded-lg">
            <button
              onClick={() => {
                setDocTab("overview");
                setTestResult(null);
                setTestError(null);
              }}
              className={`cursor-pointer px-3 py-1 rounded text-xs font-medium transition ${
                docTab === "overview"
                  ? "bg-blue-600 text-white font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              1. /overview
            </button>
            <button
              onClick={() => {
                setDocTab("sites");
                setTestResult(null);
                setTestError(null);
              }}
              className={`cursor-pointer px-3 py-1 rounded text-xs font-medium transition ${
                docTab === "sites"
                  ? "bg-blue-600 text-white font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              2. /sites (Wilayah)
            </button>
            <button
              onClick={() => {
                setDocTab("auth");
                setTestResult(null);
                setTestError(null);
              }}
              className={`cursor-pointer px-3 py-1 rounded text-xs font-medium transition ${
                docTab === "auth"
                  ? "bg-blue-600 text-white font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              3. Metode Autentikasi
            </button>
          </div>
        </div>

        {/* TAB 3: AUTHENTICATION METHODS */}
        {docTab === "auth" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-blue-400">
                  HTTP Header (Rekomendasi)
                </span>
                <button
                  onClick={() => copyToClipboard("X-API-Key: YOUR_API_KEY", "m_header")}
                  className="cursor-pointer text-slate-400 hover:text-slate-200"
                >
                  {copiedState["m_header"] ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                </button>
              </div>
              <div className="bg-slate-900 p-2 rounded font-mono text-[11px] text-blue-300 select-all border border-slate-800">
                X-API-Key: YOUR_API_KEY
              </div>
              <p className="text-[10px] text-slate-500">
                Paling aman, tidak terekspos di log query URL proxy atau browser.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-slate-300">
                  Authorization Bearer
                </span>
                <button
                  onClick={() => copyToClipboard("Authorization: Bearer YOUR_API_KEY", "m_bearer")}
                  className="cursor-pointer text-slate-400 hover:text-slate-200"
                >
                  {copiedState["m_bearer"] ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                </button>
              </div>
              <div className="bg-slate-900 p-2 rounded font-mono text-[11px] text-slate-200 select-all border border-slate-800">
                Authorization: Bearer YOUR_API_KEY
              </div>
              <p className="text-[10px] text-slate-500">
                Standar kompatibel dengan Postman, Swagger, dan HTTP client umum.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-emerald-400">
                  URL Query Parameter
                </span>
                <button
                  onClick={() => copyToClipboard("?api_key=YOUR_API_KEY", "m_query")}
                  className="cursor-pointer text-slate-400 hover:text-slate-200"
                >
                  {copiedState["m_query"] ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                </button>
              </div>
              <div className="bg-slate-900 p-2 rounded font-mono text-[11px] text-emerald-300 select-all border border-slate-800">
                ?api_key=YOUR_API_KEY
              </div>
              <p className="text-[10px] text-slate-500">
                Praktis untuk pengujian cepat via browser address bar.
              </p>
            </div>
          </div>
        )}

        {/* TAB 1 & 2: ENDPOINTS */}
        {docTab !== "auth" && (
          <div className="space-y-3">
            {/* Compact Endpoint & Tester Strip */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono text-xs font-bold border border-emerald-500/20">
                  GET
                </span>
                <code className="text-xs font-mono font-bold text-slate-200 select-all">
                  {docTab === "overview" ? "/api/nocr/overview" : "/api/nocr/sites"}
                </code>
                <span className="text-[11px] text-slate-500 hidden sm:inline">
                  {docTab === "overview"
                    ? "— Ringkasan kesehatan & status online Desa vs OPD"
                    : "— Katalog titik sebaran perangkat & koordinat GIS"}
                </span>
              </div>

              {/* Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedTesterKey}
                  onChange={(e) => setSelectedTesterKey(e.target.value)}
                  className="cursor-pointer bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                >
                  <option value="">Sesi Login Aktif (Default)</option>
                  {keys
                    .filter((k) => k.is_active)
                    .map((k) => (
                      <option key={k.id} value={k.key_prefix || k.masked_key}>
                        {k.name} ({k.key_prefix || k.masked_key})
                      </option>
                    ))}
                </select>

                {docTab === "sites" && (
                  <>
                    <select
                      value={testerParams.type}
                      onChange={(e) => setTesterParams((prev) => ({ ...prev, type: e.target.value }))}
                      className="cursor-pointer bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                      <option value="all">Semua Tipe</option>
                      <option value="desa">Desa</option>
                      <option value="opd">OPD</option>
                    </select>
                    <select
                      value={testerParams.status}
                      onChange={(e) => setTesterParams((prev) => ({ ...prev, status: e.target.value }))}
                      className="cursor-pointer bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                      <option value="all">Semua Status</option>
                      <option value="online">Online</option>
                      <option value="offline">Offline</option>
                    </select>
                  </>
                )}

                <button
                  onClick={handleExecuteLiveTest}
                  disabled={testingEndpoint}
                  className="cursor-pointer px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  {testingEndpoint ? (
                    <RefreshCw size={12} className="animate-spin" />
                  ) : (
                    <Play size={12} />
                  )}
                  <span>{testingEndpoint ? "Menguji..." : "Kirim Request"}</span>
                </button>
              </div>
            </div>

            {/* Test Result Display if executed */}
            {(testResult || testError) && (
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                        testResult
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-red-500/10 text-red-400 border border-red-500/20"
                      }`}
                    >
                      {testResult ? "200 OK" : "ERROR RESPONSE"}
                    </span>
                    {testLatency !== null && (
                      <span className="text-slate-400 font-mono text-[10px]">
                        Latency: <strong className="text-blue-400">{testLatency}ms</strong>
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        JSON.stringify(testResult || testError, null, 2),
                        "test_json"
                      )
                    }
                    className="cursor-pointer px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-[10px] flex items-center gap-1"
                  >
                    {copiedState["test_json"] ? <Check size={11} /> : <Copy size={11} />}
                    <span>{copiedState["test_json"] ? "Tersalin!" : "Salin JSON Respon"}</span>
                  </button>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded p-2.5 font-mono text-[11px] text-emerald-400 max-h-52 overflow-y-auto custom-scrollbar select-all">
                  <pre className="leading-relaxed">
                    {JSON.stringify(testResult || testError, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Code Snippet Box (Flat, clean, no purple) */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-slate-300 font-semibold">
                  <Terminal size={13} className="text-blue-400" />
                  <span>Contoh Integrasi Kode</span>
                </div>

                <div className="flex p-0.5 bg-slate-900 border border-slate-800 rounded">
                  <button
                    onClick={() => setSnippetTab("curl")}
                    className={`cursor-pointer px-2 py-0.5 rounded text-[10px] font-medium transition ${
                      snippetTab === "curl"
                        ? "bg-blue-600 text-white font-semibold"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    cURL
                  </button>
                  <button
                    onClick={() => setSnippetTab("javascript")}
                    className={`cursor-pointer px-2 py-0.5 rounded text-[10px] font-medium transition ${
                      snippetTab === "javascript"
                        ? "bg-blue-600 text-white font-semibold"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    JavaScript
                  </button>
                  <button
                    onClick={() => setSnippetTab("python")}
                    className={`cursor-pointer px-2 py-0.5 rounded text-[10px] font-medium transition ${
                      snippetTab === "python"
                        ? "bg-blue-600 text-white font-semibold"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Python
                  </button>
                  <button
                    onClick={() => setSnippetTab("php")}
                    className={`cursor-pointer px-2 py-0.5 rounded text-[10px] font-medium transition ${
                      snippetTab === "php"
                        ? "bg-blue-600 text-white font-semibold"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    PHP
                  </button>
                </div>
              </div>

              {/* cURL */}
              {snippetTab === "curl" && (
                <div className="bg-slate-900 p-2.5 rounded border border-slate-800 font-mono text-[11px] text-blue-300 relative">
                  <pre className="leading-relaxed overflow-x-auto custom-scrollbar">{`curl -X GET "${getActiveSampleUrl(docTab)}" \\
  -H "X-API-Key: ${selectedTesterKey || "YOUR_API_KEY"}" \\
  -H "Accept: application/json"`}</pre>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `curl -X GET "${getActiveSampleUrl(docTab)}" -H "X-API-Key: ${selectedTesterKey || "YOUR_API_KEY"}" -H "Accept: application/json"`,
                        "curl_code"
                      )
                    }
                    className="cursor-pointer absolute top-2 right-2 px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 text-[10px] flex items-center gap-1 border border-slate-800"
                  >
                    {copiedState["curl_code"] ? <Check size={11} /> : <Copy size={11} />}
                    <span>{copiedState["curl_code"] ? "Tersalin" : "Salin"}</span>
                  </button>
                </div>
              )}

              {/* JavaScript */}
              {snippetTab === "javascript" && (
                <div className="bg-slate-900 p-2.5 rounded border border-slate-800 font-mono text-[11px] text-slate-200 relative">
                  <pre className="leading-relaxed overflow-x-auto custom-scrollbar">{`const API_KEY = "${selectedTesterKey || "YOUR_API_KEY"}";
const res = await fetch("${getActiveSampleUrl(docTab)}", {
  headers: { "X-API-Key": API_KEY, "Accept": "application/json" }
});
const data = await res.json();
console.log(data);`}</pre>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `const res = await fetch("${getActiveSampleUrl(docTab)}", { headers: { "X-API-Key": "${selectedTesterKey || "YOUR_API_KEY"}" } });\nconst data = await res.json();\nconsole.log(data);`,
                        "js_code"
                      )
                    }
                    className="cursor-pointer absolute top-2 right-2 px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 text-[10px] flex items-center gap-1 border border-slate-800"
                  >
                    {copiedState["js_code"] ? <Check size={11} /> : <Copy size={11} />}
                    <span>{copiedState["js_code"] ? "Tersalin" : "Salin"}</span>
                  </button>
                </div>
              )}

              {/* Python */}
              {snippetTab === "python" && (
                <div className="bg-slate-900 p-2.5 rounded border border-slate-800 font-mono text-[11px] text-emerald-300 relative">
                  <pre className="leading-relaxed overflow-x-auto custom-scrollbar">{`import requests
headers = {"X-API-Key": "${selectedTesterKey || "YOUR_API_KEY"}", "Accept": "application/json"}
res = requests.get("${getActiveSampleUrl(docTab)}", headers=headers)
print(res.json())`}</pre>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `import requests\nres = requests.get("${getActiveSampleUrl(docTab)}", headers={"X-API-Key": "${selectedTesterKey || "YOUR_API_KEY"}"})\nprint(res.json())`,
                        "py_code"
                      )
                    }
                    className="cursor-pointer absolute top-2 right-2 px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 text-[10px] flex items-center gap-1 border border-slate-800"
                  >
                    {copiedState["py_code"] ? <Check size={11} /> : <Copy size={11} />}
                    <span>{copiedState["py_code"] ? "Tersalin" : "Salin"}</span>
                  </button>
                </div>
              )}

              {/* PHP */}
              {snippetTab === "php" && (
                <div className="bg-slate-900 p-2.5 rounded border border-slate-800 font-mono text-[11px] text-slate-300 relative">
                  <pre className="leading-relaxed overflow-x-auto custom-scrollbar">{`<?php
$ch = curl_init("${getActiveSampleUrl(docTab)}");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ["X-API-Key: ${selectedTesterKey || "YOUR_API_KEY"}"]);
$res = curl_exec($ch);
curl_close($ch);
print_r(json_decode($res, true));
?>`}</pre>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `<?php\n$ch = curl_init("${getActiveSampleUrl(docTab)}");\ncurl_setopt($ch, CURLOPT_RETURNTRANSFER, true);\ncurl_setopt($ch, CURLOPT_HTTPHEADER, ["X-API-Key: ${selectedTesterKey || "YOUR_API_KEY"}"]);\n$res = curl_exec($ch);\ncurl_close($ch);\nprint_r(json_decode($res, true));\n?>`,
                        "php_code"
                      )
                    }
                    className="cursor-pointer absolute top-2 right-2 px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 text-[10px] flex items-center gap-1 border border-slate-800"
                  >
                    {copiedState["php_code"] ? <Check size={11} /> : <Copy size={11} />}
                    <span>{copiedState["php_code"] ? "Tersalin" : "Salin"}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 5. MODAL CREATE API KEY (Clean, flat, compact) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key size={18} className="text-blue-400" />
                <h3 className="text-sm font-bold text-slate-100">
                  Buat Kunci API Baru
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="cursor-pointer text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-4 space-y-3">
              {createError && (
                <div className="p-2.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider font-mono">
                  Nama Klien / Sistem <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Dashboard Eksternal Kominfo"
                  value={createForm.name}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  autoFocus
                />
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {presetSuggestions.map((preset, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => setCreateForm((prev) => ({ ...prev, name: preset }))}
                      className="cursor-pointer text-[10px] px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-blue-300 border border-slate-800 transition"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider font-mono">
                  Hak Akses
                </label>
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800 flex items-center justify-between text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={15} className="text-emerald-400" />
                    <span>Read-Only GET (Akses Baca Data)</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold">LOCKED</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider font-mono">
                  Masa Berlaku
                </label>
                <select
                  value={createForm.expires_in_days}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      expires_in_days: e.target.value,
                    }))
                  }
                  className="cursor-pointer w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                >
                  <option value="0">Permanen (Tanpa Kedaluwarsa)</option>
                  <option value="30">30 Hari</option>
                  <option value="90">90 Hari</option>
                  <option value="180">180 Hari</option>
                  <option value="365">365 Hari (1 Tahun)</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="cursor-pointer px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="cursor-pointer px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  {creating ? (
                    <>
                      <RefreshCw size={12} className="animate-spin" />
                      <span>Membuat...</span>
                    </>
                  ) : (
                    <span>Generate Kunci</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL NEW KEY GENERATED SUCCESS */}
      {newKeyData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="bg-slate-900 border border-blue-500/40 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-100">
                  API Key Berhasil Dibuat!
                </h3>
              </div>
              <button
                onClick={() => setNewKeyData(null)}
                className="cursor-pointer text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3.5">
              <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2">
                <AlertCircle size={15} className="shrink-0 mt-0.5 text-amber-400" />
                <div className="leading-relaxed">
                  <strong>PENTING:</strong> Simpan kunci API ini sekarang. Token rahasia ini <u>hanya ditampilkan satu kali</u> dan tidak dapat dilihat lagi setelah modal ditutup.
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  Secret API Key:
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-950 border border-slate-800 rounded p-2.5 font-mono text-xs text-emerald-400 break-all select-all font-bold">
                    {newKeyData.key}
                  </div>
                  <button
                    onClick={() => copyToClipboard(newKeyData.key, "key")}
                    className="cursor-pointer px-3.5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold text-xs flex items-center gap-1.5 shrink-0"
                  >
                    {copiedKey ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedKey ? "Tersalin!" : "Salin Key"}</span>
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  Contoh cURL:
                </label>
                <div className="bg-slate-950 border border-slate-800 rounded p-2 font-mono text-[11px] text-slate-300 relative custom-scrollbar overflow-x-auto">
                  <pre className="text-blue-300">{`curl -X GET "${currentOrigin}/api/nocr/overview" -H "X-API-Key: ${newKeyData.key}"`}</pre>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `curl -X GET "${currentOrigin}/api/nocr/overview" -H "X-API-Key: ${newKeyData.key}"`,
                        "curl"
                      )
                    }
                    className="cursor-pointer absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] flex items-center gap-1 border border-slate-700"
                  >
                    {copiedCurl ? <Check size={11} /> : <Copy size={11} />}
                    <span>{copiedCurl ? "Tersalin" : "Salin"}</span>
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setNewKeyData(null)}
                  className="cursor-pointer px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                >
                  Saya Sudah Menyimpan Kunci Ini
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
