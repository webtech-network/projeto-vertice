/**
 * Login pelo Canvas -> conta já vinculada (ADR-0026). Quem conectou o Canvas em
 * /perfil, logado com Google/GitHub, deixou em `integrations` o ID do Canvas
 * ligado à própria conta; o login pelo Canvas deve cair nela, mesmo que a API
 * do Canvas não exponha o mesmo e-mail.
 *
 * Server-only: recebe o client com service_role. Lê apenas colunas não
 * secretas — tokens continuam acessíveis só pelas RPCs do Vault.
 */

// Contas criadas pelo próprio bridge do Canvas só têm o provedor "email" e
// ficam de fora: são justamente as duplicadas que não devem vencer.
const PRIMARY_PROVIDERS = ['google', 'github'];

/**
 * @returns {Promise<{ id: string, email: string } | null>} a conta Google/GitHub
 * com a integração mais recente para este usuário do Canvas, ou `null`.
 */
export async function findLinkedAccount(admin, { canvasUserId, canvasBaseUrl }) {
  const { data: links, error } = await admin
    .from('integrations')
    .select('user_id')
    .eq('provider', 'canvas')
    .eq('provider_user_id', String(canvasUserId))
    .eq('metadata->>base_url', canvasBaseUrl)
    .order('created_at', { ascending: false });
  if (error) throw error;

  for (const { user_id: userId } of links) {
    const { data, error: userError } = await admin.auth.admin.getUserById(userId);
    if (userError) throw userError;
    const user = data?.user;
    const providers = user?.app_metadata?.providers ?? [];
    if (user?.email && providers.some((provider) => PRIMARY_PROVIDERS.includes(provider))) {
      return { id: user.id, email: user.email };
    }
  }
  return null;
}
