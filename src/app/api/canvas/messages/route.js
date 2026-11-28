import { NextResponse } from 'next/server';
import { requireCanvasIntegration } from '@/lib/canvasIntegration';
import { listUserCoursesDetailed, listConversations } from '@/lib/canvasClient';
import { cachedCanvasRead } from '@/lib/canvasServerCache';

// Backs MessageBrowser.jsx's client-side stale-while-revalidate fetch —
// moved out of mensagens/page.jsx (a Server Component) so navigating to
// /mensagens no longer blocks on this Canvas round-trip before the page can
// render, same fix as /api/canvas/courses.
export async function GET() {
  const { user, canvas } = await requireCanvasIntegration();
  if (!user) return NextResponse.json({ error: 'Sessão inválida. Faça login novamente.' }, { status: 401 });
  if (!canvas) {
    return NextResponse.json({ error: 'Canvas não conectado. Conecte sua conta em /perfil.' }, { status: 409 });
  }

  const client = canvas.client;

  // A busca geral da inbox não depende dos cursos favoritos — inicia em
  // paralelo com `userCourses` (que compartilha o cache curto do servidor) e
  // limita a 3 páginas (até 300 conversas mais recentes) para não paginar
  // anos de histórico a cada abertura de /mensagens.
  const allResultPromise = listConversations(client, { maxPages: 3 }).then(
    (value) => ({ status: 'fulfilled', value }),
    (reason) => ({ status: 'rejected', reason }),
  );

  const { courses: rawCourses } = await cachedCanvasRead(user.id, 'userCourses', () =>
    listUserCoursesDetailed(client),
  );
  // Favorite AND published — an unpublished favorite course has no real
  // conversations worth surfacing here and would just be dead weight in the
  // context selector (see mensagens/page.jsx's note under the page title).
  const favoriteCourses = rawCourses.filter((c) => c.is_favorite && c.workflow_state === 'available');

  const CONVERSATIONS_ERROR =
    'Não foi possível carregar as mensagens. Se o problema persistir, verifique se a Developer Key do Canvas usada por este app tem o escopo de Conversas (Conversations API) habilitado.';

  const [favoritesResult, allResult] = await Promise.all([
    favoriteCourses.length > 0
      ? listConversations(client, { filter: favoriteCourses.map((c) => `course_${c.id}`) }).then(
          (value) => ({ status: 'fulfilled', value }),
          (reason) => ({ status: 'rejected', reason }),
        )
      : Promise.resolve({ status: 'fulfilled', value: [] }),
    allResultPromise,
  ]);

  let conversations = favoritesResult.status === 'fulfilled' ? favoritesResult.value : [];
  let loadError = favoritesResult.status === 'rejected' ? CONVERSATIONS_ERROR : null;

  // "Direct" (no course) is defined relative to what's already fetched
  // above, not by inspecting audience_contexts/context_code directly:
  // audience_contexts.courses turned out to list *every* course the
  // conversation's participants happen to share with the professor — for a
  // teacher in many courses that's nearly always non-empty, even for a
  // one-off account-level notice, so "empty audience_contexts.courses" was
  // never true in practice and the bucket stayed permanently empty. The
  // second, unscoped call above fetches the user's whole inbox; anything in
  // it that ISN'T already one of the favorites-scoped conversations above
  // (by id) is, by construction, not associated with any favorite course —
  // Canvas's own filter[]=course_<id> on the first call already guarantees
  // that (same audience_contexts matching, done Canvas-side) — so it's
  // exactly the "not linked to a course" set groupConversationsByCourse's
  // "other" bucket is meant to catch.
  if (allResult.status === 'fulfilled') {
    const favoriteConversationIds = new Set(conversations.map((c) => c.id));
    const extra = allResult.value.filter((c) => !favoriteConversationIds.has(c.id));
    conversations = [...conversations, ...extra];
  } else {
    loadError = loadError || CONVERSATIONS_ERROR;
  }

  return NextResponse.json({ courses: favoriteCourses, conversations, loadError });
}
