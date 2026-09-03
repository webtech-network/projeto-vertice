import { NextResponse } from 'next/server';
import { requireCanvasIntegration } from '@/lib/canvasIntegration';
import { addCourseFavorite, removeCourseFavorite } from '@/lib/canvasClient';

const NOT_CONNECTED = NextResponse.json(
  { error: 'Canvas não conectado. Conecte sua conta em /perfil.' },
  { status: 409 },
);

export async function POST(request, { params }) {
  const { user, canvas } = await requireCanvasIntegration();
  if (!user) return NextResponse.json({ error: 'Sessão inválida. Faça login novamente.' }, { status: 401 });
  if (!canvas) return NOT_CONNECTED;

  const { courseId } = await params;
  try {
    await addCourseFavorite(canvas.client, courseId);
    return NextResponse.json({ is_favorite: true });
  } catch {
    return NextResponse.json({ error: 'Falha ao favoritar o curso.' }, { status: 502 });
  }
}

export async function DELETE(request, { params }) {
  const { user, canvas } = await requireCanvasIntegration();
  if (!user) return NextResponse.json({ error: 'Sessão inválida. Faça login novamente.' }, { status: 401 });
  if (!canvas) return NOT_CONNECTED;

  const { courseId } = await params;
  try {
    await removeCourseFavorite(canvas.client, courseId);
    return NextResponse.json({ is_favorite: false });
  } catch {
    return NextResponse.json({ error: 'Falha ao desfavoritar o curso.' }, { status: 502 });
  }
}
