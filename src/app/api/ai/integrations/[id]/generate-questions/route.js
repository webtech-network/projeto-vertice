import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';
import { getProvider } from '@/lib/aiProviders';
import { getAiIntegration } from '@/lib/aiIntegrations';
import { validateStructural, createSchemaValidator } from '@/lib/quizValidation';
import quizSchema from '@/lib/quiz.schema.json';
import { SYSTEM_PROMPT } from '@/lib/aiProviders/shared';
import { resolvePrompt } from '@/lib/promptResolution';

const NIVEIS = ['baixo', 'intermediario', 'alto'];
const TIPOS = ['RU', 'CM', 'AR'];

function validateSpecs(specs) {
  if (!Array.isArray(specs) || specs.length === 0) {
    return 'É necessário informar ao menos uma questão.';
  }
  for (const spec of specs) {
    if (!spec || typeof spec.tema !== 'string' || !spec.tema.trim()) {
      return 'Cada questão precisa de um tema.';
    }
    if (!Number.isInteger(spec.quantidade) || spec.quantidade < 1) {
      return `Quantidade inválida para o tema "${spec.tema}".`;
    }
    if (!NIVEIS.includes(spec.nivel)) {
      return `Nível inválido: ${spec.nivel}.`;
    }
    if (!TIPOS.includes(spec.tipo)) {
      return `Tipo inválido: ${spec.tipo}.`;
    }
  }
  return null;
}

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
  const { specs, customPromptText, customPromptMode } = body || {};

  const specsError = validateSpecs(specs);
  if (specsError) {
    return NextResponse.json({ error: specsError }, { status: 400 });
  }

  // Duas camadas: prompt padrão da capacidade + prompt customizado global
  // (existente hoje), depois o prompt próprio da integração por cima
  // (novo — ver public.ai_integrations.system_prompt/system_prompt_mode).
  const capabilityPrompt = resolvePrompt(SYSTEM_PROMPT, customPromptText, customPromptMode);
  const systemPrompt = resolvePrompt(capabilityPrompt, config.systemPrompt, config.systemPromptMode);

  let quiz;
  try {
    quiz = await provider.generateQuestions({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      presencePenalty: config.presencePenalty,
      frequencyPenalty: config.frequencyPenalty,
      specs,
      systemPrompt,
    });
  } catch (err) {
    const message = err.response?.data?.error?.message || err.message || 'Falha ao gerar questões.';
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const structural = validateStructural(quiz);
  if (!structural.valid) {
    return NextResponse.json(
      { error: `${provider.label} retornou questões inválidas.`, details: structural.errors },
      { status: 502 },
    );
  }

  const checkSchema = createSchemaValidator(quizSchema);
  const warnings = checkSchema(quiz);

  return NextResponse.json({ quiz, warnings });
}
