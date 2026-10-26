import { NextResponse } from 'next/server';
import { requireCanvasIntegration } from '@/lib/canvasIntegration';
import { listGroupCategories } from '@/lib/canvasClient';

// Group sets of a course (`[{ id, name }]`) — called by StudentReport.jsx to
// fill the "Agrupar por" picker above the students table.
export async function GET(_request, { params }) {
  const { user, canvas } = await requireCanvasIntegration();
  if (!user) return NextResponse.json({ error: 'Sessão inválida. Faça login novamente.' }, { status: 401 });
  if (!canvas) {
    return NextResponse.json({ error: 'Canvas não conectado. Conecte sua conta em /perfil.' }, { status: 409 });
  }

  const { courseId } = await params;
  try {
    const categories = await listGroupCategories(canvas.client, courseId);
    return NextResponse.json({ categories: categories.map((c) => ({ id: c.id, name: c.name })) });
  } catch (err) {
    const message = err.response?.data?.errors?.[0]?.message || err.message || 'Falha ao carregar os conjuntos de grupos do Canvas.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
