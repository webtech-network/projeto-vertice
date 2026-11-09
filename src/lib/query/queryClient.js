import { QueryClient } from '@tanstack/react-query';

// Cache de consultas do cliente (ADR-0015). Ver specs/platform/data-storage.md.

// `buster` do cache persistido: incremente quando o formato de algum payload
// cacheado mudar, para descartar o cache antigo de todo mundo no próximo load.
export const CACHE_SCHEMA_VERSION = '1';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

// Retenção máxima no IndexedDB. `gcTime` acompanha: uma consulta removida da
// memória também some do que é persistido.
// ATENÇÃO: precisa ficar abaixo de 2^31-1 ms (~24,8 dias) — o gcTime vira um
// setTimeout, que estoura acima disso e dispara na hora: as consultas recém
// restauradas (ainda sem observador) seriam coletadas antes de qualquer tela
// lê-las, e o cache persistido seria regravado vazio.
export const PERSIST_MAX_AGE = 20 * 24 * HOUR;

// Faixas de validade por volatilidade. A mesma chave pode ser lida com faixas
// diferentes: quem só precisa de nomes usa `stable`; quem exibe contadores
// (needs_grading_count, mensagens, notas) usa `volatile`/`live`.
export const STALE = {
  live: 30 * 1000,
  volatile: 2 * MINUTE,
  stable: 12 * HOUR,
};

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE.volatile,
        gcTime: PERSIST_MAX_AGE,
        // Cada consulta ao Canvas é cara; quem precisar liga explicitamente.
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}

let browserClient = null;

// Singleton no browser (compartilhado pelo provider e pelos helpers
// imperativos de canvasResolution.js); instância nova por render no servidor,
// para nunca vazar dados entre requisições.
export function getQueryClient() {
  if (typeof window === 'undefined') return makeQueryClient();
  if (!browserClient) browserClient = makeQueryClient();
  return browserClient;
}

// Helpers imperativos (fora de componentes) precisam esperar a restauração do
// IndexedDB; senão buscariam na rede algo que já estava em cache.
let resolveRestored;
const restoredPromise = new Promise((resolve) => {
  resolveRestored = resolve;
});

export function markCacheRestored() {
  resolveRestored();
}

// Teto de espera: fora do QueryProvider (nunca deveria acontecer) o helper
// segue para a rede em vez de ficar pendurado.
const RESTORE_TIMEOUT_MS = 3000;

export function waitForCacheRestore() {
  return Promise.race([restoredPromise, new Promise((resolve) => setTimeout(resolve, RESTORE_TIMEOUT_MS))]);
}
