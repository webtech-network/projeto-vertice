import { NextResponse } from 'next/server';
import { requireCanvasIntegration } from '@/lib/canvasIntegration';
import { listCourses, listConversations, listAssignments } from '@/lib/canvasClient';
import { countMessagesByCourse } from '@/lib/messageGrouping';
import { correctedCourseNeedsGradingCount } from '@/lib/groupGrading';

// Backs CourseBrowser.jsx's client-side stale-while-revalidate fetch — moved
// out of courses/page.jsx (a Server Component) so navigating to /courses no
// longer blocks on this Canvas round-trip before the page can render; the
// client paints instantly from IndexedDB cache instead, then calls this to
// refresh in the background.
export async function GET() {
  const { user, canvas } = await requireCanvasIntegration();
  if (!user) return NextResponse.json({ error: 'Sessão inválida. Faça login novamente.' }, { status: 401 });
  if (!canvas) {
    return NextResponse.json({ error: 'Canvas não conectado. Conecte sua conta em /perfil.' }, { status: 409 });
  }

  const client = canvas.client;

  const rawCourses = await listCourses(client);
  const favoriteIds = rawCourses.filter((c) => c.is_favorite).map((c) => c.id);

  // Canvas has no per-course message count on the course-list endpoint (unlike
  // needs_grading_count), and message counts are only tracked for favorite
  // courses to keep this to a single extra call: Canvas's `filter[]` accepts
  // several course contexts at once and OR's them together, so one Inbox call
  // covers every favorite course instead of one call per course.
  let messageCounts = new Map();
  if (favoriteIds.length > 0) {
    try {
      const conversations = await listConversations(client, {
        filter: favoriteIds.map((id) => `course_${id}`),
      });
      messageCounts = countMessagesByCourse(conversations, favoriteIds);
    } catch {
      messageCounts = null; // signals "failed to load", distinct from "not a favorite" below
    }
  }

  // Canvas's own per-course needs_grading_count over-counts real group
  // assignments (one per student instead of one per group — see
  // groupGrading.js). Correcting it needs a whole extra
  // list-assignments-then-list-submissions round-trip per course, so — same
  // reasoning and same favorites-only scoping as message_count just above —
  // this is only worth paying for on favorite courses with something
  // pending, not across the full course list (up to 100+ courses on a real
  // account). Non-favorite courses keep Canvas's raw (possibly overcounted)
  // number, same as message_count staying `undefined` for them.
  const gradingCorrections = new Map();
  await Promise.all(
    rawCourses
      .filter((c) => c.is_favorite && (c.needs_grading_count ?? 0) > 0)
      .map(async (course) => {
        try {
          const assignments = await listAssignments(client, course.id);
          const corrected = await correctedCourseNeedsGradingCount(client, course.id, assignments);
          gradingCorrections.set(course.id, corrected);
        } catch {
          // best-effort — that course's badge just falls back to Canvas's own number below
        }
      }),
  );

  // Canvas's course-list endpoint doesn't return an html_url by default (unlike
  // assignments, which do) — build the link to the course's own Canvas page ourselves.
  const courses = rawCourses.map((course) => ({
    ...course,
    needs_grading_count: gradingCorrections.has(course.id)
      ? gradingCorrections.get(course.id)
      : course.needs_grading_count,
    html_url: `${canvas.baseUrl}/courses/${course.id}`,
    message_count: course.is_favorite ? (messageCounts ? messageCounts.get(String(course.id)) : null) : undefined,
  }));

  return NextResponse.json({ courses });
}
