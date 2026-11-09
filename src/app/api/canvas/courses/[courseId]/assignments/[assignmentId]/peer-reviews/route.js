import { NextResponse } from 'next/server';
import { requireCanvasIntegration } from '@/lib/canvasIntegration';
import { createPeerReview, deletePeerReview } from '@/lib/canvasClient';

// One peer review per request — PeerReviewDistributor.jsx applies its plan
// item by item, sequentially (writes stay one-by-one — ADR-0016), so each
// failure is reported per pair and can be retried.
// Body: `{ submissionId, userId }` — the reviewed submission's id and the
// reviewer's user id (Canvas's peer-review paths take the submission id).
async function handle(request, params, action) {
  const { user, canvas } = await requireCanvasIntegration();
  if (!user) return NextResponse.json({ error: 'Sessão inválida. Faça login novamente.' }, { status: 401 });
  if (!canvas) {
    return NextResponse.json({ error: 'Canvas não conectado. Conecte sua conta em /perfil.' }, { status: 409 });
  }

  const { courseId, assignmentId } = await params;
  const body = await request.json().catch(() => null);
  if (!body?.submissionId || !body?.userId) {
    return NextResponse.json({ error: 'Informe submissionId e userId.' }, { status: 400 });
  }

  try {
    const peerReview = await action(canvas.client, courseId, assignmentId, body.submissionId, body.userId);
    return NextResponse.json({ peerReview });
  } catch (err) {
    const message = err.response?.data?.errors?.[0]?.message || err.message || 'Falha ao atualizar a avaliação por pares no Canvas.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(request, { params }) {
  return handle(request, params, createPeerReview);
}

export async function DELETE(request, { params }) {
  return handle(request, params, deletePeerReview);
}
