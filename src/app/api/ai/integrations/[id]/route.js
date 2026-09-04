import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';
import { getProvider } from '@/lib/aiProviders';
import { listAiIntegrations, updateAiIntegration, deleteAiIntegration } from '@/lib/aiIntegrations';

// PATCH aceita atualização parcial: qualquer campo omitido do body não é
// alterado (ver update_ai_integration — null nos parâmetros nullable
// significa "não mexe"). Revalida a chave junto à API só quando `apiKey`
// vem preenchido no body, igual ao fluxo antigo de key/route.js.
export async function PATCH(request, { params }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sessão inválida. Faça login novamente.' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
  }

  if (body.apiKey) {
    // Precisa saber o provider da integração pra validar a chave contra o
    // driver certo — não vem no body do PATCH (só campos que mudaram). Usa
    // listAiIntegrations (não getAiIntegration) porque essa leitura tem que
    // funcionar mesmo pra uma integração inativa (ex.: reativando e trocando
    // a chave na mesma edição) — getAiIntegration só retorna integrações
    // ativas, de propósito, pra geração/listagem de modelos.
    const current = (await listAiIntegrations(user.id)).find((i) => i.id === id);
    if (!current) {
      return NextResponse.json({ error: 'Integração não encontrada.' }, { status: 404 });
    }
    const provider = getProvider(current.provider);
    const result = await provider.validateApiKey(body.apiKey, body.baseUrl ?? current.baseUrl);
    if (!result.valid) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
  }

  try {
    const ok = await updateAiIntegration(user.id, id, body);
    if (!ok) {
      return NextResponse.json({ error: 'Integração não encontrada.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err.code === '23505') {
      return NextResponse.json({ error: 'Já existe uma integração com esse nome.' }, { status: 409 });
    }
    throw err;
  }
}

export async function DELETE(request, { params }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sessão inválida. Faça login novamente.' }, { status: 401 });
  }

  const { id } = await params;
  await deleteAiIntegration(user.id, id);
  return NextResponse.json({ ok: true });
}
