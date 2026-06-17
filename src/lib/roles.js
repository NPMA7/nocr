/** Client & server safe role helpers */

export const PERMISSIONS = {
  SYSTEM_SETTINGS: 'system.settings',
  SYSTEM_USERS: 'system.users',
  NETWORK_TOPOLOGY: 'network.topology',
  NETWORK_DEVICES: 'network.devices',
  CHAT_LIVE: 'chat.live',
  PASSWORDS_REVEAL: 'passwords.reveal',
};

export const PERMISSION_LABELS = {
  [PERMISSIONS.SYSTEM_SETTINGS]: 'Pengaturan Sistem (WA, VPN, dll)',
  [PERMISSIONS.SYSTEM_USERS]: 'Manajemen Pengguna & Role',
  [PERMISSIONS.NETWORK_TOPOLOGY]: 'Peta Topologi',
  [PERMISSIONS.NETWORK_DEVICES]: 'Perangkat Jaringan (Mikrotik, Ruijie)',
  [PERMISSIONS.CHAT_LIVE]: 'Live Chat Omnichannel',
  [PERMISSIONS.PASSWORDS_REVEAL]: 'Melihat Password (Reveal)',
};

export function hasPermission(user, permission) {
  if (!user || !user.permissions) return false;
  return user.permissions.includes(permission);
}

// Fallbacks for hardcoded places if we still have user.role = 'admin' without permissions
function isLegacyAdmin(user) {
    return user?.role === 'admin' && (!user.permissions || user.permissions.length === 0);
}

// We don't normalize role names anymore since they are dynamic
export function normalizeRole(role) {
  return String(role ?? '').trim().toLowerCase();
}

export function isAdminRole(user) {
  return hasPermission(user, PERMISSIONS.SYSTEM_USERS) || isLegacyAdmin(user);
}

export function canEditTopology(user) {
  return hasPermission(user, PERMISSIONS.NETWORK_TOPOLOGY) || isLegacyAdmin(user);
}

export function canMutateApp(user) {
  return hasPermission(user, PERMISSIONS.SYSTEM_SETTINGS) || isLegacyAdmin(user);
}

export function canRevealPasswords(user) {
  return hasPermission(user, PERMISSIONS.PASSWORDS_REVEAL) || isLegacyAdmin(user);
}

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
  const next = {
    id: user.id,
    username: user.username,
    role: user.role,
    permissions: user.permissions || []
  };
  localStorage.setItem('nocr_user', JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('nocr-role-updated', { detail: next }));
  return next;
}

export function getRoleLabel(role) {
  if (!role) return 'Visitor';
  return String(role).charAt(0).toUpperCase() + String(role).slice(1);
}
