import { upsertUiPreferences } from '@/lib/uiPreferences';

// Preferência persistente e única do módulo Tarefas (card density, visão
// padrão, colunas do Kanban fechadas, agrupar por projeto) — localStorage
// como cache local rápido/síncrono (evita hydration mismatch, ver
// TasksProvider.jsx) + write-through pro Postgres (Fase 2: sincroniza
// entre dispositivos, ver UiPreferencesSync.jsx).
//
// Até a Fase 2 existia um segundo tier — "session" (sessionStorage),
// gravado sozinho por todo toggle feito direto na tela de Tarefas,
// nunca sobrevivendo a fechar a aba nem sincronizando entre dispositivos.
// Removido por pedido explícito do usuário: agora qualquer toggle feito
// direto na tela de Tarefas grava aqui mesmo, na única fonte.
const DEFAULTS_KEY = 'canvastools:tarefas-default-prefs';

// Pre-dates this two-tier system — density and Backlog/Block collapse used
// to each persist under their own always-on localStorage key, no "default
// vs session" distinction. Folded into the new default tier below (one-time,
// on first read) so a professor who'd already set these doesn't see them
// silently reset to FALLBACK_PREFERENCES.
const LEGACY_DENSITY_KEY = 'canvastools:workspace-card-density';
const LEGACY_STAGES_COLLAPSED_KEY = 'canvastools:workspace-stages-collapsed';

export const FALLBACK_PREFERENCES = {
  cardDensity: 'expanded',
  view: 'kanban',
  // Which Kanban column statuses start collapsed (narrow strip — see
  // KanbanColumn.jsx). Used to be a single `stagesCollapsed` boolean
  // covering only BACKLOG+BLOCK together; generalized to a status list so
  // any column can be closed independently, via its own header button.
  collapsedColumns: [],
  // "Agrupar por projeto" toolbar toggle (TasksView.jsx) — clusters each
  // view's task list by project (see grouping.js's groupTasksByProject)
  // instead of one flat list.
  groupByProject: false,
};

function migrateLegacyPreferences() {
  const legacy = {};
  const legacyDensity = window.localStorage.getItem(LEGACY_DENSITY_KEY);
  if (legacyDensity === 'condensed' || legacyDensity === 'expanded') legacy.cardDensity = legacyDensity;
  if (window.localStorage.getItem(LEGACY_STAGES_COLLAPSED_KEY) === '1') legacy.collapsedColumns = ['BACKLOG', 'BLOCK'];
  window.localStorage.removeItem(LEGACY_DENSITY_KEY);
  window.localStorage.removeItem(LEGACY_STAGES_COLLAPSED_KEY);
  if (Object.keys(legacy).length > 0) {
    window.localStorage.setItem(DEFAULTS_KEY, JSON.stringify({ ...FALLBACK_PREFERENCES, ...legacy }));
  }
  return legacy;
}

// Converts a still-on-disk `{ stagesCollapsed: boolean }` (the shape this
// module used before per-column collapse existed) into the current
// `collapsedColumns` array shape — same one-time-fold-in idea as
// migrateLegacyPreferences above, just one layer later.
function migrateStagesCollapsedField(stored) {
  if (stored.collapsedColumns !== undefined || typeof stored.stagesCollapsed !== 'boolean') return stored;
  const { stagesCollapsed, ...rest } = stored;
  return { ...rest, collapsedColumns: stagesCollapsed ? ['BACKLOG', 'BLOCK'] : [] };
}

export function getDefaultPreferences() {
  if (typeof window === 'undefined') return FALLBACK_PREFERENCES;
  try {
    if (window.localStorage.getItem(DEFAULTS_KEY) === null) {
      return { ...FALLBACK_PREFERENCES, ...migrateLegacyPreferences() };
    }
    const stored = migrateStagesCollapsedField(JSON.parse(window.localStorage.getItem(DEFAULTS_KEY) || '{}'));
    return { ...FALLBACK_PREFERENCES, ...stored };
  } catch {
    return FALLBACK_PREFERENCES;
  }
}

// Chamado tanto por TarefasPreferences.jsx (formulário de /perfil) quanto
// por TasksProvider.jsx (todo toggle feito direto na tela de Tarefas) —
// única fonte de escrita agora, sem tier de sessão separado.
export function patchDefaultPreferences(patch) {
  const current = getDefaultPreferences();
  window.localStorage.setItem(DEFAULTS_KEY, JSON.stringify({ ...current, ...patch }));

  // Write-through pro Postgres (Fase 2: sincroniza entre dispositivos) —
  // melhor esforço, nunca bloqueia nem quebra a UI se falhar (ex.: sessão
  // Supabase expirada no meio da edição). localStorage acima já é a
  // aplicação real da mudança nesta aba.
  const row = {};
  if ('cardDensity' in patch) row.card_density = patch.cardDensity;
  if ('view' in patch) row.tasks_view = patch.view;
  if ('groupByProject' in patch) row.group_by_project = patch.groupByProject;
  if ('collapsedColumns' in patch) row.collapsed_columns = patch.collapsedColumns;
  if (Object.keys(row).length > 0) {
    upsertUiPreferences(row).catch(() => {});
  }
}

// Mantido como alias de getDefaultPreferences() — chamado no mount de
// TasksProvider.jsx. Sem tier de sessão pra mesclar mais, mas o nome
// "resolve" (em vez de simplesmente reexportar getDefaultPreferences) fica
// documentando que esta é a leitura inicial resolvida do módulo, ponto
// único de entrada consumido de fora deste arquivo.
export function resolveTasksPreferences() {
  return getDefaultPreferences();
}
