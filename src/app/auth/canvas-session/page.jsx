'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabaseBrowserClient';

/**
 * Último salto do bridge de login do Canvas (ver `src/app/oauth2/callback/route.js`).
 * O GoTrue devolve `access_token`/`refresh_token` no *fragmento* da URL
 * (fluxo implícito, não PKCE) — um fragmento nunca chega ao servidor, então
 * essa etapa só pode ser resolvida no client.
 */
export default function CanvasSessionPage() {
  const router = useRouter();
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = hash.get('access_token');
    const refreshToken = hash.get('refresh_token');

    if (!accessToken || !refreshToken) {
      setErrored(true);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ error }) => {
      if (error) {
        console.error('Falha ao materializar a sessão do Canvas:', error.message);
        setErrored(true);
        return;
      }
      router.replace('/');
    });
  }, [router]);

  if (errored) {
    router.replace('/login?error=oauth_falhou');
    return null;
  }

  return (
    <main className="login-page">
      <div className="login-page-content">
        <p>Entrando...</p>
      </div>
    </main>
  );
}
