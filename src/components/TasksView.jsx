'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Flag,
  Zap,
  FolderKanban,
  Filter,
  FileJson,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Rows3,
  Rows4,
  Columns3,
  Grid2x2,
  Table2,
  Layers,
} from 'lucide-react';
import { useTasks } from './TasksProvider';
import TasksFilterModal from './TasksFilterModal';
import QuickAddTask from './QuickAddTask';
import TaskSearch from './TaskSearch';
import KanbanBoard from './KanbanBoard';
import EisenhowerMatrix from './EisenhowerMatrix';
import TaskTable from './TaskTable';
import TaskDetailModal from './TaskDetailModal';
import ProjectsManagerModal from './ProjectsManagerModal';
import TasksExportImport from './TasksExportImport';
import { STATUS_META } from '@/lib/tasks/statusMeta';
import { STATUSES } from '@/lib/tasks/tasksRepo';
import { EMPTY_FILTERS } from '@/lib/tasks/filters';

export default function TasksView() {
  const {
    view,
    setView,
    cardDensity,
    setCardDensity,
    groupByProject,
    setGroupByProject,
    collapsedColumns,
    setStagesCollapsed,
    loading,
    tasks,
    filters,
  } = useTasks();
  // Toolbar shortcut still targets Backlog+Block as a pair — independent
  // per-column closes (via each column's own header button) don't affect
  // this derived flag unless both happen to end up collapsed anyway.
  const stagesCollapsed = collapsedColumns.includes('BACKLOG') && collapsedColumns.includes('BLOCK');
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [showProjectsManager, setShowProjectsManager] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showExportImport, setShowExportImport] = useState(false);
  // Set by KanbanColumn.jsx's double-click-on-empty-space — opens
  // TaskDetailModal in "create" mode with this status pre-selected.
  const [creatingStatus, setCreatingStatus] = useState(null);
  // Looked up fresh every render (rather than storing the clicked object
  // itself) so the modal always reflects the latest state — e.g. a drag
  // that changes the task moments before the click is still respected.
  const selectedTask = selectedTaskId ? tasks.find((t) => t.id === selectedTaskId) || null : null;

  // `search` has its own visible input (TaskSearch) — it shouldn't light up
  // the Filtrar button too.
  const hasActiveFilters = Object.entries(filters).some(
    ([key, value]) => key !== 'search' && value !== EMPTY_FILTERS[key] && value !== null && value !== '',
  );

  if (loading) {
    return <p className="lede">Carregando tarefas…</p>;
  }

  const stagesToggleTitle =
    view === 'kanban'
      ? stagesCollapsed
        ? 'Mostrar colunas Backlog/Block'
        : 'Recolher colunas Backlog/Block'
      : stagesCollapsed
        ? 'Mostrar tarefas de Backlog/Block na matriz'
        : 'Ocultar tarefas de Backlog/Block na matriz';

  return (
    <>
      <div className="tasks-toolbar">
        {/* Nova tarefa + Buscar + Filtrar tarefas share the first line — everything
            else (including o botão de mostrar/ocultar Backlog/Block) lives
            on the second line, in tasks-toolbar-right. */}
        <div className="tasks-toolbar-primary">
          <QuickAddTask />
          <TaskSearch />
          <button
            type="button"
            className={`btn btn-secondary btn-icon${hasActiveFilters ? ' active' : ''}`}
            onClick={() => setShowFilterModal(true)}
            title="Filtrar tarefas"
            aria-label="Filtrar tarefas"
            aria-pressed={hasActiveFilters}
          >
            <Filter size={16} strokeWidth={1.8} />
          </button>
        </div>

        <div className="tasks-toolbar-secondary">
        <div className="tasks-toolbar-right">
          {view !== 'table' && (
            <button
              type="button"
              className={`btn btn-secondary btn-icon${stagesCollapsed ? ' active' : ''}`}
              onClick={() => setStagesCollapsed(!stagesCollapsed)}
              title={stagesToggleTitle}
              aria-label={stagesToggleTitle}
              aria-pressed={stagesCollapsed}
            >
              {stagesCollapsed ? <PanelLeftOpen size={16} strokeWidth={1.8} /> : <PanelLeftClose size={16} strokeWidth={1.8} />}
            </button>
          )}

          <button
            type="button"
            className={`btn btn-secondary btn-icon${groupByProject ? ' active' : ''}`}
            onClick={() => setGroupByProject(!groupByProject)}
            title="Agrupar por projeto"
            aria-label="Agrupar por projeto"
            aria-pressed={groupByProject}
          >
            <Layers size={16} strokeWidth={1.8} />
          </button>

          <div className="segmented" role="group" aria-label="Densidade dos cards">
            <button
              type="button"
              className={`segmented-btn icon-only${cardDensity === 'expanded' ? ' active' : ''}`}
              onClick={() => setCardDensity('expanded')}
              title="Densidade aberta"
              aria-label="Densidade aberta"
              aria-pressed={cardDensity === 'expanded'}
            >
              <Rows3 size={16} strokeWidth={1.8} />
            </button>
            <button
              type="button"
              className={`segmented-btn icon-only${cardDensity === 'condensed' ? ' active' : ''}`}
              onClick={() => setCardDensity('condensed')}
              title="Densidade condensada"
              aria-label="Densidade condensada"
              aria-pressed={cardDensity === 'condensed'}
            >
              <Rows4 size={16} strokeWidth={1.8} />
            </button>
          </div>

          <div className="segmented" role="group" aria-label="Alternar visão">
            <button
              type="button"
              className={`segmented-btn icon-only${view === 'kanban' ? ' active' : ''}`}
              onClick={() => setView('kanban')}
              title="Kanban"
              aria-label="Kanban"
              aria-pressed={view === 'kanban'}
            >
              <Columns3 size={16} strokeWidth={1.8} />
            </button>
            <button
              type="button"
              className={`segmented-btn icon-only${view === 'eisenhower' ? ' active' : ''}`}
              onClick={() => setView('eisenhower')}
              title="Matriz de Eisenhower"
              aria-label="Matriz de Eisenhower"
              aria-pressed={view === 'eisenhower'}
            >
              <Grid2x2 size={16} strokeWidth={1.8} />
            </button>
            <button
              type="button"
              className={`segmented-btn icon-only${view === 'table' ? ' active' : ''}`}
              onClick={() => setView('table')}
              title="Tabela"
              aria-label="Tabela"
              aria-pressed={view === 'table'}
            >
              <Table2 size={16} strokeWidth={1.8} />
            </button>
          </div>

          <button type="button" className="btn btn-secondary btn-icon" onClick={() => setShowProjectsManager(true)} title="Projetos" aria-label="Projetos">
            <FolderKanban size={16} strokeWidth={1.8} />
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-icon"
            onClick={() => setShowExportImport(true)}
            title="Exportar/Importar tarefas (JSON)"
            aria-label="Exportar/Importar tarefas (JSON)"
          >
            <FileJson size={16} strokeWidth={1.8} />
          </button>

          <Link
            href="/perfil?tab=preferencias"
            className="btn btn-secondary btn-icon"
            title="Preferências de Tarefas"
            aria-label="Preferências de Tarefas"
          >
            <Settings size={16} strokeWidth={1.8} />
          </Link>
        </div>
        </div>
      </div>

      {view === 'kanban' && (
        <KanbanBoard onSelect={(task) => setSelectedTaskId(task.id)} onCreate={(status) => setCreatingStatus(status)} />
      )}
      {view === 'eisenhower' && <EisenhowerMatrix onSelect={(task) => setSelectedTaskId(task.id)} />}
      {view === 'table' && <TaskTable onSelect={(task) => setSelectedTaskId(task.id)} />}

      {/* Status is invisible while looking at the Eisenhower matrix, and
          priority is invisible while looking at the Kanban board — this
          legend is what makes the condensed cards' icon-only status/
          priority indicators (see TaskCard.jsx) legible either way. */}
      <ul className="icon-legend">
        {STATUSES.map((status) => {
          const { label, Icon } = STATUS_META[status];
          return (
            <li key={status}>
              <Icon size={14} strokeWidth={1.8} aria-hidden="true" /> {label}
            </li>
          );
        })}
        <li className="icon-legend-separator" aria-hidden="true" />
        <li>
          <Flag size={14} strokeWidth={1.8} aria-hidden="true" /> Importante
        </li>
        <li>
          <Zap size={14} strokeWidth={1.8} aria-hidden="true" /> Urgente
        </li>
      </ul>

      {selectedTask && <TaskDetailModal task={selectedTask} onClose={() => setSelectedTaskId(null)} />}
      {creatingStatus && <TaskDetailModal initialStatus={creatingStatus} onClose={() => setCreatingStatus(null)} />}
      {showProjectsManager && <ProjectsManagerModal onClose={() => setShowProjectsManager(false)} />}
      {showFilterModal && <TasksFilterModal onClose={() => setShowFilterModal(false)} />}
      {showExportImport && <TasksExportImport onClose={() => setShowExportImport(false)} />}
    </>
  );
}
