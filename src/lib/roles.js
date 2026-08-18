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

/** Urutan prioritas menu dari atas ke bawah */
export const MENU_ROUTE_HIERARCHY = [
  { menuKey: 'dashboard', path: '/dashboard' },
  { menuKey: 'topology', path: '/topology' },
  { menuKey: 'sites', path: '/sites/desa' },
  { menuKey: 'monitoring-l2tp', path: '/monitoring/desa' },
  { menuKey: 'monitoring-pppoe', path: '/monitoring/opd' },
  { menuKey: 'devices-ruijie', path: '/device/ruijie' },
  { menuKey: 'devices-mikrotik', path: '/device/mikrotik' },
  { menuKey: 'devices-hsgq', path: '/device/hsgq-olt' },
  { menuKey: 'laporan-harian', path: '/report' },
  { menuKey: 'chat', path: '/live-chat' },
  { menuKey: 'settings-mikrotik', path: '/settings?tab=core' },
  { menuKey: 'settings-vpn', path: '/settings?tab=vpn' },
  { menuKey: 'settings-health', path: '/settings?tab=health' },
  { menuKey: 'settings-wa', path: '/settings?tab=whatsapp' },
  { menuKey: 'settings-users', path: '/settings?tab=users' },
  { menuKey: 'settings-roles', path: '/settings?tab=roles' },
  { menuKey: 'settings-password', path: '/settings?tab=password' },
  { menuKey: 'settings-system', path: '/settings?tab=system' },
];

/** Validasi struktur dan masa berlaku JWT di sisi client */
export function isClientTokenValid(token) {
  if (!token || typeof token !== 'string') return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    if (!payload || !payload.exp) return false;
    // Expired check (10s margin)
    if (payload.exp * 1000 < Date.now() + 10000) {
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

/** Bersihkan seluruh residu data autentikasi di browser client */
export function clearClientAuth() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('nocr_token');
    localStorage.removeItem('nocr_user');
    document.cookie = 'nocr_token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  } catch (e) {}
}

/** Dapatkan URL halaman pertama/teratas yang boleh diakses user */
export function getDefaultAccessibleRoute(user) {
  if (!user) return '/dashboard';
  if (isLegacyAdmin(user)) return '/dashboard';

  for (const item of MENU_ROUTE_HIERARCHY) {
    if (hasAccess(user, item.menuKey, 'read')) {
      return item.path;
    }
  }

  return '/dashboard';
}
