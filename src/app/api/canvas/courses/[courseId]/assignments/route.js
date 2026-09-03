import { NextResponse } from 'next/server';
import { requireCanvasIntegration } from '@/lib/canvasIntegration';
import { listAssignments } from '@/lib/canvasClient';

// Backs TaskDetailModal.jsx's assignment picker (tasks feature) — a
// single, course-scoped call, fetched lazily once a Canvas-linked project is
// selected, then cached client-side via canvasResolution.js.
export async function GET(request, { params }) {
  const { user, canvas } = await requireCanvasIntegration();
  if (!user) return NextResponse.json({ error: 'Sessão inválida. Faça login novamente.' }, { status: 401 });
  if (!canvas) {
    return NextResponse.json({ error: 'Canvas não conectado. Conecte sua conta em /perfil.' }, { status: 409 });
  }

  const { courseId } = await params;

  try {
    const assignments = await listAssignments(canvas.client, courseId);
    return NextResponse.json({ assignments });
  } catch {
    return NextResponse.json({ error: 'Falha ao carregar as atividades do curso.' }, { status: 502 });
  }
}
