import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';
import { getProvider } from '@/lib/aiProviders';
import { getConfiguredIntegrations, getAiIntegration } from '@/lib/aiIntegrations';
import { STUDENT_ANALYSIS_SYSTEM_PROMPT, buildStudentAnalysisUserMessage } from '@/lib/aiProviders/studentAnalysisPrompt';
import { buildStudentAnalysisPayload } from '@/lib/studentEngagement/studentAnalysisPayload';
import { resolvePrompt } from '@/lib/promptResolution';

// Analisa a "Situação do Aluno" usando a integração de IA marcada como padrão
// (Perfil → Plataformas de IA) — resolvida no servidor, já que a UI não tem
// seletor de modelo. Ao contrário das rotas [id]/..., não recebe id na URL.
// O que chega ao modelo é apenas o payload anônimo (ver
// src/lib/studentEngagement/studentAnalysisPayload.js), nunca nome/e-mail/id.
export async function POST(request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sessão inválida. Faça login novamente.' }, { status: 401 });
  }

  const integrations = await getConfiguredIntegrations(user.id);
  const defaultIntegration = integrations.find((i) => i.isDefault) || integrations[0];
  if (!defaultIntegration) {
    return NextResponse.json(
      { error: 'Nenhuma integração de IA configurada. Configure uma em Perfil → Plataformas de IA.' },
      { status: 404 },
    );
  }

  const config = await getAiIntegration(user.id, defaultIntegration.id);
  if (!config) {
    return NextResponse.json(
      { error: 'A integração padrão não está ativa ou não tem chave de API configurada.' },
      { status: 404 },
    );
  }
  const provider = getProvider(config.provider);

  const body = await request.json().catch(() => null);
  const { riskResult, riskQuartiles, customPromptText, customPromptMode } = body || {};
  if (!riskResult || typeof riskResult !== 'object') {
    return NextResponse.json({ error: 'Dados da situação do aluno são obrigatórios.' }, { status: 400 });
  }

  const anonymized = buildStudentAnalysisPayload({ riskResult, riskQuartiles });
  const text = buildStudentAnalysisUserMessage(anonymized);

  const capabilityPrompt = resolvePrompt(STUDENT_ANALYSIS_SYSTEM_PROMPT, customPromptText, customPromptMode);
  const systemPrompt = resolvePrompt(capabilityPrompt, config.systemPrompt, config.systemPromptMode);

  try {
    const analysis = await provider.analyzeStudent({
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
    return NextResponse.json({ analysis });
  } catch (err) {
    const errorMessage = err.response?.data?.error?.message || err.message || 'Falha ao analisar a situação do aluno.';
    return NextResponse.json({ error: errorMessage }, { status: 502 });
  }
}
