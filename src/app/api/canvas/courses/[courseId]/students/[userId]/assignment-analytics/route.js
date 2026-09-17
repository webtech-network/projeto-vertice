import { NextResponse } from 'next/server';
import { requireCanvasIntegration } from '@/lib/canvasIntegration';
import { getStudentAssignmentAnalytics } from '@/lib/canvasClient';

const UNAVAILABLE_ERROR =
  'Os dados da situação dos alunos não estão disponíveis para esta conta Canvas. Verifique se o recurso "Analytics" está habilitado para o curso/instituição.';

// Backs StudentEngagementDashboard.jsx's per-assignment list — fetched
// lazily, only for the one student whose dashboard row is expanded (unlike
// .../analytics/students, this isn't shared across students).
export async function GET(request, { params }) {
  const { user, canvas } = await requireCanvasIntegration();
  if (!user) return NextResponse.json({ error: 'Sessão inválida. Faça login novamente.' }, { status: 401 });
  if (!canvas) {
    return NextResponse.json({ error: 'Canvas não conectado. Conecte sua conta em /perfil.' }, { status: 409 });
  }

  const { courseId, userId } = await params;

  try {
    const assignments = await getStudentAssignmentAnalytics(canvas.client, courseId, userId);
    return NextResponse.json({ assignments });
  } catch {
    return NextResponse.json({ error: UNAVAILABLE_ERROR }, { status: 502 });
  }
}
