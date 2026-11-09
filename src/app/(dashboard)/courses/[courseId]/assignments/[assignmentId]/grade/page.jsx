import {
  CircleAlert,
  CircleDashed,
  Clock,
  Hourglass,
  FileCheck,
  CircleCheckBig,
  Award,
  Eraser,
  Send,
} from 'lucide-react';
import { requireCanvasIntegration } from '@/lib/canvasIntegration';
import { getCourse, getAssignment, listSubmissions } from '@/lib/canvasClient';
import CanvasNotConnected from '@/components/CanvasNotConnected';
import BackButton from '@/components/BackButton';
import ContextBanner from '@/components/ContextBanner';
import RubricGrader from '@/components/RubricGrader';
import InfoHint from '@/components/InfoHint';

export default async function GradeAssignmentPage({ params }) {
  const { courseId, assignmentId } = await params;
  const { user, canvas } = await requireCanvasIntegration();
  if (!user) return null;
  if (!canvas) return <CanvasNotConnected />;

  const client = canvas.client;

  // Independent reads, fetched in parallel — the token refresh is
  // single-flight now, so simultaneous 401s no longer race it (ADR-0016).
  // Grading no longer requires a rubric — RubricGrader falls back to a
  // plain "Nota" column (see its own comment) when assignment.rubric is
  // absent, so submissions are always fetched, not just when there's one.
  const [course, assignment, submissions] = await Promise.all([
    getCourse(client, courseId),
    getAssignment(client, courseId, assignmentId),
    listSubmissions(client, courseId, assignmentId, { include: ['user', 'rubric_assessment', 'group'] }),
  ]);

  // Canvas returns one submission per *student* either way — for a group
  // assignment it also returns each submission's `group` (requested above),
  // but only rows up when the course isn't set to grade group members
  // individually does that submission actually represent the whole group
  // (same grade for everyone in it, propagated automatically by Canvas when
  // you grade any one member — see the PUT route this page's RubricGrader
  // posts to). When grade_group_students_individually is true, each student
  // still gets graded on their own despite belonging to a group, so the
  // table should show students, not groups.
  const isGroupAssignment = Boolean(assignment.group_category_id) && !assignment.grade_group_students_individually;

  const speedGraderUrl = `${canvas.baseUrl}/courses/${courseId}/gradebook/speed_grader?assignment_id=${assignmentId}`;

  return (
    <main className="page">
      <BackButton fallbackHref={`/courses/${courseId}?tab=atividades`} />
      <div className="page-title-row">
        <h1>Correção de Atividade</h1>
        <InfoHint label="Sobre a tela de Correção de Atividade">
          <p>
            Lance notas para cada aluno ou grupo — por critério de rubrica quando a atividade tiver uma associada no
            Canvas, ou em uma única nota quando não tiver. Clique no nome de um aluno/grupo para ver a entrega
            enviada, sem sair da página.
          </p>
          <p>
            Nenhuma nota chega ao Canvas até você clicar em "Enviar" (por linha) ou "Enviar todas as notas" — até lá,
            tudo fica só como rascunho local.
          </p>
          <h4>Status da entrega</h4>
          <ul className="icon-legend">
            <li>
              <CircleAlert size={14} strokeWidth={1.8} aria-hidden="true" style={{ color: 'var(--err)' }} /> Faltando
            </li>
            <li>
              <CircleDashed size={14} strokeWidth={1.8} aria-hidden="true" /> Não entregue
            </li>
            <li>
              <Clock size={14} strokeWidth={1.8} aria-hidden="true" style={{ color: 'var(--warn)' }} /> Atrasada
            </li>
            <li>
              <Hourglass size={14} strokeWidth={1.8} aria-hidden="true" style={{ color: 'var(--warn)' }} /> Aguardando
              revisão
            </li>
            <li>
              <FileCheck size={14} strokeWidth={1.8} aria-hidden="true" /> Entregue
            </li>
            <li>
              <CircleCheckBig size={14} strokeWidth={1.8} aria-hidden="true" style={{ color: 'var(--ok)' }} /> Avaliada
            </li>
          </ul>
          <h4>Ícones e botões</h4>
          <ul className="icon-legend">
            <li>
              <Award size={14} strokeWidth={1.8} aria-hidden="true" /> Nota máxima
            </li>
            <li>
              <Eraser size={14} strokeWidth={1.8} aria-hidden="true" /> Limpar nota
            </li>
            <li>
              <Send size={14} strokeWidth={1.8} aria-hidden="true" /> Enviar nota ao Canvas
            </li>
          </ul>
        </InfoHint>
      </div>
      <ContextBanner
        items={[
          { label: 'Curso', value: course.name },
          {
            label: 'Atividade',
            value: assignment.name,
            link: { href: speedGraderUrl, title: 'Abrir no SpeedGrader do Canvas' },
          },
        ]}
      />

      <RubricGrader
        courseId={courseId}
        assignmentId={assignmentId}
        rubric={assignment.rubric}
        pointsPossible={assignment.points_possible}
        submissions={submissions}
        groupAssignment={isGroupAssignment}
      />
    </main>
  );
}
