import { NextResponse } from 'next/server';
import { requireCanvasIntegration } from '@/lib/canvasIntegration';
import { getCourse } from '@/lib/canvasClient';

// Nome e código de um curso, para CoursePageContent.jsx quando o curso não
// está na lista de cursos já em cache no cliente (ex.: link direto antes de
// abrir /courses). Só os campos que a página usa — ADR-0016.
export async function GET(request, { params }) {
  const { user, canvas } = await requireCanvasIntegration();
  if (!user) return NextResponse.json({ error: 'Sessão inválida. Faça login novamente.' }, { status: 401 });
  if (!canvas) {
    return NextResponse.json({ error: 'Canvas não conectado. Conecte sua conta em /perfil.' }, { status: 409 });
  }

  const { courseId } = await params;

  try {
    const course = await getCourse(canvas.client, courseId);
    return NextResponse.json({ course: { id: course.id, name: course.name, course_code: course.course_code } });
  } catch {
    return NextResponse.json({ error: 'Falha ao carregar o curso.' }, { status: 502 });
  }
}
