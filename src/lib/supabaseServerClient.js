import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseServerUrl, getSupabaseStorageKey } from '@/lib/supabaseUrl';

/**
 * Client Supabase para Server Components, Route Handlers e o proxy — lê/
 * escreve os cookies `sb-*` via next/headers. `cookies()` é assíncrono no
 * Next 16, por isso esta função também é.
 *
 * Chamado a partir de um Server Component (não um Route Handler), `setAll`
 * pode lançar — Next não permite escrever cookies fora de uma Server Action
 * ou Route Handler. O try/catch é intencional: nesse caso o middleware
 * (`src/proxy.js`) já cuida do refresh de sessão a cada request, então um
 * Server Component não precisar reescrever o cookie não quebra nada.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    getSupabaseServerUrl(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      // Sem isso, o storageKey seria derivado de getSupabaseServerUrl() (que
      // no Docker é a URL interna, hostname diferente do público) — ver
      // getSupabaseStorageKey().
      cookieOptions: { name: getSupabaseStorageKey() },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Chamado de um Server Component — ver comentário acima.
          }
        },
      },
    },
  );
}
