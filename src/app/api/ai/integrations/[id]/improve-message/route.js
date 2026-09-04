import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';
import { getProvider } from '@/lib/aiProviders';
import { getAiIntegration } from '@/lib/aiIntegrations';
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

  const { id } = await params;
  const config = await getAiIntegration(user.id, id);
  if (!config) {
    return NextResponse.json({ error: 'Integração não encontrada ou sem chave de API configurada.' }, { status: 404 });
  }
  const provider = getProvider(config.provider);

  const body = await request.json().catch(() => null);
  const { text, customPromptText, customPromptMode } = body || {};
  if (!text || typeof text !== 'string' || !text.trim()) {
    return NextResponse.json({ error: 'Texto da mensagem é obrigatório.' }, { status: 400 });
  }

  const capabilityPrompt = resolvePrompt(IMPROVE_SYSTEM_PROMPT, customPromptText, customPromptMode);
  const systemPrompt = resolvePrompt(capabilityPrompt, config.systemPrompt, config.systemPromptMode);

  try {
    const improved = await provider.improveMessage({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      presencePenalty: config.presencePenalty,
      frequencyPenalty: config.frequencyPenalty,
      text,
      systemPrompt,
    });
    return NextResponse.json({ improved });
  } catch (err) {
    const errorMessage = err.response?.data?.error?.message || err.message || 'Falha ao melhorar a mensagem.';
    return NextResponse.json({ error: errorMessage }, { status: 502 });
  }
}
