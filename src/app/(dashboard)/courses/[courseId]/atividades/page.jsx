import Link from 'next/link';
import { CircleCheckBig, CircleDashed, ClipboardCheck, ExternalLink, ClipboardList, ListPlus } from 'lucide-react';
import { requireCanvasIntegration } from '@/lib/canvasIntegration';
import { getCourse, listAssignments } from '@/lib/canvasClient';
import { isRealGroupAssignment, correctedGroupNeedsGradingCount } from '@/lib/groupGrading';
import { courseAssignmentsUrl } from '@/lib/canvasLinks';
import CanvasNotConnected from '@/components/CanvasNotConnected';
import ContextBanner from '@/components/ContextBanner';
import ActiveWorkspaceCourseBanner from '@/components/ActiveWorkspaceCourseBanner';
import AssignmentsTable from '@/components/AssignmentsTable';
import InfoHint from '@/components/InfoHint';

export default async function AtividadesPage({ params }) {
  const { courseId } = await params;
  const { user, canvas } = await requireCanvasIntegration();
  if (!user) return null;
  if (!canvas) return <CanvasNotConnected />;

  const client = canvas.client;

  // Sequenced, not Promise.all — firing both requests concurrently on a
  // near-expired access token means both 401 at once and each independently
  // races to refresh via onUnauthorized, causing a hard crash (observed live
  // on this page; already fixed the same way on the quiz-import page).
  const course = await getCourse(client, courseId);
  const rawAssignments = await listAssignments(client, courseId);

  // Same sequencing reasoning as above applies to each of these extra calls
  // too — a for loop, not Promise.all. Best-effort: if a particular
  // assignment's submissions can't be fetched (e.g. a permissions quirk),
  // fall back to Canvas's own (overcounted) needs_grading_count rather than
  // failing the whole page.
  const assignments = [];
  for (const assignment of rawAssignments) {
    if (!isRealGroupAssignment(assignment) || !assignment.needs_grading_count) {
      assignments.push(assignment);
      continue;
    }
    try {
      const needs_grading_count = await correctedGroupNeedsGradingCount(client, courseId, assignment);
      assignments.push({ ...assignment, needs_grading_count });
    } catch {
      assignments.push(assignment);
    }
  }

  return (
    <main className="page">
      <div className="page-header-row">
        <div className="page-header-block">
          <div className="page-title-row">
            <h1>Atividades</h1>
            <InfoHint label="Sobre a tela de Atividades">
              <p>
                Todas as atividades do curso, com destaque para as que têm entregas pendentes de correção. Quizzes
                clássicos (não os New Quizzes) podem receber questões importadas em lote.
              </p>
              <p>
                Filtre por status de publicação e clique no nome de uma atividade para ver seu enunciado sem sair da
                página.
              </p>
              <h4>Ícones e botões</h4>
              <ul className="icon-legend">
                <li>
                  <CircleCheckBig size={14} strokeWidth={1.8} aria-hidden="true" style={{ color: 'var(--ok)' }} />{' '}
                  Publicado
                </li>
                <li>
                  <CircleDashed size={14} strokeWidth={1.8} aria-hidden="true" /> Não publicado
                </li>
                <li>
                  <ClipboardCheck size={14} strokeWidth={1.8} aria-hidden="true" /> Correções pendentes
                </li>
                <li>
                  <ExternalLink size={14} strokeWidth={1.8} aria-hidden="true" /> Abrir atividade no Canvas
                </li>
                <li>
                  <ClipboardList size={14} strokeWidth={1.8} aria-hidden="true" /> Correção de Atividade
                </li>
                <li>
                  <ListPlus size={14} strokeWidth={1.8} aria-hidden="true" /> Importar questões (quizzes clássicos)
                </li>
              </ul>
            </InfoHint>
          </div>
          <ContextBanner
            items={[
              {
                label: 'Curso',
                value: course.name,
                link: { href: courseAssignmentsUrl(canvas.baseUrl, courseId), title: 'Abrir atividades do curso no Canvas' },
              },
            ]}
          />
        </div>
        <Link href="/questoes" className="btn btn-secondary">
          Gerar questões com IA
        </Link>
      </div>

      <ActiveWorkspaceCourseBanner courseId={courseId} />

      <AssignmentsTable courseId={courseId} assignments={assignments} />
    </main>
  );
}
