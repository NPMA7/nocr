'use client';
import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import axios from 'axios';
import { API_URL, useAppState } from '@/App';
import { Save, Server, Shield, Database, Network, Trash2, UserPlus, Eye, EyeOff, Monitor, Terminal, Pencil } from 'lucide-react';
import { isAdminRole, canRevealPasswords, getStoredUser, getRoleLabel } from '@/lib/roles';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 flex flex-col gap-4">
          <h1 className="text-2xl text-red-500 font-bold">Terjadi Kesalahan Render</h1>
          <p className="text-slate-300 font-mono bg-slate-900 p-4 rounded-lg">{this.state.error?.toString()}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function UserManagement() {
  const { showToast } = useAppState();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ username: '', password: '', role: 'visitor' });
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [roleEdits, setRoleEdits] = useState({});
  const [savingRoleId, setSavingRoleId] = useState(null);

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API_URL}/auth/users`);
      setUsers(res.data);
      setRoleEdits({});
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await axios.post(`${API_URL}/auth/users`, {
        username: form.username.trim(),
        password: form.password,
        role: form.role
      });
      setForm({ username: '', password: '', role: 'visitor' });
      fetchUsers();
      if (showToast) showToast('Pengguna berhasil dibuat', 'success');
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const handleUpdateRole = async (userId) => {
    const newRole = roleEdits[userId];
    if (!newRole) return;
    const current = users.find((u) => u.id === userId);
    if (current && current.role === newRole) return;

    setSavingRoleId(userId);
    try {
      await axios.patch(`${API_URL}/auth/users/${userId}`, { role: newRole });
      await fetchUsers();
      if (showToast) showToast('Role pengguna diperbarui', 'success');
    } catch (err) {
      if (showToast) showToast(err.response?.data?.error || err.message, 'error');
    } finally {
      setSavingRoleId(null);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Yakin ingin menghapus pengguna ini?')) {
      try {
        await axios.delete(`${API_URL}/auth/users/${id}`);
        fetchUsers();
      } catch (err) {
        if (showToast) showToast(err.response?.data?.error || err.message, 'error');
      }
    }
  };

  if (loading) return <div className="text-slate-400 p-5">Memuat pengguna...</div>;

  return (
    <div className="bg-slate-800 border border-slate-700/50 rounded-xl overflow-hidden shadow-lg p-5">
      <h2 className="text-lg font-bold text-slate-100 mb-4">Manajemen Pengguna</h2>
      <h3 className="text-sm font-bold text-slate-200 mb-3">Buat Pengguna Baru</h3>
      {error && <div className="mb-3 text-xs text-red-400 bg-red-500/10 p-2 rounded border border-red-500/20">{error}</div>}
      <form onSubmit={handleCreate} className="mb-3 flex gap-3 flex-wrap">
        <input type="text" value={form.username} onChange={e=>setForm({...form, username: e.target.value})} placeholder="Username" required className="bg-slate-900 border border-slate-700 p-2 text-sm text-white rounded-lg flex-1 min-w-[150px] outline-none focus:border-blue-500" />
        <div className="relative flex-1 min-w-[150px]">
          <input type={showPassword ? "text" : "password"} value={form.password} onChange={e=>setForm({...form, password: e.target.value})} placeholder="Password" required className="bg-slate-900 border border-slate-700 p-2 text-sm text-white rounded-lg outline-none focus:border-blue-500 w-full pr-10" />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
            {showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
          </button>
        </div>
        <select
          name="role"
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
          className="bg-slate-900 border border-slate-700 p-2 text-sm text-white rounded-lg w-32 outline-none focus:border-blue-500"
        >
          <option value="visitor">Visitor</option>
          <option value="editor">Editor</option>
          <option value="admin">Admin</option>
        </select>
        <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition flex items-center justify-center"><UserPlus size={16}/></button>
      </form>
      {/* List */}
      <div className="mb-3 overflow-hidden rounded-lg border border-slate-700">
        <table className="w-full text-left">
          <thead className="bg-slate-900/50">
            <tr>
              <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase">Username</th>
              <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase">Role</th>
              <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {users.map(u => {
              const editRole = roleEdits[u.id] ?? u.role;
              const roleDirty = editRole !== u.role;
              return (
              <tr key={u.id} className="hover:bg-slate-700/20 transition-colors">
                <td className="px-4 py-3 text-sm font-semibold text-slate-200">{u.username}</td>
                <td className="px-4 py-3 text-sm text-slate-400">
                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      value={editRole}
                      onChange={(e) => setRoleEdits((prev) => ({ ...prev, [u.id]: e.target.value }))}
                      className="bg-slate-900 border border-slate-700 px-2 py-1 text-xs text-white rounded-lg outline-none focus:border-blue-500"
                    >
                      <option value="visitor">Visitor</option>
                      <option value="editor">Editor</option>
                      <option value="admin">Admin</option>
                    </select>
                    {roleDirty && (
                      <button
                        type="button"
                        title="Simpan role"
                        disabled={savingRoleId === u.id}
                        onClick={() => handleUpdateRole(u.id)}
                        className="text-blue-400 hover:text-blue-300 p-1 transition disabled:opacity-50"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <button title="Hapus" onClick={() => handleDelete(u.id)} className="text-slate-500 hover:text-red-400 p-1 transition"><Trash2 size={16} /></button>
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SettingsWrapper(props) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="p-10 text-slate-400">Memuat...</div>}>
        <Settings {...props} />
      </Suspense>
    </ErrorBoundary>
  );
}

function Settings() {
  const { devices, refreshDevices, showToast, sessionUser } = useAppState();
  const [isAdmin, setIsAdmin] = useState(false);
  const [canShowPassword, setCanShowPassword] = useState(false);

  const syncRoleFlags = () => {
    const userData = getStoredUser();
    setIsAdmin(isAdminRole(userData.role));
    setCanShowPassword(canRevealPasswords(userData.role));
  };
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') || 'core';
  const readOnlySettings = !isAdmin;

  const [coreDevice, setCoreDevice] = useState({
    name: 'MikroTik Pusat',
    ip_address: '',
    username: 'admin',
    password: '',
    port: 8728,
    type: 'mikrotik-core'
  });

  const [existingId, setExistingId] = useState(null);
  
  const [vpnConfig, setVpnConfig] = useState({
    windows_name: '',
    windows_username: '',
    windows_password: '',
    linux_name: '',
    linux_username: '',
    linux_password: '',
    name: '',
    username: '',
    password: '',
    active_platform: 'windows'
  });
  const [vpnConnecting, setVpnConnecting] = useState(false);
  const [vpnMsg, setVpnMsg] = useState('');

  const [showCorePassword, setShowCorePassword] = useState(false);
  const [showVpnPassword, setShowVpnPassword] = useState(false);

  useEffect(() => {
    syncRoleFlags();
    const onRole = () => syncRoleFlags();
    window.addEventListener('nocr-role-updated', onRole);
    return () => window.removeEventListener('nocr-role-updated', onRole);
  }, []);

  useEffect(() => {
    if (sessionUser?.role) syncRoleFlags();
  }, [sessionUser]);

  useEffect(() => {
    if (!devices) return;
    const core = devices.find(d => d.type === 'mikrotik-core' || (d.name && d.name.toLowerCase().includes('pusat')) || (d.name && d.name.toLowerCase().includes('core')));
    if (core) {
      setExistingId(core.id);
      axios.get(`${API_URL}/devices/${core.id}`).then(res => {
        setCoreDevice({
          name: res.data.name,
          ip_address: res.data.ip_address,
          username: res.data.username || '',
          password: res.data.password || '',
          port: res.data.port || 8728,
          type: res.data.type
        });
      }).catch(console.error);
    }
    
    axios.get(`${API_URL}/vpn/settings`).then(res => {
      setVpnConfig({
        windows_name: res.data.windows_name || '',
        windows_username: res.data.windows_username || '',
        windows_password: res.data.windows_password || '',
        linux_name: res.data.linux_name || '',
        linux_username: res.data.linux_username || '',
        linux_password: res.data.linux_password || '',
        name: res.data.name || '',
        username: res.data.username || '',
        password: res.data.password || '',
        active_platform: res.data.active_platform || 'windows'
      });
    }).catch(console.error);
  }, [devices]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    try {
      if (existingId) {
        await axios.put(`${API_URL}/devices/${existingId}`, coreDevice);
      } else {
        await axios.post(`${API_URL}/devices`, coreDevice);
      }
      showToast('Konfigurasi MikroTik Pusat berhasil disimpan!', 'success');
      if (refreshDevices) refreshDevices();
    } catch (err) {
      showToast('Gagal menyimpan: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleSaveVpn = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    try {
      const res = await axios.post(`${API_URL}/vpn/settings`, vpnConfig);
      const isWarning = res.data.message && res.data.message.includes('gagal');
      showToast(res.data.message || 'Pengaturan VPN berhasil disimpan!', isWarning ? 'warning' : 'success');
    } catch (err) {
      showToast('Gagal menyimpan pengaturan VPN: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const testVpnConnect = async () => {
    setVpnConnecting(true);
    setVpnMsg('Menghubungkan...');
    try {
      const res = await axios.post(`${API_URL}/vpn/connect`);
      setVpnMsg(res.data.message);
    } catch (err) {
      setVpnMsg('Error: ' + (err.response?.data?.error || err.message));
    } finally {
      setVpnConnecting(false);
    }
  };

  const testVpnDisconnect = async () => {
    setVpnConnecting(true);
    setVpnMsg('Memutuskan...');
    try {
      const res = await axios.post(`${API_URL}/vpn/disconnect`);
      setVpnMsg(res.data.message);
    } catch (err) {
      setVpnMsg('Error: ' + (err.response?.data?.error || err.message));
    } finally {
      setVpnConnecting(false);
    }
  };

  return (
    <div className="h-full min-h-0 overflow-y-auto flex flex-col gap-6 max-w-4xl mx-auto w-full pb-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Pengaturan Sistem</h1>
        <p className="text-sm text-slate-400">Konfigurasi pusat untuk NOCR dan Perangkat Core</p>
        {readOnlySettings && (
          <p className="text-xs text-amber-400/90 mt-1">
            Mode baca saja ({getRoleLabel(getStoredUser().role)}) — perubahan hanya oleh Administrator
          </p>
        )}
      </div>

      <div>
        {/* Content Settings - full width, tab driven by URL */}
        <div>
          {activeTab === 'core' && (
            <div className="bg-slate-800 border border-slate-700/50 rounded-xl overflow-hidden shadow-lg">
              <div className="p-5 border-b border-slate-700/50">
                <h2 className="text-lg font-bold text-slate-100">MikroTik Pusat (Core Router)</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Router utama ini akan menjadi pusat monitoring untuk PPPoE, ONT, dan interface pelanggan lainnya.
                </p>
              </div>
              <div className="p-5">
                <form onSubmit={handleSave} className="flex flex-col gap-4">
                  <div className={`grid grid-cols-2 gap-4 ${readOnlySettings ? 'opacity-90' : ''}`}>
                    <div className="flex flex-col gap-1.5 col-span-2 md:col-span-1">
                      <label className="text-xs font-semibold text-slate-400">Nama Router</label>
                      <input 
                        type="text" 
                        readOnly={readOnlySettings}
                        value={coreDevice.name} 
                        onChange={e => setCoreDevice({...coreDevice, name: e.target.value})}
                        className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100 focus:border-blue-500 outline-none" 
                        required 
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 col-span-2 md:col-span-1">
                      <label className="text-xs font-semibold text-slate-400">IP Address</label>
                      <input 
                        type="text" 
                        readOnly={readOnlySettings}
                        value={coreDevice.ip_address} 
                        onChange={e => setCoreDevice({...coreDevice, ip_address: e.target.value})}
                        placeholder="Contoh: 192.168.100.1"
                        className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100 focus:border-blue-500 outline-none" 
                        required 
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 col-span-2 md:col-span-1">
                      <label className="text-xs font-semibold text-slate-400">Username API</label>
                      <input 
                        type="text" 
                        readOnly={readOnlySettings}
                        value={coreDevice.username} 
                        onChange={e => setCoreDevice({...coreDevice, username: e.target.value})}
                        className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100 focus:border-blue-500 outline-none" 
                        required 
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 col-span-2 md:col-span-1">
                      <label className="text-xs font-semibold text-slate-400">Password API</label>
                      <div className="relative">
                        <input 
                          type={showCorePassword ? "text" : "password"} 
                          readOnly={readOnlySettings}
                          value={coreDevice.password} 
                          onChange={e => setCoreDevice({...coreDevice, password: e.target.value})}
                          placeholder={existingId ? "Kosongkan jika tidak diubah" : "Masukkan password"}
                          className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100 focus:border-blue-500 outline-none w-full pr-10" 
                        />
                        <button
                          type="button"
                          disabled={!canShowPassword}
                          onClick={() => canShowPassword && setShowCorePassword(!showCorePassword)}
                          className={`absolute right-3 top-1/2 -translate-y-1/2 ${canShowPassword ? 'text-slate-500 hover:text-slate-300' : 'text-slate-600 cursor-not-allowed'}`}
                        >
                          {showCorePassword ? <EyeOff size={16}/> : <Eye size={16}/>}
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 col-span-2 md:col-span-1">
                      <label className="text-xs font-semibold text-slate-400">Port API</label>
                      <input 
                        type="number" 
                        readOnly={readOnlySettings}
                        value={coreDevice.port} 
                        onChange={e => setCoreDevice({...coreDevice, port: parseInt(e.target.value)})}
                        className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100 focus:border-blue-500 outline-none" 
                        required 
                      />
                    </div>
                  </div>
                  
                  {isAdmin && (
                    <div className="mt-4 flex justify-end">
                      <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition shadow-lg shadow-blue-500/20">
                        <Save size={16} /> Simpan Konfigurasi
                      </button>
                    </div>
                  )}
                </form>
              </div>
            </div>
          )}

          {activeTab === 'vpn' && (
            <div className="bg-slate-800 border border-slate-700/50 rounded-xl overflow-hidden shadow-lg">
              <div className="p-5 border-b border-slate-700/50 flex justify-between items-start">
                <div>
                  <h2 className="text-lg font-bold text-emerald-400 flex items-center gap-2"><Network size={20} /> VPN Auto-Dial (Windows / Linux)</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Biarkan backend memanggil koneksi VPN secara otomatis saat jaringan terputus. Pada Windows menggunakan profil VPN Windows (rasdial), sedangkan pada Linux menggunakan PPPoE/VPN peers (pon/poff).
                  </p>
                </div>
              </div>
              <div className="p-5">
                <form onSubmit={handleSaveVpn} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-6">
                    {/* Platform Selector */}
                    <div className="flex flex-col gap-2 max-w-md">
                      <label className="text-xs font-semibold text-slate-400">Pilih Platform VPN</label>
                      <div className="grid grid-cols-2 bg-slate-900 p-1.5 rounded-lg border border-slate-700 gap-1.5">
                        <button
                          type="button"
                          disabled={readOnlySettings}
                          onClick={() => setVpnConfig({ ...vpnConfig, active_platform: 'windows' })}
                          className={`py-2 px-4 text-xs font-bold rounded-md transition-all duration-200 flex items-center justify-center gap-2 ${
                            vpnConfig.active_platform === 'windows'
                              ? 'bg-blue-600 text-white shadow-md'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                          }`}
                        >
                          <Monitor size={14} />
                          Windows (rasdial)
                        </button>
                        <button
                          type="button"
                          disabled={readOnlySettings}
                          onClick={() => setVpnConfig({ ...vpnConfig, active_platform: 'linux' })}
                          className={`py-2 px-4 text-xs font-bold rounded-md transition-all duration-200 flex items-center justify-center gap-2 ${
                            vpnConfig.active_platform === 'linux'
                              ? 'bg-orange-600 text-white shadow-md'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                          }`}
                        >
                          <Terminal size={14} />
                          Linux (pon/poff)
                        </button>
                      </div>
                    </div>

                    <div className="border-t border-slate-700/50 my-1"></div>

                    {/* Conditional Platform Forms */}
                    {vpnConfig.active_platform === 'windows' ? (
                      <div className="flex flex-col gap-4 max-w-xl transition-all duration-300">
                        <div className="flex items-center gap-2 pb-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                          <h3 className="text-sm font-bold text-slate-200">Konfigurasi Windows</h3>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="flex flex-col gap-1.5 col-span-2">
                            <label className="text-xs font-semibold text-slate-400">Nama Profil VPN (rasdial)</label>
                            <input 
                              type="text" 
                              value={vpnConfig.windows_name} 
                              onChange={e => setVpnConfig({...vpnConfig, windows_name: e.target.value})}
                              placeholder='Contoh: "VPN_DISKOMINFO_KABBDG"'
                              className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100 focus:border-emerald-500 outline-none" 
                            />
                          </div>
                          
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-slate-400">Username VPN (Opsional)</label>
                            <input 
                              type="text" 
                              value={vpnConfig.windows_username} 
                              onChange={e => setVpnConfig({...vpnConfig, windows_username: e.target.value})}
                              className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100 focus:border-emerald-500 outline-none" 
                            />
                          </div>
                          
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-slate-400">Password VPN (Opsional)</label>
                            <div className="relative">
                              <input 
                                type={showVpnPassword ? "text" : "password"} 
                                value={vpnConfig.windows_password} 
                                onChange={e => setVpnConfig({...vpnConfig, windows_password: e.target.value})}
                                className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100 focus:border-emerald-500 outline-none w-full pr-10" 
                              />
                              <button
                                type="button"
                                disabled={!canShowPassword}
                                onClick={() => canShowPassword && setShowVpnPassword(!showVpnPassword)}
                                className={`absolute right-3 top-1/2 -translate-y-1/2 ${canShowPassword ? 'text-slate-500 hover:text-slate-300' : 'text-slate-600 cursor-not-allowed'}`}
                              >
                                {showVpnPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4 max-w-xl transition-all duration-300">
                        <div className="flex items-center gap-2 pb-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                          <h3 className="text-sm font-bold text-slate-200">Konfigurasi Linux</h3>
                        </div>
                        
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-slate-400">Nama Peer / PPPoE (pon/poff)</label>
                          <input 
                            type="text" 
                            value={vpnConfig.linux_name} 
                            onChange={e => setVpnConfig({...vpnConfig, linux_name: e.target.value})}
                            placeholder='Contoh: "diskominfo"'
                            className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100 focus:border-emerald-500 outline-none" 
                          />
                        </div>
                        
                        <div className="bg-slate-900/50 border border-slate-700/50 p-4 rounded-lg flex flex-col gap-2 mt-2">
                          <div className="flex items-center gap-2 text-xs font-semibold text-orange-400">
                            <Terminal size={14} />
                            Info Penggunaan pon/poff
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            Koneksi VPN pada sistem operasi Linux tidak memerlukan input Username dan Password di sini. 
                            Sistem akan memanggil perintah <code className="bg-slate-950 px-1.5 py-0.5 rounded text-amber-500 font-mono">pon [nama]</code> dan <code className="bg-slate-950 px-1.5 py-0.5 rounded text-amber-500 font-mono">poff [nama]</code> menggunakan konfigurasi peers yang sudah ada di file <code className="bg-slate-950 px-1.5 py-0.5 rounded text-amber-500 font-mono">/etc/ppp/peers/[nama]</code>.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center mt-4">
                    <div className="flex items-center gap-2">
                      {isAdmin && (
                        <>
                          <button type="button" onClick={testVpnConnect} disabled={vpnConnecting} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg text-sm transition">
                            Tes Hubungkan
                          </button>
                          <button type="button" onClick={testVpnDisconnect} disabled={vpnConnecting} className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg text-sm transition">
                            Putuskan
                          </button>
                        </>
                      )}
                    </div>
                    {isAdmin && (
                      <button type="submit" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-6 rounded-lg text-sm transition">
                        <Save size={16} /> Simpan Pengaturan
                      </button>
                    )}
                  </div>
                  {vpnMsg && <div className="mt-2 text-xs bg-slate-900 border border-slate-700 p-2 rounded-md text-slate-300 font-mono break-all">{vpnMsg}</div>}
                </form>
              </div>
            </div>
          )}

          {activeTab === 'users' && isAdmin && (
            <UserManagement />
          )}

          {(activeTab === 'db') && (
            <div className="bg-slate-800 border border-slate-700/50 rounded-xl overflow-hidden shadow-lg p-10 text-center">
              <p className="text-slate-500 font-medium">Pengaturan ini belum tersedia (Coming Soon)</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
