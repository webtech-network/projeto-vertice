/**
 * Nome/avatar de exibição a partir de um `user` do Supabase Auth — os
 * campos em `user_metadata` variam por provedor (Google: `full_name`/
 * `picture`; GitHub: `full_name`/`user_name`/`avatar_url`; bridge do Canvas:
 * só `full_name`, setado em `oauth2/callback/route.js` via `options.data`).
 * Substitui o antigo `session.user?.name`/`avatar_url` do iron-session
 * (só existiam sob login-Canvas-único).
 */
export function getDisplayName(user) {
  return (
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.user_metadata?.user_name ||
    user?.email ||
    null
  );
}

export function getAvatarUrl(user) {
  return user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null;
}
