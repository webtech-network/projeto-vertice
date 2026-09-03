import { NextResponse } from 'next/server';
import { exchangeCodeForToken } from '@/lib/canvasOAuth';
import { createClient, getSelf } from '@/lib/canvasClient';
import { createSupabaseAdminClient } from '@/lib/supabaseAdminClient';
import { getAppBaseUrl } from '@/lib/appUrl';

/**
 * Bridge de login do Canvas (Opção B do plano da Fase 1) — CONFIRMADA como
 * o único caminho viável após o spike: o GoTrue self-hosted v2.189.0 não
 * tem "canvas" na sua lista fixa de provedores OAuth embutidos, e a API de
 * "custom OAuth provider" encontrada no binário é para o GoTrue atuar como
 * *servidor* OAuth pra terceiros (direção oposta), não como *cliente* de um
 * IdP arbitrário.
 *
 * Mecanismo, validado manualmente contra o stack local antes de escrever
 * este código (ver plano):
 *   1. Troca o `code` pelo token do Canvas exatamente como antes (mesma
 *      `canvasOAuth.js`, sem alterações) — isto não muda o
 *      CANVAS_OAUTH_REDIRECT_URI já cadastrado na Developer Key.
 *   2. `supabase.auth.admin.generateLink({ type: 'magiclink', email })`
 *      cria (1º login) ou reencontra (login seguinte) o usuário Supabase
 *      correspondente e devolve `id` + `hashed_token` + `verification_type`
 *      — o `id` já é o user_id definitivo, disponível antes mesmo de
 *      terminar o login, então a integração já pode ser gravada aqui.
 *   3. Redireciona o browser para `GET {SUPABASE_URL}/auth/v1/verify`
 *      (NUNCA para o `action_link` que a própria API devolve — ele vem sem
 *      o prefixo `/auth/v1`, um bug/particularidade desta versão do GoTrue
 *      que faz o Kong devolver 404). O GoTrue então responde com um 303
 *      cujo destino carrega `access_token`/`refresh_token` no *fragmento*
 *      da URL (fluxo implícito) — por isso o próximo salto
 *      (`/auth/canvas-session`) precisa ser uma página client-side: um
 *      fragmento nunca chega ao servidor.
 *
 * `verification_type` varia entre "signup" (e-mail novo) e "magiclink"
 * (e-mail já existente) — confirmado nos dois casos; **nunca** hardcodear
 * "magiclink" aqui, tem que ser sempre o valor devolvido pela API.
 *
 * Limitação conhecida, não resolvida nesta fase: se o mesmo professor mais
 * tarde logar via Google/GitHub com um e-mail diferente do usado aqui,
 * nada os une automaticamente — cada e-mail vira uma conta Supabase
 * separada. Account linking entre provedores fica para uma fase futura.
 */
export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = request.cookies.get('oauth_state')?.value;
  const baseUrl = getAppBaseUrl();

  if (!code || !state || !cookieState || state !== cookieState) {
    const response = NextResponse.redirect(new URL('/login?error=state_invalido', baseUrl));
    response.cookies.delete('oauth_state');
    return response;
  }

  let token;
  try {
    token = await exchangeCodeForToken(code);
  } catch (err) {
    console.error('Falha no login OAuth do Canvas:', err.message);
    const response = NextResponse.redirect(new URL('/login?error=oauth_falhou', baseUrl));
    response.cookies.delete('oauth_state');
    return response;
  }

  const canvasBaseUrl = process.env.CANVAS_DOMAIN.replace(/\/$/, '');

  // Best-effort, igual ao fluxo antigo: usado pro e-mail (identidade
  // Supabase) e pro avatar; login não trava se isto falhar.
  let profile = null;
  try {
    const client = createClient({ baseUrl: canvasBaseUrl, token: token.access_token });
    profile = await getSelf(client);
  } catch (err) {
    console.error('Falha ao buscar o perfil do Canvas:', err.message);
  }

  // E-mail real do Canvas quando disponível; sintético e determinístico
  // (mesmo id do Canvas + mesma instituição = mesmo e-mail sempre) quando
  // não — garante que o mesmo usuário do Canvas sempre mapeia pro mesmo
  // usuário Supabase entre logins, mesmo sem e-mail exposto pela API.
  const email =
    profile?.primary_email ||
    profile?.email ||
    `canvas-${token.user.id}@${new URL(canvasBaseUrl).hostname}.vertice.invalid`;

  const admin = createSupabaseAdminClient();
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { data: { full_name: token.user.name } },
  });

  // O SDK tipa esses campos dentro de `properties`; a API REST crua
  // (usada nos testes manuais que validaram este mecanismo) os devolve no
  // nível raiz — cobrir os dois formatos em vez de assumir um dos dois.
  const hashedToken = linkData?.properties?.hashed_token || linkData?.hashed_token;
  const verificationType = linkData?.properties?.verification_type || linkData?.verification_type;
  const supabaseUserId = linkData?.user?.id || linkData?.id;

  if (linkError || !hashedToken || !verificationType || !supabaseUserId) {
    console.error('Falha ao gerar o link de sessão Supabase para o Canvas:', linkError?.message);
    const response = NextResponse.redirect(new URL('/login?error=oauth_falhou', baseUrl));
    response.cookies.delete('oauth_state');
    return response;
  }

  // Grava a integração já aqui — o `id` do usuário Supabase já é conhecido,
  // não precisa esperar o passo client-side de /auth/canvas-session.
  try {
    const { error: rpcError } = await admin.rpc('upsert_integration_tokens', {
      p_user_id: supabaseUserId,
      p_provider: 'canvas',
      p_access_token: token.access_token,
      p_refresh_token: token.refresh_token,
      p_provider_user_id: String(token.user.id),
      p_display_name: token.user.name,
      p_avatar_url: profile?.avatar_url ?? null,
      p_access_token_expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
      p_metadata: { base_url: canvasBaseUrl },
    });
    if (rpcError) {
      console.error('Falha ao gravar a integração Canvas:', rpcError.message);
    }
  } catch (err) {
    console.error('Falha ao gravar a integração Canvas:', err.message);
  }

  const verifyUrl = new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/verify`);
  verifyUrl.searchParams.set('token', hashedToken);
  verifyUrl.searchParams.set('type', verificationType);
  verifyUrl.searchParams.set('redirect_to', `${baseUrl}/auth/canvas-session`);

  const response = NextResponse.redirect(verifyUrl);
  response.cookies.delete('oauth_state');
  return response;
}
