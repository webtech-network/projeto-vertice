import { redirect } from 'next/navigation';

// Superseded by the "Atividades" tab of CourseWorkspaceTabs.jsx, reached
// from courses/[courseId]/page.jsx (itself linked from CourseBrowser.jsx's
// expanded row, which used to link here directly via a dedicated button —
// removed in favor of the integrated tabs). Kept as a redirect, not deleted,
// so any bookmark/browser-history entry pointing at this URL still lands
// somewhere useful instead of 404ing.
export default async function AtividadesPage({ params }) {
  const { courseId } = await params;
  redirect(`/courses/${courseId}?tab=atividades`);
}
