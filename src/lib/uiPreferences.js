import { createSupabaseBrowserClient } from '@/lib/supabaseBrowserClient';

// Mapeamento de campo camelCase (app) <-> snake_case (Postgres) — mesmo
// padrão de tasksRepo.js/workspacesRepo.js.
export function toApp(row) {
  if (!row) return null;
  return {
    cardDensity: row.card_density,
    tasksView: row.tasks_view,
    groupByProject: row.group_by_project,
    collapsedColumns: row.collapsed_columns || [],
    activeWorkspaceId: row.active_workspace_id,
    theme: row.theme,
    sidebarCollapsed: row.sidebar_collapsed,
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

// null quando o usuário ainda não tem linha (primeiro acesso depois do
// deploy) — UiPreferencesSync.jsx trata isso como "semeia do localStorage
// atual" em vez de "aplica os valores".
export async function getUiPreferences() {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.from('ui_preferences').select('*').maybeSingle();
  if (error) throw error;
  return toApp(data);
}

// Upsert parcial — só os campos presentes em `patch` (já em snake_case,
// nome de coluna) são tocados; o resto da linha mantém o valor atual (ou o
// default da coluna, na primeira escrita). user_id nunca precisa ser
// passado — a coluna tem `default auth.uid()`, mesmo padrão de
// shortcuts.js/courseNotesRepo.js.
export async function upsertUiPreferences(patch) {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from('ui_preferences').upsert(patch, { onConflict: 'user_id' });
  if (error) throw error;
}
