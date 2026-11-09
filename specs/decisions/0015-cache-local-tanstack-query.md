---
title: Cache local dos dados do Canvas com TanStack Query persistido em IndexedDB
status: accepted
date: 2026-11-08
supersedes: []
superseded_by: []
---

# ADR-0015: Cache local com TanStack Query + IndexedDB

## Contexto

O app já fazia "mostra o cache e atualiza em segundo plano" (stale-while-revalidate),
mas de forma artesanal: `dashboardCache.js` (`readCache`/`writeCache` no store `cache`)
reimplementado à mão em `DashboardPanel`, `CourseBrowser`, `MessageBrowser` e
`canvasResolution.js`. Problemas:

- **Chaves sem usuário** (`courses:list`, `messages:inbox`…) e **nada limpo no logout**:
  num computador compartilhado, o próximo usuário via por um instante cursos, alunos e
  mensagens do anterior (dados pessoais, LGPD).
- Sem validade por tipo de dado: cursos e alunos, que quase não mudam depois das primeiras
  semanas do semestre, eram rebuscados a cada montagem de tela.
- Sem deduplicação (duas telas → duas chamadas ao Canvas), sem invalidação após mutações,
  sem versão de formato (um deploy que mude o payload quebra a tela com o cache antigo).

## Decisão

- **TanStack Query v5** como camada de dados do cliente para leituras do Canvas, com
  **`PersistQueryClientProvider`** e um persister próprio sobre o store `cache` do IndexedDB
  (via `idb`, já dependência). Alternativas descartadas:
  - SWR: persistência e invalidação menos maduras.
  - Dexie: só vale se precisarmos consultar entidades normalizadas localmente.
  - RxDB/PowerSync/ElectricSQL: o Canvas não é sincronizável; para tarefas o Realtime já
    cumpre o papel.
  - Cache no Service Worker: difícil separar por usuário e invalidar após mutações.
- **Um cache por usuário, e só um por dispositivo.** O registro persistido usa a chave
  `query-client:<userId>`. Ao montar o provider, o app apaga todos os outros registros do
  store `cache` (de outros usuários e as chaves legadas sem usuário). No logout, o cache em
  memória e o persistido são limpos antes do POST de `/api/auth/logout`.
- **As páginas offline do service worker seguem a mesma regra.** São HTML renderizado com
  dados do usuário. O Cache Storage é apagado no logout e sempre que o provider encontra no
  IndexedDB um registro de outro dono (sessão que expirou sem logout).
- **Validade por faixa de volatilidade** (`STALE` em `src/lib/query/queryClient.js`).
  Cada consumidor escolhe a sua sobre a **mesma chave**: a aba "Atividades" usa
  `volatile` (mostra `needs_grading_count`); os seletores de tarefas usam `stable`, porque
  só precisam de nomes.
- **`CACHE_SCHEMA_VERSION`** é o `buster`: incrementar quando o formato de um payload mudar
  descarta o cache persistido de todos.
- `refetchOnWindowFocus: false` por padrão (cada chamada ao Canvas é cara); cada consulta
  ativa explicitamente quando fizer sentido.

## Consequências

- Uma única implementação de cache; telas novas só declaram chave, fetcher e faixa.
- Dados do Canvas continuam sem criptografia no IndexedDB, mas com escopo de um usuário,
  limpeza no logout e retenção máxima (`PERSIST_MAX_AGE`).
- Tokens e chaves nunca passam pelo cache (as rotas não os devolvem ao browser).
- Telas que leem o Canvas em Server Components (página do curso, correção, pares, import)
  **ainda não** se beneficiam do cache: ficam para a fase seguinte.
