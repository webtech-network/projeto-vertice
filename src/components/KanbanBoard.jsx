'use client';

import { useState } from 'react';
import { DndContext, DragOverlay, PointerSensor, pointerWithin, useSensor, useSensors } from '@dnd-kit/core';
import KanbanColumn from './KanbanColumn';
import TaskCard from './TaskCard';
import { useTasks } from './TasksProvider';
import { useWorkspaceScope } from './WorkspaceScopeProvider';
import { BASE_WORKSPACE_ID } from '@/lib/workspaces/workspacesRepo';
import { applyFilters } from '@/lib/tasks/filters';
import { sortTasksByPriority } from '@/lib/tasks/taskSort';
import { STATUSES } from '@/lib/tasks/tasksRepo';
import { STATUS_META } from '@/lib/tasks/statusMeta';

export default function KanbanBoard({ onSelect, onCreate }) {
  const {
    tasks,
    projects,
    filters,
    moveTaskStatus,
    moveTaskPriorityRank,
    collapsedColumns,
    setColumnCollapsed,
    groupByProject,
  } = useTasks();
  const { activeWorkspaceId, getVisibleResourceIds } = useWorkspaceScope();
  const [activeTask, setActiveTask] = useState(null);
  // A distance activation constraint lets a plain click (no pointer
  // movement) reach TaskCard's onClick normally — without it, dnd-kit's
  // PointerSensor would swallow every click as a zero-distance drag attempt.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const scope =
    activeWorkspaceId === BASE_WORKSPACE_ID
      ? null
      : { visibleProjectIds: getVisibleResourceIds('project'), visibleCourseIds: getVisibleResourceIds('course') };
  const filtered = applyFilters(tasks, filters, projects, scope);

  // `over` can now resolve to either a column's own droppable (id = status —
  // dropped on empty column space) or a TaskCard's droppable (id = task id —
  // dropped directly on another card, see TaskCard.jsx). Dropping onto a
  // card in a *different* column still just changes status, same as before;
  // dropping onto a card in the *same* column is a priority reorder instead —
  // it doesn't touch status at all, it bumps priorityRank exactly one level
  // toward wherever the drop landed relative to the dragged card's current
  // position (see taskSort.js's comparePriority for why one column list is
  // "the" priority order to measure that position against).
  function handleDragEnd({ active, over }) {
    setActiveTask(null);
    if (!over) return;
    const task = active.data.current?.task;
    if (!task) return;
    const overTask = over.data.current?.task;
    if (overTask) {
      if (overTask.id === task.id) return;
      if (overTask.status !== task.status) {
        moveTaskStatus(task.id, overTask.status);
        return;
      }
      const columnTasks = sortTasksByPriority(filtered.filter((t) => t.status === task.status));
      const fromIndex = columnTasks.findIndex((t) => t.id === task.id);
      const toIndex = columnTasks.findIndex((t) => t.id === overTask.id);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;
      const currentRank = task.priorityRank ?? 3;
      const nextRank = toIndex < fromIndex ? Math.max(0, currentRank - 1) : Math.min(9, currentRank + 1);
      if (nextRank !== currentRank) moveTaskPriorityRank(task.id, nextRank);
      return;
    }
    if (task.status !== over.id) moveTaskStatus(task.id, over.id);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={({ active }) => setActiveTask(active.data.current?.task ?? null)}
      onDragCancel={() => setActiveTask(null)}
      onDragEnd={handleDragEnd}
    >
      <div className="kanban-board">
        {STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            label={STATUS_META[status].label}
            Icon={STATUS_META[status].Icon}
            tasks={sortTasksByPriority(filtered.filter((t) => t.status === status))}
            projects={projects}
            groupByProject={groupByProject}
            onSelect={onSelect}
            collapsed={collapsedColumns.includes(status)}
            onCollapse={() => setColumnCollapsed(status, true)}
            onExpand={() => setColumnCollapsed(status, false)}
            onCreate={onCreate}
          />
        ))}
      </div>
      <DragOverlay zIndex={100} dropAnimation={null}>
        {activeTask ? <TaskCard task={activeTask} onSelect={() => {}} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
