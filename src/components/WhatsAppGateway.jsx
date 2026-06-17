'use client';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL, socket, useAppState } from '@/App';
import { MessageCircle, Play, Square, LogOut, CheckCircle, XCircle, Loader2 } from 'lucide-react';

export default function WhatsAppGateway() {
  const { showToast } = useAppState();
  const [status, setStatus] = useState('loading');
  const [qrCode, setQrCode] = useState(null);
  const [settings, setSettings] = useState({ autoReply: false, botEnabled: true });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatus();

    if (socket) {
      socket.on('wa_status', (data) => {
        setStatus(data.status);
        if (data.qr) setQrCode(data.qr);
        if (data.settings) setSettings(data.settings);
      });
      socket.on('wa_qr', (data) => {
        setQrCode(data.qr);
        setStatus('qr');
      });
    }

    return () => {
      if (socket) {
        socket.off('wa_status');
        socket.off('wa_qr');
      }
    };
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await axios.get(`${API_URL}/whatsapp/status`);
      setStatus(res.data.status);
      setQrCode(res.data.qr);
      if (res.data.settings) setSettings(res.data.settings);
    } catch (e) {
      console.error('Failed to get WA status', e);
    } finally {
      setLoading(false);
    }
  };

  const performAction = async (actionStr) => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/whatsapp/action`, { action: actionStr });
      if (res.data.success) {
        showToast(res.data.message, 'success');
        if (actionStr === 'stop' || actionStr === 'logout') {
          setStatus('disconnected');
          setQrCode(null);
        }
      } else {
        showToast(res.data.error || 'Terjadi kesalahan', 'error');
      }
    } catch (e) {
      showToast(e.response?.data?.error || e.message, 'error');
    } finally {
      setLoading(false);
      fetchStatus();
    }
  };

  const saveSettings = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_URL}/whatsapp/action`, { action: 'settings', settings });
      if (res.data.success) {
        showToast('Pengaturan WA disimpan', 'success');
      }
    } catch (e) {
      showToast(e.response?.data?.error || e.message, 'error');
    }
  };

  return (
    <div className="bg-slate-800 border border-slate-700/50 rounded-xl overflow-hidden shadow-lg">
      <div className="p-5 border-b border-slate-700/50">
        <h2 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
          <MessageCircle size={20} /> WhatsApp Gateway & Omni
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Hubungkan satu nomor WhatsApp untuk digunakan sebagai Omnichannel (dibalas banyak admin) dan Auto-reply Bot.
        </p>
      </div>

      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Status Area */}
        <div className="flex flex-col gap-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 shadow-inner">
            <h3 className="text-sm font-bold text-slate-300 mb-4">Status Koneksi</h3>
            
            <div className="flex items-center gap-3 mb-6">
              {status === 'connected' && (
                <div className="flex items-center gap-2 text-emerald-400 font-bold bg-emerald-500/10 px-4 py-2 rounded-lg border border-emerald-500/20">
                  <CheckCircle size={20} /> Terhubung
                </div>
              )}
              {status === 'disconnected' && (
                <div className="flex items-center gap-2 text-red-400 font-bold bg-red-500/10 px-4 py-2 rounded-lg border border-red-500/20">
                  <XCircle size={20} /> Terputus
                </div>
              )}
              {status === 'loading' && (
                <div className="flex items-center gap-2 text-blue-400 font-bold bg-blue-500/10 px-4 py-2 rounded-lg border border-blue-500/20">
                  <Loader2 size={20} className="animate-spin" /> Memproses...
                </div>
              )}
              {status === 'qr' && (
                <div className="flex items-center gap-2 text-amber-400 font-bold bg-amber-500/10 px-4 py-2 rounded-lg border border-amber-500/20">
                  <Loader2 size={20} className="animate-spin" /> Menunggu Scan
                </div>
              )}
            </div>

            {status === 'qr' && qrCode && (
              <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl w-max mb-4 mx-auto">
                <img src={qrCode} alt="WhatsApp QR Code" className="w-48 h-48" />
                <p className="text-xs text-slate-600 font-bold mt-2 text-center">Scan via WhatsApp &gt; Tautkan Perangkat</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {status === 'disconnected' && (
                <button 
                  onClick={() => performAction('start')} 
                  disabled={loading}
                  className="cursor-pointer flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50"
                >
                  <Play size={16} /> Mulai Gateway
                </button>
              )}
              {(status === 'connected' || status === 'qr' || status === 'loading') && (
                <button 
                  onClick={() => performAction('stop')} 
                  disabled={loading}
                  className="cursor-pointer flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50"
                >
                  <Square size={16} /> Hentikan Klien
                </button>
              )}
              {status === 'connected' && (
                <button 
                  onClick={() => {
                    if (confirm('Yakin ingin memutus tautan nomor ini (Logout)? Anda harus scan QR ulang nanti.')) {
                      performAction('logout');
                    }
                  }} 
                  disabled={loading}
                  className="cursor-pointer flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50"
                >
                  <LogOut size={16} /> Keluar (Logout)
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Settings Area */}
        <div className="flex flex-col gap-4">
          <form onSubmit={saveSettings} className="bg-slate-900 border border-slate-700 rounded-xl p-5 shadow-inner flex flex-col gap-4 h-full">
            <h3 className="text-sm font-bold text-slate-300 border-b border-slate-700/50 pb-2">Pengaturan Bot</h3>
            
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input 
                  type="checkbox" 
                  className="sr-only" 
                  checked={settings.botEnabled}
                  onChange={(e) => setSettings({...settings, botEnabled: e.target.checked})}
                />
                <div className={`block w-10 h-6 rounded-full transition ${settings.botEnabled ? 'bg-emerald-500' : 'bg-slate-600'}`}></div>
                <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition ${settings.botEnabled ? 'transform translate-x-4' : ''}`}></div>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-200 group-hover:text-white">Aktifkan Fitur Bot</span>
                <span className="text-xs text-slate-500">Merespon perintah seperti /ping, /info secara otomatis</span>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer group mt-2">
              <div className="relative">
                <input 
                  type="checkbox" 
                  className="sr-only" 
                  checked={settings.autoReply}
                  onChange={(e) => setSettings({...settings, autoReply: e.target.checked})}
                />
                <div className={`block w-10 h-6 rounded-full transition ${settings.autoReply ? 'bg-emerald-500' : 'bg-slate-600'}`}></div>
                <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition ${settings.autoReply ? 'transform translate-x-4' : ''}`}></div>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-200 group-hover:text-white">Pesan Otomatis Luar Jam Kerja</span>
                <span className="text-xs text-slate-500">Mengirim balasan default saat ada pesan baru</span>
              </div>
            </label>

            <div className="mt-auto pt-4">
              <button 
                type="submit" 
                className="cursor-pointer w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 rounded-lg text-sm transition shadow-lg shadow-blue-500/20"
              >
                Simpan Pengaturan
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
