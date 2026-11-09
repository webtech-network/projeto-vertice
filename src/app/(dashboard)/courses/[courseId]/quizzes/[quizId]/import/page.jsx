import { requireCanvasIntegration } from '@/lib/canvasIntegration';
import { getCourse, getQuiz } from '@/lib/canvasClient';
import { getConfiguredIntegrations } from '@/lib/aiIntegrations';
import CanvasNotConnected from '@/components/CanvasNotConnected';
import BackButton from '@/components/BackButton';
import QuizImportPanel from '@/components/QuizImportPanel';
import ContextBanner from '@/components/ContextBanner';

export default async function ImportPage({ params }) {
  const { courseId, quizId } = await params;
  const { user, canvas } = await requireCanvasIntegration();
  if (!user) return null;
  if (!canvas) return <CanvasNotConnected />;

  const client = canvas.client;

  // Independent reads, in parallel — the token refresh is single-flight now,
  // so two simultaneous 401s share one refresh instead of racing (ADR-0016).
  const [course, quiz, configuredIntegrations] = await Promise.all([
    getCourse(client, courseId),
    getQuiz(client, courseId, quizId),
    getConfiguredIntegrations(user.id),
  ]);

  return (
    <main className="page">
      <BackButton fallbackHref={`/courses/${courseId}?tab=atividades`} />
      <h1>Importar questões</h1>
      <ContextBanner
        items={[
          { label: 'Curso', value: course.name },
          { label: 'Atividade', value: quiz.title },
        ]}
      />
      <QuizImportPanel courseId={courseId} quizId={quizId} integrations={configuredIntegrations} />
    </main>
  );
}
