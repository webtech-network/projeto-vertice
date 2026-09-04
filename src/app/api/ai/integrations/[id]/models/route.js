import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';
import { getProvider } from '@/lib/aiProviders';
import { getAiIntegration } from '@/lib/aiIntegrations';

// Lists the models available to this integration's own already-saved key —
// deliberately requires the key to be configured first (see route.js POST)
// rather than accepting a raw key in the request body, so this can't be
// used to probe an arbitrary key without going through the normal
// save/validate flow.
export async function GET(request, { params }) {
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

  try {
    const models = await provider.listModels(config.apiKey, config.baseUrl);
    return NextResponse.json({ models });
  } catch (err) {
    const message = err.response?.data?.error?.message || err.message || 'Falha ao listar os modelos disponíveis.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
