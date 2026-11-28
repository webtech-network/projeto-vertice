import { upsertUiPreferences } from '@/lib/uiPreferences';

export const VIEW_ROLE_KEY = 'vertice:active-view-role';
const VALID_ROLES = new Set(['teacher', 'student']);

export function getStoredViewRole() {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(VIEW_ROLE_KEY);
    return VALID_ROLES.has(value) ? value : null;
  } catch {
    return null;
  }
}

export function setStoredViewRole(role, { syncRemote = true } = {}) {
  if (typeof window === 'undefined' || !VALID_ROLES.has(role)) return;
  try {
    window.localStorage.setItem(VIEW_ROLE_KEY, role);
  } catch {
    // best-effort
  }
  if (syncRemote) {
    upsertUiPreferences({ active_view_mode: role }).catch(() => {});
  }
  window.dispatchEvent(new Event('vertice:view-role-change'));
}
