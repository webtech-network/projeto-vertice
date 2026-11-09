import Link from 'next/link';
import { Scale } from 'lucide-react';
import { requireCanvasIntegration } from '@/lib/canvasIntegration';
import {
  getCourse,
  getAssignment,
  listGroupCategories,
  listSubmissions,
  listPeerReviews,
} from '@/lib/canvasClient';
import { loadGroupsWithMembers } from '@/lib/peerReviewGroups';
import CanvasNotConnected from '@/components/CanvasNotConnected';
import ContextBanner from '@/components/ContextBanner';
import InfoHint from '@/components/InfoHint';
import PeerReviewDistributor from '@/components/PeerReviewDistributor';

// Only students who actually turned something in take part (as reviewers and
// reviewees) — `attempt`/`submitted_at`, not workflow_state alone, since a
// professor-graded non-submission is also 'graded'.
function isDelivered(submission) {
  return (submission.attempt != null || Boolean(submission.submitted_at)) && !submission.excused;
}

export default async function PeerReviewsPage({ params }) {
  const { courseId, assignmentId } = await params;
  const { user, canvas } = await requireCanvasIntegration();
  if (!user) return null;
  if (!canvas) return <CanvasNotConnected />;

  const client = canvas.client;

  // Sequenced, not Promise.all — same concurrent-refresh race every other
  // multi-call Canvas page here avoids.
  const course = await getCourse(client, courseId);
  const assignment = await getAssignment(client, courseId, assignmentId);

  const peerReviewsUrl = `${canvas.baseUrl}/courses/${courseId}/assignments/${assignmentId}/peer_reviews`;

  let content;
  if (!assignment.peer_reviews) {
    content = (
      <p className="alert alert-warning" role="alert">
        Esta atividade não tem avaliação por pares habilitada no Canvas.
      </p>
    );
  } else {
    const categories = await listGroupCategories(client, courseId);
    if (categories.length === 0) {
      content = (
        <p className="alert alert-warning" role="alert">
          Este curso não tem nenhum conjunto de grupos no Canvas — crie os grupos antes de distribuir a avaliação por
          pares.
        </p>
      );
    } else {
      // The assignment's own group set wins; otherwise a lone set is the
      // obvious default. With several and no hint, the professor must pick.
      const assignmentCategory = categories.find((c) => c.id === assignment.group_category_id);
      const defaultCategoryId = assignmentCategory?.id ?? (categories.length === 1 ? categories[0].id : null);

      const submissions = await listSubmissions(client, courseId, assignmentId, { include: ['user'] });
      const peerReviews = await listPeerReviews(client, courseId, assignmentId);
      const initialGroups = defaultCategoryId ? await loadGroupsWithMembers(client, defaultCategoryId) : null;

      const studentNames = Object.fromEntries(
        submissions.map((s) => [s.user_id, s.user?.sortable_name || s.user?.name || `Aluno ${s.user_id}`]),
      );
      const delivered = submissions
        .filter(isDelivered)
        .map((s) => ({ userId: s.user_id, submissionId: s.id }));

      content = (
        <PeerReviewDistributor
          courseId={courseId}
          assignmentId={assignmentId}
          defaultCount={assignment.peer_review_count || 3}
          automaticPeerReviews={Boolean(assignment.automatic_peer_reviews)}
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          defaultCategoryId={defaultCategoryId}
          initialGroups={initialGroups}
          delivered={delivered}
          studentNames={studentNames}
          peerReviews={peerReviews.map((r) => ({
            assessor_id: r.assessor_id,
            user_id: r.user_id,
            asset_id: r.asset_id,
            workflow_state: r.workflow_state,
          }))}
        />
      );
    }
  }

  return (
    <main className="page">
      <div className="page-title-row">
        <h1>Avaliação por pares</h1>
        <div className="page-title-actions">
          <InfoHint label="Sobre a distribuição de avaliação por pares">
            <p>
              Distribui as avaliações por pares de modo que cada aluno avalie apenas colegas de <strong>outros
              grupos</strong>, com a mesma quantidade de revisões para todos sempre que possível.
            </p>
            <p>
              Só participam alunos que entregaram a atividade. Quem entregou sem estar em nenhum grupo do conjunto
              escolhido é tratado como um grupo de uma pessoa.
            </p>
            <p>
              Nada muda no Canvas até você clicar em "Aplicar no Canvas". A aplicação refaz a distribuição do zero:
              revisões existentes que não estão no plano são removidas.
            </p>
          </InfoHint>
          <Link
            href={`/courses/${courseId}/assignments/${assignmentId}/peer-grading`}
            className="btn btn-secondary"
            title="Consolidar avaliação por pares"
          >
            <Scale size={16} strokeWidth={1.8} />
            Consolidação
          </Link>
        </div>
      </div>
      <ContextBanner
        items={[
          { label: 'Curso', value: course.name },
          {
            label: 'Atividade',
            value: assignment.name,
            link: { href: peerReviewsUrl, title: 'Abrir avaliações por pares no Canvas' },
          },
        ]}
      />
      {content}
    </main>
  );
}
