import { createSupabaseAdminClient } from '@/lib/supabaseAdminClient';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';
import { createClient as createCanvasClient } from '@/lib/canvasClient';
import { refreshAccessToken } from '@/lib/canvasOAuth';

// Mesma margem de segurança que src/proxy.js usava pro token de sessão
// antes da Fase 1 — agora aplicada ao token de *integração* do Canvas, não
// mais à sessão do app (ver "Canvas como provedor de login" no plano:
// sessão de app e capacidade de API do Canvas são coisas desacopladas).
const REFRESH_SAFETY_MARGIN_MS = 5 * 60 * 1000;

/**
 * Lê a integração Canvas de um usuário (tokens já decifrados do Vault) via
 * a função SECURITY DEFINER — nunca lê `public.integrations` direto, essa
 * tabela não tem nenhuma policy de RLS pra authenticated de propósito (ver
 * supabase/volumes/db/init/05_rls.sql). `null` quando o usuário não tem
 * Canvas conectado — é o sinal que todo chamador usa pra decidir entre
 * "funcionalidade de curso habilitada" e "peça pra conectar o Canvas".
 */
export async function getCanvasIntegration(userId) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc('get_integration_tokens', { p_user_id: userId, p_provider: 'canvas' });
  if (error) throw error;
  const row = data?.[0];
  if (!row?.access_token || !row?.metadata?.base_url) return null;
  return {
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    expiresAt: row.access_token_expires_at ? new Date(row.access_token_expires_at).getTime() : null,
    baseUrl: row.metadata.base_url,
    providerUserId: row.provider_user_id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
  };
}

/**
 * O substituto direto de canvasSession.js's antigo `buildClient(session)` —
 * mesma ideia (client Canvas + retry de 401 embutido), mas a partir da
 * integração gravada em Postgres em vez de um iron-session síncrono, e
 * assíncrono porque agora depende de uma consulta ao banco. Refresh
 * proativo (mesma margem de 5 min de antes) se o token já estiver perto de
 * expirar, persistindo o token renovado de volta na integração — assim o
 * próximo request nem precisa refrescar de novo.
 *
 * Retorna `null` quando o usuário não tem integração Canvas — todo call
 * site (rota de API ou Server Component) deve tratar isso como "funcionali-
 * dade de curso indisponível", nunca deixar propagar pra uma chamada real
 * à API do Canvas com `baseUrl`/`token` undefined.
 */
export async function getCanvasClientForUser(userId) {
  let integration = await getCanvasIntegration(userId);
  if (!integration) return null;

  const expiringSoon = !integration.expiresAt || integration.expiresAt - Date.now() < REFRESH_SAFETY_MARGIN_MS;
  if (expiringSoon && integration.refreshToken) {
    try {
      const refreshed = await refreshAccessToken(integration.refreshToken);
      const admin = createSupabaseAdminClient();
      await admin.rpc('upsert_integration_tokens', {
        p_user_id: userId,
        p_provider: 'canvas',
        p_access_token: refreshed.access_token,
        p_refresh_token: integration.refreshToken, // Canvas nunca devolve um novo — reusa o mesmo
        p_provider_user_id: integration.providerUserId,
        p_display_name: integration.displayName,
        p_avatar_url: integration.avatarUrl,
        p_access_token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        p_metadata: { base_url: integration.baseUrl },
      });
      integration = { ...integration, accessToken: refreshed.access_token };
    } catch (err) {
      console.error('Falha ao renovar o token do Canvas:', err.message);
      // Segue com o token antigo — se estiver mesmo vencido, a própria
      // chamada à API falha e o onUnauthorized abaixo tenta de novo.
    }
  }

  const client = createCanvasClient({
    baseUrl: integration.baseUrl,
    token: integration.accessToken,
    onUnauthorized: async () => {
      const refreshed = await refreshAccessToken(integration.refreshToken);
      const admin = createSupabaseAdminClient();
      await admin.rpc('upsert_integration_tokens', {
        p_user_id: userId,
        p_provider: 'canvas',
        p_access_token: refreshed.access_token,
        p_refresh_token: integration.refreshToken,
        p_provider_user_id: integration.providerUserId,
        p_display_name: integration.displayName,
        p_avatar_url: integration.avatarUrl,
        p_access_token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        p_metadata: { base_url: integration.baseUrl },
      });
      return refreshed.access_token;
    },
  });

  return {
    client,
    baseUrl: integration.baseUrl,
    providerUserId: integration.providerUserId,
    displayName: integration.displayName,
    avatarUrl: integration.avatarUrl,
  };
}

/**
 * O gate compartilhado que toda página/rota dependente do Canvas chama no
 * lugar do antigo `getSession()` + `isSessionValid()`. `user` é sempre
 * não-nulo aqui dentro (proxy.js já bloqueou requests sem sessão Supabase
 * antes de chegar neste código); `canvas` vem `null` quando o usuário está
 * legitimamente logado mas não tem uma integração Canvas ativa — cada
 * chamador decide como reagir (página: mensagem "conecte o Canvas"; rota de
 * API: 409), nunca deixar `canvas` nulo virar uma chamada de API quebrada.
 */
export async function requireCanvasIntegration() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, canvas: null };
  const canvas = await getCanvasClientForUser(user.id);
  return { user, canvas };
}
