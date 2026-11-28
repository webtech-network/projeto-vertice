import { NextResponse } from 'next/server';
import { requireCanvasIntegration } from '@/lib/canvasIntegration';
import {
  listUserCoursesDetailed,
  listConversations,
  listAssignments,
  listStudentTodo,
  listMissingSubmissions,
} from '@/lib/canvasClient';
import { deriveStudentTodoItems, countTodoByCourse } from '@/lib/dashboard';
import { countMessagesByCourse } from '@/lib/messageGrouping';
import { correctedCourseNeedsGradingCount } from '@/lib/groupGrading';
import { mapWithConcurrency } from '@/lib/concurrency';
import { cachedCanvasRead } from '@/lib/canvasServerCache';

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

  const { courses: rawCourses, roleErrors } = await cachedCanvasRead(user.id, 'userCourses', () =>
    listUserCoursesDetailed(client),
  );
  const favoriteIds = rawCourses.filter((c) => c.is_favorite).map((c) => c.id);
  const favoritesNeedingGrading = rawCourses.filter((c) => c.is_favorite && (c.needs_grading_count ?? 0) > 0);
  const hasStudentCourse = rawCourses.some((c) => c.user_roles?.includes('student'));

  // Os três enriquecimentos abaixo são totalmente independentes entre si e
  // agora rodam em paralelo em vez de em cascata sequencial.
  const [messageCounts, gradingCorrections, todoCounts] = await Promise.all([
    favoriteIds.length > 0
      ? listConversations(client, { filter: favoriteIds.map((id) => `course_${id}`) })
          .then((conversations) => countMessagesByCourse(conversations, favoriteIds))
          .catch(() => null)
      : Promise.resolve(new Map()),

    (async () => {
      const corrections = new Map();
      await mapWithConcurrency(favoritesNeedingGrading, 4, async (course) => {
        try {
          const assignments = await cachedCanvasRead(user.id, `assignments:${course.id}`, () =>
            listAssignments(client, course.id),
          );
          const corrected = await correctedCourseNeedsGradingCount(client, course.id, assignments);
          corrections.set(course.id, corrected);
        } catch {
          // best-effort — cai no número bruto do Canvas
        }
      });
      return corrections;
    })(),

    hasStudentCourse
      ? Promise.allSettled([listStudentTodo(client), listMissingSubmissions(client)]).then(([todo, missing]) =>
          countTodoByCourse(
            deriveStudentTodoItems(
              todo.status === 'fulfilled' ? todo.value : [],
              missing.status === 'fulfilled' ? missing.value : [],
            ),
          ),
        )
      : Promise.resolve(new Map()),
  ]);

  // Canvas's course-list endpoint doesn't return an html_url by default (unlike
  // assignments, which do) — build the link to the course's own Canvas page ourselves.
  const courses = rawCourses.map((course) => ({
    ...course,
    needs_grading_count: gradingCorrections.has(course.id)
      ? gradingCorrections.get(course.id)
      : course.needs_grading_count,
    todo_count: course.user_roles?.includes('student') ? (todoCounts.get(course.id) ?? 0) : undefined,
    // O cache/consumidores esperam um array puro de cursos; o aviso de papéis que falharam
    // viaja carimbado em cada curso (só quando há falha).
    ...(roleErrors.length ? { role_errors: roleErrors } : {}),
    html_url: `${canvas.baseUrl}/courses/${course.id}`,
    message_count: course.is_favorite ? (messageCounts ? messageCounts.get(String(course.id)) : null) : undefined,
  }));

  return NextResponse.json({ courses });
}
