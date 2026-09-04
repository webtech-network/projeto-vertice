import { BASE_WORKSPACE_ID } from './workspacesRepo';
import { upsertUiPreferences } from '@/lib/uiPreferences';

// Ainda deliberadamente sem tier de sessão como tasksViewPreferences.js
// (a escolha ativa não tem um "override temporário desta aba" fazendo
// sentido) — mas, ao contrário do que este comentário dizia antes, agora
// sincroniza entre dispositivos via write-through pro Postgres
// (ui_preferences.active_workspace_id) — pedido explícito do usuário.
// localStorage continua sendo o cache local rápido/síncrono (evita
// hydration mismatch, ver WorkspaceScopeProvider.jsx).
const ACTIVE_WORKSPACE_KEY = 'canvastools:active-workspace-id';

export function getActiveWorkspaceId() {
  if (typeof window === 'undefined') return BASE_WORKSPACE_ID;
  try {
    return window.localStorage.getItem(ACTIVE_WORKSPACE_KEY) || BASE_WORKSPACE_ID;
  } catch {
    return BASE_WORKSPACE_ID;
  }
}

export function setActiveWorkspaceId(id) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ACTIVE_WORKSPACE_KEY, id);
  } catch {
    // best-effort — worst case the choice doesn't survive a reload
  }

  // BASE_WORKSPACE_ID ('base') é um id sintético, nunca uma linha real de
  // workspaces — vira null na coluna (mesmo significado: "nenhum filtro").
  upsertUiPreferences({ active_workspace_id: id === BASE_WORKSPACE_ID ? null : id }).catch(() => {});
}
