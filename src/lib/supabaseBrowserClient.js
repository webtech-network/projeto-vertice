import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseStorageKey } from '@/lib/supabaseUrl';
import { PASSKEYS_ENABLED } from '@/lib/passkeys';

/**
 * Client Supabase para Client Components — usa a ANON_KEY (pública) e o
 * fluxo PKCE de cookies do @supabase/ssr. RLS garante que cada usuário só
 * enxerga suas próprias linhas; nunca usar esse client para tabelas sem RLS
 * confiável (ex.: `integrations`, que não tem nenhuma policy pra
 * authenticated de propósito — ver supabase/volumes/db/init/05_rls.sql).
 *
 * Memoizado num singleton de módulo — os repos (tasksRepo.js/projectsRepo.js/
 * workspacesRepo.js) chamam isso a cada operação; recriar o client toda vez
 * seria desperdício sem motivo (o @supabase/ssr não faz esse cache sozinho).
 */
let browserClient = null;

export function createSupabaseBrowserClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        // Explícito, não deixado pro default (que já dá o mesmo valor hoje,
        // via NEXT_PUBLIC_SUPABASE_URL) — ver getSupabaseStorageKey() pra
        // saber por que os clients server-side também fixam isso.
        cookieOptions: { name: getSupabaseStorageKey() },
        auth: {
          experimental: {
            // Embute `sb_flow_id` na redirectTo do signInWithOAuth (Google/
            // GitHub, ver LoginButtons.jsx) — sem isso, o
            // src/app/auth/callback/route.js (server-side, não tem acesso a
            // window.location pra resolver o flow id sozinho) cai no
            // fallback de "verifier mais recente" via chave legada, que na
            // prática falhava com "PKCE code verifier not found in storage"
            // (confirmado ao vivo: LoginButtons.jsx cria vários flows
            // pendentes ao longo de uma sessão de testes, e o fallback não
            // estava resolvendo pro flow certo). Com a flag, o flow id vem
            // explícito na URL e a rota de callback já sabe usá-lo.
            appendPkceFlowIdToRedirects: true,
            // Libera `auth.signInWithPasskey`/`registerPasskey`/`auth.passkey.*`
            // (ver LoginButtons.jsx/PasskeyManager.jsx) — sem isso, o
            // supabase-js lança um erro descritivo em qualquer chamada desses
            // métodos, mesmo com o GOTRUE_WEBAUTHN_ENABLED do stack ligado.
            // Mesma flag pública que decide se a UI de passkey aparece (ver
            // src/lib/passkeys.js) — não faz sentido as duas divergirem.
            passkey: PASSKEYS_ENABLED,
          },
        },
      },
    );
  }
  return browserClient;
}
