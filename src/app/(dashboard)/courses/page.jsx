import { Star, ClipboardCheck, Megaphone, Mail, ExternalLink, ListChecks, Users } from 'lucide-react';
import { requireCanvasIntegration } from '@/lib/canvasIntegration';
import CanvasNotConnected from '@/components/CanvasNotConnected';
import CourseBrowser from '@/components/CourseBrowser';
import InfoHint from '@/components/InfoHint';

// No Canvas data is fetched here anymore — CourseBrowser fetches it
// client-side (via /api/canvas/courses) with an IndexedDB stale-while-
// revalidate cache, so navigating to /courses paints instantly instead of
// blocking on a Canvas round-trip inside this Server Component render.
export default async function CoursesPage() {
  const { user, canvas } = await requireCanvasIntegration();
  if (!user) {
    return null; // proxy já redireciona requests não autenticados pra /login
  }
  if (!canvas) {
    return <CanvasNotConnected />;
  }

  return (
    <main className="page">
      <div className="page-title-row">
        <h1>Painel de Cursos</h1>
        <InfoHint label="Sobre o Painel de Cursos">
          <p>Cursos ativos em que você está matriculado como professor no Canvas.</p>
          <p>
            Por padrão só os cursos marcados como favoritos no Canvas aparecem aqui — use o filtro "Todos" para ver o
            restante. Pesquise por nome/código, filtre por status de publicação, ordene qualquer coluna clicando no
            cabeçalho e clique no nome do curso para abrir/editar suas próprias anotações sobre ele.
          </p>
          <h4>Ícones e botões</h4>
          <ul className="icon-legend">
            <li>
              <Star size={14} strokeWidth={1.8} fill="currentColor" aria-hidden="true" /> Favorito (clique para
              marcar/desmarcar)
            </li>
            <li>
              <Megaphone size={14} strokeWidth={1.8} aria-hidden="true" /> Status de publicação
            </li>
            <li>
              <ClipboardCheck size={14} strokeWidth={1.8} aria-hidden="true" /> Correções pendentes
            </li>
            <li>
              <Mail size={14} strokeWidth={1.8} aria-hidden="true" /> Mensagens
            </li>
            <li>
              <ExternalLink size={14} strokeWidth={1.8} aria-hidden="true" /> Abrir curso no Canvas
            </li>
            <li>
              <ListChecks size={14} strokeWidth={1.8} aria-hidden="true" /> Ver atividades
            </li>
            <li>
              <Users size={14} strokeWidth={1.8} aria-hidden="true" /> Ver alunos
            </li>
          </ul>
        </InfoHint>
      </div>

      <CourseBrowser />
    </main>
  );
}
