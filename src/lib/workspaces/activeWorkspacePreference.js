import { BASE_WORKSPACE_ID } from './workspacesRepo';
import { upsertUiPreferences } from '@/lib/uiPreferences';

// Ainda deliberadamente sem tier de sessão como tasksViewPreferences.js
// (a escolha ativa não tem um "override temporário desta aba" fazendo
// sentido) — mas, ao contrário do que este comentário dizia antes, agora
// sincroniza entre dispositivos via write-through pro Postgres
// (ui_preferences.active_workspace_id) — pedido explícito do usuário.
// localStorage continua sendo o cache local rápido/síncrono (evita
// hydration mismatch, ver WorkspaceScopeProvider.jsx).
const ACTIVE_WORKSPACE_KEY = 'vertice:active-workspace-id';
// Seleção múltipla (ADR-0021): lista de ids em JSON. A chave antiga continua
// sendo escrita com o primeiro id para que um build/dispositivo anterior ainda
// leia algo coerente.
const ACTIVE_WORKSPACE_IDS_KEY = 'vertice:active-workspace-ids';

// Base é exclusiva e lista vazia volta a Base (ADR-0021).
export function normalizeWorkspaceIds(ids) {
  const list = [...new Set((Array.isArray(ids) ? ids : []).filter((id) => typeof id === 'string' && id))];
  if (list.length === 0 || list.includes(BASE_WORKSPACE_ID)) return [BASE_WORKSPACE_ID];
  return list;
}

export function getActiveWorkspaceIds() {
  if (typeof window === 'undefined') return [BASE_WORKSPACE_ID];
  try {
    const raw = window.localStorage.getItem(ACTIVE_WORKSPACE_IDS_KEY);
    if (raw) return normalizeWorkspaceIds(JSON.parse(raw));
    return normalizeWorkspaceIds([window.localStorage.getItem(ACTIVE_WORKSPACE_KEY)]);
  } catch {
    return [BASE_WORKSPACE_ID];
  }
}

export function getActiveWorkspaceId() {
  return getActiveWorkspaceIds()[0];
}

export function setActiveWorkspaceIds(ids) {
  if (typeof window === 'undefined') return;
  const normalized = normalizeWorkspaceIds(ids);
  try {
    window.localStorage.setItem(ACTIVE_WORKSPACE_IDS_KEY, JSON.stringify(normalized));
    window.localStorage.setItem(ACTIVE_WORKSPACE_KEY, normalized[0]);
  } catch {
    // best-effort — worst case the choice doesn't survive a reload
  }

  // BASE_WORKSPACE_ID ('base') é um id sintético, nunca uma linha real de
  // workspaces — vira null na coluna (mesmo significado: "nenhum filtro").
  const isBase = normalized[0] === BASE_WORKSPACE_ID;
  upsertUiPreferences({ active_workspace_id: isBase ? null : normalized[0] }).catch(() => {});
  // Coluna nova (manual/14_ui_preferences_active_workspace_ids.sql) em upsert
  // à parte: num banco ainda sem a migração só esta chamada falha, sem
  // derrubar a sincronização do id primário acima.
  upsertUiPreferences({ active_workspace_ids: isBase ? [] : normalized }).catch(() => {});
}

export function setActiveWorkspaceId(id) {
  setActiveWorkspaceIds([id]);
}
