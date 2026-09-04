import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';
import { getProvider } from '@/lib/aiProviders';
import { getAiProviderKey } from '@/lib/aiProviderKeys';
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
  const { specs, customPromptText, customPromptMode } = body || {};

  const specsError = validateSpecs(specs);
  if (specsError) {
    return NextResponse.json({ error: specsError }, { status: 400 });
  }

  const systemPrompt = resolvePrompt(SYSTEM_PROMPT, customPromptText, customPromptMode);

  let quiz;
  try {
    quiz = await provider.generateQuestions({
      apiKey: config.apiKey,
      model: config.model || process.env[`${providerId.toUpperCase()}_MODEL`],
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
