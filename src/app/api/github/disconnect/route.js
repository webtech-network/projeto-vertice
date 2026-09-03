import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';
import { revokeToken } from '@/lib/githubOAuth';

// The durable copy of the token lives in the browser's IndexedDB, not the
// session — this route's job is just best-effort revocation on GitHub's
// side; GithubConnection.jsx clears its own IndexedDB record regardless of
// whether this call succeeds.
export async function POST(request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sessão inválida. Faça login novamente.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const accessToken = body?.accessToken;
  if (accessToken) {
    await revokeToken(accessToken);
  }

  return NextResponse.json({ ok: true });
}
