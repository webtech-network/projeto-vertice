// Cache curto em memória no servidor (por usuário, single-flight, TTL padrão 30 s)
// para evitar chamadas redundantes ao Canvas quando o usuário navega rapidamente
// entre Dashboard, Cursos e Mensagens ou quando duas rotas pedem os mesmos dados
// em paralelo. Nunca compartilha dados entre usuários (chave sempre prefixada por userId).

const DEFAULT_TTL_MS = 30 * 1000;
const MAX_ENTRIES = 500;

const cacheStore = new Map(); // fullKey -> { value, expiresAt }
const inFlightStore = new Map(); // fullKey -> Promise

function makeKey(userId, key) {
  return `${userId}:${key}`;
}

function evictIfNeeded() {
  if (cacheStore.size <= MAX_ENTRIES) return;
  const now = Date.now();
  for (const [k, entry] of cacheStore) {
    if (entry.expiresAt <= now) cacheStore.delete(k);
  }
  while (cacheStore.size > MAX_ENTRIES) {
    const oldestKey = cacheStore.keys().next().value;
    if (oldestKey === undefined) break;
    cacheStore.delete(oldestKey);
  }
}

export async function cachedCanvasRead(userId, key, fetcher, { ttlMs = DEFAULT_TTL_MS } = {}) {
  if (!userId) return fetcher();
  const fullKey = makeKey(userId, key);
  const now = Date.now();

  const hit = cacheStore.get(fullKey);
  if (hit && hit.expiresAt > now) {
    return hit.value;
  }

  const existingPromise = inFlightStore.get(fullKey);
  if (existingPromise) {
    return existingPromise;
  }

  const promise = Promise.resolve()
    .then(fetcher)
    .then((value) => {
      cacheStore.set(fullKey, { value, expiresAt: Date.now() + ttlMs });
      evictIfNeeded();
      return value;
    })
    .finally(() => {
      inFlightStore.delete(fullKey);
    });

  inFlightStore.set(fullKey, promise);
  return promise;
}

export function invalidateUserCanvasCache(userId, keyPrefix = '') {
  if (!userId) return;
  const prefix = `${userId}:${keyPrefix}`;
  for (const k of cacheStore.keys()) {
    if (k.startsWith(prefix)) cacheStore.delete(k);
  }
}
