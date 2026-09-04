import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';
import { getProvider } from '@/lib/aiProviders';
import { getAiProviderKey } from '@/lib/aiProviderKeys';

// Lists the models available to the professor's own already-saved key —
// deliberately requires the key to be configured first (see key/route.js)
// rather than accepting a raw key in the request body, so this can't be used
// to probe an arbitrary key without going through the normal save/validate
// flow.
export async function GET(request, { params }) {
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

  try {
    const models = await provider.listModels(config.apiKey);
    return NextResponse.json({ models });
  } catch (err) {
    const message = err.response?.data?.error?.message || err.message || 'Falha ao listar os modelos disponíveis.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
