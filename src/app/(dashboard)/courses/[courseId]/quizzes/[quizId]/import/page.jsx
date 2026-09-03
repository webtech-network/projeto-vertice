import { getSession } from '@/lib/session';
import { requireCanvasIntegration } from '@/lib/canvasIntegration';
import { getCourse, getQuiz } from '@/lib/canvasClient';
import { listProviders } from '@/lib/aiProviders';
import CanvasNotConnected from '@/components/CanvasNotConnected';
import QuizImportPanel from '@/components/QuizImportPanel';
import ContextBanner from '@/components/ContextBanner';

export default async function ImportPage({ params }) {
  const { courseId, quizId } = await params;
  const { user, canvas } = await requireCanvasIntegration();
  if (!user) return null;
  if (!canvas) return <CanvasNotConnected />;

  const client = canvas.client;

  // Sequential, not Promise.all: firing both requests concurrently on a stale
  // access token means both 401 at once and each independently races to
  // refresh via onUnauthorized — two simultaneous refresh-token exchanges
  // against Canvas, which isn't safe (observed causing a hard failure here).
  const course = await getCourse(client, courseId);
  const quiz = await getQuiz(client, courseId, quizId);
  // aiApiKeys ainda vive no iron-session (migração pra Postgres é Fase 2).
  const session = await getSession();
  const configuredProviders = listProviders().filter((provider) => Boolean(session.aiApiKeys?.[provider.id]));

  return (
    <main className="page">
      <h1>Importar questões</h1>
      <ContextBanner
        items={[
          { label: 'Curso', value: course.name },
          { label: 'Atividade', value: quiz.title },
        ]}
      />
      <QuizImportPanel courseId={courseId} quizId={quizId} providers={configuredProviders} />
    </main>
  );
}
