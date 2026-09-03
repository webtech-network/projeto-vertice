const REQUIRED_ENV = ['APP_URL'];

/**
 * Origem pública onde o próprio app Next.js é servido — independente de
 * qualquer provedor de login. Antes da Fase 1, `proxy.js` e a rota de
 * logout importavam `getAppBaseUrl` de `canvasOAuth.js`, o que fazia essas
 * duas peças centrais do app falharem sem as variáveis CANVAS_OAUTH_* — um
 * resquício exato do "Canvas como plataforma-base obrigatória" que esta
 * fase elimina. `githubOAuth.js`/`googleOAuth.js` mantêm suas próprias
 * `getAppBaseUrl` (derivadas de seus próprios redirect URIs) porque ainda
 * servem só ao fluxo de *conexão* dessas integrações, não a login.
 */
export function getAppBaseUrl() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Defina no .env: ${missing.join(', ')} (ex.: http://localhost em dev).`);
  }
  return process.env.APP_URL.replace(/\/$/, '');
}
