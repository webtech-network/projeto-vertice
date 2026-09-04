import { requireCanvasIntegration } from '@/lib/canvasIntegration';
import { getCourse, listCourseStudents } from '@/lib/canvasClient';
import { buildStudentRows } from '@/lib/studentReport';
import { getConfiguredIntegrations } from '@/lib/aiIntegrations';
import { coursePeopleUrl } from '@/lib/canvasLinks';
import CanvasNotConnected from '@/components/CanvasNotConnected';
import StudentReport from '@/components/StudentReport';
import ContextBanner from '@/components/ContextBanner';

export default async function AlunosPage({ params }) {
  const { courseId } = await params;
  const { user, canvas } = await requireCanvasIntegration();
  if (!user) return null;
  if (!canvas) return <CanvasNotConnected />;

  const client = canvas.client;

  // Sequenced, not Promise.all — this app has a known bug where firing
  // multiple Canvas calls concurrently on a near-expired access token causes
  // simultaneous 401s and a concurrent-refresh race that crashes the page
  // (already fixed once, on the quiz-import page, the same way).
  const course = await getCourse(client, courseId);
  const students = await listCourseStudents(client, courseId, { include: ['enrollments', 'email'] });

  const rows = buildStudentRows(students);
  const configuredIntegrations = await getConfiguredIntegrations(user.id);

  return (
    <main className="page">
      <h1>Alunos</h1>
      <ContextBanner
        items={[
          {
            label: 'Curso',
            value: course.name,
            link: { href: coursePeopleUrl(canvas.baseUrl, courseId), title: 'Abrir pessoas do curso no Canvas' },
          },
        ]}
      />
      <p className="lede">Listagem dos alunos ativos do curso, com dados de matrícula, atividade e notas.</p>

      <StudentReport rows={rows} courseId={courseId} baseUrl={canvas.baseUrl} integrations={configuredIntegrations} />
    </main>
  );
}
