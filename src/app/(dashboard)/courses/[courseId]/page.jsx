import { requireCanvasIntegration } from '@/lib/canvasIntegration';
import { getCourse } from '@/lib/canvasClient';
import { courseUrl } from '@/lib/canvasLinks';
import CanvasNotConnected from '@/components/CanvasNotConnected';
import ContextBanner from '@/components/ContextBanner';
import ActiveWorkspaceCourseBanner from '@/components/ActiveWorkspaceCourseBanner';
import CourseWorkspaceTabs from '@/components/CourseWorkspaceTabs';

// The "tela cheia" destination for CourseBrowser.jsx's inline
// CourseWorkspaceTabs — same Anotações/Atividades/Mensagens/Alunos tabs, just
// on their own page instead of an expanded table row, for when a course's
// workspace is what someone actually wants to spend a while in (e.g. working
// through a stack of messages) rather than a quick check from the list. No
// `expandHref` passed down here — this already is the full-page view.
//
// `?tab=` (e.g. from TaskCard.jsx's "ir para o curso" link on a task linked
// to a specific Canvas assignment) preselects a tab; anything else falls
// back to CourseWorkspaceTabs' own default ("Anotações").
export default async function CoursePage({ params, searchParams }) {
  const { courseId } = await params;
  const { tab } = (await searchParams) || {};
  const { user, canvas } = await requireCanvasIntegration();
  if (!user) return null;
  if (!canvas) return <CanvasNotConnected />;

  const course = await getCourse(canvas.client, courseId);

  return (
    <main className="page">
      <h1>{course.name}</h1>
      <ContextBanner
        items={[
          {
            label: 'Curso',
            value: course.course_code || course.name,
            link: { href: courseUrl(canvas.baseUrl, courseId), title: 'Abrir curso no Canvas' },
          },
        ]}
      />

      <ActiveWorkspaceCourseBanner courseId={courseId} />

      <CourseWorkspaceTabs courseId={courseId} courseCode={course.course_code} initialTab={tab} />
    </main>
  );
}
