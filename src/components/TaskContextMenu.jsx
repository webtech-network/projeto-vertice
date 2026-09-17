'use client';

import { useEffect, useRef, useState } from 'react';
import { Trash2, FolderKanban, Check } from 'lucide-react';
import { useTasks } from './TasksProvider';
import { useWorkspaceScope } from './WorkspaceScopeProvider';
import { BASE_WORKSPACE_ID } from '@/lib/workspaces/workspacesRepo';
import { STATUSES } from '@/lib/tasks/tasksRepo';
import { STATUS_META } from '@/lib/tasks/statusMeta';

// Right-click menu for a single task — desktop-only affordance (there's no
// long-press equivalent wired up for touch) surfacing the three actions
// requested most often without opening the full TaskDetailModal: change
// status, move to another project, delete. Both TaskCard.jsx (Kanban/
// Eisenhower cards) and TaskTable.jsx (table rows) open the same component
// on their own onContextMenu — same click-outside/Escape-to-close popover
// pattern as WorkspaceSwitcher.jsx/UserMenu.jsx, but position: fixed at the
// cursor instead of anchored under a trigger button, since it can open
// anywhere a task is right-clicked.
export default function TaskContextMenu({ task, position, onClose }) {
  const { projects, moveTaskStatus, editTask, removeTask } = useTasks();
  const { activeWorkspaceId, getVisibleResourceIds } = useWorkspaceScope();
  const menuRef = useRef(null);
  const [coords, setCoords] = useState(position);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Clamps the menu inside the viewport — a right-click near the right/bottom
  // edge would otherwise render mostly off-screen, the same overflow a
  // native context menu already avoids.
  useEffect(() => {
    const node = menuRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const maxX = Math.max(8, window.innerWidth - rect.width - 8);
    const maxY = Math.max(8, window.innerHeight - rect.height - 8);
    setCoords({ x: Math.min(position.x, maxX), y: Math.min(position.y, maxY) });
    // Only re-clamp when a *new* click opens the menu, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position.x, position.y]);

  // Same scoping TaskDetailModal.jsx's project <select> uses — projects
  // visible in the active workspace, plus the task's own current project
  // even if it falls outside that scope, so this menu never hides the
  // option to see/keep what's already selected.
  const scopedProjects =
    activeWorkspaceId === BASE_WORKSPACE_ID
      ? projects
      : projects.filter((p) => getVisibleResourceIds('project')?.has(p.id) || p.id === task.projectId);

  function handleDelete() {
    if (!window.confirm('Excluir esta tarefa?')) return;
    removeTask(task.id);
    onClose();
  }

  return (
    <div
      ref={menuRef}
      className="task-context-menu"
      role="menu"
      style={{ top: coords.y, left: coords.x }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="task-context-menu-title">{task.title}</div>

      <div className="task-context-menu-section">
        <span className="task-context-menu-label">Status</span>
        {STATUSES.map((status) => {
          const { label, Icon } = STATUS_META[status];
          const active = status === task.status;
          return (
            <button
              key={status}
              type="button"
              className={`task-context-menu-item${active ? ' active' : ''}`}
              role="menuitemradio"
              aria-checked={active}
              onClick={() => {
                moveTaskStatus(task.id, status);
                onClose();
              }}
            >
              <Icon size={14} strokeWidth={1.8} aria-hidden="true" />
              {label}
              {active && <Check className="task-context-menu-check" size={14} strokeWidth={2.2} />}
            </button>
          );
        })}
      </div>

      <div className="task-context-menu-section">
        <span className="task-context-menu-label">
          <FolderKanban size={13} strokeWidth={1.8} aria-hidden="true" /> Mover para projeto
        </span>
        <div className="task-context-menu-scroll">
          <button
            type="button"
            className={`task-context-menu-item${!task.projectId ? ' active' : ''}`}
            role="menuitemradio"
            aria-checked={!task.projectId}
            onClick={() => {
              editTask(task.id, { projectId: null });
              onClose();
            }}
          >
            Sem projeto
            {!task.projectId && <Check className="task-context-menu-check" size={14} strokeWidth={2.2} />}
          </button>
          {scopedProjects.map((project) => {
            const active = project.id === task.projectId;
            return (
              <button
                key={project.id}
                type="button"
                className={`task-context-menu-item${active ? ' active' : ''}`}
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  editTask(task.id, { projectId: project.id });
                  onClose();
                }}
              >
                <span
                  className="tasks-projects-color-dot"
                  style={{ backgroundColor: project.color || 'var(--ink-soft)' }}
                  aria-hidden="true"
                />
                {project.name}
                {active && <Check className="task-context-menu-check" size={14} strokeWidth={2.2} />}
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        className="task-context-menu-item task-context-menu-danger"
        role="menuitem"
        onClick={handleDelete}
      >
        <Trash2 size={14} strokeWidth={1.8} aria-hidden="true" /> Excluir tarefa
      </button>
    </div>
  );
}
