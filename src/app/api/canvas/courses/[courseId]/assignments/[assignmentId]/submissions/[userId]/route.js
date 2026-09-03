import { NextResponse } from 'next/server';
import { requireCanvasIntegration } from '@/lib/canvasIntegration';
import { gradeSubmissionWithRubric } from '@/lib/canvasClient';

// Body is already Canvas-shaped (`{ rubric_assessment?, submission, comment? }`)
// — built client-side by RubricGrader.jsx via src/lib/rubricGrading.js's
// buildGradePayload/buildSimpleGradePayload, which needs the full rubric
// (criteria descriptions, point totals) to compose the human-readable
// comment summary; the rubric doesn't change between requests in a grading
// session, so it's cheaper to build the final payload once client-side than
// to resend the rubric on every submission and re-derive it here.
// `rubric_assessment` is only present when the assignment actually has a
// rubric — RubricGrader.jsx's no-rubric fallback ("Nota" column only) sends
// just `submission` (+ an optional comment).
export async function PUT(request, { params }) {
  const { user, canvas } = await requireCanvasIntegration();
  if (!user) return NextResponse.json({ error: 'Sessão inválida. Faça login novamente.' }, { status: 401 });
  if (!canvas) {
    return NextResponse.json({ error: 'Canvas não conectado. Conecte sua conta em /perfil.' }, { status: 409 });
  }

  const { courseId, assignmentId, userId } = await params;
  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== 'object' || !payload.submission) {
    return NextResponse.json({ error: 'Payload de avaliação inválido.' }, { status: 400 });
  }

  try {
    const submission = await gradeSubmissionWithRubric(canvas.client, courseId, assignmentId, userId, payload);
    return NextResponse.json({ submission });
  } catch (err) {
    const message = err.response?.data?.errors?.[0]?.message || err.message || 'Falha ao enviar a nota ao Canvas.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
