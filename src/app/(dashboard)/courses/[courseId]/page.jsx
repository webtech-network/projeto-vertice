import { requireCanvasIntegration } from '@/lib/canvasIntegration';
import CanvasNotConnected from '@/components/CanvasNotConnected';
import BackButton from '@/components/BackButton';
import CoursePageContent from '@/components/CoursePageContent';

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

  // No Canvas call here (ADR-0016): the course name/code come from the
  // client-side query cache in CoursePageContent, so navigating to this page
  // never waits on a Canvas round-trip.
  return (
    <main className="page">
      <BackButton fallbackHref={'/courses'} />
      <CoursePageContent courseId={courseId} baseUrl={canvas.baseUrl} initialTab={tab} />
    </main>
  );
}
