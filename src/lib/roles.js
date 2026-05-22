/** Client & server safe role helpers */

export const ROLES = ['admin', 'editor', 'visitor'];

export function normalizeRole(role) {
  const r = String(role ?? '').trim().toLowerCase();
  if (r === 'admin' || r === 'administrator') return 'admin';
  if (r === 'editor' || r === 'edit') return 'editor';
  if (r === 'visitor' || r === 'user' || r === 'readonly') return 'visitor';
  return null;
}

export function isAdminRole(role) {
  return normalizeRole(role) === 'admin';
}

export function isEditorRole(role) {
  return normalizeRole(role) === 'editor';
}

export function isVisitorRole(role) {
  return normalizeRole(role) === 'visitor';
}

/** Full edit on topology map */
export function canEditTopology(role) {
  const r = normalizeRole(role);
  return r === 'admin' || r === 'editor';
}

/** Mutate devices, settings, users, VPN */
export function canMutateApp(role) {
  return isAdminRole(role);
}

/** Reveal passwords in read-only views (devices/settings lists) */
export function canRevealPasswords(role) {
  const r = normalizeRole(role);
  return r === 'admin' || r === 'editor';
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
    role: normalizeRole(user.role) || 'visitor'
  };
  localStorage.setItem('nocr_user', JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('nocr-role-updated', { detail: next }));
  return next;
}

export function getRoleLabel(role) {
  const r = normalizeRole(role);
  if (r === 'admin') return 'Admin';
  if (r === 'editor') return 'Editor';
  if (r === 'visitor') return 'Visitor';
  return 'Visitor';
}
