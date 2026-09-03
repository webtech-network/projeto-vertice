import { NextResponse } from 'next/server';
import { requireCanvasIntegration } from '@/lib/canvasIntegration';
import { listCourseStudents, createConversation } from '@/lib/canvasClient';

// Canvas requires group_conversation:true once recipients exceeds 100 — but
// this route always sends individual private copies (group_conversation:
// false, see canvasClient.createConversation), so a course with more
// students than that needs several create-conversation calls instead of
// one.
const RECIPIENTS_PER_BATCH = 100;

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// Backs the "Nova mensagem" compose form on the per-course messages screen —
// sends one private copy of the message to each active student in the
// course.
export async function POST(request, { params }) {
  const { user, canvas } = await requireCanvasIntegration();
  if (!user) return NextResponse.json({ error: 'Sessão inválida. Faça login novamente.' }, { status: 401 });
  if (!canvas) {
    return NextResponse.json({ error: 'Canvas não conectado. Conecte sua conta em /perfil.' }, { status: 409 });
  }

  const { courseId } = await params;
  const requestBody = await request.json().catch(() => null);
  const { subject, body } = requestBody || {};

  if (!body || typeof body !== 'string' || !body.trim()) {
    return NextResponse.json({ error: 'O corpo da mensagem é obrigatório.' }, { status: 400 });
  }

  const client = canvas.client;

  let students;
  try {
    students = await listCourseStudents(client, courseId);
  } catch {
    return NextResponse.json({ error: 'Falha ao carregar os alunos do curso.' }, { status: 502 });
  }

  if (students.length === 0) {
    return NextResponse.json({ error: 'Nenhum aluno ativo encontrado neste curso.' }, { status: 400 });
  }

  const batches = chunk(
    students.map((s) => s.id),
    RECIPIENTS_PER_BATCH,
  );

  let sentCount = 0;
  let failedBatches = 0;
  for (const recipients of batches) {
    try {
      await createConversation(client, {
        recipients,
        subject: subject?.trim() || undefined,
        body: body.trim(),
        contextCode: `course_${courseId}`,
      });
      sentCount += recipients.length;
    } catch {
      failedBatches += 1;
    }
  }

  if (sentCount === 0) {
    return NextResponse.json({ error: 'Falha ao enviar a mensagem.' }, { status: 502 });
  }

  return NextResponse.json({ recipientCount: sentCount, failedBatches });
}
