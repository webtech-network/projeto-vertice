'use client';

import { useEffect, useMemo } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { CACHE_SCHEMA_VERSION, PERSIST_MAX_AGE, getQueryClient, markCacheRestored } from '@/lib/query/queryClient';
import { createIdbPersister, purgeForeignCaches, setActivePersister } from '@/lib/query/idbPersister';

// Cache de consultas do dashboard (ADR-0015). `userId` vem do servidor
// (layout) e escopa o registro persistido: um usuário nunca restaura o cache
// de outro, e ao montar qualquer outro registro do store é apagado.
export default function QueryProvider({ userId, children }) {
  const client = getQueryClient();
  const persister = useMemo(() => (userId ? createIdbPersister(userId) : null), [userId]);

  useEffect(() => {
    if (!persister) {
      markCacheRestored();
      return undefined;
    }
    setActivePersister(persister);
    purgeForeignCaches(userId).catch(() => {});
    return () => setActivePersister(null);
  }, [persister, userId]);

  if (!persister) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }

  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister,
        maxAge: PERSIST_MAX_AGE,
        buster: CACHE_SCHEMA_VERSION,
        dehydrateOptions: {
          // Só respostas bem-sucedidas, e só consultas que não pediram para
          // ficar fora do disco (meta.persist === false).
          shouldDehydrateQuery: (query) => query.state.status === 'success' && query.meta?.persist !== false,
        },
      }}
      onSuccess={markCacheRestored}
      onError={markCacheRestored}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
