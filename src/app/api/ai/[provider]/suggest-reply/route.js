import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';
import { getProvider } from '@/lib/aiProviders';
import { REPLY_SYSTEM_PROMPT } from '@/lib/aiProviders/replyPrompt';
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

  // aiApiKeys/aiModels ainda vivem no iron-session (migração pra Postgres é Fase 2).
  const session = await getSession();
  const apiKey = session.aiApiKeys?.[providerId];
  if (!apiKey) {
    return NextResponse.json({ error: `Nenhuma chave de API configurada para ${provider.label}.` }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const { subject, sender, message, guidance, customPromptText, customPromptMode } = body || {};
  if (!message || typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'Mensagem original é obrigatória.' }, { status: 400 });
  }

  const systemPrompt = resolvePrompt(REPLY_SYSTEM_PROMPT, customPromptText, customPromptMode);

  try {
    const reply = await provider.suggestReply({
      apiKey,
      model: session.aiModels?.[providerId] || process.env[`${providerId.toUpperCase()}_MODEL`],
      context: { subject, sender, message, guidance },
      systemPrompt,
    });
    return NextResponse.json({ reply });
  } catch (err) {
    const errorMessage = err.response?.data?.error?.message || err.message || 'Falha ao gerar sugestão de resposta.';
    return NextResponse.json({ error: errorMessage }, { status: 502 });
  }
}
