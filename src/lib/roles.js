/** Client & server safe role helpers */

export const MENUS = {
  // Main Menus
  dashboard: 'Dashboard',
  topology: 'Peta Topologi',
  sites: 'Data Wilayah',
  'laporan-harian': 'Laporan Harian',
  chat: 'Live Chat Omni',
  
  // Monitoring
  'monitoring-l2tp': 'Monitor L2TP',
  'monitoring-pppoe': 'Monitor PPPOE',
  
  // Perangkat Jaringan
  'devices-ruijie': 'Ruijie AP',
  'devices-mikrotik': 'Mikrotik RO',
  'devices-hsgq': 'HSGQ OLT',
  
  // Pengaturan Sistem
  'settings-mikrotik': 'Pengaturan - MikroTik Gateway',
  'settings-vpn': 'Pengaturan - VPN Connection',
  'settings-health': 'Pengaturan - Kesehatan Sistem & DB',
  'settings-wa': 'Pengaturan - WhatsApp Gateway',
  'settings-users': 'Pengaturan - Manajemen Pengguna',
  'settings-roles': 'Pengaturan - Manajemen Role',
  'settings-password': 'Pengaturan - Ubah Password',
  'settings-system': 'Pengaturan - Konfigurasi Server',
};

export const ACTIONS = ['create', 'read', 'update', 'delete'];

export function normalizeRole(role) {
  if (!role || typeof role !== 'string') return '';
  return role.toLowerCase().trim();
}

// Backward compatibility or absolute admin check
export function isLegacyAdmin(user) {
    return user?.role === 'admin' || (user?.role === 'admin' && (!user.permissions || user.permissions.length === 0));
}

// New robust access check
export function hasAccess(user, menuKey, action) {
  // 1. Admin always bypasses checks
  if (isLegacyAdmin(user)) return true;
  
  if (!user || !user.permissions) return false;

  let perms = user.permissions;
  
  // Handle stringified JSON
  if (typeof perms === 'string') {
    try {
      perms = JSON.parse(perms);
    } catch(e) {
      perms = {};
    }
  }

  // Handle legacy array format (graceful fallback)
  if (Array.isArray(perms)) {
    // Basic mapping for older roles before migration
    if (menuKey === 'settings' && perms.includes('system.settings')) return true;
    if (menuKey === 'settings' && perms.includes('system.users')) return true;
    if (menuKey === 'topology' && perms.includes('network.topology')) return true;
    if (menuKey === 'devices' && perms.includes('network.devices')) return true;
    if (menuKey === 'chat' && perms.includes('chat.live')) return true;
    return false;
  }

  // New object mapping format: { "laporan-harian": ["read", "create"] }
  if (perms && typeof perms === 'object' && !Array.isArray(perms)) {
    // 1. Direct exact key match (e.g. 'settings-mikrotik')
    if (Array.isArray(perms[menuKey]) && perms[menuKey].includes(action)) {
      return true;
    }
    
    // 2. Graceful fallback for legacy generic roles (e.g. 'settings', 'devices', 'monitoring')
    if (menuKey.startsWith('settings-') && Array.isArray(perms['settings']) && perms['settings'].includes(action)) {
      return true;
    }
    if (menuKey.startsWith('devices-') && Array.isArray(perms['devices']) && perms['devices'].includes(action)) {
      return true;
    }
    if (menuKey.startsWith('monitoring-') && Array.isArray(perms['monitoring']) && perms['monitoring'].includes(action)) {
      return true;
    }
  }

  return false;
}

// Legacy fallback functions removed

export function getStoredUser() {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem('nocr_user') || '{}');
  } catch {
    return {};
  }
}

/** Sinkronkan role dari server ke localStorage + beri tahu semua halaman */
export function applySessionUser(user) {
  if (typeof window === 'undefined' || !user) return;
  
  let perms = user.permissions;
  if (typeof perms === 'string') {
      try { perms = JSON.parse(perms); } catch(e) { perms = {}; }
  }

  const next = {
    id: user.id,
    username: user.username,
    role: user.role,
    permissions: perms || {}
  };
  localStorage.setItem('nocr_user', JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('nocr-role-updated', { detail: next }));
  return next;
}

export function getRoleLabel(role) {
  if (!role) return 'Visitor';
  return String(role).charAt(0).toUpperCase() + String(role).slice(1);
}
