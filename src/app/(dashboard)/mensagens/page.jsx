import { ChevronsDown, ChevronsUp, RefreshCw, ExternalLink, Archive, Sparkles } from 'lucide-react';
import { requireCanvasIntegration } from '@/lib/canvasIntegration';
import { getConfiguredProviders } from '@/lib/aiProviderKeys';
import CanvasNotConnected from '@/components/CanvasNotConnected';
import MessageBrowser from '@/components/MessageBrowser';
import InfoHint from '@/components/InfoHint';

// No Canvas data is fetched here anymore — MessageBrowser fetches it
// client-side (via /api/canvas/messages) with an IndexedDB stale-while-
// revalidate cache, so navigating to /mensagens paints instantly instead of
// blocking on a Canvas round-trip inside this Server Component render.
export default async function MensagensPage() {
  const { user, canvas } = await requireCanvasIntegration();
  if (!user) return null;
  if (!canvas) return <CanvasNotConnected />;

  const configuredProviders = await getConfiguredProviders(user.id);

  return (
    <main className="page">
      <div className="page-title-row">
        <h1>Mensagens</h1>
        <InfoHint label="Sobre a tela de Mensagens">
          <p>
            Caixa de entrada do Canvas para seus cursos favoritos e publicados, agrupada por curso. Marque cursos como
            favoritos no Painel de Cursos para vê-los aqui.
          </p>
          <p>
            Filtre por curso (ou só mensagens diretas) no seletor "Contexto", expanda/recolha os grupos e responda cada
            conversa sem sair da página — se você tiver um provedor de IA configurado em Perfil, cada conversa também
            ganha sugestão de resposta e revisão de texto assistidas por IA.
          </p>
          <h4>Ícones e botões</h4>
          <ul className="icon-legend">
            <li>
              <ChevronsDown size={14} strokeWidth={1.8} aria-hidden="true" /> Expandir tudo
            </li>
            <li>
              <ChevronsUp size={14} strokeWidth={1.8} aria-hidden="true" /> Recolher tudo
            </li>
            <li>
              <RefreshCw size={14} strokeWidth={1.8} aria-hidden="true" /> Recarregar mensagens
            </li>
            <li>
              <ExternalLink size={14} strokeWidth={1.8} aria-hidden="true" /> Abrir mensagens do curso no Canvas
            </li>
            <li>
              <Archive size={14} strokeWidth={1.8} aria-hidden="true" /> Arquivar conversa
            </li>
            <li>
              <Sparkles size={14} strokeWidth={1.8} aria-hidden="true" /> Resposta assistida por IA
            </li>
          </ul>
        </InfoHint>
      </div>

      <MessageBrowser
        currentUserId={canvas.providerUserId ? Number(canvas.providerUserId) : null}
        baseUrl={canvas.baseUrl}
        providers={configuredProviders}
      />
    </main>
  );
}
