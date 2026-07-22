"use client";
// Force hot-reload trigger comment
import { useState, useEffect } from "react";
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
} from "lucide-react";
import { socket, useAppState } from "@/App";
import { getStoredUser, hasAccess } from "@/lib/roles";
import OntDetailModal from "@/components/OntDetailModal";
import OntDetailView from "@/components/OntDetailView";
import { useToast } from "@/hooks/useToast";

export default function HsgqOltPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("Authenticate List");
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
    "Version Information": "version",
    "Bind Profile Info": "profile",
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

    const handleWifiUpdate = (payload) => {
      if (activeTab !== "WLAN") return;
      setData((prevData) =>
        prevData.map((row) => {
          if (row.identifier === payload.identifier) {
            // make sure we have a wifi array
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

    socket.on("hsgq_wifi_update", handleWifiUpdate);
    return () => {
      socket.off("hsgq_wifi_update", handleWifiUpdate);
    };
  }, [activeTab, socket]);

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
        // Fallback dummy data or empty
        console.warn("Unrecognized data format:", tableData);
        tableData = [];
      }

      setData(tableData);
      if (setLastSyncTime) {
        setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
      }
    } catch (err) {
      console.error(err);
      setError("Failed to fetch OLT data");
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
      // OLT bitmask flags (captured from OLT native UI):
      // 1024 = isolation, 2048 = broadcast/enable
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

      // Optimistic update
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
      fetchData(); // Revert on failure
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
    if (!editingWifi) return;
    if (Number(wifiEnable) === 1) {
      // Full validation only when WLAN is being enabled
      if (!wifiSsid.trim()) return;
      // Only require 8 character password for WPA modes (3: wpapsk, 4: wpa2psk, 5: wpa2mixed)
      if ([3, 4, 5].includes(Number(wifiSecurityMode)) && wifiShareKey.length < 8) {
        showToast("Share key (Password) harus minimal 8 karakter!", 'warning');
        return;
      }
    }
    setIsSavingWifi(true);
    try {
      const originalWifi = (editingWifi.row && editingWifi.row.wifi && editingWifi.row.wifi[0]) ? editingWifi.row.wifi[0] : {};
      let calculatedFlags = 0;
      if (wifiSsid.trim() !== (originalWifi.wifiname || "")) calculatedFlags |= 1;
      if (wifiShareKey !== (originalWifi.sharekey || "")) calculatedFlags |= 2;
      if (Number(wifiSecurityMode) !== (originalWifi.securitymode !== undefined ? originalWifi.securitymode : 4)) calculatedFlags |= 4;
      if (Number(wifiWpaEncrypt) !== (originalWifi.wpaencrypt !== undefined ? originalWifi.wpaencrypt : 2)) calculatedFlags |= 16;
      if (Number(wifiWepAuth) !== (originalWifi.wepauth !== undefined ? originalWifi.wepauth : 0)) calculatedFlags |= 4;
      if (Number(wifiChannel) !== (originalWifi.channel !== undefined ? originalWifi.channel : 0)) calculatedFlags |= 16;
      if (Number(wifiBandwidth) !== (originalWifi.bandwidth !== undefined ? originalWifi.bandwidth : 1)) calculatedFlags |= 32;
      if (Number(wifiBeacon) !== (originalWifi.beacon !== undefined ? originalWifi.beacon : 100)) calculatedFlags |= 128;
      if (Number(wifiDtim) !== (originalWifi.dtim !== undefined ? originalWifi.dtim : 1)) calculatedFlags |= 256;
      if (Number(wifiShortgi) !== (originalWifi.shortgi !== undefined ? originalWifi.shortgi : 1)) calculatedFlags |= 512;
      if (Number(wifiIsolation) !== (originalWifi.isolation !== undefined ? originalWifi.isolation : 0)) calculatedFlags |= 1024;
      if (Number(wifiBroadcast) !== (originalWifi.broadcast !== undefined ? originalWifi.broadcast : 1)) calculatedFlags |= 2048;
      if (Number(wifiEnable) !== (originalWifi.enable !== undefined ? originalWifi.enable : 1)) calculatedFlags |= 2048;

      if (calculatedFlags === 0) {
        calculatedFlags = 4095; // Default fallback to update all
      }

      const payload = {
        method: "set",
        param: {
          identifier: editingWifi.identifier,
          flags: calculatedFlags,
          instance: editingWifi.instance,
          enable: Number(wifiEnable),
          wifiname: wifiSsid.trim(),
          securitymode: Number(wifiSecurityMode),
          wpaencrypt: Number(wifiWpaEncrypt),
          sharekey: wifiShareKey,
          wepauth: Number(wifiWepAuth),
          keyindex: 0,
          key1: "",
          key2: "",
          key3: "",
          key4: "",
          channel: Number(wifiChannel),
          bandwidth: Number(wifiBandwidth),
          beacon: Number(wifiBeacon),
          dtim: Number(wifiDtim),
          shortgi: Number(wifiShortgi),
          isolation: Number(wifiIsolation),
          broadcast: Number(wifiBroadcast),
        },
      };

      const response = await axios.post("/api/hsgq-olt?action=set_wifi", payload);
      if (response.data && response.data.code === 1) {
        setData((prevData) =>
          prevData.map((r) => {
            if (r.identifier === editingWifi.identifier) {
              const currentWifi = r.wifi && r.wifi[0] ? r.wifi[0] : {};
              if (currentWifi.instance === editingWifi.instance) {
                return {
                  ...r,
                  wifi: [
                    {
                      ...currentWifi,
                      wifiname: wifiSsid.trim(),
                      enable: Number(wifiEnable),
                      securitymode: Number(wifiSecurityMode),
                      wpaencrypt: Number(wifiWpaEncrypt),
                      sharekey: wifiShareKey,
                      wepauth: Number(wifiWepAuth),
                      channel: Number(wifiChannel),
                      bandwidth: Number(wifiBandwidth),
                      beacon: Number(wifiBeacon),
                      dtim: Number(wifiDtim),
                      shortgi: Number(wifiShortgi),
                      isolation: Number(wifiIsolation),
                      broadcast: Number(wifiBroadcast),
                    },
                  ],
                };
              }
            }
            return r;
          }),
        );
        setEditingWifi(null);
        setTimeout(() => {
          fetchData(true);
        }, 2000);
      } else {
        showToast("Gagal ubah konfigurasi WiFi: " + (response.data?.message || "Error tidak diketahui"));
      }
    } catch (err) {
      console.error(err);
      showToast("Gagal ubah konfigurasi WiFi: " + (err.response?.data?.error || err.message));
    } finally {
      setIsSavingWifi(false);
    }
  };

  const handleOpenEditModal = (row, portId, ontId, currentName) => {
    if (!canManageOlt) return;
    const isArray = Array.isArray(row);
    const initialDesc = !isArray ? (row.ont_description || row.ont_desc || row.description || "No-description") : "No-description";
    
    let identifier = 0;
    if (!isArray && row.identifier !== undefined) {
      identifier = row.identifier;
    } else {
      identifier = (portId << 8) | ontId;
    }

    setEditingOnt({
      row,
      portId,
      ontId,
      identifier,
    });
    setEditOntName(currentName);
    setEditOntDesc(initialDesc);
  };

  const handleSaveEdit = async () => {
    if (!editingOnt || !editOntName.trim()) return;
    setIsSavingEdit(true);
    try {
      const identifier = (Number(editingOnt.portId) << 8) | Number(editingOnt.ontId);
      const payload = {
        method: "set",
        param: {
          identifier: identifier,
          flags: 8,
          ont_name: editOntName.trim(),
          ont_description: editOntDesc.trim() || "No-description",
        },
      };

      const response = await axios.post("/api/hsgq-olt?action=set_info", payload);
      if (response.data && response.data.code === 1) {
        setData(prevData => {
          return prevData.map(row => {
            let p = 1, o = 0;
            const rawName = row.ont_name || row.name || "";
            if (rawName && rawName.includes("/")) {
              const parts = rawName.split("/");
              p = parseInt(parts[0].replace("ONT", "").replace("PON", ""), 10);
              o = parseInt(parts[1], 10);
            } else if (row.identifier !== undefined) {
              p = (row.identifier >> 8) & 255;
              o = row.identifier & 255;
            }
            
            if (Number(p) === Number(editingOnt.portId) && Number(o) === Number(editingOnt.ontId)) {
              return {
                ...row,
                ont_name: editOntName.trim(),
                name: editOntName.trim(),
                ont_description: editOntDesc.trim() || "No-description",
                description: editOntDesc.trim() || "No-description",
              };
            }
            return row;
          });
        });

        setEditingOnt(null);
        setEditTimestamp(Date.now());
        setTimeout(() => {
          fetchData(true); // silent refresh
        }, 2000);
      } else {
        showToast("Gagal ubah nama ONT: " + (response.data?.message || "Error tidak diketahui"));
      }
    } catch (err) {
      console.error(err);
      showToast("Gagal ubah nama ONT: " + (err.response?.data?.error || err.message));
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleViewDetail = () => {
    if (!editingOnt) return;
    
    // Set active tab to "ONT Detail"
    setActiveTab("ONT Detail");
    
    // Set selected port & ONT ID in the details dropdowns
    setDetailSelectedPortId(editingOnt.portId.toString());
    setDetailSelectedOntId(editingOnt.ontId.toString());
    
    // Close the settings modal
    setEditingOnt(null);
    
    // Update URL history
    if (typeof window !== "undefined") {
      const url = new URL(window.location);
      url.search = `?tab=detail`;
      window.history.pushState({}, "", url);
    }
  };

  useEffect(() => {
    if (canRead) {
      fetchData();

      // Lazy auto-refresh main data every 1 minute
      const interval = setInterval(() => {
        fetchData(true); // silent refresh
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
      const rstateVal = isArray ? item[4] : item.rstate;
      return rstateVal === 1;
    }).length,
    offline: filteredByPortData.filter((item) => {
      const isArray = Array.isArray(item);
      const rstateVal = isArray ? item[4] : item.rstate;
      // Asumsi: 1 = online, 0 = initial, 2 (atau lainnya) = offline
      return rstateVal !== 1 && rstateVal !== 0;
    }).length,
  };

  const filteredData = filteredByPortData.filter((row, idx) => {
    if (displayType === "All" || !displayValue) return true;
    const isArray = Array.isArray(row);
    let fieldVal = "";

    if (displayType === "ONT ID") {
      let genId = "";
      const rawName = row.ont_name || row.name || "";
      if (rawName && rawName.includes("/")) {
        const parts = rawName.split("/");
        genId = `${parts[0].replace("ONT", "PON")}/${parseInt(parts[1], 10)}`;
      } else if (row.identifier !== undefined) {
        genId = `PON0${(row.identifier >> 8) & 255}/${row.identifier & 255}`;
      } else {
        genId = `PON0${Math.floor(idx / 10)}/${idx % 10}`;
      }
      fieldVal = String(isArray ? row[0] : row.ont_id || row.id || genId);
    } else if (displayType === "Name")
      fieldVal = String(
        isArray ? row[1] : row.ont_name || row.name || `ONT01/00${idx}`,
      );
    else if (displayType === "Serial Number")
      fieldVal = String(
        isArray ? row[2] : row.ont_sn || row.sn || row.serial_number || "-",
      );
    else if (displayType === "Device Type")
      fieldVal = String(
        isArray
          ? activeTab === "Version Information" ||
            activeTab === "Bind Profile Info"
            ? row[3]
            : row[6]
          : row.dev_type || row.device_type || "",
      );
    else if (displayType === "Vendor ID")
      fieldVal = String(isArray ? row[4] : row.vendorid || "-");
    else if (displayType === "ONT Version")
      fieldVal = String(isArray ? row[5] : row.ont_version || "-");
    else if (displayType === "Equipment ID")
      fieldVal = String(
        isArray
          ? activeTab === "Version Information"
            ? row[6]
            : row[4]
          : row.equipmentid || "-",
      );
    else if (displayType === "Line Profile ID")
      fieldVal = String(isArray ? row[5] : (row.lprofid ?? "-"));
    else if (displayType === "SSID") {
      const wifi = row.wifi && row.wifi[0];
      fieldVal = String(isArray ? "" : wifi?.wifiname || "");
    } else if (displayType === "Running state") {
      const rstateVal = isArray ? row[4] : row.rstate;
      fieldVal =
        rstateVal === 1 ? "online" : rstateVal === 0 ? "initial" : "offline";
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
    // Default selects
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
    <div className="max-w-full h-full flex flex-col">
      {ToastComponent}
      {/* Header Tabs */}
      <div className="flex-shrink-0 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-3">
            <Server size={24} className="text-purple-400" />
            HSGQ OLT
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Monitoring dan Konfigurasi perangkat OLT HSGQ
          </p>
        </div>
      </div>
      <div className="flex border-b border-slate-700/50 my-4 overflow-x-auto">
        {[
          "Authenticate List",
          "Version Information",
          "Bind Profile Info",
          "WLAN",
          "ONT Detail",
        ].map((tab, idx) => (
          <button
            key={idx}
            onClick={() => {
              setActiveTab(tab);
              setError(null);
              setDisplayType("All");
              setDisplayValue("");
              setSelectedPort("All");
              setCurrentPage(1);

              if (typeof window !== "undefined") {
                const url = new URL(window.location);
                url.search = `?tab=${encodeURIComponent(tabSlugs[tab])}`;
                window.history.pushState({}, "", url);
              }
            }}
            className={`cursor-pointer px-4 py-3 whitespace-nowrap text-xs font-medium transition-colors ${
              activeTab === tab
                ? "text-blue-400 border-b-2 border-blue-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "ONT Detail" ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-xs">Port ID:</span>
                <select
                  className="bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 w-32 cursor-pointer"
                  value={activeDetailPortId}
                  onChange={(e) => {
                    setDetailSelectedPortId(e.target.value);
                    setDetailSelectedOntId(""); // Reset ONT selection when port changes
                  }}
                >
                  {uniquePorts.map((p) => (
                    <option key={p} value={p}>
                      PON0{p}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-xs">Name:</span>
                <select
                  className="bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 w-48 cursor-pointer"
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
                      const activeOnt = ontsInPort.find(o => String(o.ontId) === String(activeDetailOntId));
                      const activeOntName = activeOnt ? activeOnt.name : `ONT0${activeDetailPortId}/00${activeDetailOntId}`;
                      
                      const row = data.find(r => {
                        let p = 1, o = 0;
                        const rawName = r.ont_name || r.name || "";
                        if (rawName && rawName.includes("/")) {
                          const parts = rawName.split("/");
                          p = parseInt(parts[0].replace("ONT", "").replace("PON", ""), 10);
                          o = parseInt(parts[1], 10);
                        } else if (r.identifier !== undefined) {
                          p = (r.identifier >> 8) & 255;
                          o = r.identifier & 255;
                        }
                        return String(p) === String(activeDetailPortId) && String(o) === String(activeDetailOntId);
                      });
                      const activeOntDesc = row ? (row.ont_description || row.description || "") : "";

                      setEditingOnt({
                        portId: parseInt(activeDetailPortId, 10),
                        ontId: parseInt(activeDetailOntId, 10),
                        ontIdString: `PON0${activeDetailPortId}/${activeDetailOntId}`,
                      });
                      setEditOntName(activeOntName);
                      setEditOntDesc(activeOntDesc);
                    }}
                    className="cursor-pointer flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-md text-xs transition-colors"
                  >
                    <Settings size={14} /> Setting Description
                  </button>
                  <button
                    onClick={() => {
                      setRebootOntAction({
                        portId: activeDetailPortId,
                        ontId: activeDetailOntId,
                      });
                      setShowRebootOntConfirm(true);
                    }}
                    className="cursor-pointer flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-md text-xs transition-colors"
                  >
                    <Power size={14} /> Reboot ONT
                  </button>
                </>
              )}
              <button
                className="cursor-pointer flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-1.5 rounded-md text-xs transition-colors"
                onClick={() => {
                  const tempP = detailSelectedPortId;
                  const tempO = detailSelectedOntId;
                  setDetailSelectedPortId("");
                  setTimeout(() => {
                    setDetailSelectedPortId(tempP || activeDetailPortId);
                    setDetailSelectedOntId(tempO || activeDetailOntId);
                  }, 10);
                }}
              >
                <RefreshCw size={14} /> Refresh
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
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
              <div className="text-slate-400">Pilih Port dan Name ONT...</div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-xs">Port ID:</span>
              <select
                className="cursor-pointer bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500 mr-2"
                value={selectedPort}
                onChange={(e) => {
                  setSelectedPort(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="All">All</option>
                {uniquePorts.map((p) => (
                  <option key={p} value={String(p)}>
                    {p < 10 ? `PON0${p}` : `PON${p}`}
                  </option>
                ))}
              </select>

              <span className="text-slate-400 text-xs">Query Method:</span>
              <select
                className="cursor-pointer bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                value={displayType}
                onChange={(e) => {
                  setDisplayType(e.target.value);
                  setDisplayValue("");
                }}
              >
                <option value="All">All</option>
                <option value="ONT ID">ONT ID</option>
                <option value="Name">Name</option>
                <option value="Serial Number">Serial Number</option>

                {activeTab === "Version Information" ? (
                  <>
                    <option value="Vendor ID">Vendor ID</option>
                    <option value="ONT Version">ONT Version</option>
                  </>
                ) : activeTab === "Bind Profile Info" ? (
                  <>
                    <option value="Equipment ID">Equipment ID</option>
                    <option value="Line Profile ID">Line Profile ID</option>
                  </>
                ) : activeTab === "WLAN" ? (
                  <option value="SSID">SSID</option>
                ) : (
                  <option value="Running state">Running state</option>
                )}
              </select>

              {displayType === "Running state" ? (
                <select
                  className="bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 w-32 cursor-pointer "
                  value={displayValue}
                  onChange={(e) => {
                    setDisplayValue(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="initial">initial</option>
                  <option value="online">online</option>
                  <option value="offline">offline</option>
                </select>
              ) : displayType !== "All" ? (
                <input
                  type="text"
                  className="bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 w-48"
                  value={displayValue}
                  onChange={(e) => {
                    setDisplayValue(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder={`Search ${displayType}...`}
                />
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {activeTab === "Authenticate List" && (
                <>
                  <div
                    onClick={() => {
                      setDisplayType("All");
                      setDisplayValue("");
                      setCurrentPage(1);
                    }}
                    className="flex bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-md text-xs border border-blue-500/20 cursor-pointer hover:bg-blue-500/20 transition-colors"
                  >
                    Registered: {stats.registered}
                  </div>
                  <div
                    onClick={() => {
                      setDisplayType("Running state");
                      setDisplayValue("initial");
                      setCurrentPage(1);
                    }}
                    className="flex bg-red-500/10 text-red-400 px-3 py-1.5 rounded-md text-xs border border-red-500/20 cursor-pointer hover:bg-red-500/20 transition-colors"
                  >
                    Unregistered: {stats.unregistered}
                  </div>
                  <div
                    onClick={() => {
                      setDisplayType("Running state");
                      setDisplayValue("online");
                      setCurrentPage(1);
                    }}
                    className="flex bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-md text-xs border border-emerald-500/20 cursor-pointer hover:bg-emerald-500/20 transition-colors"
                  >
                    Online: {stats.online}
                  </div>
                  <div
                    onClick={() => {
                      setDisplayType("Running state");
                      setDisplayValue("offline");
                      setCurrentPage(1);
                    }}
                    className="flex bg-rose-500/10 text-rose-400 px-3 py-1.5 rounded-md text-xs border border-rose-500/20 cursor-pointer hover:bg-rose-500/20 transition-colors"
                  >
                    Offline: {stats.offline}
                  </div>
                </>
              )}

              <div className="flex items-center gap-2 ml-4">
                <button
                  onClick={fetchData}
                  className="cursor-pointer flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-1.5 rounded-md text-xs transition-colors"
                >
                  <RefreshCw size={14} /> Refresh
                </button>
                <button
                  onClick={() => {
                    setDisplayType("All");
                    setDisplayValue("");
                    setSelectedPort("All");
                  }}
                  className="cursor-pointer flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-1.5 rounded-md text-xs transition-colors"
                >
                  Reset Query
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg mb-4 text-xs">
              {error}
            </div>
          )}

          {/* Table */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 flex flex-col flex-1 overflow-hidden min-h-[400px]">
            <div className="overflow-auto flex-1">
              <table className="w-full text-left text-xs text-slate-300 relative">
                <thead className="bg-slate-800/90 text-slate-400 border-b border-slate-700/50 uppercase text-xs sticky top-0 z-10 backdrop-blur-sm">
                  <tr>
                    <th className="px-4 py-3">ONT ID</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Serial Number</th>
                    {activeTab === "Version Information" ? (
                      <>
                        <th className="px-4 py-3">Device Type</th>
                        <th className="px-4 py-3">Vendor ID</th>
                        <th className="px-4 py-3">ONT Version</th>
                        <th className="px-4 py-3">Equipment ID</th>
                        <th className="px-4 py-3">Main Software Version</th>
                        <th className="px-4 py-3">Standby Software Version</th>
                      </>
                    ) : activeTab === "Bind Profile Info" ? (
                      <>
                        <th className="px-4 py-3">Device Type</th>
                        <th className="px-4 py-3">Equipment ID</th>
                        <th className="px-4 py-3">Line Profile ID</th>
                        <th className="px-4 py-3">Line Profile Name</th>
                        <th className="px-4 py-3">Srv Profile ID</th>
                        <th className="px-4 py-3">Srv Profile Name</th>
                      </>
                    ) : activeTab === "WLAN" ? (
                      <>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">SSID</th>
                        <th className="px-4 py-3">Share key</th>
                        <th className="px-4 py-3">Band Width</th>
                        <th className="px-4 py-3">Isolation</th>
                        <th className="px-4 py-3">Broadcast</th>
                        <th className="px-4 py-3">Channel</th>
                      </>
                    ) : (
                      <>
                        <th className="px-4 py-3">Running state</th>
                        <th className="px-4 py-3">Receive Power</th>
                        <th className="px-4 py-3">Last up time</th>
                        <th className="px-4 py-3">Last down time</th>
                        <th className="px-4 py-3">Last down cause</th>
                      </>
                    )}
                    <th className="px-4 py-3 text-center">Setting</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {loading ? (
                    <tr>
                      <td
                        colSpan="13"
                        className="px-4 py-8 text-center text-slate-400"
                      >
                        Loading data...
                      </td>
                    </tr>
                  ) : filteredData.length === 0 ? (
                    <tr>
                      <td
                        colSpan="12"
                        className="px-4 py-8 text-center text-slate-400"
                      >
                        No data available.
                      </td>
                    </tr>
                  ) : (
                    currentData.map((row, idx) => {
                      // Jika API mengembalikan array object tapi key tidak diketahui, coba mapping manual
                      // Default field mappings fallback to row[0], row[1] etc jika format array of arrays
                      const isArray = Array.isArray(row);
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

                      const ontId = isArray
                        ? row[0]
                        : row.ont_id || row.id || genId;
                      const name = isArray
                        ? row[1]
                        : row.ont_name || row.name || `ONT01/00${idx}`;
                      const sn = isArray
                        ? row[2]
                        : row.ont_sn || row.sn || row.serial_number || "-";

                      let parsedPortId = 1;
                      let parsedOntId = 0;
                      if (row.identifier !== undefined) {
                        parsedPortId = (row.identifier >> 8) & 255;
                        parsedOntId = row.identifier & 255;
                      } else {
                        const idParts =
                          String(ontId).match(/PON0?(\d+)\/(\d+)/i);
                        if (idParts) {
                          parsedPortId = parseInt(idParts[1], 10);
                          parsedOntId = parseInt(idParts[2], 10);
                        }
                      }

                      const handleOntClick = () => {
                        setSelectedOnt({
                          ontIdString: ontId,
                          portId: parsedPortId,
                          ontId: parsedOntId,
                        });
                      };

                      const ontIdCell = (
                        <td className="px-4 py-3">
                          <button
                            onClick={handleOntClick}
                            className="text-blue-400 hover:text-blue-300 hover:underline font-medium transition-colors cursor-pointer"
                            title="Klik untuk melihat detail ONT"
                          >
                            {ontId}
                          </button>
                        </td>
                      );

                      const nameCell = (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
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
                                  setEditOntDesc(row.ont_description || row.description || "");
                                }}
                                className="cursor-pointer text-slate-400 hover:text-blue-400 transition-colors p-0.5"
                                title="Edit Name & Description"
                              >
                                <Edit2 size={12} />
                              </button>
                            )}
                          </div>
                        </td>
                      );

                      const settingCell = (
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-3">
                            {activeTab === "WLAN" && canManageOlt && (
                              <button
                                onClick={() => handleOpenWifiModal(row)}
                                className="cursor-pointer text-blue-400 hover:text-blue-300 hover:underline transition-colors font-medium text-xs"
                              >
                                Setting WiFi
                              </button>
                            )}
                            <button
                              onClick={() => {
                                // Trigger client-side view detail
                                setActiveTab("ONT Detail");
                                setDetailSelectedPortId(parsedPortId.toString());
                                setDetailSelectedOntId(parsedOntId.toString());
                                if (typeof window !== "undefined") {
                                  const url = new URL(window.location);
                                  url.search = `?tab=detail`;
                                  window.history.pushState({}, "", url);
                                }
                              }}
                              className="cursor-pointer text-blue-400 hover:text-blue-300 hover:underline transition-colors font-medium text-xs"
                            >
                              View Detail
                            </button>
                          </div>
                        </td>
                      );

                      if (activeTab === "Version Information") {
                        const devType = isArray
                          ? row[3]
                          : row.dev_type || row.device_type || "-";
                        const vendorId = isArray ? row[4] : row.vendorid || "-";
                        const ontVersion = isArray
                          ? row[5]
                          : row.ont_version || "-";
                        const equipId = isArray
                          ? row[6]
                          : row.equipmentid || "-";
                        const mainVer = isArray
                          ? row[7]
                          : row.mainversion || "-";
                        const stbVer = isArray ? row[8] : row.stbversion || "-";

                        return (
                          <tr
                            key={idx}
                            className="hover:bg-slate-700/20 transition-colors"
                          >
                            {ontIdCell}
                            {nameCell}
                            <td className="px-4 py-3">{sn}</td>
                            <td className="px-4 py-3">{devType}</td>
                            <td className="px-4 py-3">{vendorId}</td>
                            <td className="px-4 py-3">{ontVersion}</td>
                            <td className="px-4 py-3">{equipId}</td>
                            <td className="px-4 py-3">{mainVer}</td>
                            <td className="px-4 py-3">{stbVer}</td>
                            {settingCell}
                          </tr>
                        );
                      }

                      if (activeTab === "Bind Profile Info") {
                        const devType = isArray
                          ? row[3]
                          : row.dev_type || row.device_type || "-";
                        const equipId = isArray
                          ? row[4]
                          : row.equipmentid || "-";
                        const lprofId = isArray ? row[5] : (row.lprofid ?? row.lineprof_id ?? "-");
                        const lprofName = isArray
                          ? row[6]
                          : row.lprofname || row.lineprof_name || (row.lineprof_id !== undefined ? `PROFILE_${row.lineprof_id}` : "-");
                        const sprofId = isArray ? row[7] : (row.sprofid ?? row.srvprof_id ?? "-");
                        const sprofName = isArray
                          ? row[8]
                          : row.sprofname || row.srvprof_name || (row.srvprof_id !== undefined ? `PROFILE_${row.srvprof_id}` : "-");

                        return (
                          <tr
                            key={idx}
                            className="hover:bg-slate-700/20 transition-colors"
                          >
                            {ontIdCell}
                            {nameCell}
                            <td className="px-4 py-3">{sn}</td>
                            <td className="px-4 py-3">{devType}</td>
                            <td className="px-4 py-3">{equipId}</td>
                            <td className="px-4 py-3">{lprofId}</td>
                            <td className="px-4 py-3">{lprofName}</td>
                            <td className="px-4 py-3">{sprofId}</td>
                            <td className="px-4 py-3">{sprofName}</td>
                            {settingCell}
                          </tr>
                        );
                      }

                      if (activeTab === "WLAN") {
                        const wifi = row.wifi && row.wifi[0] ? row.wifi[0] : {};
                        const typeStr = wifi.instance === 2 ? "5G" : "2.4G";

                        const status = wifi.enable === 1;
                        const ssid = wifi.wifiname || "-";
                        const sharekey = wifi.sharekey || "-";
                        const bandwidth =
                          wifi.bandwidth === 0
                            ? "20mhz"
                            : wifi.bandwidth === 1
                              ? "40mhz"
                              : "auto";
                        const isolation = wifi.isolation === 1;
                        const broadcast = wifi.broadcast === 1;
                        const channel =
                          wifi.channel === 0 ? "auto" : wifi.channel;

                        return (
                          <tr
                            key={idx}
                            className="hover:bg-slate-700/20 transition-colors"
                          >
                            {ontIdCell}
                            {nameCell}
                            <td className="px-4 py-3">{sn}</td>
                            <td className="px-4 py-3">{typeStr}</td>
                            <td className="px-4 py-3">
                              <div
                                className={`flex flex-col gap-1 ${canManageOlt ? "cursor-pointer group" : "cursor-not-allowed opacity-60"}`}
                                onClick={() =>
                                  canManageOlt &&
                                  handleWifiToggle(row, "enable", wifi.enable)
                                }
                              >
                                <span
                                  className={`text-xs transition-colors ${canManageOlt ? "text-slate-300 group-hover:text-blue-400" : "text-slate-400"}`}
                                >
                                  {status ? "Enable" : "Disable"}
                                </span>
                                <div
                                  className={`w-8 h-4 rounded-full relative transition-colors ${status ? "bg-blue-500" : "bg-slate-600"}`}
                                >
                                  <div
                                    className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${status ? "left-[18px]" : "left-0.5"}`}
                                  ></div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">{ssid}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="font-mono bg-slate-900/50 px-2 py-1 rounded text-slate-300">
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
                                    className="cursor-pointer text-slate-400 hover:text-blue-400 transition-colors"
                                    title={
                                      visiblePasswords[ontId]
                                        ? "Sembunyikan Password"
                                        : "Lihat Password"
                                    }
                                  >
                                    {visiblePasswords[ontId] ? (
                                      <EyeOff size={14} />
                                    ) : (
                                      <Eye size={14} />
                                    )}
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">{bandwidth}</td>
                            <td className="px-4 py-3">
                              <div
                                className={`flex flex-col gap-1 ${
                                  canManageOlt && wifi.enable === 1
                                    ? "cursor-pointer group"
                                    : "cursor-not-allowed opacity-40"
                                }`}
                                onClick={() =>
                                  canManageOlt && wifi.enable === 1 &&
                                  handleWifiToggle(
                                    row,
                                    "isolation",
                                    wifi.isolation,
                                  )
                                }
                              >
                                <span
                                  className={`text-xs transition-colors ${canManageOlt ? "text-slate-300 group-hover:text-blue-400" : "text-slate-400"}`}
                                >
                                  {isolation ? "Enable" : "Disable"}
                                </span>
                                <div
                                  className={`w-8 h-4 rounded-full relative transition-colors ${isolation ? "bg-blue-500" : "bg-slate-600"}`}
                                >
                                  <div
                                    className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${isolation ? "left-[18px]" : "left-0.5"}`}
                                  ></div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div
                                className={`flex flex-col gap-1 ${
                                  canManageOlt && wifi.enable === 1
                                    ? "cursor-pointer group"
                                    : "cursor-not-allowed opacity-40"
                                }`}
                                onClick={() =>
                                  canManageOlt && wifi.enable === 1 &&
                                  handleWifiToggle(
                                    row,
                                    "broadcast",
                                    wifi.broadcast,
                                  )
                                }
                              >
                                <span
                                  className={`text-xs transition-colors ${canManageOlt ? "text-slate-300 group-hover:text-blue-400" : "text-slate-400"}`}
                                >
                                  {broadcast ? "Enable" : "Disable"}
                                </span>
                                <div
                                  className={`w-8 h-4 rounded-full relative transition-colors ${broadcast ? "bg-blue-500" : "bg-slate-600"}`}
                                >
                                  <div
                                    className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${broadcast ? "left-[18px]" : "left-0.5"}`}
                                  ></div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">{channel}</td>
                            {settingCell}
                          </tr>
                        );
                      }

                      const stateVal = isArray ? row[3] : row.state;
                      const rstateVal = isArray ? row[4] : row.rstate;
                      const cstateVal = isArray ? row[5] : row.cstate;

                      const state =
                        stateVal === 1
                          ? "Active"
                          : stateVal === 0
                            ? "Inactive"
                            : "Unknown";
                      const runningState =
                        rstateVal === 1
                          ? "online"
                          : rstateVal === 0
                            ? "initial"
                            : "offline";
                      const configState =
                        cstateVal === 1
                          ? "normal"
                          : cstateVal === 0
                            ? "initial"
                            : "unknown";

                      const deviceType = isArray
                        ? row[6]
                        : row.dev_type || row.device_type || "HGU";
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

                      return (
                        <tr
                          key={idx}
                          className="hover:bg-slate-700/20 transition-colors"
                        >
                          {ontIdCell}
                          {nameCell}
                          <td className="px-4 py-3">{sn}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                runningState.toLowerCase() === "online"
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                  : "bg-red-500/10 text-red-400 border border-red-500/20"
                              }`}
                            >
                              {runningState}
                            </span>
                          </td>
                          <td className="px-4 py-3">{rxPower}</td>
                          <td className="px-4 py-3 text-xs">{lastUp}</td>
                          <td className="px-4 py-3 text-xs">{lastDown}</td>
                          <td className="px-4 py-3 text-xs">{lastDownCause}</td>
                          {settingCell}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700/50 text-xs text-slate-400">
              <div>Total {filteredData.length}</div>
              <div className="flex items-center gap-4">
                <select
                  className="cursor-pointer bg-slate-800 border border-slate-700 rounded-md px-2 py-1 focus:outline-none"
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                >
                  <option value={20}>20/page</option>
                  <option value={30}>30/page</option>
                  <option value={50}>50/page</option>
                </select>
                <div className="flex items-center gap-1">
                  <button
                    className="cursor-pointer p-1 hover:text-slate-200 disabled:opacity-50"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="px-2">
                    Page {currentPage} of {totalPages || 1}
                  </span>
                  <button
                    className="cursor-pointer p-1 hover:text-slate-200 disabled:opacity-50"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage >= totalPages || totalPages === 0}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span>Go to</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={currentPage}
                    onChange={(e) => {
                      const valStr = e.target.value.replace(/[^0-9]/g, "");
                      if (valStr === "") {
                        setCurrentPage("");
                        return;
                      }
                      const val = Number(valStr);
                      if (val >= 1 && val <= totalPages) {
                        setCurrentPage(val);
                      } else if (val > totalPages) {
                        setCurrentPage(totalPages);
                      }
                    }}
                    onBlur={() => {
                      if (currentPage === "" || currentPage < 1)
                        setCurrentPage(1);
                      if (currentPage > totalPages) setCurrentPage(totalPages);
                    }}
                    className="w-12 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-center"
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {editingOnt && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-700 shadow-2xl rounded-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between bg-slate-800/80">
              <h3 className="font-bold text-slate-100 flex items-center gap-2">
                <Settings size={16} className="text-blue-400" />
                Setting ONT
              </h3>
              <button
                onClick={() => setEditingOnt(null)}
                className="text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 flex flex-col gap-4 text-xs">
              <div className="flex flex-col gap-1">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Port ID</span>
                <span className="text-slate-200 font-medium">PON0{editingOnt.portId}</span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">ONT ID</span>
                <span className="text-slate-200 font-medium">PON0{editingOnt.portId}/{editingOnt.ontId}</span>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Name</label>
                <input
                  type="text"
                  value={editOntName}
                  onChange={(e) => setEditOntName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100 focus:border-blue-500 outline-none"
                  placeholder="Masukkan nama ONT"
                  maxLength={32}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">ONT Description</label>
                <textarea
                  value={editOntDesc}
                  onChange={(e) => setEditOntDesc(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100 focus:border-blue-500 outline-none resize-none"
                  placeholder="Masukkan deskripsi ONT"
                  maxLength={128}
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-700 bg-slate-800/80 flex items-center justify-between">
              <button
                onClick={handleViewDetail}
                className="cursor-pointer px-4 py-2 text-xs font-medium text-blue-400 hover:text-blue-300 hover:underline transition"
              >
                View Detail
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setEditingOnt(null)}
                  className="cursor-pointer px-4 py-2 text-xs font-medium text-slate-300 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={isSavingEdit || !editOntName.trim()}
                  className="cursor-pointer px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSavingEdit ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <span>Apply</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingWifi && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-700 shadow-2xl rounded-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between bg-slate-800/80">
              <h3 className="font-bold text-slate-100 flex items-center gap-2">
                <Settings size={16} className="text-blue-400" />
                Setting WiFi (WLAN)
              </h3>
              <button
                onClick={() => setEditingWifi(null)}
                className="text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto max-h-[70vh] flex flex-col gap-4 text-xs custom-scrollbar">
              {/* Warning banner when WLAN is disabled */}
              {editingWifi.enable === 0 && Number(wifiEnable) === 0 && (
                <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                  <span className="text-yellow-400 mt-0.5">⚠️</span>
                  <p className="text-yellow-300 text-[11px] leading-relaxed">
                    WLAN sedang <strong>Disable</strong>. Hanya status yang dapat diubah. Ubah Status WiFi ke <strong>Enable</strong> untuk mengakses semua pengaturan.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {/* Instance (always shown) */}
                <div className="flex flex-col gap-1">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Instance</span>
                  <input
                    type="text"
                    value={editingWifi.instance ?? '-'}
                    readOnly
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-slate-400 outline-none cursor-not-allowed"
                  />
                </div>

                {/* Status WiFi (always shown) */}
                <div className="flex flex-col gap-1">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Status WiFi</span>
                  <select
                    value={wifiEnable}
                    onChange={(e) => setWifiEnable(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100 focus:border-blue-500 outline-none cursor-pointer"
                  >
                    <option value={1}>Enable</option>
                    <option value={0}>Disable</option>
                  </select>
                </div>

                {/* Full fields — only shown when WLAN is being enabled */}
                {Number(wifiEnable) === 1 && (
                  <>
                    <div className="flex flex-col gap-1">
                      <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">SSID (Nama WiFi)</span>
                      <input
                        type="text"
                        value={wifiSsid}
                        onChange={(e) => setWifiSsid(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100 focus:border-blue-500 outline-none"
                        placeholder="Masukkan SSID"
                        maxLength={32}
                      />
                    </div>
                    
                    <div className="flex flex-col gap-1">
                      <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Share Key (Password)</span>
                      <input
                        type="text"
                        value={wifiShareKey}
                        onChange={(e) => setWifiShareKey(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100 focus:border-blue-500 outline-none font-mono"
                        placeholder="Minimal 8 karakter"
                        maxLength={64}
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Security Mode</span>
                      <select
                        value={wifiSecurityMode}
                        disabled
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-2 text-slate-400 outline-none cursor-not-allowed"
                      >
                        <option value={0}>open</option>
                        <option value={3}>wpapsk</option>
                        <option value={4}>wpa2psk</option>
                        <option value={5}>wpa2mixed</option>
                        <option value={1}>wep64bits</option>
                        <option value={2}>wep128bits</option>
                      </select>
                    </div>

                    {[3, 4, 5].includes(Number(wifiSecurityMode)) && (
                      <div className="flex flex-col gap-1">
                        <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">WPA Encryption</span>
                        <select
                          value={wifiWpaEncrypt}
                          onChange={(e) => setWifiWpaEncrypt(Number(e.target.value))}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100 focus:border-blue-500 outline-none cursor-pointer"
                        >
                          <option value={0}>TKIP</option>
                          <option value={1}>AES</option>
                          <option value={2}>TKIP/AES</option>
                        </select>
                      </div>
                    )}

                    {[1, 2].includes(Number(wifiSecurityMode)) && (
                      <div className="flex flex-col gap-1">
                        <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">WEP Auth Type</span>
                        <select
                          value={wifiWepAuth}
                          onChange={(e) => setWifiWepAuth(Number(e.target.value))}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100 focus:border-blue-500 outline-none cursor-pointer"
                        >
                          <option value={0}>open</option>
                          <option value={1}>share</option>
                          <option value={2}>share and open auto</option>
                        </select>
                      </div>
                    )}

                    <div className="flex flex-col gap-1">
                      <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Channel</span>
                      <select
                        value={wifiChannel}
                        onChange={(e) => setWifiChannel(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100 focus:border-blue-500 outline-none cursor-pointer"
                      >
                        <option value={0}>Auto</option>
                        {Array.from({ length: 13 }, (_, i) => i + 1).map(ch => (
                          <option key={ch} value={ch}>Channel {ch}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Bandwidth</span>
                      <select
                        value={wifiBandwidth}
                        onChange={(e) => setWifiBandwidth(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100 focus:border-blue-500 outline-none cursor-pointer"
                      >
                        <option value={0}>20 MHz</option>
                        <option value={1}>40 MHz</option>
                        <option value={2}>Auto</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Short Guard Interval (GI)</span>
                      <select
                        value={wifiShortgi}
                        onChange={(e) => setWifiShortgi(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100 focus:border-blue-500 outline-none cursor-pointer"
                      >
                        <option value={1}>Enable</option>
                        <option value={0}>Disable</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">WiFi Isolation</span>
                      <select
                        value={wifiIsolation}
                        onChange={(e) => setWifiIsolation(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100 focus:border-blue-500 outline-none cursor-pointer"
                      >
                        <option value={1}>Enable</option>
                        <option value={0}>Disable</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Broadcast SSID</span>
                      <select
                        value={wifiBroadcast}
                        onChange={(e) => setWifiBroadcast(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100 focus:border-blue-500 outline-none cursor-pointer"
                      >
                        <option value={1}>Enable</option>
                        <option value={0}>Disable</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Beacon Interval</span>
                      <input
                        type="number"
                        value={wifiBeacon}
                        onChange={(e) => setWifiBeacon(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100 focus:border-blue-500 outline-none"
                        placeholder="Default 100"
                        min={20}
                        max={1000}
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">DTIM Period</span>
                      <input
                        type="number"
                        value={wifiDtim}
                        onChange={(e) => setWifiDtim(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100 focus:border-blue-500 outline-none"
                        placeholder="Default 1"
                        min={1}
                        max={255}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-700 bg-slate-800/80 flex items-center justify-end gap-3">
              <button
                onClick={() => setEditingWifi(null)}
                className="cursor-pointer px-4 py-2 text-xs font-medium text-slate-300 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveWifi}
                disabled={isSavingWifi || (Number(wifiEnable) === 1 && !wifiSsid.trim())}
                className="cursor-pointer px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingWifi ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <span>Apply</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedOnt && (
        <OntDetailModal
          ontIdString={selectedOnt.ontIdString}
          portId={selectedOnt.portId}
          ontId={selectedOnt.ontId}
          canManageOlt={canManageOlt}
          onRebootSuccess={() => fetchData(true)}
          onEditNameDesc={(name, desc) => {
            setEditingOnt({
              portId: selectedOnt.portId,
              ontId: selectedOnt.ontId,
              ontIdString: selectedOnt.ontIdString,
            });
            setEditOntName(name);
            setEditOntDesc(desc);
            setSelectedOnt(null);
          }}
          onClose={() => setSelectedOnt(null)}
        />
      )}

      {/* Reboot ONT Confirmation Modal */}
      {showRebootOntConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
              <h3 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
                <Power size={16} className="text-red-400" />
                Konfirmasi Reboot ONT
              </h3>
              <button onClick={() => setShowRebootOntConfirm(false)} className="cursor-pointer text-slate-400 hover:text-slate-200 transition">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-300 leading-relaxed">
                Apakah Anda yakin ingin me-reboot ONT ini?
              </p>
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg">
                ⚠️ ONT akan offline sementara selama proses reboot berlangsung.
              </div>
              <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-700/30">
                <button
                  type="button"
                  onClick={() => setShowRebootOntConfirm(false)}
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-slate-300 font-medium transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setShowRebootOntConfirm(false);
                    try {
                      const { portId, ontId } = rebootOntAction;
                      const identifier = (Number(portId) << 8) | Number(ontId);
                      const payload = {
                        method: "set",
                        param: {
                          identifier,
                          flags: 4,
                          ont_name: "",
                          ont_description: "",
                        },
                      };
                      const response = await axios.post("/api/hsgq-olt?action=set_info", payload);
                      if (response.data && response.data.code === 1) {
                        showToast("Reboot command berhasil dikirim!", "success");
                        setRebootTimestamp(Date.now());
                        setTimeout(() => fetchData(true), 3000);
                      } else {
                        showToast("Gagal reboot ONT: " + (response.data?.message || "Error tidak diketahui"));
                      }
                    } catch (err) {
                      showToast("Gagal reboot ONT: " + (err.response?.data?.error || err.message));
                    }
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 border border-red-500 text-xs text-white font-semibold transition cursor-pointer"
                >
                  <Power size={13} />
                  Ya, Reboot
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}