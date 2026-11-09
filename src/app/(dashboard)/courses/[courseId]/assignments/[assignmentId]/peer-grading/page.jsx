import Link from 'next/link';
import { Shuffle } from 'lucide-react';
import { requireCanvasIntegration } from '@/lib/canvasIntegration';
import {
  getCourse,
  getAssignment,
  getRubric,
  listGroupCategories,
  listSubmissions,
  listPeerReviews,
} from '@/lib/canvasClient';
import { loadGroupsWithMembers } from '@/lib/peerReviewGroups';
import { consolidatePeerReviews } from '@/lib/peerReviewGrading';
import CanvasNotConnected from '@/components/CanvasNotConnected';
import ContextBanner from '@/components/ContextBanner';
import InfoHint from '@/components/InfoHint';
import PeerReviewGrader from '@/components/PeerReviewGrader';

// Only what SubmissionPreview.jsx needs — same fields RubricGrader.jsx keeps.
function previewFields(submission) {
  return {
    hasSubmission: submission.workflow_state !== 'unsubmitted',
    previewUrl: submission.preview_url || null,
    submissionType: submission.submission_type || null,
    submittedUrl: submission.url || null,
    body: submission.body || null,
    attachments: (submission.attachments || []).map((a) => ({
      id: a.id,
      name: a.display_name || a.filename || `Arquivo ${a.id}`,
      url: a.url,
      contentType: a['content-type'] || '',
    })),
  };
}

// See specs/capabilities/peer-review-grading.md.
export default async function PeerGradingPage({ params }) {
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
    const submissions = await listSubmissions(client, courseId, assignmentId, {
      include: ['user', 'submission_comments'],
    });
    const peerReviews = await listPeerReviews(client, courseId, assignmentId);

    const rubricId = assignment.rubric_settings?.id;
    const rubric = rubricId ? await getRubric(client, courseId, rubricId, { include: ['peer_assessments'] }) : null;

    const categories = await listGroupCategories(client, courseId);
    const assignmentCategory = categories.find((c) => c.id === assignment.group_category_id);
    const defaultCategoryId = assignmentCategory?.id ?? (categories.length === 1 ? categories[0].id : null);
    const initialGroups = defaultCategoryId ? await loadGroupsWithMembers(client, defaultCategoryId) : null;

    const rubricPoints = rubric ? (assignment.rubric_settings?.points_possible ?? rubric.points_possible ?? null) : null;
    const consolidated = consolidatePeerReviews({
      submissions,
      peerReviews,
      assessments: rubric?.assessments || [],
      criteria: rubric?.data || [],
      rubricPoints,
      assignmentPoints: assignment.points_possible ?? null,
    });

    const previews = new Map(submissions.map((s) => [s.user_id, previewFields(s)]));

    content = (
      <PeerReviewGrader
        courseId={courseId}
        assignmentId={assignmentId}
        pointsPossible={assignment.points_possible ?? null}
        rubricPoints={rubricPoints}
        hasRubric={consolidated.hasRubric}
        totals={consolidated.totals}
        students={consolidated.students.map((s) => ({ ...s, preview: previews.get(s.userId) }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        defaultCategoryId={defaultCategoryId}
        initialGroups={initialGroups}
      />
    );
  }

  return (
    <main className="page">
      <div className="page-title-row">
        <h1>Consolidar avaliação por pares</h1>
        <div className="page-title-actions">
          <InfoHint label="Sobre a consolidação da avaliação por pares">
            <p>
              Calcula a média das notas que cada aluno recebeu dos colegas e mostra os comentários recebidos e feitos. A
              média é convertida para o valor da atividade.
            </p>
            <p>
              Quem não entregou recebe 0 como sugestão. Quem entregou sem nenhuma avaliação dos pares precisa de nota
              manual.
            </p>
            <p>
              Nada muda no Canvas até você enviar. Linhas sem nota nunca são enviadas, para não apagar a nota existente.
            </p>
          </InfoHint>
          <Link
            href={`/courses/${courseId}/assignments/${assignmentId}/peer-reviews`}
            className="btn btn-secondary"
            title="Distribuir avaliação por pares"
          >
            <Shuffle size={16} strokeWidth={1.8} />
            Distribuição
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
          ...(assignment.points_possible != null
            ? [{ label: 'Valor', value: `${assignment.points_possible} pts` }]
            : []),
        ]}
      />
      {content}
    </main>
  );
}
