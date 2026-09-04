import { createSupabaseServerClient } from '@/lib/supabaseServerClient';
import { getConfiguredIntegrations } from '@/lib/aiIntegrations';
import QuestionGenerator from '@/components/QuestionGenerator';

export default async function QuestoesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null; // proxy already redirects unauthenticated requests to /login
  }

  const configuredIntegrations = await getConfiguredIntegrations(user.id);

  return (
    <main className="page">
      <h1>Questões</h1>
      <p className="lede">Gere questões no padrão ENADE com IA, revise e salve um arquivo pronto para importar.</p>

      <QuestionGenerator integrations={configuredIntegrations} />
    </main>
  );
}
