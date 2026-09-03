import { getSession } from '@/lib/session';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';
import { listProviders } from '@/lib/aiProviders';
import QuestionGenerator from '@/components/QuestionGenerator';

export default async function QuestoesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null; // proxy already redirects unauthenticated requests to /login
  }

  // aiApiKeys ainda vive no iron-session (migração pra Postgres é Fase 2).
  const session = await getSession();
  const configuredProviders = listProviders().filter((provider) => Boolean(session.aiApiKeys?.[provider.id]));

  return (
    <main className="page">
      <h1>Questões</h1>
      <p className="lede">Gere questões no padrão ENADE com IA, revise e salve um arquivo pronto para importar.</p>

      <QuestionGenerator providers={configuredProviders} />
    </main>
  );
}
