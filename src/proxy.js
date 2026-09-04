import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getAppBaseUrl } from '@/lib/appUrl';
import { getSupabaseServerUrl, getSupabaseStorageKey } from '@/lib/supabaseUrl';

/**
 * Gate de rota da Fase 1 — sessão Supabase (login: Google/GitHub/Canvas),
 * substituindo o antigo `iron-session`/`isSessionValid` (só Canvas). Usa
 * `getUser()`, não `getSession()`: revalida o JWT contra o GoTrue a cada
 * request em vez de confiar num cookie potencialmente stale — é a
 * recomendação oficial do Supabase para middleware/proxy.
 *
 * O refresh proativo de *token de API do Canvas* (que existia aqui antes,
 * com margem de 5 min) não faz mais sentido neste arquivo: "sessão do app"
 * (Supabase) e "capacidade de chamar a API do Canvas" (tabela
 * `integrations`, tokens cifrados no Vault) são coisas desacopladas agora.
 * Esse refresh vira responsabilidade de quem efetivamente chama
 * `canvasClient.js`, sob demanda — não deste gate genérico.
 */
export async function proxy(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    getSupabaseServerUrl(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      // Sem isso, o storageKey seria derivado de getSupabaseServerUrl() (que
      // no Docker é a URL interna, hostname diferente do público) — o
      // proxy nunca acharia o cookie de sessão que o navegador seta, e todo
      // request autenticado cairia em "sem usuário" mesmo com sessão válida
      // (bug real encontrado ao vivo). Ver getSupabaseStorageKey().
      cookieOptions: { name: getSupabaseStorageKey() },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const isApi = request.nextUrl.pathname.startsWith('/api/');
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    if (isApi) {
      return NextResponse.json({ error: 'Sessão inválida. Faça login novamente.' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', getAppBaseUrl()));
  }

  return response;
}

export const config = {
  matcher: [
    '/',
    '/courses/:path*',
    '/api/canvas/:path*',
    '/questoes/:path*',
    '/api/ai/:path*',
    '/perfil/:path*',
    '/mensagens/:path*',
    '/tarefas/:path*',
    '/api/dashboard/:path*',
    '/tutorial/:path*',
    '/sobre/:path*',
    '/api/github/:path*',
    '/github/:path*',
    '/api/google/:path*',
    '/google/:path*',
  ],
};
