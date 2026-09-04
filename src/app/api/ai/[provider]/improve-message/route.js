import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';
import { getProvider } from '@/lib/aiProviders';
import { getAiProviderKey } from '@/lib/aiProviderKeys';
import { IMPROVE_SYSTEM_PROMPT } from '@/lib/aiProviders/improvePrompt';
import { resolvePrompt } from '@/lib/promptResolution';

export async function POST(request, { params }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sessão inválida. Faça login novamente.' }, { status: 401 });
  }

  const { provider: providerId } = await params;
  let provider;
  try {
    provider = getProvider(providerId);
  } catch {
    return NextResponse.json({ error: 'Provedor de IA desconhecido.' }, { status: 404 });
  }

  const config = await getAiProviderKey(user.id, providerId);
  if (!config) {
    return NextResponse.json({ error: `Nenhuma chave de API configurada para ${provider.label}.` }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const { text, customPromptText, customPromptMode } = body || {};
  if (!text || typeof text !== 'string' || !text.trim()) {
    return NextResponse.json({ error: 'Texto da mensagem é obrigatório.' }, { status: 400 });
  }

  const systemPrompt = resolvePrompt(IMPROVE_SYSTEM_PROMPT, customPromptText, customPromptMode);

  try {
    const improved = await provider.improveMessage({
      apiKey: config.apiKey,
      model: config.model || process.env[`${providerId.toUpperCase()}_MODEL`],
      text,
      systemPrompt,
    });
    return NextResponse.json({ improved });
  } catch (err) {
    const errorMessage = err.response?.data?.error?.message || err.message || 'Falha ao melhorar a mensagem.';
    return NextResponse.json({ error: errorMessage }, { status: 502 });
  }
}
