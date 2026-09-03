import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';
import { createSupabaseAdminClient } from '@/lib/supabaseAdminClient';

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sessão inválida. Faça login novamente.' }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc('delete_integration_tokens', { p_user_id: user.id, p_provider: 'canvas' });
  if (error) {
    return NextResponse.json({ error: 'Falha ao desconectar o Canvas.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
