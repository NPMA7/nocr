"use client";
import React, { useState, useEffect } from "react";
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
  Layers,
  Terminal,
  Activity,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Eye,
  Info,
  Lock,
  Send,
  Download,
  FileJson,
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
  const [docTab, setDocTab] = useState("overview");
  const [snippetTab, setSnippetTab] = useState("curl");

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
      setTimeout(() => setCopiedKey(false), 2500);
    } else if (id === "curl") {
      setCopiedCurl(true);
      setTimeout(() => setCopiedCurl(false), 2500);
    } else {
      setCopiedState((prev) => ({ ...prev, [id]: true }));
      setTimeout(() => {
        setCopiedState((prev) => ({ ...prev, [id]: false }));
      }, 2500);
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

  // Helper to dynamically generate and download Postman Collection JSON
  const handleDownloadPostmanCollection = () => {
    const postmanData = {
      info: {
        _postman_id: "a918f723-5e92-4927-b50a-3c582f34e6b1",
        name: "NOCR REST API",
        description: "Koleksi Postman resmi untuk integrasi REST API NOCR Network. Berisi endpoint monitoring kesehatan sistem dan data titik sebaran wilayah (Desa & OPD) lengkap dengan koordinat GIS.",
        schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
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
                description: "Kunci API Klien NOCR"
              },
              {
                key: "Accept",
                value: "application/json",
                type: "text"
              }
            ],
            url: {
              raw: "{{baseUrl}}/api/nocr/overview",
              host: ["{{baseUrl}}"],
              path: ["api", "nocr", "overview"]
            },
            description: "Mengembalikan ringkasan status kesehatan jaringan, persentase online Desa vs OPD, total user aktif, dan status insiden hari ini."
          },
          response: []
        },
        {
          name: "2. Data Wilayah - Semua Titik",
          request: {
            method: "GET",
            header: [
              {
                key: "X-API-Key",
                value: "{{apiKey}}",
                type: "text"
              },
              {
                key: "Accept",
                value: "application/json",
                type: "text"
              }
            ],
            url: {
              raw: "{{baseUrl}}/api/nocr/sites?status=all&type=all&page=1&limit=50",
              host: ["{{baseUrl}}"],
              path: ["api", "nocr", "sites"],
              query: [
                { key: "status", value: "all", description: "Filter status koneksi: all, online, offline" },
                { key: "type", value: "all", description: "Filter tipe wilayah: all, desa, opd" },
                { key: "page", value: "1", description: "Halaman data" },
                { key: "limit", value: "50", description: "Jumlah item per halaman (maks 500)" },
                { key: "search", value: "", disabled: true, description: "Pencarian nama titik / MAC / IP / alamat" }
              ]
            },
            description: "Mengembalikan daftar semua titik sebaran perangkat Desa dan OPD lengkap dengan koordinat latitude & longitude untuk peta GIS, status koneksi, dan kontak PIC lapangan."
          },
          response: []
        },
        {
          name: "3. Data Wilayah - Khusus Desa (L2TP)",
          request: {
            method: "GET",
            header: [
              {
                key: "X-API-Key",
                value: "{{apiKey}}",
                type: "text"
              },
              {
                key: "Accept",
                value: "application/json",
                type: "text"
              }
            ],
            url: {
              raw: "{{baseUrl}}/api/nocr/sites?status=all&type=desa&page=1&limit=50",
              host: ["{{baseUrl}}"],
              path: ["api", "nocr", "sites"],
              query: [
                { key: "status", value: "all", description: "Filter status: all, online, offline" },
                { key: "type", value: "desa", description: "Kategori khusus Desa" },
                { key: "page", value: "1" },
                { key: "limit", value: "50" }
              ]
            },
            description: "Mengembalikan daftar titik sebaran perangkat khusus Desa (koneksi L2TP)."
          },
          response: []
        },
        {
          name: "4. Data Wilayah - Khusus OPD (PPPoE)",
          request: {
            method: "GET",
            header: [
              {
                key: "X-API-Key",
                value: "{{apiKey}}",
                type: "text"
              },
              {
                key: "Accept",
                value: "application/json",
                type: "text"
              }
            ],
            url: {
              raw: "{{baseUrl}}/api/nocr/sites?status=all&type=opd&page=1&limit=50",
              host: ["{{baseUrl}}"],
              path: ["api", "nocr", "sites"],
              query: [
                { key: "status", value: "all", description: "Filter status: all, online, offline" },
                { key: "type", value: "opd", description: "Kategori khusus OPD" },
                { key: "page", value: "1" },
                { key: "limit", value: "50" }
              ]
            },
            description: "Mengembalikan daftar titik sebaran perangkat khusus OPD (koneksi PPPoE)."
          },
          response: []
        }
      ],
      variable: [
        {
          key: "baseUrl",
          value: typeof window !== "undefined" ? window.location.origin : "https://nocrnetwork.com",
          type: "string"
        },
        {
          key: "apiKey",
          value: "YOUR_API_KEY_HERE",
          type: "string"
        }
      ]
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

  // Helper to render Code integration snippet per endpoint
  const renderIntegrationSnippet = (endpointPath, sampleUrl, descriptionSnippet) => {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3.5 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <Terminal size={14} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                Contoh Pemanggilan & Kode Integrasi
              </h4>
              <p className="text-[10px] text-slate-400">
                Pilih format pengujian endpoint <code className="text-blue-300 font-mono">{endpointPath}</code>
              </p>
            </div>
          </div>

          {/* Snippet Selector */}
          <div className="flex p-1 bg-slate-950 border border-slate-800 rounded-lg overflow-x-auto">
            <button
              onClick={() => setSnippetTab("curl")}
              className={`cursor-pointer px-2.5 py-1 rounded-md text-[11px] font-semibold transition whitespace-nowrap ${
                snippetTab === "curl"
                  ? "bg-blue-600 text-white shadow-sm font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              cURL
            </button>
            <button
              onClick={() => setSnippetTab("javascript")}
              className={`cursor-pointer px-2.5 py-1 rounded-md text-[11px] font-semibold transition whitespace-nowrap ${
                snippetTab === "javascript"
                  ? "bg-amber-600 text-white shadow-sm font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              JavaScript
            </button>
            <button
              onClick={() => setSnippetTab("python")}
              className={`cursor-pointer px-2.5 py-1 rounded-md text-[11px] font-semibold transition whitespace-nowrap ${
                snippetTab === "python"
                  ? "bg-emerald-600 text-white shadow-sm font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Python
            </button>
            <button
              onClick={() => setSnippetTab("php")}
              className={`cursor-pointer px-2.5 py-1 rounded-md text-[11px] font-semibold transition whitespace-nowrap ${
                snippetTab === "php"
                  ? "bg-purple-600 text-white shadow-sm font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              PHP
            </button>
          </div>
        </div>

        {/* Tab 2: cURL */}
        {snippetTab === "curl" && (
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 relative">
            <pre className="text-blue-300 leading-relaxed">{`curl -X GET "${sampleUrl}" \\
  -H "X-API-Key: YOUR_API_KEY"`}</pre>
            <button
              onClick={() => copyToClipboard(`curl -X GET "${sampleUrl}" -H "X-API-Key: YOUR_API_KEY"`, `curl_${endpointPath}`)}
              className="cursor-pointer absolute top-2 right-2 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] flex items-center gap-1 border border-slate-800 transition"
            >
              {copiedState[`curl_${endpointPath}`] ? <Check size={11} /> : <Copy size={11} />}
              <span>{copiedState[`curl_${endpointPath}`] ? "Tersalin" : "Salin cURL"}</span>
            </button>
          </div>
        )}

        {/* Tab 3: JavaScript */}
        {snippetTab === "javascript" && (
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 relative">
            <pre className="text-amber-200 leading-relaxed">{`const API_KEY = "YOUR_API_KEY";

async function fetchData() {
  const response = await fetch("${sampleUrl}", {
    method: "GET",
    headers: {
      "X-API-Key": API_KEY,
      "Content-Type": "application/json"
    }
  });
  if (!response.ok) throw new Error(\`HTTP error! status: \${response.status}\`);
  const data = await response.json();
  console.log(data);
  return data;
}

fetchData();`}</pre>
            <button
              onClick={() => copyToClipboard(`const API_KEY = "YOUR_API_KEY";\n\nasync function fetchData() {\n  const response = await fetch("${sampleUrl}", {\n    method: "GET",\n    headers: {\n      "X-API-Key": API_KEY,\n      "Content-Type": "application/json"\n    }\n  });\n  if (!response.ok) throw new Error(\`HTTP error! status: \${response.status}\`);\n  const data = await response.json();\n  return data;\n}\nfetchData();`, `js_${endpointPath}`)}
              className="cursor-pointer absolute top-2 right-2 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] flex items-center gap-1 border border-slate-800 transition"
            >
              {copiedState[`js_${endpointPath}`] ? <Check size={11} /> : <Copy size={11} />}
              <span>{copiedState[`js_${endpointPath}`] ? "Tersalin" : "Salin JS"}</span>
            </button>
          </div>
        )}

        {/* Tab 4: Python */}
        {snippetTab === "python" && (
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 relative">
            <pre className="text-emerald-300 leading-relaxed">{`import requests

API_KEY = "YOUR_API_KEY"
headers = {
    "X-API-Key": API_KEY,
    "Accept": "application/json"
}

response = requests.get("${sampleUrl}", headers=headers)
if response.status_code == 200:
    data = response.json()
    print("Respon sukses:", data)
else:
    print(f"Error {response.status_code}: {response.text}")`}</pre>
            <button
              onClick={() => copyToClipboard(`import requests\n\nAPI_KEY = "YOUR_API_KEY"\nheaders = {"X-API-Key": API_KEY, "Accept": "application/json"}\nresponse = requests.get("${sampleUrl}", headers=headers)\nprint(response.json())`, `py_${endpointPath}`)}
              className="cursor-pointer absolute top-2 right-2 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] flex items-center gap-1 border border-slate-800 transition"
            >
              {copiedState[`py_${endpointPath}`] ? <Check size={11} /> : <Copy size={11} />}
              <span>{copiedState[`py_${endpointPath}`] ? "Tersalin" : "Salin Python"}</span>
            </button>
          </div>
        )}

        {/* Tab 5: PHP */}
        {snippetTab === "php" && (
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 relative">
            <pre className="text-purple-300 leading-relaxed">{`<?php
$apiKey = "YOUR_API_KEY";
$url = "${sampleUrl}";

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "X-API-Key: " . $apiKey,
    "Accept: application/json"
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode === 200) {
    $data = json_decode($response, true);
    print_r($data);
} else {
    echo "Gagal: " . $response;
}
?>`}</pre>
            <button
              onClick={() => copyToClipboard(`<?php\n$apiKey = "YOUR_API_KEY";\n$url = "${sampleUrl}";\n$ch = curl_init();\ncurl_setopt($ch, CURLOPT_URL, $url);\ncurl_setopt($ch, CURLOPT_RETURNTRANSFER, true);\ncurl_setopt($ch, CURLOPT_HTTPHEADER, ["X-API-Key: " . $apiKey, "Accept: application/json"]);\n$response = curl_exec($ch);\ncurl_close($ch);\nprint_r(json_decode($response, true));\n?>`, `php_${endpointPath}`)}
              className="cursor-pointer absolute top-2 right-2 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] flex items-center gap-1 border border-slate-800 transition"
            >
              {copiedState[`php_${endpointPath}`] ? <Check size={11} /> : <Copy size={11} />}
              <span>{copiedState[`php_${endpointPath}`] ? "Tersalin" : "Salin PHP"}</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 w-full">
      {/* Header Banner */}
      <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-5 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-sm shrink-0 mt-1">
              <Key size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg lg:text-xl font-bold text-slate-100">
                  Manajemen API Key & Akses Integrasi
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-wider">
                  REST JSON
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider font-mono flex items-center gap-1">
                  <Lock size={10} /> Read-Only (GET)
                </span>
              </div>
              <p className="text-xs lg:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Kelola kunci API terotentikasi untuk integrasi pihak ketiga,
                termasuk sinkronisasi data real-time ke{" "}
                <strong className="text-blue-300 font-semibold">
                  Dashboard Client / Eksternal
                </strong>
                , Sistem GIS, dan platform analitik melalui endpoint NOCR.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchKeys(true)}
              disabled={refreshing}
              className="cursor-pointer px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-2 transition shadow-sm"
              title="Refresh Data"
            >
              <RefreshCw
                size={14}
                className={refreshing ? "animate-spin text-blue-400" : ""}
              />
              <span>Segarkan</span>
            </button>

            {canCreate && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="cursor-pointer px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition transform active:scale-95"
              >
                <Plus size={15} />
                <span>Buat API Key Baru</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-slate-800 border border-slate-700/50 rounded-xl overflow-hidden shadow-lg">
        <div className="p-5 border-b border-slate-700/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-blue-400" />
            <h3 className="text-sm font-bold text-slate-200">
              Daftar Kunci API Terdaftar
            </h3>
            <span className="ml-2 px-2 py-0.5 text-[11px] font-bold rounded-full bg-slate-800 text-slate-400 border border-slate-700">
              {keys.length} Kunci
            </span>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 animate-pulse flex flex-col items-center gap-3">
            <RefreshCw size={24} className="animate-spin text-blue-400" />
            <span className="text-xs">Memuat daftar API Key...</span>
          </div>
        ) : keys.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-800/80 text-slate-500 flex items-center justify-center mx-auto mb-3">
              <Key size={20} />
            </div>
            <h4 className="text-sm font-bold text-slate-300">
              Belum Ada API Key
            </h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Belum ada kunci API yang dibuat. Klik tombol &quot;Buat API Key
              Baru&quot; untuk mengaktifkan akses integrasi data REST API.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900/60 text-slate-400 border-b border-slate-800/80">
                  <th className="py-3.5 px-4 font-semibold">Nama / Penggunaan</th>
                  <th className="py-3.5 px-4 font-semibold">Token Prefix</th>
                  <th className="py-3.5 px-4 font-semibold">Hak Akses (Role)</th>
                  <th className="py-3.5 px-4 font-semibold">Status</th>
                  <th className="py-3.5 px-4 font-semibold">Terakhir Digunakan</th>
                  <th className="py-3.5 px-4 font-semibold">Masa Berlaku</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {keys.map((k) => {
                  const isExpired =
                    k.expires_at && new Date(k.expires_at) < new Date();
                  return (
                    <tr
                      key={k.id}
                      className="hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-200">
                          {k.name}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          Dibuat oleh: {k.created_by} • {formatDate(k.created_at)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <code className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-blue-300">
                            {k.masked_key || k.key_prefix}
                          </code>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <Lock size={10} /> Read-Only (GET)
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {isExpired ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Clock size={11} /> Kedaluwarsa
                          </span>
                        ) : k.is_active ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 size={11} /> Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                            <XCircle size={11} /> Dinonaktifkan
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 font-mono text-[11px]">
                        {k.last_used_at ? formatDate(k.last_used_at) : "Belum pernah"}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                        {k.expires_at ? formatDate(k.expires_at) : "Selamanya (No Expiry)"}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {canUpdate && (
                            <button
                              onClick={() => handleToggleActive(k)}
                              disabled={actionLoadingId === k.id}
                              className={`cursor-pointer p-1.5 rounded-lg border transition ${
                                k.is_active
                                  ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-sm"
                                  : "bg-slate-900 hover:bg-slate-800 text-slate-500 hover:text-slate-300 border-slate-800"
                              }`}
                              title={
                                k.is_active
                                  ? "Status Aktif (Klik untuk nonaktifkan)"
                                  : "Status Nonaktif (Klik untuk aktifkan)"
                              }
                            >
                              <Power size={14} />
                            </button>
                          )}

                          {canDelete && (
                            <>
                              {deleteConfirmId === k.id ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleDelete(k.id)}
                                    disabled={actionLoadingId === k.id}
                                    className="cursor-pointer px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold"
                                  >
                                    Ya, Hapus
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirmId(null)}
                                    className="cursor-pointer px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px]"
                                  >
                                    Batal
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setDeleteConfirmId(k.id)}
                                  className="cursor-pointer p-1.5 rounded-lg bg-red-600/10 hover:bg-red-600/20 border border-red-500/30 text-red-400 transition"
                                  title="Hapus API Key"
                                >
                                  <Trash2 size={14} />
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

      {/* Integration Guide & Documentation */}
      <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-5 shadow-lg space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700/50 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Code2 size={20} className="text-blue-400" />
              Panduan Integrasi REST API NOCR (JSON Endpoints)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Dokumentasi endpoint dan cara autentikasi untuk developer dan sistem
              eksternal klien.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPostmanCollection}
              className="cursor-pointer px-3 py-1.5 rounded-xl bg-orange-600/10 hover:bg-orange-600/20 text-orange-400 border border-orange-500/30 text-xs font-bold flex items-center gap-1.5 transition shadow-sm active:scale-95"
              title="Unduh file format Postman Collection v2.1"
            >
              <Download size={13} />
              <span className="hidden sm:inline">Unduh</span> Postman Collection (.json)
            </button>

            {/* Tab Selector */}
            <div className="flex p-1 bg-slate-900/80 border border-slate-800 rounded-xl">
              <button
                onClick={() => setDocTab("overview")}
                className={`cursor-pointer px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  docTab === "overview"
                    ? "bg-blue-600 text-white shadow-sm font-bold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                1. Ringkasan Sistem (overview)
              </button>
              <button
                onClick={() => setDocTab("sites")}
                className={`cursor-pointer px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  docTab === "sites"
                    ? "bg-blue-600 text-white shadow-sm font-bold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                2. Data Wilayah (sites)
              </button>
            </div>
          </div>
        </div>

        {/* 1. Metode Pengiriman API Key */}
        <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-800/40 text-xs text-slate-300 space-y-2">
          <div className="font-bold text-blue-300 flex items-center gap-1.5">
            <Info size={14} /> Metode Pengiriman API Key
          </div>
          <p className="text-slate-400 leading-relaxed">
            API Key dapat dikirimkan melalui 3 cara pilihan sesuai kenyamanan
            integrasi klien:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
            <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
              <span className="text-blue-400 font-bold block">HTTP Header (Rekomendasi):</span>
              <code>X-API-Key: &lt;YOUR_API_KEY&gt;</code>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
              <span className="text-cyan-400 font-bold block">Bearer Header:</span>
              <code>Authorization: Bearer &lt;YOUR_API_KEY&gt;</code>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
              <span className="text-emerald-400 font-bold block">URL Query Parameter:</span>
              <code>?api_key=&lt;YOUR_API_KEY&gt;</code>
            </div>
          </div>
        </div>

        {/* Doc Content Tabs */}

        {docTab === "overview" && (
          <div className="space-y-4 pt-2 border-t border-slate-700/40">
            {/* A. Endpoint & Deskripsi */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono text-xs font-bold border border-emerald-500/20">
                  GET
                </span>
                <code className="text-xs font-mono text-slate-200 bg-slate-900 px-3 py-1 rounded-lg border border-slate-800">
                  /api/nocr/overview
                </code>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Mengembalikan ringkasan status kesehatan jaringan, persentase online
                Desa vs OPD, total user aktif, dan status insiden hari ini.
              </p>
            </div>

            {/* B. Contoh Pemanggilan di Postman & Kode Integrasi */}
            {renderIntegrationSnippet(
              "/api/nocr/overview",
              "https://nocrnetwork.com/api/nocr/overview"
            )}

            {/* C. Contoh Respon JSON */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-300">
                Contoh Respon JSON (HTTP 200 OK):
              </h4>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto">
                <pre>{`// Contoh Respon JSON GET /api/nocr/overview:
{
  "success": true,
  "status": "HEALTHY",
  "health_score": "93.66%",
  "timestamp": "2026-08-29T12:36:43.238Z",
  "server_time": "29/8/2026, 19.36.43",
  "summary": {
    "total_sites": 410,
    "online_sites": 384,
    "offline_sites": 26,
    "online_percentage": 93.66,
    "desa": {
      "total": 280,
      "online": 260,
      "offline": 20,
      "percentage": 92.86
    },
    "opd": {
      "total": 130,
      "online": 124,
      "offline": 6,
      "percentage": 95.38
    }
  }
}`}</pre>
              </div>
            </div>
          </div>
        )}

        {docTab === "sites" && (
          <div className="space-y-4 pt-2 border-t border-slate-700/40">
            {/* A. Endpoint & Deskripsi */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono text-xs font-bold border border-emerald-500/20">
                  GET
                </span>
                <code className="text-xs font-mono text-slate-200 bg-slate-900 px-3 py-1 rounded-lg border border-slate-800">
                  /api/nocr/sites?status=all&type=desa&page=1&limit=50
                </code>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Mengembalikan daftar titik sebaran perangkat lengkap dengan
                koordinat latitude/longitude untuk peta GIS, status koneksi, dan
                kontak PIC lapangan.
              </p>
            </div>

            {/* B. Contoh Pemanggilan di Postman & Kode Integrasi */}
            {renderIntegrationSnippet(
              "/api/nocr/sites",
              "https://nocrnetwork.com/api/nocr/sites?status=all&type=desa&page=1&limit=50"
            )}

            {/* C. Contoh Respon JSON */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-300">
                Contoh Respon JSON (HTTP 200 OK):
              </h4>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto">
                <pre>{`// Contoh Respon JSON GET /api/nocr/sites:
{
  "success": true,
  "meta": {
    "total": 280,
    "online_count": 260,
    "offline_count": 20,
    "page": 1,
    "limit": 50,
    "total_pages": 6
  },
  "data": [
    {
      "id": "e6a2...",
      "name": "KANTOR DESA CIWIDEY",
      "category": "DESA",
      "connection_type": "L2TP",
      "ruijie_mac": "00:74:9c:aa:bb:cc",
      "status": "online",
      "ip_address": "10.10.20.15",
      "clients_connected": 18,
      "latitude": -7.08912,
      "longitude": 107.45231,
      "address": "Jl. Raya Ciwidey No. 12",
      "last_online": "2026-08-10 15:28:22",
      "vendor": "INDIBIZ",
      "pic": { "name": "Asep Suherman", "phone": "08123456789" }
    }
  ]
}`}</pre>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: CREATE API KEY */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Key size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">
                    Buat Kunci API Baru
                  </h3>
                  <p className="text-xs text-slate-400">
                    Kredensial akses data REST API NOCR
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="cursor-pointer p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {createError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle size={16} />
                  <span>{createError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 tracking-wider uppercase">
                  Nama Klien / Sistem <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Client External Dashboard API"
                  value={createForm.name}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 tracking-wider uppercase">
                  Tingkat Hak Akses
                </label>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span className="text-xs font-semibold text-slate-200">
                      Read-Only (Akses Baca Data)
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20 font-mono flex items-center gap-1">
                    <Lock size={10} /> GET ONLY
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Seluruh API Key yang dibuat secara mutlak bersifat{" "}
                  <strong>Read-Only</strong> (hanya dapat membaca data via HTTP GET) dan tidak dapat memodifikasi atau menghapus data sistem.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 tracking-wider uppercase">
                  Masa Berlaku Kunci
                </label>
                <select
                  value={createForm.expires_in_days}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      expires_in_days: e.target.value,
                    }))
                  }
                  className="cursor-pointer w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500 transition"
                >
                  <option value="0">Selamanya (Tidak Ada Kedaluwarsa)</option>
                  <option value="30">30 Hari</option>
                  <option value="90">90 Hari</option>
                  <option value="180">180 Hari (6 Bulan)</option>
                  <option value="365">365 Hari (1 Tahun)</option>
                </select>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="cursor-pointer px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="cursor-pointer px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition flex items-center gap-2"
                >
                  {creating ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Membuat...</span>
                    </>
                  ) : (
                    <span>Generate API Key</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NEW KEY GENERATED SUCCESS */}
      {newKeyData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#0f172a] border border-blue-500/40 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden relative">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">
                    API Key Berhasil Dibuat!
                  </h3>
                  <p className="text-xs text-slate-400">{newKeyData.name}</p>
                </div>
              </div>
              <button
                onClick={() => setNewKeyData(null)}
                className="cursor-pointer p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Warning Alert */}
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>PENTING:</strong> Simpan kunci API ini di tempat aman.
                  Demi alasan keamanan, kunci rahasia ini <u>hanya akan ditampilkan
                  satu kali ini</u> dan tidak dapat dilihat kembali setelah modal
                  ditutup.
                </div>
              </div>

              {/* The Key Box */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Secret API Key:
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-emerald-400 break-all select-all">
                    {newKeyData.key}
                  </div>
                  <button
                    onClick={() => copyToClipboard(newKeyData.key, "key")}
                    className="cursor-pointer px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-xs flex items-center gap-2 shadow-lg shadow-blue-500/20 transition shrink-0"
                  >
                    {copiedKey ? <Check size={16} /> : <Copy size={16} />}
                    <span>{copiedKey ? "Tersalin!" : "Salin Key"}</span>
                  </button>
                </div>
              </div>

              {/* cURL Example */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Contoh Pemanggilan cURL:
                </label>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-[11px] text-slate-300 overflow-x-auto relative">
                  <pre className="text-blue-300">
                    {`curl -H "X-API-Key: ${newKeyData.key}" \\
  https://nocrnetwork.com/api/nocr/overview`}
                  </pre>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `curl -H "X-API-Key: ${newKeyData.key}" https://nocrnetwork.com/api/nocr/overview`,
                        "curl"
                      )
                    }
                    className="cursor-pointer absolute top-2 right-2 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] flex items-center gap-1 border border-slate-700"
                  >
                    {copiedCurl ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedCurl ? "Tersalin" : "Salin cURL"}</span>
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end">
                <button
                  onClick={() => setNewKeyData(null)}
                  className="cursor-pointer px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition"
                >
                  Saya Sudah Menyimpan API Key Ini
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
