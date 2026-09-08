import { requireCanvasIntegration } from '@/lib/canvasIntegration';
import { getCourse, listConversations } from '@/lib/canvasClient';
import { getConfiguredIntegrations } from '@/lib/aiIntegrations';
import { courseMessagesUrl } from '@/lib/canvasLinks';
import CanvasNotConnected from '@/components/CanvasNotConnected';
import ComposeMessage from '@/components/ComposeMessage';
import MessageList from '@/components/MessageList';
import ContextBanner from '@/components/ContextBanner';

export default async function CourseMensagensPage({ params }) {
  const { courseId } = await params;
  const { user, canvas } = await requireCanvasIntegration();
  if (!user) return null;
  if (!canvas) return <CanvasNotConnected />;

  const configuredIntegrations = await getConfiguredIntegrations(user.id);

  const client = canvas.client;

  // getCourse and listConversations are independent Canvas reads using the
  // same already-authenticated `client` — no OAuth-token race to serialize
  // for, so they're fetched in parallel instead of paying two sequential
  // round-trips before the page can render.
  //
  // A 401 from listConversations (as opposed to elsewhere in the app) almost
  // always means the Canvas Developer Key has "Enforce Scopes" on without
  // the Conversations API in its allowed list — a Canvas-admin config issue,
  // not a bug — so it's caught locally instead of crashing the whole page.
  const [course, conversationsResult] = await Promise.all([
    getCourse(client, courseId),
    listConversations(client, { filter: [`course_${courseId}`] }).catch(() => null),
  ]);

  const conversations = conversationsResult ?? [];
  const loadError =
    conversationsResult === null
      ? 'Não foi possível carregar as mensagens deste curso. Se o problema persistir, verifique se a Developer Key do Canvas usada por este app tem o escopo de Conversas (Conversations API) habilitado.'
      : null;

  return (
    <main className="page">
      <h1>Mensagens</h1>
      <ContextBanner
        items={[
          {
            label: 'Curso',
            value: course.name,
            link: { href: courseMessagesUrl(canvas.baseUrl, courseId), title: 'Abrir mensagens do curso no Canvas' },
          },
        ]}
      />
      <p className="lede">Mensagens da caixa de entrada do Canvas associadas a este curso.</p>

      <ComposeMessage courseId={courseId} integrations={configuredIntegrations} />

      {loadError ? (
        <p className="alert alert-error" role="alert">
          {loadError}
        </p>
      ) : (
        <MessageList
          conversations={conversations}
          currentUserId={canvas.providerUserId ? Number(canvas.providerUserId) : null}
          baseUrl={canvas.baseUrl}
          integrations={configuredIntegrations}
        />
      )}
    </main>
  );
}
