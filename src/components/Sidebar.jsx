'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Network, PieChart, GitGraph, Server, Settings, Database, Shield, Wifi, Monitor, Key, MapPin } from 'lucide-react';

import { useAppState } from '@/App';
import { isAdminRole, getStoredUser } from '@/lib/roles';

export default function Sidebar({ isConnected, onNavigate }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab') || 'core';
  const { sessionUser } = useAppState();
  const [isAdmin, setIsAdmin] = useState(false);

  const syncAdmin = () => setIsAdmin(isAdminRole(getStoredUser().role));

  useEffect(() => {
    syncAdmin();
    const onRole = () => syncAdmin();
    window.addEventListener('nocr-role-updated', onRole);
    return () => window.removeEventListener('nocr-role-updated', onRole);
  }, []);

  useEffect(() => {
    if (sessionUser?.role) syncAdmin();
  }, [sessionUser]);

  const getLinkClass = (href) => {
    const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
    return `flex items-center gap-3 px-4 py-3 text-slate-400 rounded-lg hover:bg-slate-800 hover:text-white transition duration-200 font-medium ${
      isActive ? 'bg-blue-600 text-white hover:bg-blue-700' : ''
    }`;
  };

  return (
    <aside className="w-64 bg-slate-800 border-r border-slate-700/50 flex flex-col z-10 h-full">
      <div className="p-6 text-xl font-bold text-blue-500 flex flex-col gap-1 border-b border-slate-700/50">
        <span className="flex items-center gap-2">
        <img src="/logo.png" alt="NOCR Logo" className="w-10 h-10 border-2 border-slate-600 rounded-full object-contain drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
         NOCR <span className='text-[10px] text-slate-400 font-normal'>by: npma</span>
        </span>
        <span className="text-[12px] text-slate-400 font-normal mt-0.5">
          Network Operations Center
        </span>
      </div>
 
 
      
      <nav className="flex-1 p-4 flex flex-col gap-1">
        <Link href="/dashboard" onClick={onNavigate} scroll={false} className={getLinkClass('/dashboard')}>
          <PieChart size={18} /> Dashboard
        </Link>
        <Link href="/topology" onClick={onNavigate} scroll={false} className={getLinkClass('/topology')}>
          <GitGraph size={18} /> Peta Topologi
        </Link>
        <Link href="/monitor-device" onClick={onNavigate} scroll={false} className={getLinkClass('/monitor-device')}>
          <Monitor size={18} /> Monitor Gabungan
        </Link>
        <Link href="/sites" onClick={onNavigate} scroll={false} className={getLinkClass('/sites')}>
          <MapPin size={18} /> Data Wilayah
        </Link>
        <Link href="/devices" onClick={onNavigate} scroll={false} className={getLinkClass('/devices')}>
          <Server size={18} /> Mikrotik RO
        </Link>
        <Link href="/ruijie" onClick={onNavigate} scroll={false} className={getLinkClass('/ruijie')}>
          <Wifi size={18} /> Ruijie AP
        </Link>
        
        
        <div className="flex flex-col gap-0.5">
          <Link href="/settings?tab=core" onClick={onNavigate} scroll={false} className={getLinkClass('/settings')}>
            <Settings size={18} /> Pengaturan
          </Link>
          
          {pathname.startsWith('/settings') && (
            <div className="pl-6 pr-2 py-1.5 flex flex-col gap-1 border-l border-slate-700/50 ml-6 mt-1 mb-2">
              <Link 
                href="/settings?tab=core" 
                onClick={onNavigate} 
                scroll={false}
                className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-md transition duration-200 ${
                  currentTab === 'core' 
                    ? 'text-blue-400 bg-blue-500/10' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Server size={14} /> MikroTik Pusat (Core)
              </Link>
              <Link 
                href="/settings?tab=vpn" 
                onClick={onNavigate} 
                scroll={false}
                className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-md transition duration-200 ${
                  currentTab === 'vpn' 
                    ? 'text-emerald-400 bg-emerald-500/10' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Network size={14} /> VPN (Auto-Dial)
              </Link>

              {isAdmin && (
                <Link 
                  href="/settings?tab=users" 
                  onClick={onNavigate} 
                  scroll={false}
                  className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-md transition duration-200 ${
                    currentTab === 'users' 
                      ? 'text-blue-400 bg-blue-500/10' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Shield size={14} /> Manajemen Pengguna
                </Link>
              )}
              <Link 
                href="/settings?tab=password" 
                onClick={onNavigate} 
                scroll={false}
                className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-md transition duration-200 ${
                  currentTab === 'password' 
                    ? 'text-blue-400 bg-blue-500/10' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Key size={14} /> Ubah Password Saya
              </Link>
            </div>
          )}
        </div>
      </nav>
      
      <div className="p-5 border-t border-slate-700/50 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-500'}`}></span>
          <span>{isConnected ? 'Server: Terhubung' : 'Server: Terputus'}</span>
        </div>
      </div>
    </aside>
  );
}
