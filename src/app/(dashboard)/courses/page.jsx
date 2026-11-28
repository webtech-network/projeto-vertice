import {
  Star,
  ClipboardCheck,
  Megaphone,
  Mail,
  ExternalLink,
  Maximize2,
  Users,
} from 'lucide-react';
import { requireCanvasIntegrationMeta } from '@/lib/canvasIntegration';
import CanvasNotConnected from '@/components/CanvasNotConnected';
import CourseBrowser from '@/components/CourseBrowser';
import InfoHint from '@/components/InfoHint';

// No Canvas data is fetched here anymore — CourseBrowser fetches it
// client-side (via /api/canvas/courses) with an IndexedDB stale-while-
// revalidate cache, so navigating to /courses paints instantly instead of
// blocking on a Canvas round-trip inside this Server Component render.
export default async function CoursesPage() {
  const { user, canvas } = await requireCanvasIntegrationMeta();
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
          <p>
            Seus cursos ativos no Canvas em qualquer papel: professor, tutor, designer, aluno ou observador. O ícone
            ao lado da estrela mostra o seu papel em cada curso.
          </p>
          <p>
            Por padrão só os cursos marcados como favoritos no Canvas aparecem aqui — use o filtro "Todos" para ver o
            restante. Pesquise por nome/código, filtre por status de publicação e por papel (o seletor "Papel" aceita
            marcar vários de uma vez, só clicando — "Todos" limpa a escolha), ordene qualquer coluna clicando no
            cabeçalho e clique na seta ou no nome do curso para abrir, sem sair da página, a visão integrada de
            Anotações, Atividades, Mensagens e Alunos. O ícone ao lado do nome leva direto pra essa mesma visão numa
            página própria do curso.
          </p>
          <p>
            A coluna Pendências mostra, para cursos em que você é professor, quantas correções esperam por você e,
            para cursos em que é aluno, quantas atividades ainda faltam entregar.
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
              <Users size={14} strokeWidth={1.8} aria-hidden="true" /> Papel no curso (filtro por papel)
            </li>
            <li>
              <ClipboardCheck size={14} strokeWidth={1.8} aria-hidden="true" /> Pendências: a corrigir (professor) e a
              fazer (aluno)
            </li>
            <li>
              <Mail size={14} strokeWidth={1.8} aria-hidden="true" /> Mensagens
            </li>
            <li>
              <Maximize2 size={14} strokeWidth={1.8} aria-hidden="true" /> Abrir página do curso
            </li>
            <li>
              <ExternalLink size={14} strokeWidth={1.8} aria-hidden="true" /> Abrir curso no Canvas
            </li>
          </ul>
        </InfoHint>
      </div>

      <CourseBrowser />
    </main>
  );
}
