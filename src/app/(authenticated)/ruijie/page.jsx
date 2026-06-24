"use client";
import { useState, useEffect } from "react";
import axios from "axios";
import { API_URL, socket, useAppState } from "@/App";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Search,
  Clock,
  Users,
  Activity,
} from "lucide-react";

export default function Ruijie() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const { setLastSyncTime } = useAppState();

  const fetchDevices = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_URL}/ruijie`);
      setDevices(res.data || []);
      setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
    } catch (e) {
      setError(e.message || "Gagal mengambil data Ruijie");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();

    if (socket) {
      const handleUpdate = (data) => {
        setDevices(data || []);
        setLastSyncTime(new Date().toLocaleTimeString("id-ID"));
      };

      socket.on("ruijie_update", handleUpdate);

      return () => {
        socket.off("ruijie_update", handleUpdate);
      };
    }
  }, []);

  const filteredDevices = devices.filter((d) => {
    const term = search.toLowerCase();
    const matchesSearch =
      !term ||
      (d.alias && d.alias.toLowerCase().includes(term)) ||
      (d.mac_address && d.mac_address.toLowerCase().includes(term)) ||
      (d.sn && d.sn.toLowerCase().includes(term)) ||
      (d.ip_address && d.ip_address.includes(term));

    if (!matchesSearch) return false;

    if (filterStatus !== "all") {
      if (filterStatus === "ON" && d.status !== "ON") return false;
      if (filterStatus === "OFF" && d.status !== "OFF") return false;
    }

    if (filterType !== "all") {
      if (d.connection_type !== filterType) return false;
    }

    return true;
  });

  const totalAp = filteredDevices.length;
  const totalOnline = filteredDevices.filter((d) => d.status === "ON").length;
  const totalOffline = filteredDevices.filter((d) => d.status === "OFF").length;
  const totalClients = filteredDevices.reduce(
    (sum, d) => sum + (Number(d.clients) || 0),
    0,
  );

  const getStatusDisplay = (device) => {
    const isOnline = device.status === "ON";

    if (isOnline) {
      return (
        <div className="flex flex-col items-end md:items-start">
          <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-400 w-max flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Online
          </span>
          {device.last_log_history && (
            <span className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
              <Clock size={10} /> Sejak {device.last_log_history}
            </span>
          )}
        </div>
      );
    } else {
      return (
        <div className="flex flex-col items-end md:items-start">
          <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-slate-700 text-slate-400 w-max flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
            Offline
          </span>
          {device.last_online && (
            <span className="text-[10px] text-red-400/80 mt-1 flex items-center gap-1">
              <Clock size={10} /> Sejak {device.last_online}
            </span>
          )}
        </div>
      );
    }
  };

  const dataPanelClass =
    "flex-1 min-h-0 flex flex-col bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden";
  const dataScrollClass = "flex-1 min-h-0 overflow-y-auto overscroll-contain";

  return (
    <div className="h-full min-h-0 flex flex-col gap-4 overflow-hidden relative">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <Wifi size={24} className="text-blue-400" />
            Ruijie AP Monitoring
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Daftar perangkat Access Point Ruijie Reyee
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={fetchDevices}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition shadow-lg 'bg-blue-600 hover:bg-blue-700 border border-blue-500 text-white shadow-blue-500/20 cursor-pointer"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />{" "}
            Sync Sekarang
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {!loading && !error && devices.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 flex-shrink-1">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 flex-1 min-w-[150px] flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
              <Activity size={20} className="text-indigo-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Total AP
              </p>
              <p className="text-2xl font-bold text-slate-100">{totalAp}</p>
            </div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 flex-1 min-w-[150px] flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <Wifi size={20} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Total Online
              </p>
              <p className="text-2xl font-bold text-slate-100">{totalOnline}</p>
            </div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 flex-1 min-w-[150px] flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <WifiOff size={20} className="text-red-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Total Offline
              </p>
              <p className="text-2xl font-bold text-slate-100">
                {totalOffline}
              </p>
            </div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 flex-1 min-w-[150px] flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <Users size={20} className="text-blue-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Total Client
              </p>
              <p className="text-2xl font-bold text-slate-100">
                {totalClients}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className={dataPanelClass}>
        <div className="p-4 border-b border-slate-700/30 flex items-center gap-3 flex-shrink-0 flex-wrap">
          <h2 className="font-semibold text-slate-200 text-sm flex-shrink-0">
            Daftar AP
          </h2>

          <div className="relative flex-1 min-w-[200px]">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              type="text"
              placeholder="Cari Alias, MAC, SN, atau IP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-sm text-slate-100 focus:border-blue-500 outline-none w-full"
            />
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-300 outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="all">Semua Tipe</option>
            <option value="L2TP">L2TP</option>
            <option value="PPPOE">PPPoE</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-300 outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="all">Semua Status</option>
            <option value="ON">Online</option>
            <option value="OFF">Offline</option>
          </select>

          <div className="flex items-center gap-3 ml-auto flex-shrink-0">
            <span className="text-xs text-slate-500 font-medium">
              Menampilkan {filteredDevices.length} dari {devices.length} AP
            </span>
          </div>
        </div>

        <div className={dataScrollClass}>
          {loading && devices.length === 0 ? (
            <div className="flex-1 flex flex-col gap-2 p-3 min-h-[300px]">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="w-full h-12 bg-slate-700/30 rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-red-400">
              <WifiOff size={24} />
              <p className="text-sm">{error}</p>
            </div>
          ) : (
            <>
              {/* Mobile card view */}
              <div className="md:hidden divide-y divide-slate-700/30">
                {filteredDevices.length === 0 ? (
                  <p className="text-center py-12 text-slate-500 text-base">
                    Tidak ada data AP
                  </p>
                ) : (
                  filteredDevices.map((d, i) => (
                    <div
                      key={i}
                      className="px-5 py-4 flex items-start justify-between gap-4 hover:bg-slate-700/20 transition"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-100 text-base flex items-center gap-2">
                          <span className="truncate">{d.alias || "-"}</span>
                          <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400 border border-slate-600/50">
                            {d.connection_type || "Unknown"}
                          </span>
                        </p>
                        <p className="text-sm text-slate-400 mt-1">
                          {d.ip_address || "-"} ·{" "}
                          <span className="font-mono text-xs">
                            {d.mac_address}
                          </span>
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800/80 px-2 py-1 rounded-md border border-slate-700/50">
                            <Users size={12} className="text-blue-400" />{" "}
                            {d.clients || 0} Klien
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            SN: {d.sn}
                          </span>
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        {getStatusDisplay(d)}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop table view */}
              <div className="hidden md:block min-h-0">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-slate-700/30 bg-slate-800/95 backdrop-blur">
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Alias
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        MAC Address
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        MGMT IP
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Clients
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        SN
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDevices.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="text-center py-12 text-slate-500"
                        >
                          Tidak ada data AP
                        </td>
                      </tr>
                    ) : (
                      filteredDevices.map((d, i) => (
                        <tr
                          key={i}
                          className="border-b border-slate-700/20 hover:bg-slate-700/20 transition"
                        >
                          <td className="px-4 py-3">{getStatusDisplay(d)}</td>
                          <td className="px-4 py-3 font-medium text-slate-200">
                            <div className="flex items-center gap-2">
                              <span>{d.alias || "-"}</span>
                              <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400 border border-slate-600/50">
                                {d.connection_type || "Unknown"}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                            {d.mac_address || "-"}
                          </td>
                          <td className="px-4 py-3 text-slate-300 font-mono text-xs">
                            {d.ip_address || "-"}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-300 bg-slate-900 px-2 py-1 rounded-md border border-slate-700">
                              <Users size={12} className="text-blue-400" />{" "}
                              {d.clients || 0}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                            {d.sn}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
