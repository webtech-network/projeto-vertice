import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';

// Single-use handoff, same pattern as /api/github/pending-connection: returns
// the connection stashed by google/oauth2/callback (if any) and immediately
// clears it from the session.
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sessão inválida. Faça login novamente.' }, { status: 401 });
  }

  // googlePendingConnection ainda vive no iron-session — handoff único do callback OAuth.
  const session = await getSession();
  const connection = session.googlePendingConnection || null;
  if (connection) {
    delete session.googlePendingConnection;
    await session.save();
  }

  return NextResponse.json({ connection });
}
