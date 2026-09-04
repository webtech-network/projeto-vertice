'use client';

import { createContext, useContext, useEffect, useReducer, useCallback } from 'react';
import {
  listTasks,
  getTask as repoGetTask,
  createTask as repoCreateTask,
  updateTask as repoUpdateTask,
  deleteTask as repoDeleteTask,
  setTaskStatus as repoSetTaskStatus,
  setTaskPriority as repoSetTaskPriority,
  setTaskPriorityRank as repoSetTaskPriorityRank,
  toApp as taskToApp,
} from '@/lib/tasks/tasksRepo';
import {
  listProjects,
  createProject as repoCreateProject,
  updateProject as repoUpdateProject,
  deleteProject as repoDeleteProject,
  toApp as projectToApp,
} from '@/lib/tasks/projectsRepo';
import { EMPTY_FILTERS } from '@/lib/tasks/filters';
import { resolveTasksPreferences, patchDefaultPreferences } from '@/lib/tasks/tasksViewPreferences';
import { useRealtimeTable } from '@/lib/realtime/useRealtimeTable';
import { ensureUiPreferencesSynced } from './UiPreferencesSync';

const TasksContext = createContext(null);

const initialState = {
  tasks: [],
  projects: [],
  filters: EMPTY_FILTERS,
  view: 'kanban',
  cardDensity: 'expanded',
  collapsedColumns: [],
  groupByProject: false,
  loading: true,
};

function reducer(state, action) {
  switch (action.type) {
    case 'HYDRATE':
      return { ...state, tasks: action.tasks, projects: action.projects, loading: false };
    case 'TASK_UPSERT': {
      const exists = state.tasks.some((t) => t.id === action.task.id);
      const tasks = exists
        ? state.tasks.map((t) => (t.id === action.task.id ? action.task : t))
        : [...state.tasks, action.task];
      return { ...state, tasks };
    }
    // Merges against whatever `state.tasks` is at the moment this action is
    // actually processed by the reducer — not a snapshot captured by a
    // useCallback closure — so two rapid patches to the same task (e.g. a
    // Kanban status drag and an Eisenhower priority drag) never clobber each
    // other on the React-state side (see tasksRepo.js's updateTask for the
    // matching IndexedDB-side fix).
    case 'TASK_PATCH':
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.id ? { ...t, ...action.patch } : t)),
      };
    case 'TASK_REMOVE':
      return { ...state, tasks: state.tasks.filter((t) => t.id !== action.id) };
    case 'PROJECT_UPSERT': {
      const exists = state.projects.some((p) => p.id === action.project.id);
      const projects = exists
        ? state.projects.map((p) => (p.id === action.project.id ? action.project : p))
        : [...state.projects, action.project];
      return { ...state, projects };
    }
    case 'PROJECT_REMOVE':
      return {
        ...state,
        projects: state.projects.filter((p) => p.id !== action.id),
        tasks: state.tasks.map((t) => (t.projectId === action.id ? { ...t, projectId: null } : t)),
      };
    case 'SET_FILTERS':
      return { ...state, filters: { ...state.filters, ...action.filters } };
    case 'SET_VIEW':
      return { ...state, view: action.view };
    case 'SET_DENSITY':
      return { ...state, cardDensity: action.density };
    case 'SET_COLLAPSED_COLUMNS':
      return { ...state, collapsedColumns: action.columns };
    case 'SET_GROUP_BY_PROJECT':
      return { ...state, groupByProject: action.groupByProject };
    default:
      return state;
  }
}

// Wraps /tarefas' content only (mounted in tarefas/page.jsx, not the
// dashboard layout) — this feature's state has no reason to survive
// navigation to other routes, so o Postgres é lido uma vez por visita.
//
// Fase 1: tasksRepo.js/projectsRepo.js agora leem/escrevem direto no
// Postgres (RLS-scoped) em vez de IndexedDB — a sincronização via Google
// Drive (scheduleTasksSync/flushTasksSyncNow) foi removida daqui porque
// deixou de fazer sentido: o Postgres já é a fonte autoritativa e
// multi-dispositivo por si só. Os módulos de sync (tasksDriveSync.js etc.)
// continuam intocados — viram fonte de leitura pra migração da Fase 2, não
// mecanismo de sync ativo.
export function TasksProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      const [tasks, projects] = await Promise.all([listTasks(), listProjects()]);
      if (!cancelled) {
        dispatch({
          type: 'HYDRATE',
          tasks: tasks.filter((t) => !t.deletedAt),
          projects: projects.filter((p) => !p.deletedAt),
        });
      }
    }
    hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  // Realtime — sincronização multi-dispositivo ao vivo (Fase 2). `deleted_at`
  // preenchido na linha nova vira TASK_REMOVE/PROJECT_REMOVE (mesma reducer
  // action que removeTask/removeProject já disparam localmente) em vez de
  // um TASK_UPSERT com deletedAt setado — o estado hidratado nunca guarda
  // itens já deletados (ver o filter no hydrate acima), então manter essa
  // invariante aqui evita reintroduzir um item "fantasma" na lista.
  useRealtimeTable('tasks', {
    onInsert: (row) => dispatch({ type: 'TASK_UPSERT', task: taskToApp(row) }),
    onUpdate: (row) => {
      const task = taskToApp(row);
      if (task.deletedAt) dispatch({ type: 'TASK_REMOVE', id: task.id });
      else dispatch({ type: 'TASK_UPSERT', task });
    },
  });

  useRealtimeTable('projects', {
    onInsert: (row) => dispatch({ type: 'PROJECT_UPSERT', project: projectToApp(row) }),
    onUpdate: (row) => {
      const project = projectToApp(row);
      if (project.deletedAt) dispatch({ type: 'PROJECT_REMOVE', id: project.id });
      else dispatch({ type: 'PROJECT_UPSERT', project });
    },
  });

  // Read after mount only (like Sidebar.jsx's collapse preference) so the
  // server-rendered markup (initialState's hardcoded values, which match
  // FALLBACK_PREFERENCES) never mismatches the client's first paint.
  // Resolves o padrão persistente (tasksViewPreferences.js) — mesma fonte
  // que qualquer toggle feito direto nesta tela grava, então isso é
  // literalmente "o que ficou salvo da última vez", em qualquer dispositivo.
  useEffect(() => {
    const prefs = resolveTasksPreferences();
    dispatch({ type: 'SET_DENSITY', density: prefs.cardDensity });
    dispatch({ type: 'SET_VIEW', view: prefs.view });
    dispatch({ type: 'SET_COLLAPSED_COLUMNS', columns: prefs.collapsedColumns });
    dispatch({ type: 'SET_GROUP_BY_PROJECT', groupByProject: prefs.groupByProject });
  }, []);

  // Fase 2 (sincronização entre dispositivos): `ensureUiPreferencesSynced()`
  // é memoizada a nível de módulo — TasksProvider só monta dentro da
  // página /tarefas (atrás de qualquer fronteira assíncrona própria dela),
  // então pode montar bem depois do componente UiPreferencesSync no layout
  // já ter terminado a leitura; a promise entrega o valor de qualquer jeito,
  // ao contrário de um evento que só chega em quem já estava ouvindo (bug
  // real observado ao vivo com a versão anterior baseada em evento).
  useEffect(() => {
    let cancelled = false;
    ensureUiPreferencesSynced().then(() => {
      if (cancelled) return;
      const prefs = resolveTasksPreferences();
      dispatch({ type: 'SET_DENSITY', density: prefs.cardDensity });
      dispatch({ type: 'SET_VIEW', view: prefs.view });
      dispatch({ type: 'SET_COLLAPSED_COLUMNS', columns: prefs.collapsedColumns });
      dispatch({ type: 'SET_GROUP_BY_PROJECT', groupByProject: prefs.groupByProject });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const addTask = useCallback(async (title, projectId = null) => {
    const task = await repoCreateTask({ title, projectId });
    dispatch({ type: 'TASK_UPSERT', task });
    return task;
  }, []);

  const editTask = useCallback(async (id, patch) => {
    const task = await repoUpdateTask(id, patch);
    if (task) {
      dispatch({ type: 'TASK_UPSERT', task });
    }
    return task;
  }, []);

  const removeTask = useCallback(async (id) => {
    await repoDeleteTask(id);
    dispatch({ type: 'TASK_REMOVE', id });
  }, []);

  // Optimistic: state updates immediately (drag feels instant) via
  // TASK_PATCH (merges against the latest reducer state, not a stale
  // closure — see the reducer case above), the Postgres write happens
  // alongside it. On the rare failure, the authoritative record is re-read
  // rather than restoring a snapshot that may itself be stale by then.
  const moveTaskStatus = useCallback((id, status) => {
    dispatch({ type: 'TASK_PATCH', id, patch: { status } });
    repoSetTaskStatus(id, status).catch(async () => {
      const fresh = await repoGetTask(id);
      if (fresh) dispatch({ type: 'TASK_UPSERT', task: fresh });
    });
  }, []);

  const moveTaskPriority = useCallback((id, priority) => {
    dispatch({ type: 'TASK_PATCH', id, patch: { priority } });
    repoSetTaskPriority(id, priority).catch(async () => {
      const fresh = await repoGetTask(id);
      if (fresh) dispatch({ type: 'TASK_UPSERT', task: fresh });
    });
  }, []);

  // Drag-to-reorder within a column/quadrant (KanbanBoard.jsx's and
  // EisenhowerMatrix.jsx's handleDragEnd, dropping a card onto another card
  // instead of onto the column/quadrant background) — same optimistic
  // patch-then-persist shape as moveTaskStatus/moveTaskPriority above.
  const moveTaskPriorityRank = useCallback((id, priorityRank) => {
    dispatch({ type: 'TASK_PATCH', id, patch: { priorityRank } });
    repoSetTaskPriorityRank(id, priorityRank).catch(async () => {
      const fresh = await repoGetTask(id);
      if (fresh) dispatch({ type: 'TASK_UPSERT', task: fresh });
    });
  }, []);

  const addProject = useCallback(async ({ name, type, canvasReference = null, color = null }) => {
    const project = await repoCreateProject({ name, type, canvasReference, color });
    dispatch({ type: 'PROJECT_UPSERT', project });
    return project;
  }, []);

  const editProject = useCallback(async (id, patch) => {
    const project = await repoUpdateProject(id, patch);
    if (project) {
      dispatch({ type: 'PROJECT_UPSERT', project });
    }
    return project;
  }, []);

  const removeProject = useCallback(async (id) => {
    await repoDeleteProject(id);
    dispatch({ type: 'PROJECT_REMOVE', id });
  }, []);

  // setView/setCardDensity/setColumnCollapsed/setStagesCollapsed below write
  // direto no padrão persistente (tasksViewPreferences.js) — sincroniza
  // entre dispositivos via UiPreferencesSync.jsx. Até a Fase 2 isso escrevia
  // só num tier de sessão efêmero (nunca sobrevivia a fechar a aba); removido
  // por pedido explícito do usuário, que espera ver qualquer toggle feito
  // aqui refletido em outro dispositivo. (setFilters below doesn't persist
  // at all — filters reset every visit, isso continua.)
  const setFilters = useCallback((filters) => dispatch({ type: 'SET_FILTERS', filters }), []);
  const setView = useCallback((view) => {
    patchDefaultPreferences({ view });
    dispatch({ type: 'SET_VIEW', view });
  }, []);
  const setCardDensity = useCallback((density) => {
    patchDefaultPreferences({ cardDensity: density });
    dispatch({ type: 'SET_DENSITY', density });
  }, []);
  const setGroupByProject = useCallback((groupByProject) => {
    patchDefaultPreferences({ groupByProject });
    dispatch({ type: 'SET_GROUP_BY_PROJECT', groupByProject });
  }, []);
  // Closes/reopens a single Kanban column — the header close button (any
  // status) and the collapsed strip's click-to-expand (KanbanColumn.jsx)
  // both go through here.
  const setColumnCollapsed = useCallback(
    (status, collapsed) => {
      const next = collapsed
        ? Array.from(new Set([...state.collapsedColumns, status]))
        : state.collapsedColumns.filter((s) => s !== status);
      patchDefaultPreferences({ collapsedColumns: next });
      dispatch({ type: 'SET_COLLAPSED_COLUMNS', columns: next });
    },
    [state.collapsedColumns],
  );
  // Convenience batch action over the same collapsedColumns state — kept for
  // TasksView.jsx's toolbar shortcut and TarefasPreferences.jsx's persisted
  // default, both of which still treat Backlog/Block as one pair.
  // Independent from per-column closes: collapsing Backlog on its own via
  // its header button doesn't affect Block, and vice versa.
  const setStagesCollapsed = useCallback(
    (collapsed) => {
      const next = collapsed
        ? Array.from(new Set([...state.collapsedColumns, 'BACKLOG', 'BLOCK']))
        : state.collapsedColumns.filter((s) => s !== 'BACKLOG' && s !== 'BLOCK');
      patchDefaultPreferences({ collapsedColumns: next });
      dispatch({ type: 'SET_COLLAPSED_COLUMNS', columns: next });
    },
    [state.collapsedColumns],
  );

  // For mutations that bypass the wrappers above and write straight to
  // Postgres (TasksExportImport.jsx's file import, via tasksExport.js's
  // replaceAllTasks/replaceAllProjects — e agora também
  // importLegacyIndexedDbData, ver efeito abaixo) — re-lê e re-hidrata o
  // estado, callable sob demanda em vez de esperar uma transição de sync.
  const refreshFromLocal = useCallback(async () => {
    const [tasks, projects] = await Promise.all([listTasks(), listProjects()]);
    dispatch({
      type: 'HYDRATE',
      tasks: tasks.filter((t) => !t.deletedAt),
      projects: projects.filter((p) => !p.deletedAt),
    });
  }, []);

  // TEMPORÁRIO — Fase 1 (ver src/lib/migration/importLegacyIndexedDb.js):
  // ponte pra importar, uma única vez, tasks/projects que ficaram presos no
  // IndexedDB de antes desta sessão migrar pra Postgres. Sem UI própria de
  // propósito — é uma operação de uma vez só; abra o console do navegador
  // em /tarefas e rode `await importLegacyIndexedDbData()`. Remover este
  // efeito (e o arquivo do módulo) depois que a migração automática de
  // verdade existir (Fase 2) ou depois de usado, o que vier primeiro.
  useEffect(() => {
    let cancelled = false;
    import('@/lib/migration/importLegacyIndexedDb').then(({ importLegacyIndexedDbData }) => {
      if (cancelled) return;
      window.importLegacyIndexedDbData = async () => {
        const result = await importLegacyIndexedDbData();
        await refreshFromLocal();
        return result;
      };
    });
    return () => {
      cancelled = true;
    };
  }, [refreshFromLocal]);

  const value = {
    ...state,
    addTask,
    editTask,
    removeTask,
    moveTaskStatus,
    moveTaskPriority,
    moveTaskPriorityRank,
    addProject,
    editProject,
    removeProject,
    setFilters,
    setView,
    setCardDensity,
    setGroupByProject,
    setColumnCollapsed,
    setStagesCollapsed,
    refreshFromLocal,
  };

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}

export function useTasks() {
  return useContext(TasksContext);
}
