'use client';

import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronUp, ChevronDown, ChevronsUpDown, Flag, Zap, GraduationCap } from 'lucide-react';
import { useTasks } from './TasksProvider';
import TaskContextMenu from './TaskContextMenu';
import { useWorkspaceScope } from './WorkspaceScopeProvider';
import { BASE_WORKSPACE_ID } from '@/lib/workspaces/workspacesRepo';
import { applyFilters } from '@/lib/tasks/filters';
import { comparePriority } from '@/lib/tasks/taskSort';
import { groupTasksByProject } from '@/lib/tasks/grouping';
import { formatDueDate, isPastDue } from '@/lib/tasks/dueDate';
import { STATUSES } from '@/lib/tasks/tasksRepo';
import { STATUS_META } from '@/lib/tasks/statusMeta';

// Every sortable column but "Prioridade" needs its own comparator; that one
// reuses taskSort.js's comparePriority (same rank → urgência → importância
// tie-break as the Kanban/Matriz views) so the table's default order matches
// theirs. `projectsById` is only needed by the 'project' column, resolving a
// task's project name the same way TaskCard.jsx/KanbanColumn.jsx do.
function buildComparator(sortKey, projectsById) {
  switch (sortKey) {
    case 'project':
      return (a, b) => {
        const nameA = a.projectId && projectsById.has(a.projectId) ? projectsById.get(a.projectId).name : 'Sem projeto';
        const nameB = b.projectId && projectsById.has(b.projectId) ? projectsById.get(b.projectId).name : 'Sem projeto';
        return nameA.localeCompare(nameB);
      };
    case 'title':
      return (a, b) => a.title.localeCompare(b.title);
    case 'status':
      return (a, b) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status);
    case 'important':
      return (a, b) => (a.priority?.important ? 1 : 0) - (b.priority?.important ? 1 : 0);
    case 'urgent':
      return (a, b) => (a.priority?.urgent ? 1 : 0) - (b.priority?.urgent ? 1 : 0);
    case 'dueDate':
      return (a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      };
    case 'priorityRank':
    default:
      return comparePriority;
  }
}

const COLUMNS = [
  { key: 'priorityRank', label: 'Prioridade' },
  { key: 'project', label: 'Projeto' },
  { key: 'title', label: 'Título' },
  { key: 'status', label: 'Status' },
  { key: 'important', label: 'Importante' },
  { key: 'urgent', label: 'Urgente' },
  { key: 'dueDate', label: 'Prazo' },
];
// Tags round out the row but aren't a sort key — there's no single sensible
// order for a set-valued column.
const TOTAL_COLUMNS = COLUMNS.length + 1;

// Third view alongside Kanban/Matriz (TasksView.jsx) — every non-deleted,
// filtered task in one sortable table instead of split across status columns
// or priority quadrants. Shares the same `groupByProject` toolbar toggle as
// the other two views (grouping.js's groupTasksByProject): grouping clusters
// rows by project, the active column sort still orders tasks *within* each
// group.
export default function TaskTable({ onSelect }) {
  const { tasks, projects, filters, groupByProject } = useTasks();
  const { activeWorkspaceId, getVisibleResourceIds } = useWorkspaceScope();
  const [sortKey, setSortKey] = useState('priorityRank');
  const [sortDir, setSortDir] = useState('asc');
  // Desktop right-click affordance (see TaskContextMenu.jsx) — one shared
  // slot for the whole table since only one row can be right-clicked at a
  // time, same reasoning TasksView.jsx uses for its single selectedTaskId.
  const [contextMenu, setContextMenu] = useState(null);

  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  function handleSort(key) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sorted = useMemo(() => {
    const scope =
      activeWorkspaceId === BASE_WORKSPACE_ID
        ? null
        : { visibleProjectIds: getVisibleResourceIds('project'), visibleCourseIds: getVisibleResourceIds('course') };
    const filtered = applyFilters(tasks, filters, projects, scope);
    const cmp = buildComparator(sortKey, projectsById);
    const dir = sortDir === 'asc' ? 1 : -1;
    // comparePriority as a secondary key keeps ties (equal titles, same
    // status, both with no due date, …) in a stable, meaningful order
    // instead of whatever order they happened to come out of IndexedDB in.
    return [...filtered].sort((a, b) => dir * cmp(a, b) || comparePriority(a, b));
  }, [tasks, filters, projects, sortKey, sortDir, projectsById, activeWorkspaceId, getVisibleResourceIds]);

  const groups = groupByProject ? groupTasksByProject(sorted, projects) : null;

  function renderRow(task) {
    const StatusIcon = STATUS_META[task.status]?.Icon;
    const project = task.projectId ? projectsById.get(task.projectId) : null;
    const dueDate = formatDueDate(task.dueDate);
    const overdue = isPastDue(task.dueDate, task.status);
    // Same "task's own reference wins over its project's" resolution as
    // TaskCard.jsx.
    const canvasCourseId = task.canvasReferences?.courseId || project?.canvasReference?.courseId || null;
    const courseHref = canvasCourseId
      ? `/courses/${canvasCourseId}${task.canvasReferences?.assignmentId ? '?tab=atividades' : ''}`
      : null;
    return (
      <tr
        key={task.id}
        className="task-table-row"
        onClick={() => onSelect(task)}
        onContextMenu={(e) => {
          e.preventDefault();
          setContextMenu({ task, x: e.clientX, y: e.clientY });
        }}
      >
        <td className="task-table-cell-center">
          <span className="priority-rank-badge">P{task.priorityRank ?? 3}</span>
        </td>
        <td>
          <span className="task-table-project">
            <span
              className="tasks-projects-color-dot"
              style={{ backgroundColor: project?.color || 'transparent' }}
            />
            {project ? project.name : 'Sem projeto'}
            {courseHref && (
              <Link
                href={courseHref}
                className="kanban-card-course-link"
                title="Abrir a página do curso no Vértice"
                onClick={(e) => e.stopPropagation()}
              >
                <GraduationCap size={14} strokeWidth={1.8} />
              </Link>
            )}
          </span>
        </td>
        <td className="task-table-title">{task.title}</td>
        <td className="task-table-cell-center">
          {StatusIcon && (
            <span title={STATUS_META[task.status].label}>
              <StatusIcon size={16} strokeWidth={1.8} />
            </span>
          )}
        </td>
        <td className="task-table-cell-center">
          {task.priority?.important && (
            <span className="kanban-card-flag" title="Importante">
              <Flag size={15} strokeWidth={1.8} />
            </span>
          )}
        </td>
        <td className="task-table-cell-center">
          {task.priority?.urgent && (
            <span className="kanban-card-urgent" title="Urgente">
              <Zap size={15} strokeWidth={1.8} />
            </span>
          )}
        </td>
        <td>
          {dueDate && (
            <span className={`kanban-card-due${overdue ? ' is-past-due' : ''}`} title={overdue ? 'Prazo vencido' : 'Prazo'}>
              {dueDate}
            </span>
          )}
        </td>
        <td>
          {task.tags?.length > 0 && (
            <div className="kanban-card-tags">
              {task.tags.map((tag) => (
                <span key={tag} className="kanban-card-tag">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </td>
      </tr>
    );
  }

  return (
    <div className="task-table-wrapper">
      <table className="task-table">
        <thead>
          <tr>
            {COLUMNS.map((col) => {
              const active = col.key === sortKey;
              const SortIcon = active ? (sortDir === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown;
              return (
                <th key={col.key}>
                  <button
                    type="button"
                    className={`task-table-sort-btn${active ? ' active' : ''}`}
                    onClick={() => handleSort(col.key)}
                  >
                    {col.label}
                    <SortIcon size={14} strokeWidth={1.8} aria-hidden="true" />
                  </button>
                </th>
              );
            })}
            <th>Tags</th>
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr>
              <td colSpan={TOTAL_COLUMNS} className="task-table-empty">
                Nenhuma tarefa encontrada.
              </td>
            </tr>
          )}
          {groups
            ? groups.map(({ project, tasks: groupTasks }) => (
                <Fragment key={`group-${project?.id || 'none'}`}>
                  <tr className="task-table-group-row">
                    <td colSpan={TOTAL_COLUMNS}>
                      <span
                        className="tasks-projects-color-dot"
                        style={{ backgroundColor: project?.color || 'transparent' }}
                      />
                      {project ? project.name : 'Sem projeto'}
                      <span className="pending-badge">{groupTasks.length}</span>
                    </td>
                  </tr>
                  {groupTasks.map(renderRow)}
                </Fragment>
              ))
            : sorted.map(renderRow)}
        </tbody>
      </table>
      {contextMenu && (
        <TaskContextMenu
          task={contextMenu.task}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
