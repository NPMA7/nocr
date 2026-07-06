"use client";
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
  EyeOff
} from "lucide-react";
import { socket, useAppState } from "@/App";
import { getStoredUser, hasAccess } from "@/lib/roles";

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

  const { sessionUser } = useAppState();
  const [userData, setUserData] = useState(() => getStoredUser());
  
  useEffect(() => {
    if (sessionUser?.username) setUserData(sessionUser);
  }, [sessionUser]);

  const canManageOlt = hasAccess(userData, 'devices-hsgq', 'update');
  const canRead = hasAccess(userData, 'devices-hsgq', 'read');

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
                wifi: [{ ...currentWifi, [payload.field]: payload.value }]
              };
            }
          }
          return row;
        })
      );
    };

    socket.on('hsgq_wifi_update', handleWifiUpdate);
    return () => {
      socket.off('hsgq_wifi_update', handleWifiUpdate);
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
    if (!canManageOlt) {
      alert("Akses Ditolak: Anda tidak memiliki izin untuk mengonfigurasi OLT");
      return;
    }
    
    try {
      const wifi = row.wifi && row.wifi[0];
      if (!wifi) return;

      const newValue = currentValue === 1 ? 0 : 1;
      const param = {
        identifier: row.identifier,
        flags: 4096,
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
      alert(
        "Failed to update wifi config: " +
          (err.response?.data?.error || err.message),
      );
      fetchData(); // Revert on failure
    }
  };

  useEffect(() => {
    if (canRead) fetchData();
  }, [activeTab, canRead]);

  // Calculate stats dynamically from API data
  const stats = {
    registered: data.filter((item) => {
      const isArray = Array.isArray(item);
      const stateVal = isArray ? item[3] : item.state;
      return stateVal === 1;
    }).length,
    unregistered: data.filter((item) => {
      const isArray = Array.isArray(item);
      const stateVal = isArray ? item[3] : item.state;
      return stateVal === 0;
    }).length,
    online: data.filter((item) => {
      const isArray = Array.isArray(item);
      const rstateVal = isArray ? item[4] : item.rstate;
      return rstateVal === 1;
    }).length,
    offline: data.filter((item) => {
      const isArray = Array.isArray(item);
      const rstateVal = isArray ? item[4] : item.rstate;
      // Asumsi: 1 = online, 0 = initial, 2 (atau lainnya) = offline
      return rstateVal !== 1 && rstateVal !== 0;
    }).length,
  };

  const filteredData = data.filter((row, idx) => {
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

  return (
    <div className="max-w-full h-full flex flex-col">
      {/* Header Tabs */}
      <div className="flex-shrink-0 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <Server size={24} className="text-purple-400" />
            HSGQ OLT
          </h1>
          <p className="text-sm text-slate-400 mt-1">
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
        ].map((tab, idx) => (
          <button
            key={idx}
            onClick={() => {
              setActiveTab(tab);
              setDisplayType("All");
              setDisplayValue("");
              setCurrentPage(1);
            }}
            className={`cursor-pointer px-4 py-3 whitespace-nowrap text-sm font-medium transition-colors ${
              activeTab === tab
                ? "text-blue-400 border-b-2 border-blue-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-sm">Query Method:</span>
          <select
            className="bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
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
              className="cursor-pointer bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 w-32"
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
              className="bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 w-48"
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
                className="flex bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-md text-sm border border-blue-500/20 cursor-pointer hover:bg-blue-500/20 transition-colors"
              >
                Registered: {stats.registered}
              </div>
              <div
                onClick={() => {
                  setDisplayType("Running state");
                  setDisplayValue("initial");
                  setCurrentPage(1);
                }}
                className="flex bg-red-500/10 text-red-400 px-3 py-1.5 rounded-md text-sm border border-red-500/20 cursor-pointer hover:bg-red-500/20 transition-colors"
              >
                Unregistered: {stats.unregistered}
              </div>
              <div
                onClick={() => {
                  setDisplayType("Running state");
                  setDisplayValue("online");
                  setCurrentPage(1);
                }}
                className="flex bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-md text-sm border border-emerald-500/20 cursor-pointer hover:bg-emerald-500/20 transition-colors"
              >
                Online: {stats.online}
              </div>
              <div
                onClick={() => {
                  setDisplayType("Running state");
                  setDisplayValue("offline");
                  setCurrentPage(1);
                }}
                className="flex bg-rose-500/10 text-rose-400 px-3 py-1.5 rounded-md text-sm border border-rose-500/20 cursor-pointer hover:bg-rose-500/20 transition-colors"
              >
                Offline: {stats.offline}
              </div>
            </>
          )}

          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={fetchData}
              className="cursor-pointer flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-1.5 rounded-md text-sm transition-colors"
            >
              <RefreshCw size={14} /> Refresh
            </button>
            <button
              onClick={() => {
                setDisplayType("All");
                setDisplayValue("");
              }}
              className="cursor-pointer flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-1.5 rounded-md text-sm transition-colors"
            >
              Reset Query
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 flex flex-col flex-1 overflow-hidden min-h-[400px]">
        <div className="overflow-auto flex-1">
          <table className="w-full text-left text-sm text-slate-300 relative">
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading ? (
                <tr>
                  <td
                    colSpan="12"
                    className="px-4 py-8 text-center text-slate-400"
                  >
                    Loading data...
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td
                    colSpan="11"
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

                  if (activeTab === "Version Information") {
                    const devType = isArray
                      ? row[3]
                      : row.dev_type || row.device_type || "-";
                    const vendorId = isArray ? row[4] : row.vendorid || "-";
                    const ontVersion = isArray
                      ? row[5]
                      : row.ont_version || "-";
                    const equipId = isArray ? row[6] : row.equipmentid || "-";
                    const mainVer = isArray ? row[7] : row.mainversion || "-";
                    const stbVer = isArray ? row[8] : row.stbversion || "-";

                    return (
                      <tr
                        key={idx}
                        className="hover:bg-slate-700/20 transition-colors"
                      >
                        <td className="px-4 py-3">{ontId}</td>
                        <td className="px-4 py-3">{name}</td>
                        <td className="px-4 py-3">{sn}</td>
                        <td className="px-4 py-3">{devType}</td>
                        <td className="px-4 py-3">{vendorId}</td>
                        <td className="px-4 py-3">{ontVersion}</td>
                        <td className="px-4 py-3">{equipId}</td>
                        <td className="px-4 py-3">{mainVer}</td>
                        <td className="px-4 py-3">{stbVer}</td>
                      </tr>
                    );
                  }

                  if (activeTab === "Bind Profile Info") {
                    const devType = isArray
                      ? row[3]
                      : row.dev_type || row.device_type || "-";
                    const equipId = isArray ? row[4] : row.equipmentid || "-";
                    const lprofId = isArray ? row[5] : (row.lprofid ?? "-");
                    const lprofName = isArray ? row[6] : row.lprofname || "-";
                    const sprofId = isArray ? row[7] : (row.sprofid ?? "-");
                    const sprofName = isArray ? row[8] : row.sprofname || "-";

                    return (
                      <tr
                        key={idx}
                        className="hover:bg-slate-700/20 transition-colors"
                      >
                        <td className="px-4 py-3">{ontId}</td>
                        <td className="px-4 py-3">{name}</td>
                        <td className="px-4 py-3">{sn}</td>
                        <td className="px-4 py-3">{devType}</td>
                        <td className="px-4 py-3">{equipId}</td>
                        <td className="px-4 py-3">{lprofId}</td>
                        <td className="px-4 py-3">{lprofName}</td>
                        <td className="px-4 py-3">{sprofId}</td>
                        <td className="px-4 py-3">{sprofName}</td>
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
                    const channel = wifi.channel === 0 ? "auto" : wifi.channel;

                    return (
                      <tr
                        key={idx}
                        className="hover:bg-slate-700/20 transition-colors"
                      >
                        <td className="px-4 py-3">{ontId}</td>
                        <td className="px-4 py-3">{name}</td>
                        <td className="px-4 py-3">{sn}</td>
                        <td className="px-4 py-3">{typeStr}</td>
                        <td className="px-4 py-3">
                          <div
                            className={`flex flex-col gap-1 ${canManageOlt ? 'cursor-pointer group' : 'cursor-not-allowed opacity-60'}`}
                            onClick={() =>
                              canManageOlt && handleWifiToggle(row, "enable", wifi.enable)
                            }
                          >
                            <span className={`text-xs transition-colors ${canManageOlt ? 'text-slate-300 group-hover:text-blue-400' : 'text-slate-400'}`}>
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
                              {visiblePasswords[ontId] ? sharekey : "••••••••"}
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
                                title={visiblePasswords[ontId] ? "Sembunyikan Password" : "Lihat Password"}
                              >
                                {visiblePasswords[ontId] ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">{bandwidth}</td>
                        <td className="px-4 py-3">
                          <div
                            className={`flex flex-col gap-1 ${canManageOlt ? 'cursor-pointer group' : 'cursor-not-allowed opacity-60'}`}
                            onClick={() =>
                              canManageOlt && handleWifiToggle(row, "isolation", wifi.isolation)
                            }
                          >
                            <span className={`text-xs transition-colors ${canManageOlt ? 'text-slate-300 group-hover:text-blue-400' : 'text-slate-400'}`}>
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
                            className={`flex flex-col gap-1 ${canManageOlt ? 'cursor-pointer group' : 'cursor-not-allowed opacity-60'}`}
                            onClick={() =>
                              canManageOlt && handleWifiToggle(row, "broadcast", wifi.broadcast)
                            }
                          >
                            <span className={`text-xs transition-colors ${canManageOlt ? 'text-slate-300 group-hover:text-blue-400' : 'text-slate-400'}`}>
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
                      </tr>
                    );
                  }

                  // Parsing state fields
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
                      <td className="px-4 py-3">{ontId}</td>
                      <td className="px-4 py-3">{name}</td>
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
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700/50 text-sm text-slate-400">
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
                  if (currentPage === "" || currentPage < 1) setCurrentPage(1);
                  if (currentPage > totalPages) setCurrentPage(totalPages);
                }}
                className="w-12 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-center"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
