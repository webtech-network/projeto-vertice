import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';
import { getProvider } from '@/lib/aiProviders';
import { listAiIntegrations, createAiIntegration } from '@/lib/aiIntegrations';

function resolveProvider(providerId) {
  try {
    return getProvider(providerId);
  } catch {
    return null;
  }
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sessão inválida. Faça login novamente.' }, { status: 401 });
  }

  const integrations = await listAiIntegrations(user.id);
  return NextResponse.json({ integrations });
}

export async function POST(request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sessão inválida. Faça login novamente.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const { provider: providerId, name, apiKey, baseUrl } = body || {};

  const provider = resolveProvider(providerId);
  if (!provider) {
    return NextResponse.json({ error: 'Provedor de IA desconhecido.' }, { status: 404 });
  }
  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Nome da integração é obrigatório.' }, { status: 400 });
  }
  if (!apiKey || typeof apiKey !== 'string') {
    return NextResponse.json({ error: 'Chave de API é obrigatória.' }, { status: 400 });
  }

  const result = await provider.validateApiKey(apiKey, baseUrl);
  if (!result.valid) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  try {
    const id = await createAiIntegration(user.id, { ...body, provider: providerId, name: name.trim() });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    if (err.code === '23505') {
      return NextResponse.json({ error: 'Já existe uma integração com esse nome.' }, { status: 409 });
    }
    throw err;
  }
}
