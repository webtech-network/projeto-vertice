import { Suspense } from 'react';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';
import { getDisplayName } from '@/lib/supabaseUserDisplay';
import { listProviders } from '@/lib/aiProviders';
import { listAiProviderKeys } from '@/lib/aiProviderKeys';
import ProfileTabs from '@/components/ProfileTabs';

export default async function PerfilPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null; // proxy already redirects unauthenticated requests to /login
  }

  const configuredKeys = await listAiProviderKeys(user.id);

  const providers = listProviders().map((provider) => ({
    ...provider,
    hasApiKey: Boolean(configuredKeys[provider.id]),
    currentModel: configuredKeys[provider.id]?.model || null,
  }));

  return (
    <main className="page">
      {/* ProfileTabs renders its own page-header-row (h1 "Configurações" +
          the compact SettingsSaveLoad widget side by side) instead of this
          file rendering a plain <h1>, since SettingsSaveLoad needs to be
          able to switch tabs (jumping to "Plataformas associadas" when
          Google Drive isn't connected yet) — that requires the tab state
          that only lives inside the client-side ProfileTabs. It also reads
          the initial tab from useSearchParams() (the GitHub/Google OAuth
          callbacks redirect to ?tab=plataformas) — Next.js requires any
          useSearchParams() consumer to sit inside a Suspense boundary. */}
      <Suspense fallback={null}>
        {/* baseUrl fica null até a Fase 2 popular a partir de uma
            integração Canvas ativa (public.integrations) — sem isso hoje,
            "Conta" só mostra o campo em branco, não quebra. */}
        <ProfileTabs userName={getDisplayName(user)} baseUrl={null} providers={providers} />
      </Suspense>
    </main>
  );
}
