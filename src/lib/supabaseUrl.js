/**
 * URL do Supabase para chamadas feitas pelo próprio processo Node (server ->
 * Supabase), distinta da URL pública usada pelo navegador. Dentro do
 * container Docker do app, `NEXT_PUBLIC_SUPABASE_URL` costuma ser algo como
 * `http://localhost:8000` (o que o navegador precisa) — mas "localhost" de
 * dentro do container do app não é o container do `kong`. `SUPABASE_INTERNAL_URL`
 * (setado no docker-compose.yml raiz como `http://kong:8000`, resolvido pela
 * rede interna do Compose) cobre esse caso; fora do Docker (dev local, ou
 * quando app e Supabase não dividem uma rede Docker) fica vazio e cai no
 * fallback público, que já funciona hoje.
 *
 * Só para clients Supabase que o servidor usa para *falar* com o Supabase
 * (proxy.js, supabaseServerClient.js, supabaseAdminClient.js). Nunca usar
 * isso para montar uma URL de redirect do navegador (ex.: o `/auth/v1/verify`
 * em src/app/oauth2/callback/route.js) — o browser não resolve `kong`.
 */
export function getSupabaseServerUrl() {
  return process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
}

/**
 * Nome do cookie de sessão/PKCE (`sb-<host>-auth-token...`) — @supabase/
 * supabase-js deriva esse prefixo sozinho do hostname da URL passada pro
 * client (`sb-${new URL(url).hostname.split('.')[0]}-auth-token`, ver
 * defaultStorageKey em @supabase/supabase-js). Com `getSupabaseServerUrl()`
 * apontando pra `http://kong:8000` dentro do Docker, o client do
 * servidor calcularia `sb-kong-auth-token`, enquanto o navegador (sempre em
 * NEXT_PUBLIC_SUPABASE_URL, hostname público) calcula `sb-localhost-auth-token`
 * — nomes de cookie diferentes nos dois lados, então o servidor nunca acha
 * nenhum cookie que o navegador seta (login trava com "PKCE code verifier
 * not found in storage", entre outras falhas silenciosas de sessão — bug
 * real encontrado ao vivo). Fixa o storageKey a partir da URL PÚBLICA
 * sempre, nos dois lados, via `cookieOptions.name` — assim a URL usada pra
 * de fato fazer a chamada HTTP (pública ou interna) pode divergir sem
 * afetar em nada o nome do cookie.
 */
export function getSupabaseStorageKey() {
  const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
  return `sb-${host}-auth-token`;
}
