---
title: Armazenamento de dados
status: implemented
domain: data
updated: 2026-09-17
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

DB `canvastools` (v8). **Stores ativos**: `cache` (agregados do Canvas, stale-while-revalidate,
via `dashboardCache.js`) e `github`/`google` (tokens de conexão). **Legados** (definidos mas
não lidos, pois migraram pro Postgres): `tasks`, `projects`, `workspaces`, `workspaceLinks`,
`shortcuts`, `prompts`, `courseNotes`.

## localStorage — cache síncrono de UI (write-through)

Chaves reais: `canvastools:theme`, `canvastools:sidebar-collapsed`,
`canvastools:active-workspace-id`, `canvastools:tarefas-default-prefs`. Todas são **cache
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
