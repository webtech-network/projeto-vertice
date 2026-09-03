import { NextResponse } from 'next/server';
import { exchangeCodeForToken } from '@/lib/canvasOAuth';
import { createClient, getSelf } from '@/lib/canvasClient';
import { createSupabaseAdminClient } from '@/lib/supabaseAdminClient';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';
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
async function upsertCanvasIntegration(admin, { userId, token, profile, canvasBaseUrl }) {
  const { error } = await admin.rpc('upsert_integration_tokens', {
    p_user_id: userId,
    p_provider: 'canvas',
    p_access_token: token.access_token,
    p_refresh_token: token.refresh_token,
    p_provider_user_id: String(token.user.id),
    p_display_name: token.user.name,
    p_avatar_url: profile?.avatar_url ?? null,
    p_access_token_expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
    p_metadata: { base_url: canvasBaseUrl },
  });
  if (error) console.error('Falha ao gravar a integração Canvas:', error.message);
}

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = request.cookies.get('oauth_state')?.value;
  // "Conectar Canvas" a partir de /perfil (usuário já logado via
  // Google/GitHub) em vez de "Entrar com Canvas" a partir de /login — ver
  // src/app/api/auth/login/route.js pra como esse cookie é setado. O
  // redirect_uri cadastrado na Developer Key é fixo (sempre este arquivo),
  // então esse cookie é o único jeito de diferenciar os dois casos aqui.
  const isConnectMode = request.cookies.get('canvas_connect_mode')?.value === '1';
  const baseUrl = getAppBaseUrl();

  function clearOAuthCookies(response) {
    response.cookies.delete('oauth_state');
    response.cookies.delete('canvas_connect_mode');
    return response;
  }

  // Alvo de erro varia pelo modo: quem já está logado e só tentando
  // conectar o Canvas volta pra /perfil com um aviso, não pra /login.
  const errorRedirectTarget = isConnectMode ? '/perfil?tab=plataformas&canvas=erro' : '/login?error=oauth_falhou';

  if (!code || !state || !cookieState || state !== cookieState) {
    const target = isConnectMode ? errorRedirectTarget : '/login?error=state_invalido';
    return clearOAuthCookies(NextResponse.redirect(new URL(target, baseUrl)));
  }

  let token;
  try {
    token = await exchangeCodeForToken(code);
  } catch (err) {
    console.error('Falha no OAuth do Canvas:', err.message);
    return clearOAuthCookies(NextResponse.redirect(new URL(errorRedirectTarget, baseUrl)));
  }

  const canvasBaseUrl = process.env.CANVAS_DOMAIN.replace(/\/$/, '');

  // Best-effort, igual ao fluxo antigo: usado pro e-mail (identidade
  // Supabase, só no modo login) e pro avatar; nada trava se isto falhar.
  let profile = null;
  try {
    const client = createClient({ baseUrl: canvasBaseUrl, token: token.access_token });
    profile = await getSelf(client);
  } catch (err) {
    console.error('Falha ao buscar o perfil do Canvas:', err.message);
  }

  const admin = createSupabaseAdminClient();

  // Modo "conectar": usuário já tem sessão Supabase (Google/GitHub ou até
  // um login Canvas anterior) — só grava a integração nele, sem tocar em
  // identidade/sessão nenhuma. Bem mais simples que o bridge de login
  // abaixo, que só existe pra criar/materializar uma sessão do zero.
  if (isConnectMode) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return clearOAuthCookies(NextResponse.redirect(new URL('/login', baseUrl)));
    }
    await upsertCanvasIntegration(admin, { userId: user.id, token, profile, canvasBaseUrl });
    return clearOAuthCookies(NextResponse.redirect(new URL('/perfil?tab=plataformas&canvas=connected', baseUrl)));
  }

  // E-mail real do Canvas quando disponível; sintético e determinístico
  // (mesmo id do Canvas + mesma instituição = mesmo e-mail sempre) quando
  // não — garante que o mesmo usuário do Canvas sempre mapeia pro mesmo
  // usuário Supabase entre logins, mesmo sem e-mail exposto pela API.
  const email =
    profile?.primary_email ||
    profile?.email ||
    `canvas-${token.user.id}@${new URL(canvasBaseUrl).hostname}.vertice.invalid`;

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
    return clearOAuthCookies(NextResponse.redirect(new URL('/login?error=oauth_falhou', baseUrl)));
  }

  // Grava a integração já aqui — o `id` do usuário Supabase já é conhecido,
  // não precisa esperar o passo client-side de /auth/canvas-session.
  await upsertCanvasIntegration(admin, { userId: supabaseUserId, token, profile, canvasBaseUrl });

  const verifyUrl = new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/verify`);
  verifyUrl.searchParams.set('token', hashedToken);
  verifyUrl.searchParams.set('type', verificationType);
  verifyUrl.searchParams.set('redirect_to', `${baseUrl}/auth/canvas-session`);

  return clearOAuthCookies(NextResponse.redirect(verifyUrl));
}
