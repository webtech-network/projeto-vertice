'use client';

import { useMemo, useState } from 'react';
import Modal from './Modal';
import { useTasks } from './TasksProvider';
import { EMPTY_FILTERS } from '@/lib/tasks/filters';
import { STATUSES } from '@/lib/tasks/tasksRepo';
import { STATUS_META } from '@/lib/tasks/statusMeta';

// Replaces the old always-visible WorkspaceFilterBar.jsx inline row — filter
// fields are edited in a local draft here, only written back to
// TasksProvider's shared `filters` state (and applied to the board/
// matrix) when "Aplicar" is pressed; both "Aplicar" and "Limpar" close the
// modal, per spec. Switching between Kanban/Eisenhower still preserves the
// applied filters, since they live in TasksProvider's reducer either way.
export default function TasksFilterModal({ onClose }) {
  const { tasks, projects, filters, setFilters } = useTasks();
  const [draft, setDraft] = useState(filters);

  const allTags = useMemo(() => {
    const tags = new Set();
    for (const task of tasks) for (const tag of task.tags || []) tags.add(tag);
    return [...tags].sort((a, b) => a.localeCompare(b));
  }, [tasks]);

  function patch(fields) {
    setDraft((d) => ({ ...d, ...fields }));
  }

  function apply() {
    setFilters(draft);
    onClose();
  }

  function clear() {
    // The toolbar search (TaskSearch.jsx) isn't part of this modal — keep it.
    setFilters({ ...EMPTY_FILTERS, search: filters.search });
    onClose();
  }

  return (
    <Modal title="Filtrar tarefas" onClose={onClose}>
      <div className="tasks-filter-modal-fields">
        <label className="tasks-filter-modal-field">
          Projeto
          <select value={draft.projectId || ''} onChange={(e) => patch({ projectId: e.target.value || null })}>
            <option value="">Todos os projetos</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="tasks-filter-modal-field">
          Tag
          <select value={draft.tag || ''} onChange={(e) => patch({ tag: e.target.value || null })}>
            <option value="">Todas as tags</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                #{tag}
              </option>
            ))}
          </select>
        </label>

        <label className="tasks-filter-modal-field">
          Status
          <select value={draft.status || ''} onChange={(e) => patch({ status: e.target.value || null })}>
            <option value="">Todos os status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </select>
        </label>

        <label className="tasks-filter-modal-field">
          Prazo até
          <input type="date" value={draft.dueBefore || ''} onChange={(e) => patch({ dueBefore: e.target.value || null })} />
        </label>

        <label className="task-detail-checkbox">
          <input
            type="checkbox"
            checked={draft.urgent === true}
            onChange={(e) => patch({ urgent: e.target.checked ? true : null })}
          />
          Urgente
        </label>
        <label className="task-detail-checkbox">
          <input
            type="checkbox"
            checked={draft.important === true}
            onChange={(e) => patch({ important: e.target.checked ? true : null })}
          />
          Importante
        </label>
      </div>

      <div className="compose-message-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={clear}>
          Limpar
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={apply}>
          Aplicar
        </button>
      </div>
    </Modal>
  );
}
