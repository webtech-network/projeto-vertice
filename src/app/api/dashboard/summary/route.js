import { NextResponse } from 'next/server';
import { requireCanvasIntegration } from '@/lib/canvasIntegration';
import { listCourses, listAssignments, listConversations } from '@/lib/canvasClient';
import { isRealGroupAssignment, correctedGroupNeedsGradingCount } from '@/lib/groupGrading';
import {
  filterActiveFavoriteCourses,
  sumTotalStudents,
  derivePendingGrading,
  derivePendingGradingItems,
  deriveDueDateItems,
  deriveRecentWindow,
} from '@/lib/dashboard';

function serializeItem(item) {
  return { ...item, dueAt: item.dueAt.toISOString() };
}

// derivePendingGradingItems() keeps undated assignments (dueAt: null),
// unlike deriveDueDateItems' items — serializeItem() would crash calling
// .toISOString() on null, so this only touches the field when it's set.
function serializePendingGradingItem(item) {
  return { ...item, dueAt: item.dueAt ? item.dueAt.toISOString() : null };
}

// Backs the dashboard's stale-while-revalidate panel (see DashboardPanel.jsx)
// — everything here is scoped to favorited + published courses, following
// the same call-minimization convention as courses/page.jsx and
// mensagens/page.jsx. Each Canvas sub-fetch is independently allowed to
// fail (Promise.allSettled) so one flaky call doesn't blank the whole panel.
export async function GET() {
  const { user, canvas } = await requireCanvasIntegration();
  if (!user) return NextResponse.json({ error: 'Sessão inválida. Faça login novamente.' }, { status: 401 });
  if (!canvas) {
    return NextResponse.json({ error: 'Canvas não conectado. Conecte sua conta em /perfil.' }, { status: 409 });
  }

  const client = canvas.client;

  let rawCourses;
  try {
    rawCourses = await listCourses(client);
  } catch {
    return NextResponse.json({ error: 'Falha ao carregar cursos do Canvas.' }, { status: 502 });
  }

  const courses = filterActiveFavoriteCourses(rawCourses);
  const errors = [];

  const [messagesResult, assignmentsResult] = await Promise.allSettled([
    courses.length
      ? listConversations(client, { filter: courses.map((c) => `course_${c.id}`), scope: 'unread' })
      : Promise.resolve([]),
    courses.length
      ? Promise.all(courses.map((c) => listAssignments(client, c.id))).then((lists) => lists.flat())
      : Promise.resolve([]),
  ]);

  const pendingCount = messagesResult.status === 'fulfilled' ? messagesResult.value.length : null;
  if (messagesResult.status === 'rejected') errors.push('messages');

  const rawAssignments = assignmentsResult.status === 'fulfilled' ? assignmentsResult.value : [];
  if (assignmentsResult.status === 'rejected') errors.push('assignments');

  // Canvas's own needs_grading_count over-counts real group assignments (one
  // per student instead of one per group) — see groupGrading.js. Corrected
  // concurrently, same Promise.all style already used above for this route
  // (unlike the sequential-only pattern used in page Server Components),
  // and only for the (typically small) subset of assignments where it
  // actually matters, so this stays cheap even at up to ~17 favorite courses.
  const assignments = await Promise.all(
    rawAssignments.map(async (assignment) => {
      if (!isRealGroupAssignment(assignment) || !assignment.needs_grading_count) return assignment;
      try {
        const needs_grading_count = await correctedGroupNeedsGradingCount(client, assignment.course_id, assignment);
        return { ...assignment, needs_grading_count };
      } catch {
        return assignment;
      }
    }),
  );

  const { pendingAssignmentsCount, pendingGradingSum } = derivePendingGrading(assignments);
  const pendingGradingItems = derivePendingGradingItems(assignments, courses);
  const dueDateItems = deriveDueDateItems(assignments, courses);
  const recentItems = deriveRecentWindow(dueDateItems);

  return NextResponse.json({
    courses: { total: courses.length, items: courses.map((c) => ({ id: c.id, name: c.name })) },
    students: { total: sumTotalStudents(courses) },
    messages: { pendingCount },
    grading:
      assignmentsResult.status === 'fulfilled'
        ? { pendingAssignmentsCount, pendingGradingSum, items: pendingGradingItems.map(serializePendingGradingItem) }
        : { pendingAssignmentsCount: null, pendingGradingSum: null, items: [] },
    calendar: { items: dueDateItems.map(serializeItem) },
    recent: { items: recentItems.map(serializeItem) },
    generatedAt: new Date().toISOString(),
    errors,
  });
}
