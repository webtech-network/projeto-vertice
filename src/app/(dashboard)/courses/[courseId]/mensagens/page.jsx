import { redirect } from 'next/navigation';

// Superseded by the "Mensagens" tab of CourseWorkspaceTabs.jsx — see
// atividades/page.jsx's comment (same reasoning, same redirect-not-delete
// choice).
export default async function CourseMensagensPage({ params }) {
  const { courseId } = await params;
  redirect(`/courses/${courseId}?tab=mensagens`);
}
