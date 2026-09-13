"use client";
import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import {
  RefreshCw,
  RotateCcw,
  Settings,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  Zap,
  Server,
  Eye,
  EyeOff,
  Edit2,
  X,
  Power,
  Wifi,
  CheckCircle2,
  AlertCircle,
  Activity,
  Layers,
  SlidersHorizontal,
  ArrowUpDown,
  Filter,
} from "lucide-react";
import { socket, useAppState } from "@/App";
import { getStoredUser, hasAccess } from "@/lib/roles";
import OntDetailModal from "@/components/OntDetailModal";
import OntDetailView from "@/components/OntDetailView";
import RebootOntConfirmModal from "@/components/device/hsgq/RebootOntConfirmModal";
import { useToast } from "@/hooks/useToast";

export default function HsgqOltPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("Authenticate List");
  const [totalOntCount, setTotalOntCount] = useState(163);
  const [totalWlanCount, setTotalWlanCount] = useState(76);
  const [displayType, setDisplayType] = useState("All");
  const [displayValue, setDisplayValue] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [selectedOnt, setSelectedOnt] = useState(null);
  const [detailSelectedPortId, setDetailSelectedPortId] = useState("");
  const [detailSelectedOntId, setDetailSelectedOntId] = useState("");
  const [selectedPort, setSelectedPort] = useState("All");
  const [editingOnt, setEditingOnt] = useState(null);
  const [editOntName, setEditOntName] = useState("");
  const [editOntDesc, setEditOntDesc] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [rebootTimestamp, setRebootTimestamp] = useState(0);
  const [editTimestamp, setEditTimestamp] = useState(0);
  const [showRebootOntConfirm, setShowRebootOntConfirm] = useState(false);
  const [rebootOntAction, setRebootOntAction] = useState(null); // { portId, ontId }

  const [editingWifi, setEditingWifi] = useState(null);
  const [wifiSsid, setWifiSsid] = useState("");
  const [wifiEnable, setWifiEnable] = useState(1);
  const [wifiSecurityMode, setWifiSecurityMode] = useState(4);
  const [wifiWepAuth, setWifiWepAuth] = useState(0);
  const [wifiWpaEncrypt, setWifiWpaEncrypt] = useState(2);
  const [wifiShareKey, setWifiShareKey] = useState("");
  const [wifiChannel, setWifiChannel] = useState(0);
  const [wifiBandwidth, setWifiBandwidth] = useState(1);
  const [wifiBeacon, setWifiBeacon] = useState(100);
  const [wifiDtim, setWifiDtim] = useState(1);
  const [wifiShortgi, setWifiShortgi] = useState(1);
  const [wifiIsolation, setWifiIsolation] = useState(0);
  const [wifiBroadcast, setWifiBroadcast] = useState(1);
  const [isSavingWifi, setIsSavingWifi] = useState(false);
  const { showToast, ToastComponent } = useToast();

  const { sessionUser, setLastSyncTime } = useAppState();
  const [userData, setUserData] = useState(() => getStoredUser());

  useEffect(() => {
    if (sessionUser?.username) setUserData(sessionUser);
  }, [sessionUser]);

  const tabSlugs = {
    "Authenticate List": "authenticate",
    WLAN: "wlan",
    "ONT Detail": "detail",
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (tabParam) {
        const matched = Object.keys(tabSlugs).find(
          (t) => tabSlugs[t].toLowerCase() === tabParam.toLowerCase(),
        );
        if (matched) setActiveTab(matched);
      }
    }
  }, []);

  const canManageOlt = hasAccess(userData, "devices-hsgq", "update");
  const canRead = hasAccess(userData, "devices-hsgq", "read");

  // Real-time WebSocket listener for immediate sync across all users
  useEffect(() => {
    if (!socket) return;

    const handleOltUpdate = (payload) => {
      if (!payload || !payload.data) return;
      const isRelevant =
        (activeTab === "Authenticate List" &&
          (payload.type === "Authenticate List" ||
            payload.endpoint === "/ontinfo_table")) ||
        (activeTab === "WLAN" &&
          (payload.type === "WLAN" ||
            payload.endpoint === "/ontwificonfig_table"));

      if (isRelevant) {
        let tableData = payload.data;
        if (
          !Array.isArray(tableData) &&
          tableData.data &&
          Array.isArray(tableData.data)
        ) {
          tableData = tableData.data;
        } else if (!Array.isArray(tableData)) {
          return;
        }
        setData(tableData);
        if (payload.type === "Authenticate List" || payload.endpoint === "/ontinfo_table") {
          setTotalOntCount(tableData.length);
        } else if (payload.type === "WLAN") {
          setTotalWlanCount(tableData.length);
        }
        setLoading(false);
        if (setLastSyncTime) {
          setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
        }
      }
    };

    const handleWifiUpdate = (payload) => {
      if (activeTab !== "WLAN") return;
      setData((prevData) =>
        prevData.map((row) => {
          if (row.identifier === payload.identifier) {
            const currentWifi = row.wifi && row.wifi[0] ? row.wifi[0] : {};
            if (currentWifi.instance === payload.instance) {
              return {
                ...row,
                wifi: [{ ...currentWifi, [payload.field]: payload.value }],
              };
            }
          }
          return row;
        }),
      );
    };

    socket.on("hsgq_olt_update", handleOltUpdate);
    socket.on("hsgq_wifi_update", handleWifiUpdate);
    return () => {
      socket.off("hsgq_olt_update", handleOltUpdate);
      socket.off("hsgq_wifi_update", handleWifiUpdate);
    };
  }, [activeTab, socket, setLastSyncTime]);

  const fetchData = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      setError(null);

      const response = await axios.get(
        `/api/hsgq-olt?type=${activeTab}&_t=${Date.now()}`,
      );

      let tableData = response.data;
      if (
        !Array.isArray(tableData) &&
        tableData.data &&
        Array.isArray(tableData.data)
      ) {
        tableData = tableData.data;
      } else if (!Array.isArray(tableData)) {
        console.warn("Unrecognized data format:", tableData);
        tableData = [];
      }

      setData(tableData);
      if (activeTab === "Authenticate List") {
        setTotalOntCount(tableData.length);
      } else if (activeTab === "WLAN") {
        setTotalWlanCount(tableData.length);
      }
      if (setLastSyncTime) {
        setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
      }
    } catch (err) {
      console.error(err);
      setError("Gagal memuat data OLT. Periksa koneksi ke perangkat.");
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const handleWifiToggle = async (row, field, currentValue) => {
    if (!canManageOlt) return;

    try {
      const wifi = row.wifi && row.wifi[0];
      if (!wifi) return;

      const newValue = currentValue === 1 ? 0 : 1;
      const flagsMap = {
        enable: 2048,
        isolation: 1024,
        broadcast: 2048,
      };
      const flags = flagsMap[field] ?? 2048;
      const param = {
        identifier: row.identifier,
        flags: flags,
        ...wifi,
        [field]: newValue,
      };

      const payload = {
        method: "set",
        param: param,
      };

      setData((prevData) =>
        prevData.map((r) => {
          if (r.identifier === row.identifier) {
            return { ...r, wifi: [{ ...wifi, [field]: newValue }] };
          }
          return r;
        }),
      );

      await axios.post("/api/hsgq-olt?action=set_wifi", payload);
    } catch (err) {
      showToast("Gagal update WiFi: " + (err.response?.data?.error || err.message));
      fetchData();
    }
  };

  const handleOpenWifiModal = (row) => {
    if (!canManageOlt) return;
    const wifi = row.wifi && row.wifi[0] ? row.wifi[0] : {};
    setEditingWifi({
      row,
      identifier: row.identifier,
      instance: wifi.instance || 1,
      enable: wifi.enable !== undefined ? wifi.enable : 1,
    });
    setWifiSsid(wifi.wifiname || "");
    setWifiEnable(wifi.enable !== undefined ? wifi.enable : 1);
    setWifiSecurityMode(wifi.securitymode !== undefined ? wifi.securitymode : 4);
    setWifiWepAuth(wifi.wepauth !== undefined ? wifi.wepauth : 0);
    setWifiWpaEncrypt(wifi.wpaencrypt !== undefined ? wifi.wpaencrypt : 2);
    setWifiShareKey(wifi.sharekey || "");
    setWifiChannel(wifi.channel !== undefined ? wifi.channel : 0);
    setWifiBandwidth(wifi.bandwidth !== undefined ? wifi.bandwidth : 1);
    setWifiBeacon(wifi.beacon !== undefined ? wifi.beacon : 100);
    setWifiDtim(wifi.dtim !== undefined ? wifi.dtim : 1);
    setWifiShortgi(wifi.shortgi !== undefined ? wifi.shortgi : 1);
    setWifiIsolation(wifi.isolation !== undefined ? wifi.isolation : 0);
    setWifiBroadcast(wifi.broadcast !== undefined ? wifi.broadcast : 1);
  };

  const handleSaveWifi = async () => {
    if (!canManageOlt || !editingWifi) return;

    if (Number(wifiEnable) === 1 && !wifiSsid.trim()) {
      showToast("SSID tidak boleh kosong jika WiFi aktif");
      return;
    }

    setIsSavingWifi(true);
    try {
      const param = {
        identifier: editingWifi.identifier,
        flags: 4095,
        instance: editingWifi.instance,
        enable: Number(wifiEnable),
        wifiname: wifiSsid.trim(),
        securitymode: Number(wifiSecurityMode),
        wepauth: Number(wifiWepAuth),
        wpaencrypt: Number(wifiWpaEncrypt),
        sharekey: wifiShareKey,
        channel: Number(wifiChannel),
        bandwidth: Number(wifiBandwidth),
        beacon: Number(wifiBeacon),
        dtim: Number(wifiDtim),
        shortgi: Number(wifiShortgi),
        isolation: Number(wifiIsolation),
        broadcast: Number(wifiBroadcast),
      };

      const payload = {
        method: "set",
        param: param,
      };

      const response = await axios.post(
        "/api/hsgq-olt?action=set_wifi",
        payload,
      );
      if (response.data && response.data.code === 1) {
        showToast("Pengaturan WiFi berhasil disimpan!");
        setEditingWifi(null);
        fetchData();
      } else {
        showToast(
          "Gagal menyimpan WiFi: " +
            (response.data?.message || "Error tidak diketahui"),
        );
      }
    } catch (err) {
      console.error(err);
      showToast("Gagal menyimpan WiFi: " + (err.response?.data?.error || err.message));
    } finally {
      setIsSavingWifi(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!canManageOlt || !editingOnt) return;

    setIsSavingEdit(true);
    try {
      const identifier = (editingOnt.portId << 8) | editingOnt.ontId;
      const flags = 3; // Bit 0 (Name) + Bit 1 (Description)
      const payload = {
        method: "set",
        param: {
          identifier: identifier,
          flags: flags,
          ont_name: editOntName.trim(),
          ont_description: editOntDesc.trim(),
        },
      };

      const response = await axios.post(
        "/api/hsgq-olt?action=set_info",
        payload,
      );

      if (response.data && response.data.code === 1) {
        showToast("Nama dan deskripsi ONT berhasil disimpan!");
        setEditTimestamp(Date.now());
        setEditingOnt(null);
        fetchData(true);
      } else {
        showToast(
          "Gagal menyimpan: " +
            (response.data?.message || "Error tidak diketahui"),
        );
      }
    } catch (err) {
      console.error(err);
      showToast("Gagal menyimpan: " + (err.response?.data?.error || err.message));
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleViewDetail = () => {
    if (!editingOnt) return;
    setActiveTab("ONT Detail");
    setDetailSelectedPortId(editingOnt.portId.toString());
    setDetailSelectedOntId(editingOnt.ontId.toString());
    setEditingOnt(null);

    if (typeof window !== "undefined") {
      const url = new URL(window.location);
      url.search = `?tab=detail`;
      window.history.pushState({}, "", url);
    }
  };

  useEffect(() => {
    if (canRead) {
      fetchData();
      const interval = setInterval(() => {
        fetchData(true);
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [activeTab, canRead]);

  // Parse ports and ONTs dynamically for filtering and detail tabs
  const portSet = new Set();
  const portMap = {};

  data.forEach((row, idx) => {
    const isArray = Array.isArray(row);
    const rawName = row.ont_name || row.name || (isArray ? row[1] : "");
    let parsedPortId = 1;
    let parsedOntId = 0;

    if (rawName && rawName.includes("/")) {
      const parts = rawName.split("/");
      parsedPortId = parseInt(
        parts[0].replace("ONT", "").replace("PON", ""),
        10,
      );
      parsedOntId = parseInt(parts[1], 10);
    } else if (row.identifier !== undefined) {
      parsedPortId = (row.identifier >> 8) & 255;
      parsedOntId = row.identifier & 255;
    } else {
      const ontId = isArray
        ? row[0]
        : row.ont_id || row.id || `PON0${Math.floor(idx / 10)}/${idx % 10}`;
      const idParts = String(ontId).match(/PON0?(\d+)\/(\d+)/i);
      if (idParts) {
        parsedPortId = parseInt(idParts[1], 10);
        parsedOntId = parseInt(idParts[2], 10);
      }
    }

    if (!isNaN(parsedPortId) && !isNaN(parsedOntId)) {
      portSet.add(parsedPortId);
      if (!portMap[parsedPortId]) portMap[parsedPortId] = [];
      portMap[parsedPortId].push({
        ontId: parsedOntId,
        name: rawName || `ONT0${parsedPortId}/00${parsedOntId}`,
      });
    }
  });

  const uniquePorts = Array.from(portSet).sort((a, b) => a - b);

  // Filter by Selected Port
  const filteredByPortData = data.filter((row, idx) => {
    if (selectedPort === "All") return true;

    const isArray = Array.isArray(row);
    const rawName = row.ont_name || row.name || (isArray ? row[1] : "");
    let parsedPortId = 1;

    if (rawName && rawName.includes("/")) {
      const parts = rawName.split("/");
      parsedPortId = parseInt(
        parts[0].replace("ONT", "").replace("PON", ""),
        10,
      );
    } else if (row.identifier !== undefined) {
      parsedPortId = (row.identifier >> 8) & 255;
    } else {
      const ontId = isArray
        ? row[0]
        : row.ont_id || row.id || `PON0${Math.floor(idx / 10)}/${idx % 10}`;
      const idParts = String(ontId).match(/PON0?(\d+)\/(\d+)/i);
      if (idParts) {
        parsedPortId = parseInt(idParts[1], 10);
      }
    }

    return String(parsedPortId) === selectedPort;
  });

  // Calculate stats dynamically from port-filtered data
  const stats = {
    registered: filteredByPortData.filter((item) => {
      const isArray = Array.isArray(item);
      const stateVal = isArray ? item[3] : item.state;
      return stateVal === 1;
    }).length,
    unregistered: filteredByPortData.filter((item) => {
      const isArray = Array.isArray(item);
      const stateVal = isArray ? item[3] : item.state;
      return stateVal === 0;
    }).length,
    online: filteredByPortData.filter((item) => {
      const isArray = Array.isArray(item);
      const stateVal = isArray ? item[3] : item.state;
      const rstateVal = isArray ? item[4] : item.rstate;
      return stateVal === 1 && rstateVal === 1;
    }).length,
    offline: filteredByPortData.filter((item) => {
      const isArray = Array.isArray(item);
      const stateVal = isArray ? item[3] : item.state;
      const rstateVal = isArray ? item[4] : item.rstate;
      return stateVal === 1 && rstateVal !== 1;
    }).length,
  };

  const wlanStats = {
    total: filteredByPortData.length,
    enabled: filteredByPortData.filter((item) => {
      const wifi = item.wifi && item.wifi[0];
      return wifi?.enable === 1;
    }).length,
    disabled: filteredByPortData.filter((item) => {
      const wifi = item.wifi && item.wifi[0];
      return !wifi || wifi.enable !== 1;
    }).length,
    broadcast: filteredByPortData.filter((item) => {
      const wifi = item.wifi && item.wifi[0];
      return wifi?.broadcast === 1;
    }).length,
  };

  const filteredData = filteredByPortData.filter((row, idx) => {
    if (displayType === "All" || !displayValue) {
      // Global search if query method is All but displayValue is present
      if (!displayValue) return true;
      const q = displayValue.toLowerCase();
      const isArray = Array.isArray(row);
      const rawName = String(row.ont_name || row.name || (isArray ? row[1] : "")).toLowerCase();
      const sn = String(row.ont_sn || row.sn || row.serial_number || (isArray ? row[2] : "")).toLowerCase();
      const wifi = row.wifi && row.wifi[0];
      const ssid = String(wifi?.wifiname || "").toLowerCase();
      return rawName.includes(q) || sn.includes(q) || ssid.includes(q);
    }

    const isArray = Array.isArray(row);
    let fieldVal = "";

    if (displayType === "ONT ID") {
      const rawName = row.ont_name || row.name || "";
      let genId = "";
      if (rawName && rawName.includes("/")) {
        const parts = rawName.split("/");
        genId = `${parts[0].replace("ONT", "PON")}/${parseInt(parts[1], 10)}`;
      } else if (row.identifier !== undefined) {
        genId = `PON0${(row.identifier >> 8) & 255}/${row.identifier & 255}`;
      } else {
        genId = `PON0${Math.floor(idx / 10)}/${idx % 10}`;
      }
      fieldVal = String(isArray ? row[0] : row.ont_id || row.id || genId);
    } else if (displayType === "Name") {
      fieldVal = String(
        isArray ? row[1] : row.ont_name || row.name || `ONT01/00${idx}`,
      );
    } else if (displayType === "Serial Number") {
      fieldVal = String(
        isArray ? row[2] : row.ont_sn || row.sn || row.serial_number || "-",
      );
    } else if (displayType === "Device Type") {
      fieldVal = String(isArray ? row[6] : row.dev_type || row.device_type || "");
    } else if (displayType === "SSID") {
      const wifi = row.wifi && row.wifi[0];
      fieldVal = String(isArray ? "" : wifi?.wifiname || "");
    } else if (displayType === "Running state") {
      const rstateVal = isArray ? row[4] : row.rstate;
      const stateVal = isArray ? row[3] : row.state;
      if (displayValue.toLowerCase() === "offline") {
        return stateVal === 1 && rstateVal !== 1;
      }
      if (displayValue.toLowerCase() === "online") {
        return stateVal === 1 && rstateVal === 1;
      }
      if (displayValue.toLowerCase() === "initial") {
        return stateVal === 0;
      }
      fieldVal =
        stateVal === 1
          ? rstateVal === 1
            ? "online"
            : "offline"
          : "initial";
      return fieldVal.toLowerCase() === displayValue.toLowerCase();
    }
    return fieldVal.toLowerCase().includes(displayValue.toLowerCase());
  });

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentData = filteredData.slice(startIndex, startIndex + itemsPerPage);

  // For ONT Detail tab dropdowns
  let ontsInPort = [];

  if (activeTab === "ONT Detail") {
    let tempPortId = detailSelectedPortId;
    if (!tempPortId && uniquePorts.length > 0) {
      tempPortId = uniquePorts[0].toString();
    }

    if (tempPortId) {
      ontsInPort = portMap[parseInt(tempPortId, 10)] || [];
      ontsInPort.sort((a, b) => a.ontId - b.ontId);
    }
  }

  const activeDetailPortId =
    detailSelectedPortId ||
    (uniquePorts.length > 0 ? uniquePorts[0].toString() : "");
  const activeDetailOntId =
    detailSelectedOntId ||
    (ontsInPort.length > 0 ? ontsInPort[0].ontId.toString() : "");

  return (
    <>
      <div className="flex-1 flex flex-col gap-4 min-w-0 pb-8">
        {ToastComponent}

        {/* 1. TOP HEADER BAR */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 sm:px-5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
              <Server size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-100">HSGQ OLT</h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">
                  GPON / EPON
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Monitoring & Konfigurasi perangkat OLT HSGQ secara langsung
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                fetchData();
                if (socket) socket.emit("force_sync_hsgq");
              }}
              disabled={loading}
              className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition disabled:opacity-50 shadow-sm"
            >
              <RefreshCw
                size={13}
                className={loading ? "animate-spin text-white" : "text-white"}
              />
              <span>{loading ? "Sinkron..." : "Refresh"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setDisplayType("All");
                setDisplayValue("");
                setSelectedPort("All");
                setCurrentPage(1);
              }}
              className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              title="Reset semua filter pencarian"
            >
              <RotateCcw size={13} />
              <span>Reset Filter</span>
            </button>
          </div>
        </div>

        {/* 2. KPI METRICS CARDS */}
        {activeTab === "Authenticate List" ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Total Registered */}
            <div
              onClick={() => {
                setDisplayType("All");
                setDisplayValue("");
                setCurrentPage(1);
              }}
              className={`cursor-pointer bg-slate-900 border rounded-xl p-3 sm:p-4 transition hover:border-slate-700 ${
                displayType === "All" && !displayValue
                  ? "border-blue-500/40 ring-1 ring-blue-500/20"
                  : "border-slate-800"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">
                  Registered ONT
                </span>
                <CheckCircle2 size={15} className="text-blue-400" />
              </div>
              <div className="text-xl font-bold font-mono text-slate-100 mt-1">
                {stats.registered}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Total unit terdaftar di port
              </p>
            </div>

            {/* Online */}
            <div
              onClick={() => {
                setDisplayType("Running state");
                setDisplayValue("online");
                setCurrentPage(1);
              }}
              className={`cursor-pointer bg-slate-900 border rounded-xl p-3 sm:p-4 transition hover:border-slate-700 ${
                displayType === "Running state" && displayValue === "online"
                  ? "border-emerald-500/40 ring-1 ring-emerald-500/20"
                  : "border-slate-800"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">
                  Online
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
                {stats.online}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Aktif & mentransmisikan optik
              </p>
            </div>

            {/* Offline */}
            <div
              onClick={() => {
                setDisplayType("Running state");
                setDisplayValue("offline");
                setCurrentPage(1);
              }}
              className={`cursor-pointer bg-slate-900 border rounded-xl p-3 sm:p-4 transition hover:border-slate-700 ${
                displayType === "Running state" && displayValue === "offline"
                  ? "border-rose-500/40 ring-1 ring-rose-500/20"
                  : "border-slate-800"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">
                  Offline
                </span>
                <span className="w-2 h-2 rounded-full bg-rose-400" />
              </div>
              <div className="text-xl font-bold font-mono text-rose-400 mt-1">
                {stats.offline}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Terdaftar namun terputus
              </p>
            </div>

            {/* Unregistered / Initial */}
            <div
              onClick={() => {
                setDisplayType("Running state");
                setDisplayValue("initial");
                setCurrentPage(1);
              }}
              className={`cursor-pointer bg-slate-900 border rounded-xl p-3 sm:p-4 transition hover:border-slate-700 ${
                displayType === "Running state" && displayValue === "initial"
                  ? "border-amber-500/40 ring-1 ring-amber-500/20"
                  : "border-slate-800"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">
                  Initial / Unregistered
                </span>
                <AlertCircle size={15} className="text-amber-400" />
              </div>
              <div className="text-xl font-bold font-mono text-amber-400 mt-1">
                {stats.unregistered}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Menunggu aktivasi / konfigurasi
              </p>
            </div>
          </div>
        ) : activeTab === "WLAN" ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Total WLAN */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">
                  Total ONT WLAN
                </span>
                <Wifi size={15} className="text-blue-400" />
              </div>
              <div className="text-xl font-bold font-mono text-slate-100 mt-1">
                {wlanStats.total}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Perangkat ONT berfitur WiFi
              </p>
            </div>

            {/* WiFi Enabled */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">
                  WiFi Enabled
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
                {wlanStats.enabled}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Radio WiFi aktif memancar
              </p>
            </div>

            {/* WiFi Disabled */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">
                  WiFi Disabled
                </span>
                <span className="w-2 h-2 rounded-full bg-slate-500" />
              </div>
              <div className="text-xl font-bold font-mono text-slate-400 mt-1">
                {wlanStats.disabled}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Radio WiFi dinonaktifkan
              </p>
            </div>

            {/* SSID Broadcast */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">
                  SSID Broadcast
                </span>
                <Activity size={15} className="text-blue-400" />
              </div>
              <div className="text-xl font-bold font-mono text-blue-400 mt-1">
                {wlanStats.broadcast}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Nama SSID terlihat publik
              </p>
            </div>
          </div>
        ) : null}

        {/* 3. MODERN TAB NAVIGATION DOCK */}
        <div className="grid grid-cols-3 gap-1 sm:gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl shadow-sm w-full">
          {[
            {
              id: "Authenticate List",
              labelFull: "Authenticate List",
              labelShort: "Auth List",
              icon: Layers,
              count:
                selectedPort === "All"
                  ? totalOntCount
                  : activeTab === "Authenticate List"
                    ? filteredByPortData.length
                    : totalOntCount,
            },
            {
              id: "WLAN",
              labelFull: "WLAN (WiFi Config)",
              labelShort: "WLAN",
              icon: Wifi,
              count:
                selectedPort === "All"
                  ? totalWlanCount
                  : activeTab === "WLAN"
                    ? filteredByPortData.length
                    : totalWlanCount,
            },
            {
              id: "ONT Detail",
              labelFull: "ONT Detail",
              labelShort: "Detail",
              icon: Activity,
              count: null,
            },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setError(null);
                  setDisplayType("All");
                  setDisplayValue("");
                  setSelectedPort("All");
                  setCurrentPage(1);

                  if (typeof window !== "undefined") {
                    const url = new URL(window.location);
                    url.search = `?tab=${encodeURIComponent(tabSlugs[item.id])}`;
                    window.history.pushState({}, "", url);
                  }
                }}
                className={`cursor-pointer w-full h-10 sm:h-11 flex items-center justify-center gap-1 sm:gap-2 px-1 sm:px-3 rounded-lg text-xs font-semibold transition ${
                  isActive
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                <Icon size={14} className={`shrink-0 ${isActive ? "text-white" : "text-slate-400"}`} />
                <span className="truncate whitespace-nowrap">
                  <span className="hidden md:inline">{item.labelFull}</span>
                  <span className="md:hidden">{item.labelShort}</span>
                </span>
                {item.count !== null && (
                  <span
                    className={`shrink-0 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md leading-none ${
                      isActive
                        ? "bg-blue-700/80 text-white"
                        : "bg-slate-800 text-slate-400 border border-slate-700"
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 4. TAB CONTENT */}
        {activeTab === "ONT Detail" ? (
          <div className="flex flex-col gap-4">
            {/* Detail Control Toolbar */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-xs font-medium">Port ID:</span>
                  <select
                    className="cursor-pointer bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-8 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono min-w-[120px]"
                    value={activeDetailPortId}
                    onChange={(e) => {
                      setDetailSelectedPortId(e.target.value);
                      setDetailSelectedOntId("");
                    }}
                  >
                    {uniquePorts.map((p) => (
                      <option key={p} value={p}>
                        {p < 10 ? `PON0${p}` : `PON${p}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-xs font-medium">Name:</span>
                  <select
                    className="cursor-pointer bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-8 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono min-w-[180px]"
                    value={activeDetailOntId}
                    onChange={(e) => setDetailSelectedOntId(e.target.value)}
                  >
                    {ontsInPort.map((o) => (
                      <option key={o.ontId} value={o.ontId}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {canManageOlt && activeDetailPortId && activeDetailOntId && (
                  <>
                    <button
                      onClick={() => {
                        const activeOnt = ontsInPort.find(
                          (o) => String(o.ontId) === String(activeDetailOntId),
                        );
                        const activeOntName = activeOnt
                          ? activeOnt.name
                          : `ONT0${activeDetailPortId}/00${activeDetailOntId}`;

                        const row = data.find((r) => {
                          let p = 1,
                            o = 0;
                          const rawName = r.ont_name || r.name || "";
                          if (rawName && rawName.includes("/")) {
                            const parts = rawName.split("/");
                            p = parseInt(
                              parts[0].replace("ONT", "").replace("PON", ""),
                              10,
                            );
                            o = parseInt(parts[1], 10);
                          } else if (r.identifier !== undefined) {
                            p = (r.identifier >> 8) & 255;
                            o = r.identifier & 255;
                          }
                          return (
                            String(p) === String(activeDetailPortId) &&
                            String(o) === String(activeDetailOntId)
                          );
                        });
                        const activeOntDesc = row
                          ? row.ont_description || row.description || ""
                          : "";

                        setEditingOnt({
                          portId: parseInt(activeDetailPortId, 10),
                          ontId: parseInt(activeDetailOntId, 10),
                          ontIdString: `PON0${activeDetailPortId}/${activeDetailOntId}`,
                        });
                        setEditOntName(activeOntName);
                        setEditOntDesc(activeOntDesc);
                      }}
                      className="cursor-pointer flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition"
                    >
                      <Settings size={13} />
                      <span>Setting Description</span>
                    </button>

                    <button
                      onClick={() => {
                        setRebootOntAction({
                          portId: activeDetailPortId,
                          ontId: activeDetailOntId,
                        });
                        setShowRebootOntConfirm(true);
                      }}
                      className="cursor-pointer flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition"
                    >
                      <Power size={13} />
                      <span>Reboot ONT</span>
                    </button>
                  </>
                )}

                <button
                  onClick={() => {
                    const tempP = detailSelectedPortId;
                    const tempO = detailSelectedOntId;
                    setDetailSelectedPortId("");
                    setTimeout(() => {
                      setDetailSelectedPortId(tempP || activeDetailPortId);
                      setDetailSelectedOntId(tempO || activeDetailOntId);
                    }, 10);
                  }}
                  className="cursor-pointer flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition"
                >
                  <RefreshCw size={13} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* ONT Detail View */}
            <div className="flex-1">
              {activeDetailPortId && activeDetailOntId ? (
                <OntDetailView
                  portId={parseInt(activeDetailPortId, 10)}
                  ontId={parseInt(activeDetailOntId, 10)}
                  canManageOlt={canManageOlt}
                  showStandaloneReboot={false}
                  rebootTimestamp={rebootTimestamp}
                  editTimestamp={editTimestamp}
                  onRebootSuccess={() => fetchData(true)}
                  onEditNameDesc={(name, desc) => {
                    setEditingOnt({
                      portId: parseInt(activeDetailPortId, 10),
                      ontId: parseInt(activeDetailOntId, 10),
                      ontIdString: `PON0${activeDetailPortId}/${activeDetailOntId}`,
                    });
                    setEditOntName(name);
                    setEditOntDesc(desc);
                  }}
                />
              ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400 text-xs">
                  Pilih Port ID dan Name ONT pada toolbar di atas untuk melihat detail lengkap perangkat.
                </div>
              )}
            </div>
          </div>
        ) : (
          /* TAB: AUTHENTICATE LIST & WLAN */
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col">
            {/* Table Toolbar */}
            <div className="p-3 sm:p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-900/60">
              <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
                {/* Port ID Filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 text-xs font-medium">Port:</span>
                  <select
                    className="cursor-pointer bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-8 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 min-w-[130px]"
                    value={selectedPort}
                    onChange={(e) => {
                      setSelectedPort(e.target.value);
                      setCurrentPage(1);
                    }}
                  >
                    <option value="All">Semua Port</option>
                    {uniquePorts.map((p) => (
                      <option key={p} value={String(p)}>
                        {p < 10 ? `PON0${p}` : `PON${p}`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Query Method */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 text-xs font-medium">Metode:</span>
                  <select
                    className="cursor-pointer bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-8 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 min-w-[140px]"
                    value={displayType}
                    onChange={(e) => {
                      setDisplayType(e.target.value);
                      setDisplayValue("");
                      setCurrentPage(1);
                    }}
                  >
                    <option value="All">Semua Kolom</option>
                    <option value="ONT ID">ONT ID</option>
                    <option value="Name">Nama</option>
                    <option value="Serial Number">Serial Number</option>
                    {activeTab === "WLAN" ? (
                      <option value="SSID">SSID</option>
                    ) : (
                      <option value="Running state">Status (Running State)</option>
                    )}
                  </select>
                </div>

                {/* Search Box / Status Selector */}
                {displayType === "Running state" ? (
                  <select
                    className="cursor-pointer bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-8 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 min-w-[130px]"
                    value={displayValue}
                    onChange={(e) => {
                      setDisplayValue(e.target.value);
                      setCurrentPage(1);
                    }}
                  >
                    <option value="">Semua Status</option>
                    <option value="online">Online</option>
                    <option value="offline">Offline</option>
                    <option value="initial">Initial</option>
                  </select>
                ) : (
                  <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search
                      size={13}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                    />
                    <input
                      type="text"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-8 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition placeholder:text-slate-500"
                      value={displayValue}
                      onChange={(e) => {
                        setDisplayValue(e.target.value);
                        setCurrentPage(1);
                      }}
                      placeholder={
                        displayType === "All"
                          ? "Cari ONT ID, Nama, SN..."
                          : `Cari berdasarkan ${displayType}...`
                      }
                    />
                    {displayValue && (
                      <button
                        onClick={() => {
                          setDisplayValue("");
                          setCurrentPage(1);
                        }}
                        className="cursor-pointer absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Rows Per Page */}
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-xs">Tampilkan:</span>
                <select
                  className="cursor-pointer bg-slate-950 border border-slate-800 rounded-lg pl-2.5 pr-7 py-1 text-xs text-slate-300 focus:outline-none"
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                >
                  <option value={20}>20</option>
                  <option value={30}>30</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-rose-500/10 border-b border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto overflow-y-visible min-w-0 max-w-full touch-auto scrollbar-thin">
              <table className="w-full text-left text-xs text-slate-300 relative min-w-[800px]">
                <thead className="bg-slate-950/95 text-slate-400 border-b border-slate-800 font-mono text-[11px] uppercase tracking-wider sticky top-0 z-10 backdrop-blur-sm">
                  <tr>
                    <th className="px-4 py-3 font-semibold">ONT ID</th>
                    <th className="px-4 py-3 font-semibold">Name</th>
                    <th className="px-4 py-3 font-semibold">Serial Number</th>

                    {activeTab === "WLAN" ? (
                      <>
                        <th className="px-4 py-3 font-semibold">Type</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold">SSID</th>
                        <th className="px-4 py-3 font-semibold">Share Key</th>
                        <th className="px-4 py-3 font-semibold">Bandwidth</th>
                        <th className="px-4 py-3 font-semibold">Channel</th>
                      </>
                    ) : (
                      <>
                        <th className="px-4 py-3 font-semibold">Running State</th>
                        <th className="px-4 py-3 font-semibold">Rx Power</th>
                        <th className="px-4 py-3 font-semibold">Last Up Time</th>
                        <th className="px-4 py-3 font-semibold">Last Down Time</th>
                        <th className="px-4 py-3 font-semibold">Last Down Cause</th>
                      </>
                    )}
                    <th className="px-4 py-3 font-semibold text-center">Aksi</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan="10" className="px-4 py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <RefreshCw size={20} className="animate-spin text-blue-500" />
                          <span className="text-xs">Memuat data dari OLT HSGQ...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredData.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="px-4 py-12 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center gap-1">
                          <Server size={24} className="text-slate-600 mb-1" />
                          <span className="text-xs font-medium">Tidak ada data ONT yang sesuai</span>
                          <span className="text-[11px] text-slate-600">
                            Coba ubah filter atau kata kunci pencarian
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    currentData.map((row, idx) => {
                      const isArray = Array.isArray(row);
                      const rawName = row.ont_name || row.name || "";
                      let genId = "";
                      let parsedPortId = 1;
                      let parsedOntId = 0;

                      if (rawName && rawName.includes("/")) {
                        const parts = rawName.split("/");
                        parsedPortId = parseInt(
                          parts[0].replace("ONT", "").replace("PON", ""),
                          10,
                        );
                        parsedOntId = parseInt(parts[1], 10);
                        genId = `${parts[0].replace("ONT", "PON")}/${parsedOntId}`;
                      } else if (row.identifier !== undefined) {
                        parsedPortId = (row.identifier >> 8) & 255;
                        parsedOntId = row.identifier & 255;
                        genId = `PON0${parsedPortId}/${parsedOntId}`;
                      } else {
                        parsedPortId = Math.floor(idx / 10);
                        parsedOntId = idx % 10;
                        genId = `PON0${parsedPortId}/${parsedOntId}`;
                      }

                      const ontId = isArray
                        ? row[0]
                        : row.ont_id || row.id || genId;
                      const name = isArray
                        ? row[1]
                        : row.ont_name || row.name || `ONT01/00${idx}`;
                      const sn = isArray
                        ? row[2]
                        : row.ont_sn || row.sn || row.serial_number || "-";

                      const ontIdCell = (
                        <td className="px-4 py-2.5 font-mono text-blue-400 font-semibold whitespace-nowrap">
                          {ontId}
                        </td>
                      );

                      const nameCell = (
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5 font-medium text-slate-200">
                            <span>{name}</span>
                            {canManageOlt && (
                              <button
                                onClick={() => {
                                  setEditingOnt({
                                    portId: parsedPortId,
                                    ontId: parsedOntId,
                                    ontIdString: ontId,
                                  });
                                  setEditOntName(name);
                                  setEditOntDesc(
                                    row.ont_description || row.description || "",
                                  );
                                }}
                                className="cursor-pointer text-slate-500 hover:text-blue-400 transition p-0.5 rounded"
                                title="Edit Nama / Deskripsi"
                              >
                                <Edit2 size={12} />
                              </button>
                            )}
                          </div>
                        </td>
                      );

                      const settingCell = (
                        <td className="px-4 py-2.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-2">
                            {activeTab === "WLAN" && canManageOlt && (
                              <button
                                onClick={() => handleOpenWifiModal(row)}
                                className="cursor-pointer px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition text-[11px] font-medium"
                              >
                                Setting WiFi
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setActiveTab("ONT Detail");
                                setDetailSelectedPortId(parsedPortId.toString());
                                setDetailSelectedOntId(parsedOntId.toString());
                                if (typeof window !== "undefined") {
                                  const url = new URL(window.location);
                                  url.search = `?tab=detail`;
                                  window.history.pushState({}, "", url);
                                }
                              }}
                              className="cursor-pointer px-2.5 py-1 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 transition text-[11px] font-semibold"
                            >
                              Detail
                            </button>
                          </div>
                        </td>
                      );

                      if (activeTab === "WLAN") {
                        const wifi = row.wifi && row.wifi[0] ? row.wifi[0] : {};
                        const typeStr = wifi.instance === 2 ? "5G" : "2.4G";
                        const status = wifi.enable === 1;
                        const ssid = wifi.wifiname || "-";
                        const sharekey = wifi.sharekey || "-";
                        const bandwidth =
                          wifi.bandwidth === 0
                            ? "20MHz"
                            : wifi.bandwidth === 1
                              ? "40MHz"
                              : "Auto";
                        const channel =
                          wifi.channel === 0 ? "Auto" : wifi.channel;

                        return (
                          <tr
                            key={idx}
                            className="hover:bg-slate-800/40 transition border-b border-slate-800/40"
                          >
                            {ontIdCell}
                            {nameCell}
                            <td className="px-4 py-2.5 font-mono text-slate-300">
                              {sn}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-slate-400">
                              {typeStr}
                            </td>
                            <td className="px-4 py-2.5">
                              <div
                                className={`inline-flex items-center gap-1.5 ${
                                  canManageOlt
                                    ? "cursor-pointer"
                                    : "cursor-not-allowed opacity-60"
                                }`}
                                onClick={() =>
                                  canManageOlt &&
                                  handleWifiToggle(row, "enable", wifi.enable)
                                }
                              >
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                    status
                                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                      : "bg-slate-800 text-slate-400 border-slate-700"
                                  }`}
                                >
                                  {status ? "Enabled" : "Disabled"}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 font-medium text-slate-200">
                              {ssid}
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <span className="font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-slate-300 text-xs">
                                  {visiblePasswords[ontId]
                                    ? sharekey
                                    : "••••••••"}
                                </span>
                                {canManageOlt && (
                                  <button
                                    onClick={() =>
                                      setVisiblePasswords((prev) => ({
                                        ...prev,
                                        [ontId]: !prev[ontId],
                                      }))
                                    }
                                    className="cursor-pointer text-slate-500 hover:text-blue-400 transition"
                                    title={
                                      visiblePasswords[ontId]
                                        ? "Sembunyikan Password"
                                        : "Lihat Password"
                                    }
                                  >
                                    {visiblePasswords[ontId] ? (
                                      <EyeOff size={13} />
                                    ) : (
                                      <Eye size={13} />
                                    )}
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2.5 font-mono text-slate-400">
                              {bandwidth}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-slate-400">
                              {channel}
                            </td>
                            {settingCell}
                          </tr>
                        );
                      }

                      // Authenticate List Row
                      const stateVal = isArray ? row[3] : row.state;
                      const rstateVal = isArray ? row[4] : row.rstate;
                      const runningState =
                        stateVal === 1
                          ? rstateVal === 1
                            ? "online"
                            : "offline"
                          : "initial";

                      const rxPower = isArray
                        ? row[7]
                        : row.receive_power || row.rx_power || "-";
                      const lastUp = isArray
                        ? row[8]
                        : row.last_u_time || row.last_up_time || "-";
                      const lastDown = isArray
                        ? row[9]
                        : row.last_d_time || row.last_down_time || "-";
                      const lastDownCause = isArray
                        ? row[10]
                        : row.last_d_cause || row.last_down_cause || "-";

                      const rxNumeric = parseFloat(rxPower);
                      const isSignalWarning = !isNaN(rxNumeric) && rxNumeric < -27;
                      const isSignalCritical = !isNaN(rxNumeric) && rxNumeric <= -30;

                      return (
                        <tr
                          key={idx}
                          className="hover:bg-slate-800/40 transition border-b border-slate-800/40"
                        >
                          {ontIdCell}
                          {nameCell}
                          <td className="px-4 py-2.5 font-mono text-slate-300">
                            {sn}
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                                runningState.toLowerCase() === "online"
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                  : runningState.toLowerCase() === "offline"
                                    ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                    : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              }`}
                            >
                              {runningState}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs">
                            <span
                              className={
                                isSignalCritical
                                  ? "text-rose-400 font-semibold"
                                  : isSignalWarning
                                    ? "text-amber-400 font-semibold"
                                    : "text-slate-300"
                              }
                            >
                              {rxPower} {rxPower !== "-" && !String(rxPower).includes("dBm") && "dBm"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                            {lastUp}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            {lastDown}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-slate-400">
                            {lastDownCause}
                          </td>
                          {settingCell}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t border-slate-800 text-xs text-slate-400 gap-3 bg-slate-900/40">
              <div className="font-medium">
                Menampilkan {filteredData.length === 0 ? 0 : startIndex + 1} -{" "}
                {Math.min(startIndex + itemsPerPage, filteredData.length)} dari{" "}
                <span className="text-slate-200 font-semibold">
                  {filteredData.length}
                </span>{" "}
                ONT
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <button
                    className="cursor-pointer p-1.5 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    title="Halaman sebelumnya"
                  >
                    <ChevronLeft size={14} />
                  </button>

                  <span className="px-2.5 py-1 text-xs font-mono font-medium text-slate-300">
                    {currentPage} / {totalPages || 1}
                  </span>

                  <button
                    className="cursor-pointer p-1.5 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage >= totalPages || totalPages === 0}
                    title="Halaman berikutnya"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: EDIT ONT NAME / DESC */}
        {editingOnt && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 shadow-2xl rounded-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900">
                <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                  <Settings size={16} className="text-blue-400" />
                  Setting ONT Description
                </h3>
                <button
                  onClick={() => setEditingOnt(null)}
                  className="text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="p-5 flex flex-col gap-4 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-slate-500 text-[10px] font-mono">PORT ID</span>
                    <span className="text-slate-200 font-mono font-semibold">PON0{editingOnt.portId}</span>
                  </div>
                  <div className="flex flex-col gap-0.5 text-right">
                    <span className="text-slate-500 text-[10px] font-mono">ONT ID</span>
                    <span className="text-blue-400 font-mono font-semibold">PON0{editingOnt.portId}/{editingOnt.ontId}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-400 font-semibold text-xs">Nama ONT</label>
                  <input
                    type="text"
                    value={editOntName}
                    onChange={(e) => setEditOntName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-100 focus:border-blue-500 outline-none text-xs"
                    placeholder="Contoh: ONT01/000"
                    maxLength={32}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-400 font-semibold text-xs">Deskripsi ONT</label>
                  <textarea
                    value={editOntDesc}
                    onChange={(e) => setEditOntDesc(e.target.value)}
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-100 focus:border-blue-500 outline-none resize-none text-xs"
                    placeholder="Masukkan keterangan atau lokasi perangkat"
                    maxLength={128}
                  />
                </div>
              </div>
              <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between">
                <button
                  onClick={handleViewDetail}
                  className="cursor-pointer text-xs font-semibold text-blue-400 hover:text-blue-300 transition"
                >
                  Buka Detail ONT &rarr;
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditingOnt(null)}
                    className="cursor-pointer px-3.5 py-1.5 text-xs font-medium text-slate-400 hover:text-white transition"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={isSavingEdit || !editOntName.trim()}
                    className="cursor-pointer px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isSavingEdit && <RefreshCw size={13} className="animate-spin" />}
                    <span>Simpan</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: EDIT WIFI (WLAN) */}
        {editingWifi && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 shadow-2xl rounded-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900">
                <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                  <Wifi size={16} className="text-blue-400" />
                  Setting WiFi ONT (WLAN)
                </h3>
                <button
                  onClick={() => setEditingWifi(null)}
                  className="text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 overflow-y-auto max-h-[70vh] flex flex-col gap-4 text-xs custom-scrollbar">
                {editingWifi.enable === 0 && Number(wifiEnable) === 0 && (
                  <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                    <span className="text-amber-400">⚠️</span>
                    <p className="text-amber-300 text-[11px] leading-relaxed">
                      WLAN sedang <strong>Disabled</strong>. Aktifkan Status WiFi untuk mengakses pengaturan SSID dan enkripsi.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3.5">
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-400 font-semibold text-[11px]">Instance</span>
                    <input
                      type="text"
                      value={editingWifi.instance ?? "-"}
                      readOnly
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-400 outline-none cursor-not-allowed font-mono"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-slate-400 font-semibold text-[11px]">Status WiFi</span>
                    <select
                      value={wifiEnable}
                      onChange={(e) => setWifiEnable(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 focus:border-blue-500 outline-none cursor-pointer"
                    >
                      <option value={1}>Enable</option>
                      <option value={0}>Disable</option>
                    </select>
                  </div>

                  {Number(wifiEnable) === 1 && (
                    <>
                      <div className="flex flex-col gap-1 col-span-2">
                        <span className="text-slate-400 font-semibold text-[11px]">SSID (Nama WiFi)</span>
                        <input
                          type="text"
                          value={wifiSsid}
                          onChange={(e) => setWifiSsid(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 focus:border-blue-500 outline-none"
                          placeholder="Masukkan nama SSID"
                          maxLength={32}
                        />
                      </div>

                      <div className="flex flex-col gap-1 col-span-2">
                        <span className="text-slate-400 font-semibold text-[11px]">Password (Share Key)</span>
                        <input
                          type="text"
                          value={wifiShareKey}
                          onChange={(e) => setWifiShareKey(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 focus:border-blue-500 outline-none font-mono"
                          placeholder="Minimal 8 karakter"
                          maxLength={64}
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-slate-400 font-semibold text-[11px]">Channel</span>
                        <select
                          value={wifiChannel}
                          onChange={(e) => setWifiChannel(Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 focus:border-blue-500 outline-none cursor-pointer"
                        >
                          <option value={0}>Auto</option>
                          {[...Array(13)].map((_, i) => (
                            <option key={i + 1} value={i + 1}>
                              Channel {i + 1}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-slate-400 font-semibold text-[11px]">Bandwidth</span>
                        <select
                          value={wifiBandwidth}
                          onChange={(e) => setWifiBandwidth(Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-100 focus:border-blue-500 outline-none cursor-pointer"
                        >
                          <option value={0}>20MHz</option>
                          <option value={1}>40MHz</option>
                          <option value={2}>Auto</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-end gap-2">
                <button
                  onClick={() => setEditingWifi(null)}
                  className="cursor-pointer px-3.5 py-1.5 text-xs font-medium text-slate-400 hover:text-white transition"
                >
                  Batal
                </button>
                <button
                  onClick={handleSaveWifi}
                  disabled={isSavingWifi || (Number(wifiEnable) === 1 && !wifiSsid.trim())}
                  className="cursor-pointer px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSavingWifi && <RefreshCw size={13} className="animate-spin" />}
                  <span>Simpan</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* REBOOT MODAL */}
        <RebootOntConfirmModal
          showRebootOntConfirm={showRebootOntConfirm}
          setShowRebootOntConfirm={setShowRebootOntConfirm}
          rebootOntAction={rebootOntAction}
          showToast={showToast}
          setRebootTimestamp={setRebootTimestamp}
          fetchData={fetchData}
        />
      </div>
    </>
  );
}