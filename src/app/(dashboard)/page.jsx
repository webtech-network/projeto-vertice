import { ExternalLink } from 'lucide-react';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';
import { getDisplayName } from '@/lib/supabaseUserDisplay';
import DashboardPanel from '@/components/DashboardPanel';
import WebTechFooter from '@/components/WebTechFooter';
import InfoHint from '@/components/InfoHint';

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null; // proxy already redirects unauthenticated requests to /login
  }

  return (
    <main className="page">
      <div className="page-title-row">
        <h1>Olá, {getDisplayName(user)?.split(' ')[0] || 'professor(a)'}</h1>
        <InfoHint label="Sobre o Dashboard">
          <p>
            Um resumo do seu dia a dia como professor: disciplinas ativas, alunos, mensagens pendentes e correções
            pendentes no topo, seguidos das suas tarefas em andamento, atalhos, calendário de prazos, atividades
            recentes e correções pendentes por curso.
          </p>
          <p>
            Em "Atividades recentes" e "Correções pendentes", clique na linha de uma atividade para corrigi-la dentro
            do próprio Vértice — o ícone à direita abre a mesma atividade direto no SpeedGrader do Canvas.
          </p>
          <h4>Ícones e botões</h4>
          <ul className="icon-legend">
            <li>
              <ExternalLink size={14} strokeWidth={1.8} aria-hidden="true" /> Abrir no SpeedGrader (Canvas)
            </li>
            <li className="deadline-tag overdue">Atrasada</li>
            <li className="deadline-tag upcoming">Em breve</li>
          </ul>
        </InfoHint>
      </div>

      <DashboardPanel />

      {/* "Sobre o CanvasTools" moved to its own dedicated page (/sobre,
          reachable from the sidebar's "Mais opções" menu) — this footer is
          the same horizontal bar layout as /login's (WebTechFooter.jsx's
          "bar" variant) minus the legal links, which only make sense on the
          entry screen. */}
      <WebTechFooter variant="bar" showLinks={false} compact />
    </main>
  );
}
