import { ExternalLink } from 'lucide-react';
import { requireCanvasIntegration } from '@/lib/canvasIntegration';
import { getCourse, getQuiz } from '@/lib/canvasClient';
import { getConfiguredIntegrations } from '@/lib/aiIntegrations';
import CanvasNotConnected from '@/components/CanvasNotConnected';
import BackButton from '@/components/BackButton';
import QuizImportPanel from '@/components/QuizImportPanel';
import ContextBanner from '@/components/ContextBanner';
import { courseUrl, quizUrl } from '@/lib/canvasLinks';

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
      <BackButton
        fallbackHref={`/courses/${courseId}?tab=atividades`}
        backTo={['/courses', `/courses/${courseId}`]}
      />
      <div className="page-title-row">
        <h1>Questões da atividade</h1>
        <div className="page-title-actions">
          <a
            href={courseUrl(canvas.baseUrl, courseId)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-sm"
            title="Abrir o curso no Canvas (nova aba)"
          >
            <ExternalLink size={14} strokeWidth={2} aria-hidden="true" />
            Curso no Canvas
          </a>
          <a
            href={quiz.html_url || quizUrl(canvas.baseUrl, courseId, quizId)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-sm"
            title="Abrir a atividade no Canvas (nova aba)"
          >
            <ExternalLink size={14} strokeWidth={2} aria-hidden="true" />
            Atividade no Canvas
          </a>
        </div>
      </div>
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
