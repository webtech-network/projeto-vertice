import { createSupabaseAdminClient } from '@/lib/supabaseAdminClient';
import { listProviders } from '@/lib/aiProviders';

/**
 * Lê a chave de API (já decifrada do Vault) + modelo escolhido de um
 * usuário pra um provedor de IA, via as funções SECURITY DEFINER (ver
 * supabase/volumes/db/manual/08_ai_provider_keys.sql) — nunca lê
 * `public.ai_provider_keys` direto, essa tabela não tem nenhuma policy de
 * RLS pra authenticated de propósito (mesmo padrão de
 * src/lib/canvasIntegration.js pra `integrations`). `null` quando o usuário
 * não tem chave configurada pra esse provedor.
 */
export async function getAiProviderKey(userId, provider) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc('get_ai_provider_key', { p_user_id: userId, p_provider: provider });
  if (error) throw error;
  const row = data?.[0];
  if (!row?.api_key) return null;
  return { apiKey: row.api_key, model: row.model || null };
}

export async function saveAiProviderKey(userId, provider, apiKey) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc('upsert_ai_provider_key', {
    p_user_id: userId,
    p_provider: provider,
    p_api_key: apiKey,
  });
  if (error) throw error;
}

// Apaga a chave e o modelo junto — a linha inteira some (ver o comentário em
// 08_ai_provider_keys.sql sobre `model` viver na mesma linha da chave).
export async function deleteAiProviderKey(userId, provider) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc('delete_ai_provider_key', { p_user_id: userId, p_provider: provider });
  if (error) throw error;
}

// `model: null` limpa a preferência (volta pro default do provedor).
// Retorna false quando não há chave configurada pra esse provedor — o
// chamador (model/route.js) trata isso como erro.
export async function setAiProviderModel(userId, provider, model) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc('set_ai_provider_model', {
    p_user_id: userId,
    p_provider: provider,
    p_model: model,
  });
  if (error) throw error;
  return Boolean(data);
}

// { [providerId]: { model } } — um provedor só aparece na resposta se tiver
// chave configurada. Usado por perfil/page.jsx (precisa do model por
// provedor, não só do booleano).
export async function listAiProviderKeys(userId) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc('list_ai_provider_keys', { p_user_id: userId });
  if (error) throw error;
  const map = {};
  for (const row of data || []) {
    map[row.provider] = { model: row.model || null };
  }
  return map;
}

// Subconjunto de listProviders() cujos ids têm chave configurada — a mesma
// linha que questoes/page.jsx, mensagens/page.jsx e as outras 3 páginas que
// só precisam do booleano (não do model) repetiam antes, uma por arquivo.
export async function getConfiguredProviders(userId) {
  const keys = await listAiProviderKeys(userId);
  return listProviders().filter((provider) => Boolean(keys[provider.id]));
}
