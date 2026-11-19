import { startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay } from 'date-fns';

// A 'completed' course was published before being concluded, so it belongs
// in the "published" bucket — only Canvas's own 'unpublished' state means
// the course was never published. Shared by CourseBrowser's status filter
// and the dashboard's "active disciplines" tile.
export function isPublished(course) {
  return course.workflow_state !== 'unpublished';
}

// The dashboard scopes every metric to favorited + published courses,
// mirroring the favorites-only-scoping convention already established in
// courses/page.jsx and mensagens/page.jsx (keeps Canvas call counts small
// and matches what the user actually cares about tracking).
export function filterActiveFavoriteCourses(courses) {
  return courses.filter((c) => c.is_favorite && isPublished(c));
}

export function sumTotalStudents(courses) {
  return courses.reduce((sum, c) => sum + (c.total_students ?? 0), 0);
}

export function derivePendingGrading(assignments) {
  const withPending = assignments.filter((a) => (a.needs_grading_count ?? 0) > 0);
  return {
    pendingAssignmentsCount: withPending.length,
    pendingGradingSum: withPending.reduce((sum, a) => sum + (a.needs_grading_count ?? 0), 0),
  };
}

// The itemized "correções pendentes" list backing PendingGradingList.jsx on
// the dashboard — unlike deriveDueDateItems, an assignment with no due_at is
// still kept (an ungraded submission doesn't stop being pending just because
// the assignment has no deadline), and the list isn't time-windowed like
// deriveRecentWindow's "prazos recentes" — every currently-ungraded
// assignment shows, sorted so the ones with a due date (soonest first) lead,
// followed by the undated ones.
export function derivePendingGradingItems(assignments, courses) {
  const courseById = new Map(courses.map((c) => [c.id, c]));
  return assignments
    .filter((a) => (a.needs_grading_count ?? 0) > 0)
    .map((a) => ({
      id: a.id,
      name: a.name,
      dueAt: a.due_at ? new Date(a.due_at) : null,
      courseId: a.course_id,
      courseName: courseById.get(a.course_id)?.name ?? '',
      htmlUrl: a.html_url,
      needsGradingCount: a.needs_grading_count,
    }))
    .sort((a, b) => {
      if (a.dueAt && b.dueAt) return a.dueAt - b.dueAt;
      if (a.dueAt) return -1;
      if (b.dueAt) return 1;
      return a.name.localeCompare(b.name);
    });
}

// "A fazer" do aluno (ADR-0022): junta o to-do do Canvas (próximas entregas)
// com as entregas faltantes (vencidas), deduplicando por id de atividade.
// Só atividades com prazo entram. Vencidas primeiro (mais antiga antes), depois
// as futuras (mais próxima antes). `todoItems` vêm de /users/self/todo
// (`{ assignment, course_id }`); `missing` de /users/self/missing_submissions
// (Assignment direto, com `course` quando pedido via include[]).
export function deriveStudentTodoItems(todoItems, missing, courses = [], now = new Date()) {
  const courseNameById = new Map(courses.map((c) => [c.id, c.name]));
  const byId = new Map();
  const add = (a, courseId, courseName) => {
    if (!a?.due_at || byId.has(a.id)) return;
    const dueAt = new Date(a.due_at);
    byId.set(a.id, {
      id: a.id,
      name: a.name,
      dueAt,
      overdue: dueAt < now,
      courseId,
      courseName: courseName ?? courseNameById.get(courseId) ?? '',
      htmlUrl: a.html_url,
    });
  };
  for (const m of missing ?? []) add(m, m.course_id, m.course?.name);
  for (const t of todoItems ?? []) add(t.assignment, t.course_id ?? t.assignment?.course_id, t.context_name);
  return [...byId.values()].sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    return a.dueAt - b.dueAt;
  });
}

// Contagem de "a fazer" por curso (para a coluna Pendências em /courses).
export function countTodoByCourse(items) {
  const counts = new Map();
  for (const i of items) counts.set(i.courseId, (counts.get(i.courseId) ?? 0) + 1);
  return counts;
}

// Normalizes a flat assignments array (e.g. from
// Promise.all(courses.map(c => listAssignments(client, c.id))).flat() — each
// Assignment object already carries its own course_id) into a
// calendar/list-ready shape. Assignments with no due_at are dropped — they
// can't appear on a due-date calendar or a "recent deadlines" list.
export function deriveDueDateItems(assignments, courses) {
  const courseById = new Map(courses.map((c) => [c.id, c]));
  return assignments
    .filter((a) => a.due_at)
    .map((a) => ({
      id: a.id,
      name: a.name,
      dueAt: new Date(a.due_at),
      courseId: a.course_id,
      courseName: courseById.get(a.course_id)?.name ?? '',
      htmlUrl: a.html_url,
      needsGrading: (a.needs_grading_count ?? 0) > 0,
    }));
}

/**
 * The "recentes" list: up to `maxTotal` items within a ±windowDays window.
 * Up to `maxPast` of the most-recent PAST items (closest to now), with the
 * remaining slots going to the nearest FUTURE items — if there are fewer
 * than `maxPast` past items, the freed slots roll over to future items (e.g.
 * zero past items → maxTotal future items). Returned in chronological order.
 *
 * A PAST item only counts if it still has ungraded submissions
 * (`needsGrading`) — once every submission's corrected, there's nothing left
 * to act on, so it's dropped instead of lingering here as a done deal (it
 * still shows on DueDateCalendar, which has no such notion of "handled").
 * FUTURE items are never filtered this way — a deadline that hasn't arrived
 * yet has no submissions to grade regardless.
 */
export function deriveRecentWindow(dueDateItems, { now = new Date(), windowDays = 7, maxTotal = 5, maxPast = 2 } = {}) {
  const windowStart = new Date(now.getTime() - windowDays * 86400000);
  const windowEnd = new Date(now.getTime() + windowDays * 86400000);
  const inWindow = dueDateItems.filter((i) => i.dueAt >= windowStart && i.dueAt <= windowEnd);

  const past = inWindow
    .filter((i) => i.dueAt <= now && i.needsGrading)
    .sort((a, b) => b.dueAt - a.dueAt); // closest-to-now first
  const future = inWindow.filter((i) => i.dueAt > now).sort((a, b) => a.dueAt - b.dueAt); // soonest first

  const pastSlots = Math.min(maxPast, past.length);
  const futureSlots = maxTotal - pastSlots;

  return [...past.slice(0, pastSlots).reverse(), ...future.slice(0, futureSlots)];
}

/**
 * Week-grid structure for a single month, each day annotated with the
 * due-date items that fall on it. Weeks start on Sunday (getDay()'s own
 * convention), padded with leading/trailing nulls so every week has 7 slots.
 */
export function buildCalendarMonth(dueDateItems, { year, month }) {
  const monthStart = startOfMonth(new Date(year, month, 1));
  const monthEnd = endOfMonth(monthStart);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd }).map((date) => ({
    date,
    items: dueDateItems.filter((i) => isSameDay(i.dueAt, date)),
  }));

  const leadingBlanks = getDay(monthStart);
  const cells = [...Array(leadingBlanks).fill(null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return { monthStart, weeks };
}
