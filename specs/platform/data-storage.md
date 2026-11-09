---
title: Armazenamento de dados
status: implemented
domain: data
updated: 2026-11-09
---

# Armazenamento de dados

> Onde cada pedaço de dado vive: Postgres/Supabase (com RLS), Vault (secrets), IndexedDB
> (cache + conexões) e localStorage (cache de UI). Leia junto com
> [supabase-schema.md](../contracts/supabase-schema.md).

## Postgres/Supabase — fonte de verdade (dados próprios)

Tabelas em `public.*`, todas com `user_id` + RLS `auth.uid() = user_id` (detalhes no
[contrato](../contracts/supabase-schema.md)): `workspaces`, `projects`, `tasks`, `shortcuts`,
`custom_prompts`, `course_notes`, `course_workspace_links`, `ui_preferences`,
`student_engagement_snapshots`.

- **Dois clients**: `supabaseBrowserClient` (anon key, RLS) para dados do próprio usuário;
  `supabaseAdminClient` (service_role) para as RPCs de secrets (`integrations`,
  `ai_integrations`) — nunca expor service_role ao browser.
- **Soft delete** (`deleted_at`) em workspaces/projects/tasks; **DELETE físico** em
  shortcuts/custom_prompts/course_notes/course_workspace_links. Ver [ADR-0011](../decisions/0011-soft-delete-vs-delete.md).

## Vault — secrets

- Tokens do Canvas (`integrations.access_token_vault_id`/`refresh_token_vault_id`) e chaves
  de IA (`ai_integrations.api_key_vault_id`) ficam no **Supabase Vault** (pgsodium). Nas
  tabelas só o `*_vault_id`. Acesso exclusivo via RPCs `SECURITY DEFINER` + `service_role`.

## IndexedDB — o que ainda é lido de verdade

DB `vertice` (v8; antes `canvastools`, migrado uma vez no cliente — [ADR-0018](../decisions/0018-renomeacao-identificadores-vertice.md)). **Stores ativos**: `cache` (cache de consultas do Canvas, ver abaixo)
e `github`/`google` (tokens de conexão). **Legados** (definidos mas não lidos, pois migraram
pro Postgres): `tasks`, `projects`, `workspaces`, `workspaceLinks`, `shortcuts`, `prompts`,
`courseNotes`.

### Cache de consultas (TanStack Query) — [ADR-0015](../decisions/0015-cache-local-tanstack-query.md)

- Leituras do Canvas no cliente passam por **TanStack Query** (`src/lib/query/`). O
  `QueryProvider` (montado no layout do dashboard com o `userId` do servidor) restaura o
  cache do IndexedDB antes das consultas rodarem e o regrava a cada mudança (com throttle).
- **Escopo**: um único registro `query-client:<userId>` no store `cache`. Ao montar, o
  provider apaga qualquer outro registro do store (outros usuários e chaves legadas
  `courses:list`, `messages:inbox`, `dashboard:*`, `tasks:*`). O logout (`UserMenu`) limpa
  memória, IndexedDB e o Cache Storage do service worker antes do POST; achar registro de
  outro dono no IndexedDB também apaga o Cache Storage.
- **Retenção**: `PERSIST_MAX_AGE` = 20 dias (= `gcTime`, que tem de ficar < ~24,8 dias, limite do `setTimeout`); `CACHE_SCHEMA_VERSION` é o `buster`, que deve ser
  incrementado quando o formato de um payload cacheado mudar.
- **Faixas de validade** (`STALE`): `live` 30 s (painel, inbox), `volatile` 2 min (lista de
  cursos com contadores, atividades e alunos nas abas do curso), `stable` 12 h (nomes para
  seletores e resolução de referências das tarefas). Mesma chave, faixa escolhida pelo
  consumidor. Botão "Recarregar" força a busca.
- Chaves e fetchers centralizados em `src/lib/query/canvasQueries.js`. Mutações atualizam o
  cache (`setQueryData`, ex.: favoritar curso, arquivar conversa).
- Tarefas, projetos, ambientes e vínculos também passam pelo cache, como **espelho** do estado
  dos providers (pinta do cache, revalida no Postgres) — [ADR-0017](../decisions/0017-cache-local-tarefas-e-ambientes.md).
- Nunca cachear tokens/chaves (as rotas não os devolvem ao browser).

## localStorage — cache síncrono de UI (write-through)

Chaves reais: `vertice:theme`, `vertice:sidebar-collapsed`,
`vertice:active-workspace-id`, `vertice:tarefas-default-prefs` (as antigas `canvastools:*` são
migradas pelo script de tema, antes de qualquer leitura). Todas são **cache
local + write-through** para `ui_preferences` (Postgres), reconciliadas uma vez no mount por
`ensureUiPreferencesSynced()` (`UiPreferencesSync.jsx`). Sem Realtime para prefs (decisão
intencional).

## Realtime — sincronização multi-dispositivo (Fase 2)

`src/lib/realtime/useRealtimeTable.js` assina `postgres_changes` (RLS-scoped) para:
`tasks`, `projects`, `workspaces`, `course_workspace_links`, `shortcuts`, `custom_prompts`,
`course_notes`. Nunca `integrations`/`ai_integrations`.

## Invariantes e gotchas

- `updatedAt`/`createdAt`/`deletedAt` no app são **epoch-ms (number)**, não string ISO —
  para o `mergeRecords` (last-write-wins) comparar com `>` puro.
- `due_date` é `date` puro (`'YYYY-MM-DD'`), sem hora/fuso.
- `iron-session` ainda está em `package.json`, mas `session.js` é legado morto.

## Dependências

- [supabase-schema.md](../contracts/supabase-schema.md) · [validation-model.md](validation-model.md)
