import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';
import { getProvider } from '@/lib/aiProviders';

function resolveProvider(providerId) {
  try {
    return getProvider(providerId);
  } catch {
    return null;
  }
}

// Mirrors key/route.js's shape, but for the per-provider model *preference*
// (session.aiModels), not the key itself — a separate session field so a
// professor can pick a non-default model without that ever being confused
// with credential storage.
export async function POST(request, { params }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sessão inválida. Faça login novamente.' }, { status: 401 });
  }

  const { provider: providerId } = await params;
  if (!resolveProvider(providerId)) {
    return NextResponse.json({ error: 'Provedor de IA desconhecido.' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const { model } = body || {};
  if (!model || typeof model !== 'string') {
    return NextResponse.json({ error: 'Modelo é obrigatório.' }, { status: 400 });
  }

  // aiModels ainda vive no iron-session (migração pra Postgres é Fase 2).
  const session = await getSession();
  session.aiModels = { ...session.aiModels, [providerId]: model };
  await session.save();

  return NextResponse.json({ ok: true });
}

// Resets the provider back to its default model (removes the override).
export async function DELETE(request, { params }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sessão inválida. Faça login novamente.' }, { status: 401 });
  }

  const { provider: providerId } = await params;
  if (!resolveProvider(providerId)) {
    return NextResponse.json({ error: 'Provedor de IA desconhecido.' }, { status: 404 });
  }

  const session = await getSession();
  if (session.aiModels && providerId in session.aiModels) {
    const { [providerId]: _removed, ...rest } = session.aiModels;
    session.aiModels = rest;
    await session.save();
  }

  return NextResponse.json({ ok: true });
}
