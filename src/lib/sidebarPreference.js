import { upsertUiPreferences } from '@/lib/uiPreferences';

// Mesmo formato de theme.js/activeWorkspacePreference.js — extraído de
// dentro de Sidebar.jsx pra evitar import circular com
// UiPreferencesSync.jsx (que precisa ler/escrever esta mesma chave).
export const SIDEBAR_COLLAPSE_KEY = 'canvastools:sidebar-collapsed';

export function getSidebarCollapsed() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setSidebarCollapsed(collapsed) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSE_KEY, collapsed ? '1' : '0');
  } catch {
    // best-effort
  }
  upsertUiPreferences({ sidebar_collapsed: collapsed }).catch(() => {});
}
