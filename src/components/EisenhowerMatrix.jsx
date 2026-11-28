'use client';

import { useState } from 'react';
import { DndContext, DragOverlay, PointerSensor, pointerWithin, useSensor, useSensors } from '@dnd-kit/core';
import EisenhowerQuadrant from './EisenhowerQuadrant';
import TaskCard from './TaskCard';
import { useTasks } from './TasksProvider';
import { useWorkspaceScope } from './WorkspaceScopeProvider';
import { BASE_WORKSPACE_ID } from '@/lib/workspaces/workspacesRepo';
import { applyFilters } from '@/lib/tasks/filters';
import { sortTasksByPriority } from '@/lib/tasks/taskSort';
import { QUADRANTS, quadrantOf, priorityForQuadrant } from '@/lib/tasks/quadrant';

// Classic Eisenhower verb-per-quadrant naming (Do/Schedule/Delegate/Delete,
// in pt-BR) — the bold `title` is the suggestive action, `criteria` is the
// same urgent/important breakdown the labels used to show on their own (see
// EisenhowerQuadrant.jsx's header, which renders both).
const QUADRANT_LABELS = {
  [QUADRANTS.URGENT_IMPORTANT]: { title: 'FAZER', criteria: 'Importante e Urgente' },
  [QUADRANTS.NOT_URGENT_IMPORTANT]: { title: 'AGENDAR', criteria: 'Importante e Não Urgente' },
  [QUADRANTS.URGENT_NOT_IMPORTANT]: { title: 'DELEGAR', criteria: 'Não Importante e Urgente' },
  [QUADRANTS.NOT_URGENT_NOT_IMPORTANT]: { title: 'DESCARTAR', criteria: 'Não Importante e Não Urgente' },
};

// Rendered in reading order (top-left → bottom-right) matching the spec's
// own 2x2 layout: important/urgent quadrants on top, not-important on
// bottom; urgent on the left, not-urgent on the right.
const QUADRANT_ORDER = [
  QUADRANTS.URGENT_IMPORTANT,
  QUADRANTS.NOT_URGENT_IMPORTANT,
  QUADRANTS.URGENT_NOT_IMPORTANT,
  QUADRANTS.NOT_URGENT_NOT_IMPORTANT,
];

// Done (already finished) never belongs in a priority call — that exclusion
// is unconditional. Backlog/Block are conditional instead, driven by the
// same per-column `collapsedColumns` state that collapses those columns in
// the Kanban board (see KanbanColumn.jsx's own close button and
// TasksView.jsx's Backlog/Block toolbar shortcut): a status collapsed
// there is hidden from the matrix too — closing just Backlog, say, hides
// only Backlog tasks here, not Block's — not yet planned or blocked work
// isn't worth a priority call either, while "expanded" (the default) shows
// every in-flight status.
const MATRIX_ALWAYS_EXCLUDED = new Set(['DONE']);
const MATRIX_HIDDEN_WHEN_COLLAPSED = new Set(['BACKLOG', 'BLOCK']);

export default function EisenhowerMatrix({ onSelect }) {
  const { tasks, projects, filters, moveTaskPriority, moveTaskPriorityRank, collapsedColumns, groupByProject } =
    useTasks();
  const { activeWorkspaceId, getVisibleResourceIds } = useWorkspaceScope();
  const [activeTask, setActiveTask] = useState(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const scope =
    activeWorkspaceId === BASE_WORKSPACE_ID
      ? null
      : { visibleProjectIds: getVisibleResourceIds('project'), visibleCourseIds: getVisibleResourceIds('course') };
  const filtered = applyFilters(tasks, filters, projects, scope).filter((t) => {
    if (MATRIX_ALWAYS_EXCLUDED.has(t.status)) return false;
    if (MATRIX_HIDDEN_WHEN_COLLAPSED.has(t.status) && collapsedColumns.includes(t.status)) return false;
    return true;
  });

  // Same "over can be the container or one of its cards" split as
  // KanbanBoard.jsx's handleDragEnd: dropping onto a card in a *different*
  // quadrant still changes urgent/important (same as dropping on empty
  // quadrant space); dropping onto a card in the *same* quadrant reorders by
  // priority instead — bumps priorityRank one level toward the drop
  // position, quadrant/urgent/important untouched.
  function handleDragEnd({ active, over }) {
    setActiveTask(null);
    if (!over) return;
    const task = active.data.current?.task;
    if (!task) return;
    const overTask = over.data.current?.task;
    if (overTask) {
      if (overTask.id === task.id) return;
      const taskQuadrant = quadrantOf(task.priority);
      const overQuadrant = quadrantOf(overTask.priority);
      if (overQuadrant !== taskQuadrant) {
        moveTaskPriority(task.id, priorityForQuadrant(overQuadrant));
        return;
      }
      const quadrantTasks = sortTasksByPriority(filtered.filter((t) => quadrantOf(t.priority) === taskQuadrant));
      const fromIndex = quadrantTasks.findIndex((t) => t.id === task.id);
      const toIndex = quadrantTasks.findIndex((t) => t.id === overTask.id);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;
      const currentRank = task.priorityRank ?? 3;
      const nextRank = toIndex < fromIndex ? Math.max(0, currentRank - 1) : Math.min(9, currentRank + 1);
      if (nextRank !== currentRank) moveTaskPriorityRank(task.id, nextRank);
      return;
    }
    if (quadrantOf(task.priority) === over.id) return;
    moveTaskPriority(task.id, priorityForQuadrant(over.id));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={({ active }) => setActiveTask(active.data.current?.task ?? null)}
      onDragCancel={() => setActiveTask(null)}
      onDragEnd={handleDragEnd}
    >
      <div className="eisenhower-matrix">
        {QUADRANT_ORDER.map((quadrant) => (
          <EisenhowerQuadrant
            key={quadrant}
            quadrant={quadrant}
            title={QUADRANT_LABELS[quadrant].title}
            criteria={QUADRANT_LABELS[quadrant].criteria}
            tasks={sortTasksByPriority(filtered.filter((t) => quadrantOf(t.priority) === quadrant))}
            projects={projects}
            groupByProject={groupByProject}
            onSelect={onSelect}
          />
        ))}
      </div>
      <DragOverlay zIndex={100} dropAnimation={null}>
        {activeTask ? <TaskCard task={activeTask} onSelect={() => {}} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
