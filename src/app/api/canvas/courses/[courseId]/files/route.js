import { NextResponse } from 'next/server';
import { requireCanvasIntegration } from '@/lib/canvasIntegration';
import { listCourseFiles } from '@/lib/canvasClient';

// Backs CourseWorkspaceTabs.jsx's "Arquivos" tab — available to every course
// role. Só metadados (nome, data de envio, tamanho, tipo); nunca o conteúdo.
//
// Situações, sempre com 200 (as outras abas do curso seguem normais):
//   - curso sem arquivos / resposta vazia ou null → `files: []`;
//   - Canvas recusou (401/403): na prática é o que ele devolve quando o curso não
//     tem nenhum arquivo enviado ou a área de Arquivos está oculta para o papel —
//     não dá para distinguir os dois, então vira lista vazia (sem alerta vermelho);
//   - qualquer outra falha (rede, 5xx, 404) → `loadError`, aí sim um aviso.
const FILES_FAILED_ERROR = 'Não foi possível carregar os arquivos agora. Tente novamente em instantes.';

export async function GET(request, { params }) {
  const { user, canvas } = await requireCanvasIntegration();
  if (!user) return NextResponse.json({ error: 'Sessão inválida. Faça login novamente.' }, { status: 401 });
  if (!canvas) {
    return NextResponse.json({ error: 'Canvas não conectado. Conecte sua conta em /perfil.' }, { status: 409 });
  }

  const { courseId } = await params;

  try {
    const raw = await listCourseFiles(canvas.client, courseId);
    const files = (Array.isArray(raw) ? raw : []).filter(Boolean).map((f) => ({
      id: f.id,
      display_name: f.display_name || f.filename,
      created_at: f.created_at,
      modified_at: f.modified_at,
      size: f.size,
      content_type: f['content-type'] || f.content_type || null,
      locked: Boolean(f.locked),
      hidden: Boolean(f.hidden),
    }));
    return NextResponse.json({ files, loadError: null });
  } catch (error) {
    // Só o status — nunca o objeto de erro, que pode carregar cabeçalhos.
    const status = error?.response?.status;
    console.error('[files] listagem falhou:', status ?? error?.code ?? 'sem status');
    if (status === 401 || status === 403) return NextResponse.json({ files: [], loadError: null });
    return NextResponse.json({ files: [], loadError: FILES_FAILED_ERROR });
  }
}
