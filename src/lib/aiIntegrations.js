import { createSupabaseAdminClient } from '@/lib/supabaseAdminClient';
import { getProvider, listProviders } from '@/lib/aiProviders';

function toIntegration(row) {
  return {
    id: row.id,
    provider: row.provider,
    name: row.name,
    hasApiKey: row.has_api_key,
    baseUrl: row.base_url || null,
    model: row.model || null,
    systemPrompt: row.system_prompt || null,
    systemPromptMode: row.system_prompt_mode,
    temperature: row.temperature != null ? Number(row.temperature) : null,
    maxTokens: row.max_tokens || null,
    presencePenalty: row.presence_penalty != null ? Number(row.presence_penalty) : null,
    frequencyPenalty: row.frequency_penalty != null ? Number(row.frequency_penalty) : null,
    isDefault: row.is_default,
    isActive: row.is_active,
  };
}

// Todas as integrações do usuário (ativas e inativas), sem o valor da
// chave — usado por /perfil ("Plataformas de IA"), via as funções
// SECURITY DEFINER (ver supabase/volumes/db/manual/10_ai_integrations.sql)
// — nunca lê `public.ai_integrations` direto, essa tabela não tem nenhuma
// policy de RLS pra authenticated de propósito.
export async function listAiIntegrations(userId) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc('list_ai_integrations', { p_user_id: userId });
  if (error) throw error;
  return (data || []).map(toIntegration);
}

// Config completa + chave decifrada de uma integração — usado pelas rotas
// de geração e de listagem de modelos. `null` se a integração não existe,
// não é do usuário, ou está inativa.
export async function getAiIntegration(userId, integrationId) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc('get_ai_integration', {
    p_user_id: userId,
    p_integration_id: integrationId,
  });
  if (error) throw error;
  const row = data?.[0];
  if (!row?.api_key) return null;
  return {
    apiKey: row.api_key,
    provider: row.provider,
    baseUrl: row.base_url || null,
    model: row.model || null,
    systemPrompt: row.system_prompt || null,
    systemPromptMode: row.system_prompt_mode,
    temperature: row.temperature != null ? Number(row.temperature) : null,
    maxTokens: row.max_tokens || null,
    presencePenalty: row.presence_penalty != null ? Number(row.presence_penalty) : null,
    frequencyPenalty: row.frequency_penalty != null ? Number(row.frequency_penalty) : null,
  };
}

export async function createAiIntegration(userId, data) {
  const admin = createSupabaseAdminClient();
  const { data: id, error } = await admin.rpc('create_ai_integration', {
    p_user_id: userId,
    p_provider: data.provider,
    p_name: data.name,
    p_api_key: data.apiKey,
    p_base_url: data.baseUrl ?? null,
    p_model: data.model ?? null,
    p_system_prompt: data.systemPrompt ?? null,
    p_system_prompt_mode: data.systemPromptMode ?? 'append',
    p_temperature: data.temperature ?? 0.7,
    p_max_tokens: data.maxTokens ?? null,
    p_presence_penalty: data.presencePenalty ?? null,
    p_frequency_penalty: data.frequencyPenalty ?? null,
    p_is_default: data.isDefault ?? false,
  });
  if (error) throw error;
  return id;
}

// `apiKey: undefined/null` mantém a chave já salva — só troca quando o
// professor explicitamente digita uma nova no formulário.
export async function updateAiIntegration(userId, integrationId, data) {
  const admin = createSupabaseAdminClient();
  const { data: ok, error } = await admin.rpc('update_ai_integration', {
    p_user_id: userId,
    p_integration_id: integrationId,
    p_name: data.name ?? null,
    p_api_key: data.apiKey ?? null,
    p_base_url: data.baseUrl ?? null,
    p_model: data.model ?? null,
    p_system_prompt: data.systemPrompt ?? null,
    p_system_prompt_mode: data.systemPromptMode ?? null,
    p_temperature: data.temperature ?? null,
    p_max_tokens: data.maxTokens ?? null,
    p_presence_penalty: data.presencePenalty ?? null,
    p_frequency_penalty: data.frequencyPenalty ?? null,
    p_is_default: data.isDefault ?? null,
    p_is_active: data.isActive ?? null,
  });
  if (error) throw error;
  return Boolean(ok);
}

export async function deleteAiIntegration(userId, integrationId) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc('delete_ai_integration', {
    p_user_id: userId,
    p_integration_id: integrationId,
  });
  if (error) throw error;
}

// Integrações ativas e com chave configurada, prontas pra UI de seleção
// (QuestionGenerator/MessageList/ComposeMessage) — padrão primeiro, depois
// por nome (mesma ordem de list_ai_integrations). `providerLabel` vem do
// driver-base (src/lib/aiProviders), só pra exibição.
export async function getConfiguredIntegrations(userId) {
  const integrations = await listAiIntegrations(userId);
  return integrations
    .filter((integration) => integration.isActive && integration.hasApiKey)
    .map((integration) => ({
      id: integration.id,
      name: integration.name,
      provider: integration.provider,
      providerLabel: getProvider(integration.provider).label,
      model: integration.model || getProvider(integration.provider).defaultModel,
      isDefault: integration.isDefault,
    }));
}

// Metadados dos drivers-base (id/label/defaultModel) — usado só no
// formulário de criação/edição de integração, pra escolher o provider.
export { listProviders as listDriverProviders };
