import { NextResponse } from 'next/server';
import { requireCanvasIntegration } from '@/lib/canvasIntegration';
import { listCourseStudents } from '@/lib/canvasClient';

// Backs TaskDetailModal.jsx's student picker (tasks feature) — a
// single, course-scoped call, fetched lazily once a Canvas-linked project is
// selected, then cached client-side via canvasResolution.js (the whole
// roster is cached per course, not one student at a time — there's no
// single-student-by-id Canvas endpoint to call instead).
export async function GET(request, { params }) {
  const { user, canvas } = await requireCanvasIntegration();
  if (!user) return NextResponse.json({ error: 'Sessão inválida. Faça login novamente.' }, { status: 401 });
  if (!canvas) {
    return NextResponse.json({ error: 'Canvas não conectado. Conecte sua conta em /perfil.' }, { status: 409 });
  }

  const { courseId } = await params;

  try {
    const students = await listCourseStudents(canvas.client, courseId);
    return NextResponse.json({ students });
  } catch {
    return NextResponse.json({ error: 'Falha ao carregar os alunos do curso.' }, { status: 502 });
  }
}
