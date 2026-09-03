import { NextResponse } from 'next/server';
import { requireCanvasIntegration } from '@/lib/canvasIntegration';
import { createConversation } from '@/lib/canvasClient';

// Backs StudentMessageModal.jsx's "Enviar mensagem" action on the Alunos
// screen — a single-recipient sibling of courses/[courseId]/messages
// (ComposeMessage.jsx's "send to every active student"), so no chunking is
// needed: `recipients` is always exactly one id.
export async function POST(request, { params }) {
  const { user, canvas } = await requireCanvasIntegration();
  if (!user) return NextResponse.json({ error: 'Sessão inválida. Faça login novamente.' }, { status: 401 });
  if (!canvas) {
    return NextResponse.json({ error: 'Canvas não conectado. Conecte sua conta em /perfil.' }, { status: 409 });
  }

  const { courseId, userId } = await params;
  const requestBody = await request.json().catch(() => null);
  const { subject, body } = requestBody || {};

  if (!body || typeof body !== 'string' || !body.trim()) {
    return NextResponse.json({ error: 'O corpo da mensagem é obrigatório.' }, { status: 400 });
  }

  try {
    const conversation = await createConversation(canvas.client, {
      recipients: [userId],
      subject: subject?.trim() || undefined,
      body: body.trim(),
      contextCode: `course_${courseId}`,
    });
    return NextResponse.json({ conversation });
  } catch {
    return NextResponse.json({ error: 'Falha ao enviar a mensagem ao aluno.' }, { status: 502 });
  }
}
