'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Flag, Zap, CalendarDays, GraduationCap } from 'lucide-react';
import { useTasks } from './TasksProvider';
import TaskContextMenu from './TaskContextMenu';
import { STATUS_META } from '@/lib/tasks/statusMeta';
import { projectCardStyle } from '@/lib/tasks/projectColors';
import { formatDueDate, isPastDue } from '@/lib/tasks/dueDate';

// Interleaves a thin visual separator between whichever of the meta groups
// (priority rank / status / classification / due date) actually have
// content — never a dangling separator next to nothing.
function withSeparators(nodes) {
  const visible = nodes.filter(Boolean);
  return visible.flatMap((node, i) =>
    i === 0 ? [node] : [<span key={`sep-${node.key}`} className="kanban-card-meta-separator" aria-hidden="true" />, node],
  );
}

// Shared by KanbanBoard.jsx and EisenhowerMatrix.jsx — same card, same
// click-to-open behavior; only the droppable container it sits in differs
// between the two views (KanbanColumn vs EisenhowerQuadrant). Renders in one
// of two densities (TasksProvider's cardDensity, toggled in
// TasksView.jsx) — 'expanded' is the original full layout, 'condensed'
// packs the same information into two lines of text plus a column of icons,
// so status (otherwise invisible in the Eisenhower view) and priority
// (otherwise invisible in the Kanban view) stay visible regardless of which
// board is showing. See the icon legend in TasksView.jsx's footer for
// what each icon means. Status/classification/due date share one
// `metaSegments` builder below (separators, per-density icon size and
// label visibility) so both densities stay in sync automatically.
export default function TaskCard({ task, onSelect }) {
  const { projects, cardDensity } = useTasks();
  // Desktop right-click affordance (see TaskContextMenu.jsx) — local state
  // per card instance is enough since only the card that was actually
  // right-clicked ever has it set.
  const [contextMenu, setContextMenu] = useState(null);
  const project = task.projectId ? projects.find((p) => p.id === task.projectId) : null;
  const dueDate = formatDueDate(task.dueDate);
  const StatusIcon = STATUS_META[task.status]?.Icon;
  const overdue = isPastDue(task.dueDate, task.status);
  // The task's own Canvas reference wins over its project's (same priority
  // TaskDetailModal.jsx uses when saving canvasReferences) — a task can be
  // linked to a specific course/assignment even when its project isn't a
  // Canvas-course project at all.
  const canvasCourseId = task.canvasReferences?.courseId || project?.canvasReference?.courseId || null;
  const courseHref = canvasCourseId
    ? `/courses/${canvasCourseId}${task.canvasReferences?.assignmentId ? '?tab=atividades' : ''}`
    : null;

  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });
  // A card is also its own drop target — same id as the draggable above,
  // dnd-kit keeps draggable/droppable ids in separate namespaces (this is
  // exactly what @dnd-kit/sortable's useSortable does internally, minus the
  // package). This is what lets KanbanBoard.jsx/EisenhowerMatrix.jsx's
  // handleDragEnd tell "dropped onto this specific card" (reorder within the
  // same column/quadrant — see comparePriority's tie-break) apart from
  // "dropped onto the column/quadrant background" (status/priority change).
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: task.id, data: { task } });
  const setRefs = (node) => {
    setDragRef(node);
    setDropRef(node);
  };

  const style = {
    ...projectCardStyle(project),
    ...(transform ? { transform: CSS.Translate.toString(transform), zIndex: 10 } : undefined),
  };

  const condensed = cardDensity === 'condensed';
  const iconSize = condensed ? 14 : 13;

  // 0 (maior) a 9 (menor) — see taskSort.js's comparePriority, which orders
  // this task within its Kanban column / Eisenhower quadrant / TaskTable row
  // by this same value. Shown here so that ordering is legible on the card
  // itself, not just as an invisible sort key.
  const priorityRankSeg = (
    <span key="priority" className="priority-rank-badge" title="Prioridade (0 = maior, 9 = menor)">
      P{task.priorityRank ?? 3}
    </span>
  );

  const statusSeg = StatusIcon ? (
    <span key="status" className="kanban-card-status-icon" title={STATUS_META[task.status].label}>
      <StatusIcon size={iconSize} strokeWidth={1.8} />
      {!condensed && ` ${STATUS_META[task.status].label}`}
    </span>
  ) : null;

  const classificationSeg =
    task.priority?.important || task.priority?.urgent ? (
      <span key="classification" className="kanban-card-classification">
        {task.priority?.important && (
          <span className="kanban-card-flag" title="Importante">
            <Flag size={iconSize} strokeWidth={1.8} />
            {!condensed && ' Importante'}
          </span>
        )}
        {task.priority?.urgent && (
          <span className="kanban-card-urgent" title="Urgente">
            <Zap size={iconSize} strokeWidth={1.8} />
            {!condensed && ' Urgente'}
          </span>
        )}
      </span>
    ) : null;

  const dueSeg = dueDate ? (
    <span key="due" className={`kanban-card-due${overdue ? ' is-past-due' : ''}`} title={overdue ? 'Prazo vencido' : 'Prazo'}>
      <CalendarDays size={iconSize} strokeWidth={1.8} /> {dueDate}
    </span>
  ) : null;

  const courseSeg = courseHref ? (
    <Link
      key="course"
      href={courseHref}
      className="kanban-card-course-link"
      title="Abrir a página do curso no Vértice"
      // Stops the click from also bubbling to the card's own onClick (which
      // opens the task detail modal) — this link should navigate instead.
      onClick={(e) => e.stopPropagation()}
    >
      <GraduationCap size={iconSize} strokeWidth={1.8} />
      {!condensed && ' Curso'}
    </Link>
  ) : null;

  const metaSegments = withSeparators([priorityRankSeg, statusSeg, classificationSeg, dueSeg, courseSeg]);

  return (
    <div
      ref={setRefs}
      style={style}
      className={`kanban-card${isDragging ? ' is-dragging' : ''}${condensed ? ' kanban-card--condensed' : ''}${isOver ? ' kanban-card--drop-over' : ''}`}
      onClick={() => onSelect(task)}
      onContextMenu={(e) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      {condensed ? (
        <>
          <div className="kanban-card-condensed-text">
            {/* Drag activation is scoped to the title text (not the whole
                card) — on touch, dragging from anywhere else on the card
                fought with tapping to open it or scrolling the column. `title`
                is a native tooltip — condensed is the only density that
                truncates with an ellipsis (see .kanban-card--condensed
                .kanban-card-title/.kanban-card-project in globals.css), so
                this is the only place the full text needs to be recoverable
                on hover. */}
            <div className="kanban-card-title" title={task.title} {...listeners} {...attributes}>
              {task.title}
            </div>
            <div className="kanban-card-project" title={project ? project.name : 'Sem projeto'}>
              {project ? project.name : 'Sem projeto'}
            </div>
          </div>
          <div className="kanban-card-condensed-side">
            {task.tags?.length > 0 && (
              <div className="kanban-card-tags">
                {task.tags.map((tag) => (
                  <span key={tag} className="kanban-card-tag">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
            <div className="kanban-card-condensed-icons">{metaSegments}</div>
          </div>
        </>
      ) : (
        <>
          <div className="kanban-card-title" {...listeners} {...attributes}>
            {task.title}
          </div>
          {project && <div className="kanban-card-project">{project.name}</div>}
          {task.tags?.length > 0 && (
            <div className="kanban-card-tags">
              {task.tags.map((tag) => (
                <span key={tag} className="kanban-card-tag">
                  #{tag}
                </span>
              ))}
            </div>
          )}
          <div className="kanban-card-footer">{metaSegments}</div>
        </>
      )}
      {contextMenu && (
        <TaskContextMenu task={task} position={contextMenu} onClose={() => setContextMenu(null)} />
      )}
    </div>
  );
}
