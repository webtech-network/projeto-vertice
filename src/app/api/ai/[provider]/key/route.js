import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';
import { getProvider } from '@/lib/aiProviders';
import { saveAiProviderKey, deleteAiProviderKey } from '@/lib/aiProviderKeys';

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

  if (!apiKey || typeof apiKey !== 'string') {
    return NextResponse.json({ error: 'Chave de API é obrigatória.' }, { status: 400 });
  }

  const result = await provider.validateApiKey(apiKey);
  if (!result.valid) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await saveAiProviderKey(user.id, providerId, apiKey);

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

  // Apaga a chave e o modelo junto (mesma linha na tabela) — ver o
  // comentário em src/lib/aiProviderKeys.js.
  await deleteAiProviderKey(user.id, providerId);

  return NextResponse.json({ ok: true });
}
