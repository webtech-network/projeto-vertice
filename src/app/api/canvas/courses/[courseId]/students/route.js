import { NextResponse } from 'next/server';
import { requireCanvasIntegration } from '@/lib/canvasIntegration';
import { listCourseStudents } from '@/lib/canvasClient';

// Backs TaskDetailModal.jsx's student picker (tasks feature — only needs
// id/name) and CourseWorkspaceTabs.jsx's "Alunos" tab (needs the full report
// — enrollment state, activity, grades — same as the old alunos/page.jsx
// Server Component), fetched lazily once a Canvas-linked project is selected
// or the tab is opened, then cached client-side via canvasResolution.js (the
// whole roster is cached per course, not one student at a time — there's no
// single-student-by-id Canvas endpoint to call instead). Always requesting
// `enrollments`/`email` is harmless for the id/name-only picker consumer.
export async function GET(request, { params }) {
  const { user, canvas } = await requireCanvasIntegration();
  if (!user) return NextResponse.json({ error: 'Sessão inválida. Faça login novamente.' }, { status: 401 });
  if (!canvas) {
    return NextResponse.json({ error: 'Canvas não conectado. Conecte sua conta em /perfil.' }, { status: 409 });
  }

  const { courseId } = await params;

  try {
    const students = await listCourseStudents(canvas.client, courseId, { include: ['enrollments', 'email'] });
    return NextResponse.json({ students });
  } catch {
    return NextResponse.json({ error: 'Falha ao carregar os alunos do curso.' }, { status: 502 });
  }
}
