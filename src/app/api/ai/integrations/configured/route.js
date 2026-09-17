import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';
import { getConfiguredIntegrations } from '@/lib/aiIntegrations';

// Client-fetchable mirror of getConfiguredIntegrations(user.id) — the
// active-integrations-with-a-key subset (no secrets) that server components
// like mensagens/page.jsx and alunos/page.jsx already pass to
// ComposeMessage/MessageList/StudentReport. CourseWorkspaceTabs.jsx needs the
// same list from a client component, so it's exposed here instead of
// duplicating the filter/shape logic. A static route, so it's matched before
// the sibling [id]/route.js for any other integration id.
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sessão inválida. Faça login novamente.' }, { status: 401 });
  }

  const integrations = await getConfiguredIntegrations(user.id);
  return NextResponse.json({ integrations });
}
