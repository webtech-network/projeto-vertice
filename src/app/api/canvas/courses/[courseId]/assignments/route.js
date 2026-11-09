import { NextResponse } from 'next/server';
import { requireCanvasIntegration } from '@/lib/canvasIntegration';
import { listAssignments } from '@/lib/canvasClient';
import { isRealGroupAssignment, correctedGroupNeedsGradingCount } from '@/lib/groupGrading';
import { mapWithConcurrency } from '@/lib/concurrency';

// Backs TaskDetailModal.jsx's assignment picker (tasks feature) and, since
// the "Atividades" tab of CourseWorkspaceTabs.jsx moved here too, the same
// per-assignment needs_grading_count correction the old atividades/page.jsx
// Server Component used to do inline — best-effort, falls back to Canvas's
// own (possibly overcounted) number if a particular assignment's submissions
// can't be fetched.
export async function GET(request, { params }) {
  const { user, canvas } = await requireCanvasIntegration();
  if (!user) return NextResponse.json({ error: 'Sessão inválida. Faça login novamente.' }, { status: 401 });
  if (!canvas) {
    return NextResponse.json({ error: 'Canvas não conectado. Conecte sua conta em /perfil.' }, { status: 409 });
  }

  const { courseId } = await params;
  const client = canvas.client;

  try {
    const rawAssignments = await listAssignments(client, courseId);

    // Bounded concurrency, not one-by-one (ADR-0016).
    const assignments = await mapWithConcurrency(rawAssignments, 4, async (assignment) => {
      if (!isRealGroupAssignment(assignment) || !assignment.needs_grading_count) return assignment;
      try {
        const needs_grading_count = await correctedGroupNeedsGradingCount(client, courseId, assignment);
        return { ...assignment, needs_grading_count };
      } catch {
        return assignment;
      }
    });

    return NextResponse.json({ assignments });
  } catch {
    return NextResponse.json({ error: 'Falha ao carregar as atividades do curso.' }, { status: 502 });
  }
}
