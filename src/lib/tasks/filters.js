// Pure filtering shared by KanbanBoard.jsx and EisenhowerMatrix.jsx — one
// filtered array, each view groups it differently downstream (by status vs.
// by quadrant). `projects` is passed in so a course-scoped filter can match
// tasks via their project's canvasReference, not just the task's own
// (optional) canvasReferences.courseId.

export const EMPTY_FILTERS = {
  projectId: null,
  courseId: null,
  tag: null,
  status: null,
  urgent: null,
  important: null,
  dueBefore: null,
  // Free-text search from TaskSearch.jsx (toolbar, not the filter modal).
  search: '',
};

// Accent- and case-insensitive, so "relatorio" finds "Relatório".
export function normalizeSearchText(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

// Every whitespace-separated term must appear somewhere in title,
// description or tags (AND, in any order).
function matchesSearch(task, terms) {
  const haystack = normalizeSearchText([task.title, task.description, ...(task.tags || [])].join(' '));
  return terms.every((term) => haystack.includes(term));
}

function taskCourseId(task, projectsById) {
  if (task.canvasReferences?.courseId) return String(task.canvasReferences.courseId);
  const project = task.projectId ? projectsById.get(task.projectId) : null;
  return project?.canvasReference?.courseId ? String(project.canvasReference.courseId) : null;
}

// `scope` is the active-workspace filter (WorkspaceScopeProvider's
// getVisibleResourceIds), layered on top of the manual `filters` above —
// `null` means Base is active (no restriction); otherwise
// `{ visibleProjectIds, visibleCourseIds }`, each a Set or null. A task with
// neither a project nor its own Canvas course reference is hidden whenever
// a non-Base workspace is active — it has nothing to be "associated" with,
// so it only ever shows up under Base (see TaskDetailModal.jsx, which
// surfaces this to the user rather than letting a task silently vanish).
export function applyFilters(tasks, filters, projects = [], scope = null) {
  const projectsById = new Map(projects.map((p) => [p.id, p]));
  const dueBeforeTime = filters.dueBefore ? new Date(filters.dueBefore).getTime() : null;
  const searchTerms = normalizeSearchText(filters.search).split(/\s+/).filter(Boolean);

  return tasks.filter((task) => {
    if (filters.projectId && task.projectId !== filters.projectId) return false;
    if (filters.courseId && taskCourseId(task, projectsById) !== String(filters.courseId)) return false;
    if (filters.tag && !(task.tags || []).includes(filters.tag)) return false;
    if (filters.status && task.status !== filters.status) return false;
    if (filters.urgent !== null && filters.urgent !== undefined && Boolean(task.priority?.urgent) !== filters.urgent) {
      return false;
    }
    if (
      filters.important !== null &&
      filters.important !== undefined &&
      Boolean(task.priority?.important) !== filters.important
    ) {
      return false;
    }
    if (dueBeforeTime !== null) {
      if (!task.dueDate) return false;
      if (new Date(task.dueDate).getTime() > dueBeforeTime) return false;
    }
    if (searchTerms.length && !matchesSearch(task, searchTerms)) return false;
    if (scope) {
      const courseId = taskCourseId(task, projectsById);
      const projectVisible = task.projectId && scope.visibleProjectIds?.has(task.projectId);
      const courseVisible = courseId && scope.visibleCourseIds?.has(courseId);
      if (!projectVisible && !courseVisible) return false;
    }
    return true;
  });
}
