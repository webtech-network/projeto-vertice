'use client';

import { useEffect, useState } from 'react';
import { Fingerprint, GraduationCap } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabaseBrowserClient';
import { PASSKEYS_ENABLED, isPasskeySupported, describePasskeyError } from '@/lib/passkeys';

// Lucide não traz logos de marca (Google/GitHub foram removidos da lib) —
// SVGs inline com os paths oficiais, um por provedor.
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.9-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

/**
 * Google e GitHub usam o login nativo do Supabase Auth (Opção A —
 * `signInWithOAuth` monta a URL de authorize contra o Kong local e o GoTrue
 * cuida do resto, terminando em `src/app/auth/callback/route.js`). Canvas
 * NÃO passa por aqui — é um link comum pro fluxo já existente
 * (`/api/auth/login` → Canvas → `/oauth2/callback`, que agora faz a ponte
 * pra uma sessão Supabase por baixo — ver esse arquivo pro racional
 * completo).
 *
 * Passkey é diferente dos dois: não é um redirect, é uma ceremony WebAuthn
 * inteira feita client-side por `supabase.auth.signInWithPasskey()` (pede
 * uma credencial descoberta via `navigator.credentials.get()`, verifica
 * contra o GoTrue e já devolve uma sessão pronta). Atrás de
 * NEXT_PUBLIC_PASSKEYS_ENABLED — feature experimental opt-in, API beta do
 * GoTrue (ver supabase/docker-compose.yml) — e escondida também quando o
 * navegador não suporta WebAuthn, pra não oferecer um botão fadado a falhar.
 */
export default function LoginButtons() {
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeyError, setPasskeyError] = useState(null);
  // window.PublicKeyCredential não existe durante SSR — lido só após montar
  // (mesmo padrão do ThemeToggle.jsx pra localStorage), senão o servidor e o
  // client renderizam o botão de forma diferente e o React acusa mismatch
  // de hidratação.
  const [passkeySupported, setPasskeySupported] = useState(false);

  useEffect(() => {
    setPasskeySupported(isPasskeySupported());
  }, []);

  async function signInWith(provider) {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  async function signInWithPasskey() {
    setPasskeyLoading(true);
    setPasskeyError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signInWithPasskey();
      if (error || !data?.session) {
        setPasskeyError(describePasskeyError(error));
        return;
      }
      // Sessão já ficou nos cookies sb-* via o storage do browser client
      // (@supabase/ssr) — navegação cheia (não router.push) pra que o proxy
      // e os Server Components releiam a sessão nova a partir daqui.
      window.location.href = '/';
    } catch (err) {
      setPasskeyError(describePasskeyError(err));
    } finally {
      setPasskeyLoading(false);
    }
  }

  return (
    <div className="login-buttons">
      <button type="button" className="btn btn-lg login-btn-google" onClick={() => signInWith('google')}>
        <GoogleIcon />
        Entrar com Google
      </button>
      <button type="button" className="btn btn-lg login-btn-github" onClick={() => signInWith('github')}>
        <GithubIcon />
        Entrar com GitHub
      </button>
      <a className="btn btn-lg login-btn-canvas" href="/api/auth/login">
        <GraduationCap size={18} strokeWidth={1.8} />
        Entrar com Canvas
      </a>
      {PASSKEYS_ENABLED && passkeySupported && (
        <button
          type="button"
          className="btn btn-ghost btn-lg login-btn-passkey"
          disabled={passkeyLoading}
          onClick={signInWithPasskey}
        >
          <Fingerprint size={18} strokeWidth={1.8} />
          {passkeyLoading ? 'Aguardando passkey…' : 'Entrar com passkey'}
        </button>
      )}
      {passkeyError && (
        <p className="alert alert-error" role="alert">
          {passkeyError}
        </p>
      )}
    </div>
  );
}
