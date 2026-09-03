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

export async function POST(request, { params }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sessão inválida. Faça login novamente.' }, { status: 401 });
  }

  const { provider: providerId } = await params;
  const provider = resolveProvider(providerId);
  if (!provider) {
    return NextResponse.json({ error: 'Provedor de IA desconhecido.' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const { apiKey } = body || {};

  // aiApiKeys ainda vive no iron-session (migração pra Postgres é Fase 2).
  const session = await getSession();

  if (!apiKey || typeof apiKey !== 'string') {
    return NextResponse.json({ error: 'Chave de API é obrigatória.' }, { status: 400 });
  }

  const result = await provider.validateApiKey(apiKey);
  if (!result.valid) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  session.aiApiKeys = { ...session.aiApiKeys, [providerId]: apiKey };
  await session.save();

  return NextResponse.json({ ok: true });
}

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
  let changed = false;

  if (session.aiApiKeys && providerId in session.aiApiKeys) {
    const { [providerId]: _removed, ...rest } = session.aiApiKeys;
    session.aiApiKeys = rest;
    changed = true;
  }

  // A model preference with no key behind it is meaningless — clear it too
  // so a later reconfigured key doesn't silently inherit a stale choice.
  if (session.aiModels && providerId in session.aiModels) {
    const { [providerId]: _removedModel, ...restModels } = session.aiModels;
    session.aiModels = restModels;
    changed = true;
  }

  if (changed) {
    await session.save();
  }

  return NextResponse.json({ ok: true });
}
