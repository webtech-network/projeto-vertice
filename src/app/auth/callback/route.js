import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';
import { getAppBaseUrl } from '@/lib/appUrl';

/**
 * Callback universal do `supabase.auth.signInWithOAuth()` — cobre Google e
 * GitHub (login nativo do GoTrue). Canvas NÃO passa por aqui — ver
 * `src/app/oauth2/callback/route.js` e a nota "Canvas como provedor de
 * login" no plano da Fase 1.
 *
 * NÃO grava nada em `public.integrations` aqui — confirmado ao vivo que
 * `session.provider_token` do login (escopo `email profile`/`user:email`)
 * não é útil pra chamar a API do provedor de verdade (sem refresh token,
 * escopo insuficiente pra Drive/repos) e criaria uma linha enganosa,
 * sugerindo uma conexão funcional que não existe. `auth.identities` do
 * próprio Supabase já registra "este login está vinculado" — a conexão de
 * verdade (escopo amplo, com refresh) continua sendo o fluxo dedicado
 * existente em /perfil (`githubOAuth.js`/`googleOAuth.js`, intocados).
 * Canvas é diferente: o login *é* a única forma de obter acesso funcional
 * à API, por isso o bridge em `oauth2/callback/route.js` grava a
 * integração ali.
 */
export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  // @supabase/auth-js >=2.x guarda o code_verifier do PKCE por flow
  // (cookie `sb-<ref>-auth-token-flow-<id>-code-verifier`), não mais numa
  // chave fixa única — `signInWithOAuth` embute esse id como `sb_flow_id`
  // na própria `redirectTo` quando `auth.experimental.appendPkceFlowIdToRedirects`
  // está ligado (ver supabaseBrowserClient.js). No navegador o SDK lê isso
  // sozinho de `window.location.href`; aqui, num Route Handler server-side,
  // precisa ser passado explicitamente — é o padrão documentado pelo
  // próprio SDK para "server-side callback handler".
  const flowId = url.searchParams.get('sb_flow_id');
  const baseUrl = getAppBaseUrl();

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=oauth_falhou', baseUrl));
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);

  if (error || !data?.session || !data?.user) {
    console.error('Falha ao trocar o código OAuth por sessão Supabase:', error?.message);
    return NextResponse.redirect(new URL('/login?error=oauth_falhou', baseUrl));
  }

  return NextResponse.redirect(new URL('/', baseUrl));
}
