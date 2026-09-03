'use client';

import { createSupabaseBrowserClient } from '@/lib/supabaseBrowserClient';

/**
 * Google e GitHub usam o login nativo do Supabase Auth (Opção A —
 * `signInWithOAuth` monta a URL de authorize contra o Kong local e o GoTrue
 * cuida do resto, terminando em `src/app/auth/callback/route.js`). Canvas
 * NÃO passa por aqui — é um link comum pro fluxo já existente
 * (`/api/auth/login` → Canvas → `/oauth2/callback`, que agora faz a ponte
 * pra uma sessão Supabase por baixo — ver esse arquivo pro racional
 * completo).
 */
export default function LoginButtons() {
  async function signInWith(provider) {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <div className="login-buttons">
      <button type="button" className="btn btn-primary btn-lg" onClick={() => signInWith('google')}>
        Entrar com Google
      </button>
      <button type="button" className="btn btn-primary btn-lg" onClick={() => signInWith('github')}>
        Entrar com GitHub
      </button>
      <a className="btn btn-secondary btn-lg" href="/api/auth/login">
        Entrar com Canvas
      </a>
    </div>
  );
}
