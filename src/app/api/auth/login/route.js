import { NextResponse } from 'next/server';
import { getAuthorizeUrl } from '@/lib/canvasOAuth';

/**
 * Único iniciador do handshake OAuth do Canvas — usado tanto por "Entrar
 * com Canvas" em /login (usuário ainda sem sessão) quanto por "Conectar
 * Canvas" em /perfil (usuário já logado via Google/GitHub, só adicionando a
 * integração). `?connect=1` marca o segundo caso via um cookie que
 * `src/app/oauth2/callback/route.js` lê pra decidir entre materializar uma
 * sessão nova (login) ou só gravar a integração no usuário atual (conectar)
 * — não dá pra diferenciar por rota própria porque o redirect_uri cadastrado
 * na Developer Key do Canvas é fixo, sempre /oauth2/callback.
 */
export async function GET(request) {
  const isConnectMode = new URL(request.url).searchParams.get('connect') === '1';
  const state = crypto.randomUUID();
  const response = NextResponse.redirect(getAuthorizeUrl(state));
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 300,
    path: '/',
  };
  response.cookies.set('oauth_state', state, cookieOptions);
  if (isConnectMode) {
    response.cookies.set('canvas_connect_mode', '1', cookieOptions);
  }
  return response;
}
