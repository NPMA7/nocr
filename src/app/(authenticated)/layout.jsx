'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import { socket, AppStateContext, API_URL } from '@/App';
import { applySessionUser, getStoredUser, getRoleLabel } from '@/lib/roles';
import axios from 'axios';
import { Network } from 'lucide-react';

export default function AuthenticatedLayout({ children }) {
  const router = useRouter();
  const [tokenChecked, setTokenChecked] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [devices, setDevices] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [sessionUser, setSessionUser] = useState(() =>
    typeof window !== 'undefined' ? getStoredUser() : {}
  );
  const [lastSyncTime, setLastSyncTime] = useState(null);

  const showToast = (message, type = 'success', duration = 4000) => {
    setToast({ message, type });
    const timer = setTimeout(() => {
      setToast(null);
    }, duration);
    return timer;
  };

  useEffect(() => {
    // Auth check
    const token = localStorage.getItem('nocr_token');
    if (!token) {
      router.push('/login');
      return;
    }
    setTokenChecked(true);
  }, [router]);

  const fetchDevices = async () => {
    try {
      const res = await axios.get(`${API_URL}/devices`);
      setDevices(res.data);
    } catch (e) {
      console.error("Gagal mengambil perangkat", e);
    }
  };

  const refreshSessionUser = async () => {
    try {
      const prev = getStoredUser();
      const res = await axios.get(`${API_URL}/auth/me`);
      if (res.data?.user) {
        const next = applySessionUser(res.data.user);
        setSessionUser(next);
        if (prev.role && next?.role && prev.role !== next.role) {
          showToast(`Peran Anda diubah menjadi ${getRoleLabel(next.role)}`, 'warning');
        }
      }
    } catch (e) {
      console.error('Gagal memuat sesi user', e);
    }
  };

  useEffect(() => {
    if (!tokenChecked) return;

    const handleRoleEvent = (e) => {
      if (e.detail) setSessionUser(e.detail);
    };
    window.addEventListener('nocr-role-updated', handleRoleEvent);

    refreshSessionUser();
    const rolePoll = setInterval(refreshSessionUser, 60000);
    const onFocus = () => refreshSessionUser();
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(rolePoll);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('nocr-role-updated', handleRoleEvent);
    };
  }, [tokenChecked]);

  useEffect(() => {
    if (!tokenChecked) return;

    if (socket) {
      const handleConnect = () => setIsConnected(true);
      const handleDisconnect = () => setIsConnected(false);
      
      const handleStatus = (data) => {
        setAlerts(prev => [{ time: data.time ? new Date(data.time) : new Date(), msg: data.message || data.msg }, ...prev].slice(0, 10));
      };

      const handleInitialLogs = (logs) => {
        if (Array.isArray(logs)) {
          setAlerts(logs.map(log => ({ time: new Date(log.time), msg: log.message })));
        }
      };

      const handleDeviceStatus = (data) => {
        setDevices(prev => prev.map(d => d.id === data.id ? { ...d, status: data.status } : d));
      };

      const handleRoleUpdated = (payload) => {
        const me = getStoredUser();
        if (
          payload?.userId && (payload.userId === me.id || payload.username === me.username)
        ) {
          refreshSessionUser();
        }
      };

      socket.on('connect', handleConnect);
      socket.on('disconnect', handleDisconnect);
      socket.on('status', handleStatus);
      socket.on('initial_logs', handleInitialLogs);
      socket.on('device-status', handleDeviceStatus);
      socket.on('user_role_updated', handleRoleUpdated);

      socket.emit('request_initial_logs');

      if (socket.connected) {
        setIsConnected(true);
      }

      fetchDevices();

      return () => {
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
        socket.off('status', handleStatus);
        socket.off('initial_logs', handleInitialLogs);
        socket.off('device-status', handleDeviceStatus);
        socket.off('user_role_updated', handleRoleUpdated);
      };
    }
  }, [tokenChecked]);

  if (!tokenChecked) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <img src="/logo.png" alt="NOCR Logo" className="w-24 h-24 object-contain drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
          <div className="text-2xl font-bold text-blue-500 flex items-center gap-2">
            NOCR <span className='text-xs text-slate-400 font-normal mt-2'>by: npma</span>
          </div>
          <p className="text-sm font-semibold tracking-wider text-slate-400 uppercase mt-4">
            Loading setup...
          </p>
        </div>
      </div>
    );
  }

  const contextValue = {
    devices,
    alerts,
    isConnected,
    sessionUser,
    refreshDevices: fetchDevices,
    refreshSessionUser,
    showToast,
    lastSyncTime,
    setLastSyncTime
  };

  return (
    <AppStateContext.Provider value={contextValue}>
      <div className="fixed inset-0 flex bg-slate-900 text-slate-50 overflow-hidden">
        
        {/* Mobile overlay */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 z-[2500] bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar with mobile slide-in */}
        <div className={`fixed inset-y-0 left-0 z-[3000] transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition-transform duration-300 ease-in-out flex`}>
          <Suspense fallback={<div className="w-64 bg-slate-800 border-r border-slate-700/50 flex-shrink-0"></div>}>
            <Sidebar isConnected={isConnected} onNavigate={() => setIsMobileMenuOpen(false)} />
          </Suspense>
        </div>
        
        <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          <Topbar onMenuClick={() => setIsMobileMenuOpen(true)} />
          
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 md:p-6">
            {children}
          </div>
        </main>
      </div>

      {toast && (
        <>
          <style>{`
            @keyframes slideInUp {
              from {
                transform: translateY(100%) scale(0.95);
                opacity: 0;
              }
              to {
                transform: translateY(0) scale(1);
                opacity: 1;
              }
            }
            .animate-slide-in-up {
              animation: slideInUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
          `}</style>
          <div className="fixed bottom-6 right-6 z-[9999] animate-slide-in-up">
            <div className={`flex items-center gap-3 px-5 py-3.5 rounded-xl border shadow-2xl backdrop-blur-md transition-all duration-300 min-w-[280px] max-w-sm ${
              toast.type === 'error' 
                ? 'bg-slate-900/90 border-red-500/30 text-red-200 shadow-red-950/20' 
                : toast.type === 'warning'
                ? 'bg-slate-900/90 border-amber-500/30 text-amber-200 shadow-amber-950/20'
                : 'bg-slate-900/90 border-emerald-500/30 text-emerald-200 shadow-emerald-950/20'
            }`}>
              <div className="flex-shrink-0">
                {toast.type === 'error' ? (
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse" />
                ) : toast.type === 'warning' ? (
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)] animate-pulse" />
                ) : (
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
                )}
              </div>
              <div className="flex-1 text-sm font-semibold tracking-wide pr-2 break-words">
                {toast.message}
              </div>
              <button 
                onClick={() => setToast(null)} 
                className="flex-shrink-0 text-slate-500 hover:text-slate-300 text-xs font-bold w-5 h-5 rounded-full hover:bg-slate-800/50 flex items-center justify-center transition-colors focus:outline-none"
              >
                ✕
              </button>
            </div>
          </div>
        </>
      )}
    </AppStateContext.Provider>
  );
}
