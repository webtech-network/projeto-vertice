import { NextResponse } from 'next/server';
import { requireCanvasIntegration } from '@/lib/canvasIntegration';
import { loadGroupsWithMembers } from '@/lib/peerReviewGroups';

// Groups (+ member ids) of one group set — called by PeerReviewDistributor.jsx
// when the professor switches the group set used as "same group".
export async function GET(_request, { params }) {
  const { user, canvas } = await requireCanvasIntegration();
  if (!user) return NextResponse.json({ error: 'Sessão inválida. Faça login novamente.' }, { status: 401 });
  if (!canvas) {
    return NextResponse.json({ error: 'Canvas não conectado. Conecte sua conta em /perfil.' }, { status: 409 });
  }

  const { categoryId } = await params;
  try {
    const groups = await loadGroupsWithMembers(canvas.client, categoryId);
    return NextResponse.json({ groups });
  } catch (err) {
    const message = err.response?.data?.errors?.[0]?.message || err.message || 'Falha ao carregar os grupos do Canvas.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
