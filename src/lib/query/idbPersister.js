import { dbClear, dbDelete, dbGet, dbGetAllKeys, dbPut, STORE_CACHE } from '../indexedDb';
import { getQueryClient } from './queryClient';

// Persister do TanStack Query sobre o store `cache` do IndexedDB (ADR-0015).
// Guarda o PersistedClient como objeto (structured clone), sem JSON.stringify.

const KEY_PREFIX = 'query-client:';
const THROTTLE_MS = 1000;

export function persistedCacheKey(userId) {
  return `${KEY_PREFIX}${userId}`;
}

// Páginas guardadas pelo service worker (public/sw.js) para uso offline: é
// HTML renderizado no servidor, com dados do usuário (ex.: alunos na página de
// correção). Mesma regra do cache de consultas: some junto.
export async function clearPageCaches() {
  if (typeof caches === 'undefined') return;
  const keys = await caches.keys();
  await Promise.all(keys.map((key) => caches.delete(key)));
}

// Um cache por dispositivo: apaga tudo no store `cache` que não seja o
// registro do usuário atual — outros usuários (sessão expirada sem logout) e
// as chaves legadas sem usuário do antigo dashboardCache.js. Se havia algo de
// outro dono, as páginas offline do service worker também podem ser dele:
// vão junto.
export async function purgeForeignCaches(userId) {
  const keep = persistedCacheKey(userId);
  const keys = await dbGetAllKeys(STORE_CACHE);
  const foreign = keys.filter((key) => key !== keep);
  await Promise.all(foreign.map((key) => dbDelete(STORE_CACHE, key)));
  if (foreign.length > 0) await clearPageCaches();
}

export function createIdbPersister(userId) {
  const key = persistedCacheKey(userId);
  let pending = null;
  let timer = null;
  let disabled = false;

  async function flush() {
    timer = null;
    if (disabled || !pending) return;
    const client = pending;
    pending = null;
    try {
      await dbPut(STORE_CACHE, { key, data: client, fetchedAt: client.timestamp });
    } catch {
      // Cota estourada / modo privado: o cache em memória segue funcionando.
    }
  }

  return {
    persistClient(client) {
      if (disabled) return;
      pending = client;
      if (!timer) timer = setTimeout(flush, THROTTLE_MS);
    },
    async restoreClient() {
      try {
        const row = await dbGet(STORE_CACHE, key);
        return row?.data;
      } catch {
        return undefined;
      }
    },
    async removeClient() {
      if (timer) clearTimeout(timer);
      timer = null;
      pending = null;
      await dbDelete(STORE_CACHE, key);
    },
    // Logout: nada mais é gravado depois daqui (um save com throttle pendente
    // não pode recriar o registro após a limpeza).
    disable() {
      disabled = true;
    },
  };
}

let activePersister = null;

export function setActivePersister(persister) {
  activePersister = persister;
}

// Chamado no logout, antes do POST: desliga o persister, esvazia o cache em
// memória, apaga o store `cache` inteiro e as páginas offline do service
// worker. Nunca lança — falhar aqui não pode impedir o usuário de sair.
export async function clearLocalCache() {
  try {
    activePersister?.disable();
    getQueryClient().clear();
    await Promise.all([dbClear(STORE_CACHE), clearPageCaches()]);
  } catch {
    // segue para o logout
  }
}
