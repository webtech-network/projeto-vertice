import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';

// Single-use handoff: returns the connection stashed by github/oauth2/callback
// (if any) and immediately clears it from the session — GithubConnection.jsx
// calls this once after being redirected back with ?github=connected, then
// persists the result into IndexedDB itself. A direct hit with nothing
// pending (e.g. reloading /perfil later) just returns { connection: null }.
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sessão inválida. Faça login novamente.' }, { status: 401 });
  }

  // githubPendingConnection ainda vive no iron-session — handoff único do callback OAuth.
  const session = await getSession();
  const connection = session.githubPendingConnection || null;
  if (connection) {
    delete session.githubPendingConnection;
    await session.save();
  }

  return NextResponse.json({ connection });
}
