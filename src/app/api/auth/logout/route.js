import { NextResponse } from 'next/server';
import { getAppBaseUrl } from '@/lib/appUrl';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';

/**
 * Não revoga mais o token do Canvas aqui (a revogação de
 * `canvasOAuth.js`'s `revokeToken` dependia de `session.accessToken`, que
 * só existia sob o modelo antigo de sessão-Canvas-única) — o token do
 * Canvas hoje é uma *integração* independente da sessão de login, e
 * revogar essa integração ao deslogar do app misturaria dois conceitos que
 * a Fase 1 deliberadamente separou. Desconectar uma integração específica
 * é uma ação própria, futura, em /perfil — não parte do logout.
 */
export async function POST() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/login', getAppBaseUrl()), { status: 303 });
}
