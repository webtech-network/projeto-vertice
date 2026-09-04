import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';
import { getProvider } from '@/lib/aiProviders';
import { setAiProviderModel } from '@/lib/aiProviderKeys';

function resolveProvider(providerId) {
  try {
    return getProvider(providerId);
  } catch {
    return null;
  }
}

// Mirrors key/route.js's shape, but for the per-provider model *preference*
// (ai_provider_keys.model), not the key itself — a professor pode escolher
// um modelo não-default sem isso nunca ser confundido com armazenamento de
// credencial.
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

  const ok = await setAiProviderModel(user.id, providerId, model);
  if (!ok) {
    return NextResponse.json({ error: 'Configure uma chave de API antes de escolher um modelo.' }, { status: 409 });
  }

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

  // Sem chave configurada não há linha nenhuma pra limpar — não é erro,
  // simplesmente não há nada a fazer (ok:true de qualquer forma).
  await setAiProviderModel(user.id, providerId, null);

  return NextResponse.json({ ok: true });
}
