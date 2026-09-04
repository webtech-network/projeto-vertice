'use client';

import { useEffect } from 'react';
import { getUiPreferences, upsertUiPreferences } from '@/lib/uiPreferences';
import { getDefaultPreferences, patchDefaultPreferences } from '@/lib/tasks/tasksViewPreferences';
import { getActiveWorkspaceId, setActiveWorkspaceId } from '@/lib/workspaces/activeWorkspacePreference';
import { BASE_WORKSPACE_ID } from '@/lib/workspaces/workspacesRepo';
import { getStoredTheme, applyTheme } from '@/lib/theme';
import { getSidebarCollapsed, setSidebarCollapsed } from '@/lib/sidebarPreference';

// Memoizado a nível de módulo (não React state) — a primeira chamada, de
// QUALQUER consumidor, em QUALQUER ordem de mount, dispara a leitura real
// do Postgres; toda chamada seguinte (deste carregamento de página) recebe
// a mesma promise já resolvida. Isso é o que resolve a corrida entre
// "quem monta primeiro": diferente de um evento de `window` (que só chega
// em quem já está ouvindo no momento do dispatch), uma promise entrega o
// valor pra quem chamar `.then()` depois de resolvida também — importante
// porque TasksProvider.jsx (só monta dentro da página /tarefas, atrás de
// qualquer fronteira assíncrona própria da página) pode montar bem depois
// de WorkspaceScopeProvider.jsx (no layout, mesma leva de montagem deste
// componente) — confirmado ao vivo: o evento anterior fazia o workspace
// ativo refletir entre dispositivos mas não as prefs de Tarefas, exatamente
// por essa diferença de timing de mount.
let syncPromise = null;

// Sem UI própria, mesmo formato de ServiceWorkerRegistration.jsx — só
// dispara `ensureUiPreferencesSynced()` cedo (no mount do layout), pra
// quando os outros consumidores chamarem a mesma função ela já estar
// resolvida ou perto disso. O componente em si não é o mecanismo de
// sincronização — só o "primeiro chute".
export default function UiPreferencesSync() {
  useEffect(() => {
    ensureUiPreferencesSynced();
  }, []);

  return null;
}

// Reconcilia, uma vez por carregamento, as sete preferências de UI que hoje
// moram no localStorage/sessionStorage do dispositivo (densidade/visão/
// agrupamento/colunas fechadas de Tarefas, workspace ativo, tema, sidebar
// colapsada) com `public.ui_preferences` (Fase 2: sincroniza entre
// dispositivos). O localStorage continua sendo o cache local rápido/
// síncrono que cada domínio já lê no próprio mount (crítico pro tema, que
// evita flash via um script inline que roda antes de qualquer JS — ver
// theme.js's THEME_INIT_SCRIPT); isso só entra depois, corrigindo esse
// cache se o Postgres tiver um valor diferente.
//
// Chamada por Sidebar.jsx/ThemeToggle.jsx/TasksProvider.jsx/
// WorkspaceScopeProvider.jsx no próprio mount, além de UiPreferencesSync
// acima. Nenhuma assinatura Realtime aqui de propósito — diferente de
// tasks/projects/workspaces (sync ao vivo, ver useRealtimeTable.js), o
// pedido era só "refletir ao trocar de dispositivo", satisfeito por ler
// uma vez no mount.
export function ensureUiPreferencesSynced() {
  if (!syncPromise) {
    syncPromise = performSync();
  }
  return syncPromise;
}

async function performSync() {
  let prefs;
  try {
    prefs = await getUiPreferences();
  } catch {
    return; // best-effort — sem sessão Supabase válida ainda, por exemplo
  }

  if (prefs) {
    // Postgres já tem uma linha — aplica cada campo pelo setter local já
    // existente de cada domínio (que também já escreve no localStorage),
    // sem duplicar essa lógica aqui.
    applyTheme(prefs.theme);
    setActiveWorkspaceId(prefs.activeWorkspaceId || BASE_WORKSPACE_ID);
    patchDefaultPreferences({
      cardDensity: prefs.cardDensity,
      view: prefs.tasksView,
      groupByProject: prefs.groupByProject,
      collapsedColumns: prefs.collapsedColumns,
    });
    setSidebarCollapsed(Boolean(prefs.sidebarCollapsed));
  } else {
    // Primeiro acesso deste usuário — semeia o Postgres com o que já está
    // neste dispositivo (migração automática e silenciosa, sem precisar de
    // um passo manual).
    const taskPrefs = getDefaultPreferences();
    await upsertUiPreferences({
      theme: getStoredTheme(),
      active_workspace_id: (() => {
        const id = getActiveWorkspaceId();
        return id === BASE_WORKSPACE_ID ? null : id;
      })(),
      card_density: taskPrefs.cardDensity,
      tasks_view: taskPrefs.view,
      group_by_project: taskPrefs.groupByProject,
      collapsed_columns: taskPrefs.collapsedColumns,
      sidebar_collapsed: getSidebarCollapsed(),
    }).catch(() => {});
  }
}
