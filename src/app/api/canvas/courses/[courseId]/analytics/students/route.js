import { NextResponse } from 'next/server';
import { requireCanvasIntegration } from '@/lib/canvasIntegration';
import { getStudentSummaries } from '@/lib/canvasClient';

const UNAVAILABLE_ERROR =
  'Os dados da situação dos alunos não estão disponíveis para esta conta Canvas. Verifique se o recurso "Analytics" está habilitado para o curso/instituição.';

// Backs StudentEngagementDashboard.jsx — the whole course's per-student
// summaries (page views, participations, on-time/late/missing submission
// counts) in one call, fetched once and reused for every student's
// dashboard (both that student's own numbers and the class averages shown
// alongside them). Not every Canvas account has the classic Analytics
// feature enabled — a 404/403 here is treated as "unavailable" rather than a
// hard failure, same pattern as the Conversations-API-scope check on the
// Mensagens tab.
export async function GET(request, { params }) {
  const { user, canvas } = await requireCanvasIntegration();
  if (!user) return NextResponse.json({ error: 'Sessão inválida. Faça login novamente.' }, { status: 401 });
  if (!canvas) {
    return NextResponse.json({ error: 'Canvas não conectado. Conecte sua conta em /perfil.' }, { status: 409 });
  }

  const { courseId } = await params;

  try {
    const summaries = await getStudentSummaries(canvas.client, courseId);
    return NextResponse.json({ summaries });
  } catch {
    return NextResponse.json({ error: UNAVAILABLE_ERROR }, { status: 502 });
  }
}
