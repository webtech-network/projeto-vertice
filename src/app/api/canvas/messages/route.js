import { NextResponse } from 'next/server';
import { requireCanvasIntegration } from '@/lib/canvasIntegration';
import { listCourses, listConversations } from '@/lib/canvasClient';

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

  const rawCourses = await listCourses(client);
  // Favorite AND published — an unpublished favorite course has no real
  // conversations worth surfacing here and would just be dead weight in the
  // context selector (see mensagens/page.jsx's note under the page title).
  const favoriteCourses = rawCourses.filter((c) => c.is_favorite && c.workflow_state === 'available');

  // A 401 here (as opposed to elsewhere in the app) almost always means the
  // Canvas Developer Key has "Enforce Scopes" on without the Conversations
  // API in its allowed list — a Canvas-admin config issue, not a bug — so
  // this is caught locally instead of failing the whole request.
  //
  // Scoped to favorite courses only, and in a single call: Canvas's
  // `filter[]` accepts several course contexts at once and OR's them
  // together, so one Inbox call covers every favorite course.
  const CONVERSATIONS_ERROR =
    'Não foi possível carregar as mensagens. Se o problema persistir, verifique se a Developer Key do Canvas usada por este app tem o escopo de Conversas (Conversations API) habilitado.';

  // The two listConversations calls below are independent Canvas reads (one
  // scoped to favorite courses, one unscoped for the whole inbox — see the
  // comment further down) using the same already-authenticated `client`, so
  // there's no OAuth-token race to serialize for (unlike the sequential
  // multi-call pages elsewhere in this app, which serialize specifically to
  // avoid concurrent refreshes of the *session's* token). Running them in
  // parallel roughly halves this route's latency, dominated by the unscoped
  // call paginating the professor's entire inbox.
  const [favoritesResult, allResult] = await Promise.allSettled([
    favoriteCourses.length > 0
      ? listConversations(client, { filter: favoriteCourses.map((c) => `course_${c.id}`) })
      : Promise.resolve([]),
    listConversations(client),
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
