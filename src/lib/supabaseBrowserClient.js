import { createBrowserClient } from '@supabase/ssr';

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
    );
  }
  return browserClient;
}
