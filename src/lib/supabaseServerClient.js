import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

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
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
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
