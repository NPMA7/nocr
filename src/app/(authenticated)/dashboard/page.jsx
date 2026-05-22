'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Router, ArrowUpRight, AlertTriangle, Users, Map as MapIcon, Cpu, Clock, HardDrive, Server, CheckCircle2, AlertCircle, Info, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { API_URL, socket, useAppState } from '@/App';
import dynamic from 'next/dynamic';

const DashboardMap = dynamic(() => import('@/components/DashboardMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-800 flex items-center justify-center text-slate-400">
      Memuat Peta...
    </div>
  )
});

const POLL_INTERVAL_MS = 15000;

export default function Dashboard() {
  const router = useRouter();
  const { alerts, isConnected } = useAppState();

  const [coreStatus, setCoreStatus] = useState(null);
  const [coreInterfaces, setCoreInterfaces] = useState([]);
  const [edges, setEdges] = useState([]);
  const [topologyNodes, setTopologyNodes] = useState([]);
  const [mapTheme, setMapTheme] = useState('colored');
  const [lastUpdated, setLastUpdated] = useState(null);
  const mountedRef = useRef(true);

  const getLogStyle = (msg) => {
    const lowercaseMsg = msg.toLowerCase();
    if (lowercaseMsg.includes('berhasil') || lowercaseMsg.includes('online')) {
      return {
        bgColor: 'bg-emerald-950/10 border-emerald-500/20 text-slate-300',
        icon: 'check'
      };
    }
    if (lowercaseMsg.includes('gagal') || lowercaseMsg.includes('offline') || lowercaseMsg.includes('dihapus')) {
      return {
        bgColor: 'bg-rose-950/10 border-rose-500/20 text-slate-300',
        icon: 'alert'
      };
    }
    if (lowercaseMsg.includes('simpan') || lowercaseMsg.includes('diperbarui') || lowercaseMsg.includes('ditambahkan')) {
      return {
        bgColor: 'bg-amber-950/10 border-amber-500/20 text-slate-300',
        icon: 'settings'
      };
    }
    return {
      bgColor: 'bg-blue-950/10 border-blue-500/20 text-slate-300',
      icon: 'info'
    };
  };

  const fetchCoreStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/devices/core/status?max_age=12`);
      if (mountedRef.current) {
        setCoreStatus(res.data);
        setLastUpdated(new Date());
      }
    } catch {
      if (mountedRef.current) setCoreStatus(null);
    }
  }, []);

  const fetchInterfaces = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/devices/core/interfaces?max_age=12`);
      if (mountedRef.current) setCoreInterfaces(res.data || []);
    } catch {
      if (mountedRef.current) setCoreInterfaces([]);
    }
  }, []);

  const fetchTopology = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/topology`);
      if (mountedRef.current) {
        setEdges(res.data.edges || []);
        setTopologyNodes(res.data.nodes || []);
        setLastUpdated(new Date());
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchAllDashboardData = useCallback(async () => {
    await Promise.all([fetchCoreStatus(), fetchInterfaces(), fetchTopology()]);
  }, [fetchCoreStatus, fetchInterfaces, fetchTopology]);

  const applyTopologyPayload = useCallback((nodes, edgesPayload) => {
    if (nodes) setTopologyNodes(nodes);
    if (edgesPayload) setEdges(edgesPayload);
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchAllDashboardData();

    const pollId = setInterval(fetchAllDashboardData, POLL_INTERVAL_MS);

    const handleCoreUpdate = (data) => {
      if (data) {
        setCoreStatus(data);
        setLastUpdated(new Date());
      }
    };

    const handleTopologyUpdated = (payload) => {
      if (payload?.nodes) applyTopologyPayload(payload.nodes, payload.edges || []);
    };

    const handleTopologyRefresh = () => fetchTopology();

    const handleInterfaceUpdate = () => fetchInterfaces();

    const handlePppoeUpdate = () => fetchCoreStatus();

    const handleDeviceStatus = ({ id, status }) => {
      if (!id || !status) return;
      setTopologyNodes((prev) =>
        prev.map((n) => (n.id === id || n.device_id === id ? { ...n, status } : n))
      );
    };

    if (socket) {
      socket.on('dashboard_core_update', handleCoreUpdate);
      socket.on('topology_updated', handleTopologyUpdated);
      socket.on('dashboard_topology_refresh', handleTopologyRefresh);
      socket.on('interface_update', handleInterfaceUpdate);
      socket.on('pppoe_active_update', handlePppoeUpdate);
      socket.on('device-status', handleDeviceStatus);
    }

    return () => {
      mountedRef.current = false;
      clearInterval(pollId);
      if (socket) {
        socket.off('dashboard_core_update', handleCoreUpdate);
        socket.off('topology_updated', handleTopologyUpdated);
        socket.off('dashboard_topology_refresh', handleTopologyRefresh);
        socket.off('interface_update', handleInterfaceUpdate);
        socket.off('pppoe_active_update', handlePppoeUpdate);
        socket.off('device-status', handleDeviceStatus);
      }
    };
  }, [fetchAllDashboardData, fetchTopology, fetchInterfaces, fetchCoreStatus, applyTopologyPayload]);

  const totalNodes = topologyNodes.length;
  const oltCount = topologyNodes.filter((n) => n.type === 'olt').length;
  const odcCount = topologyNodes.filter((n) => n.type === 'odc').length;
  const odpCount = topologyNodes.filter((n) => n.type === 'odp').length;
  const clientCount = topologyNodes.filter((n) => n.type === 'client').length;

  const offlineCount = useMemo(() => {
    return topologyNodes.filter((node) => {
      if (node.type?.toLowerCase() === 'core') return false;

      let isDown = false;
      let isDisabled = false;

      if (node.linked_interface) {
        const matchedIface = coreInterfaces.find(
          (i) => i.name && i.name.toLowerCase() === node.linked_interface.toLowerCase()
        );
        if (matchedIface) {
          if (matchedIface.disabled === 'true') isDisabled = true;
          else if (matchedIface.running !== 'true') isDown = true;
        }
      } else {
        const connectedEdges = edges.filter(
          (e) =>
            e.from_node === node.id ||
            e.to_node === node.id ||
            e.from === node.id ||
            e.to === node.id
        );
        if (connectedEdges.length === 0) isDisabled = true;
      }

      if (isDisabled) return false;
      if (isDown) return true;
      if (node.status === 'offline') return true;
      return false;
    }).length;
  }, [topologyNodes, edges, coreInterfaces]);

  return (
    <div className="h-full min-h-0 flex flex-col gap-3 md:gap-4 overflow-y-auto lg:overflow-hidden">
      <div className="flex-shrink-0 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Dashboard Utama</h1>
          <p className="text-sm text-slate-400">Ringkasan status jaringan & resource MikroTik Pusat</p>
        </div>
        <span className="flex items-center gap-1.5 text-[10px] font-semibold bg-slate-800/80 border border-slate-700/50 px-2.5 py-1 rounded-full select-none">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isConnected
                ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)] animate-pulse'
                : 'bg-rose-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]'
            }`}
          />
          <span className="text-slate-400 uppercase tracking-wider">
            {isConnected ? 'Live' : 'Terputus'}
          </span>
          {lastUpdated && (
            <span className="text-slate-500 font-normal normal-case">
              · {lastUpdated.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </span>
      </div>

      {/* Core Router Resources */}
      <div className="flex-shrink-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-800/80 border border-slate-700/50 rounded-xl p-3 flex flex-col justify-center">
          <div className="flex items-center gap-2 text-slate-400 mb-1.5">
            <Cpu size={13} className="text-blue-400" /> <span className="text-[11px] font-semibold uppercase">CPU Load</span>
          </div>
          <span className="text-lg font-bold text-slate-100">{coreStatus ? `${coreStatus.cpu}%` : '--'}</span>
        </div>
        <div className="bg-slate-800/80 border border-slate-700/50 rounded-xl p-3 flex flex-col justify-center">
          <div className="flex items-center gap-2 text-slate-400 mb-1.5">
            <HardDrive size={13} className="text-emerald-400" /> <span className="text-[11px] font-semibold uppercase">Memory Free</span>
          </div>
          <span className="text-lg font-bold text-slate-100">
            {coreStatus ? `${(coreStatus.free_memory / 1024 / 1024).toFixed(1)} MB` : '--'}
          </span>
        </div>
        <div className="bg-slate-800/80 border border-slate-700/50 rounded-xl p-3 flex flex-col justify-center">
          <div className="flex items-center gap-2 text-slate-400 mb-1.5">
            <Clock size={13} className="text-orange-400" /> <span className="text-[11px] font-semibold uppercase">Uptime</span>
          </div>
          <span className="text-lg font-bold text-slate-100">{coreStatus ? coreStatus.uptime : '--'}</span>
        </div>
        <div className="bg-slate-800/80 border border-slate-700/50 rounded-xl p-3 flex flex-col justify-center">
          <div className="flex items-center gap-2 text-slate-400 mb-1.5">
            <Server size={13} className="text-purple-400" /> <span className="text-[11px] font-semibold uppercase">Versi RouterOS</span>
          </div>
          <span className="text-base font-bold text-slate-100">
            {coreStatus ? `${coreStatus.board} (v${coreStatus.version})` : '--'}
          </span>
        </div>
      </div>

      <div className="flex-shrink-0 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-2 md:gap-3">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 rounded-xl p-4 flex flex-col justify-center shadow-lg hover:-translate-y-1 transition duration-300">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Router size={14} className="text-blue-500" /> <span className="text-[10px] font-bold uppercase tracking-wider">Total</span>
          </div>
          <span className="text-xl font-bold text-slate-100">{totalNodes}</span>
        </div>

        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 rounded-xl p-4 flex flex-col justify-center shadow-lg hover:-translate-y-1 transition duration-300">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Server size={14} className="text-purple-500" /> <span className="text-[10px] font-bold uppercase tracking-wider">OLT</span>
          </div>
          <span className="text-xl font-bold text-slate-100">{oltCount}</span>
        </div>

        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 rounded-xl p-4 flex flex-col justify-center shadow-lg hover:-translate-y-1 transition duration-300">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <HardDrive size={14} className="text-cyan-500" /> <span className="text-[10px] font-bold uppercase tracking-wider">ODC</span>
          </div>
          <span className="text-xl font-bold text-slate-100">{odcCount}</span>
        </div>

        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 rounded-xl p-4 flex flex-col justify-center shadow-lg hover:-translate-y-1 transition duration-300">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <MapIcon size={14} className="text-emerald-500" /> <span className="text-[10px] font-bold uppercase tracking-wider">ODP</span>
          </div>
          <span className="text-xl font-bold text-slate-100">{odpCount}</span>
        </div>

        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 rounded-xl p-4 flex flex-col justify-center shadow-lg hover:-translate-y-1 transition duration-300">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Users size={14} className="text-amber-500" /> <span className="text-[10px] font-bold uppercase tracking-wider">Client</span>
          </div>
          <span className="text-xl font-bold text-slate-100">{clientCount}</span>
        </div>

        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 rounded-xl p-4 flex flex-col justify-center shadow-lg hover:-translate-y-1 transition duration-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/10 rounded-full blur-xl -mr-4 -mt-4"></div>
          <div className="flex items-center gap-2 text-red-400 mb-1 relative z-10">
            <AlertTriangle size={14} /> <span className="text-[10px] font-bold uppercase tracking-wider">Offline</span>
          </div>
          <span className="text-xl font-bold text-red-400 relative z-10">{offlineCount}</span>
        </div>

        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 rounded-xl p-4 flex flex-col justify-center shadow-lg hover:-translate-y-1 transition duration-300">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Users size={14} className="text-purple-500" /> <span className="text-[10px] font-bold uppercase tracking-wider">PPPoE Aktif</span>
          </div>
          <span className="text-xl font-bold text-slate-100">{coreStatus ? coreStatus.pppoe_active : '--'}</span>
        </div>
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-orange-500/20 rounded-xl p-4 flex flex-col justify-center shadow-lg hover:-translate-y-1 transition duration-300">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <ArrowUpRight size={14} className="text-orange-500" /> <span className="text-[10px] font-bold uppercase tracking-wider">L2TP Aktif</span>
          </div>
          <span className="text-xl font-bold text-orange-400">{coreStatus ? (coreStatus.l2tp_active ?? '--') : '--'}</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
        <div className="lg:col-span-2 bg-slate-800 border border-slate-700/50 rounded-xl p-4 md:p-5 flex flex-col min-h-0 relative overflow-hidden group">
          <h3 className="flex-shrink-0 text-base font-semibold border-b border-slate-700/30 pb-3 mb-3 text-slate-200 flex justify-between items-center gap-2">
            Pratinjau Jaringan
            <div className="flex items-center gap-2 z-10">
              <button
                onClick={() => setMapTheme((t) => (t === 'dark' ? 'colored' : 'dark'))}
                className="cursor-pointer text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1 rounded flex items-center gap-1 transition"
              >
                {mapTheme === 'dark' ? (
                  <>
                    <span className="fa fa-sun" /> Mode Terang
                  </>
                ) : (
                  <>
                    <span className="fa fa-moon" /> Mode Gelap
                  </>
                )}
              </button>
              <button
                onClick={() => router.push('/topology')}
                className="cursor-pointer text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded flex items-center gap-1 transition"
              >
                <MapIcon size={12} /> Buka Peta Lengkap
              </button>
            </div>
          </h3>
          <div className="flex-1 min-h-0 rounded-lg overflow-hidden border border-slate-700 relative">
            <DashboardMap
              topologyNodes={topologyNodes}
              edges={edges}
              coreInterfaces={coreInterfaces}
              mapTheme={mapTheme}
            />
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700/50 rounded-xl p-4 md:p-5 flex flex-col min-h-0 min-h-[240px] lg:min-h-0">
          <style>{`
            .custom-scrollbar::-webkit-scrollbar {
              width: 4px;
            }
            .custom-scrollbar::-webkit-scrollbar-track {
              background: rgba(15, 23, 42, 0.1);
            }
            .custom-scrollbar::-webkit-scrollbar-thumb {
              background: rgba(148, 163, 184, 0.3);
              border-radius: 4px;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover {
              background: rgba(148, 163, 184, 0.5);
            }
          `}</style>
          <h3 className="flex-shrink-0 text-base font-semibold border-b border-slate-700/30 pb-3 mb-3 text-slate-200 flex justify-between items-center">
            <span>Log Aktivitas</span>
            <span className="flex items-center gap-1.5 text-[10px] font-semibold bg-slate-900/60 border border-slate-700/50 px-2 py-0.5 rounded-full select-none">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isConnected
                    ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)] animate-pulse'
                    : 'bg-rose-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]'
                }`}
              />
              <span className="text-slate-400 uppercase tracking-wider">{isConnected ? 'Live' : 'Terputus'}</span>
            </span>
          </h3>
          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5 custom-scrollbar">
            {alerts &&
              alerts.map((a, i) => {
                const style = getLogStyle(a.msg);
                return (
                  <div
                    key={i}
                    className={`flex gap-3 p-3 rounded-lg border text-xs transition duration-200 hover:translate-x-0.5 ${style.bgColor}`}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {style.icon === 'check' && <CheckCircle2 size={14} className="text-emerald-400" />}
                      {style.icon === 'alert' && <AlertCircle size={14} className="text-rose-400" />}
                      {style.icon === 'settings' && <Settings size={14} className="text-amber-400" />}
                      {style.icon === 'info' && <Info size={14} className="text-blue-400" />}
                    </div>
                    <div className="flex-1 flex flex-col gap-1 min-w-0">
                      <span className="text-slate-200 leading-relaxed break-words">{a.msg}</span>
                      <span className="text-[9px] text-slate-500 font-mono self-start uppercase">
                        {new Date(a.time).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}{' '}
                        {new Date(a.time).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>
                );
              })}
            {(!alerts || alerts.length === 0) && (
              <div className="flex flex-col items-center justify-center flex-1 py-12 text-slate-500 gap-2">
                <Info size={24} className="text-slate-600 animate-pulse" />
                <span className="text-sm">Belum ada aktivitas</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
