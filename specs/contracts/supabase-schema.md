---
title: Schema do Supabase (tabelas, RLS, Vault, RPCs)
status: implemented
domain: data
updated: 2026-09-17
---

# Schema do Supabase

> Contrato do banco: `supabase/volumes/db/init/04_schema.sql` (DDL), `05_rls.sql` (políticas)
> e `supabase/volumes/db/manual/10_ai_integrations.sql` (DDL + RPCs de IA). Self-hosted via
> `supabase/volumes/`.

## Tabelas `public.*` (todas `user_id` + RLS `auth.uid() = user_id`)

| tabela | PK / unique | notas |
|---|---|---|
| `workspaces` | id | soft delete (`deleted_at`) |
| `projects` | id | `type` `personal`\|`canvas-course`; `canvas_course_id` (stopgap até course_workspace_links) |
| `tasks` | id | `status` BACKLOG/BLOCK/TODO/DOING/DONE; `urgent`/`important` bool; `priority_rank` 0-9; `due_date` `date`; `canvas_references` jsonb; soft delete |
| `shortcuts` | id | DELETE físico |
| `custom_prompts` | PK `(user_id, capability)` | `mode` append\|replace |
| `course_notes` | PK `(user_id, course_code)` | DELETE físico |
| `course_workspace_links` | PK `(user_id, course_id)` | DELETE físico |
| `ui_preferences` | PK `user_id` | sem Realtime |
| `student_engagement_snapshots` | `unique(user_id, course_id, student_id, snapshot_date)` | sem DELETE |
| `integrations` | id | `provider` canvas\|github\|google; tokens = `*_vault_id` |
| `ai_integrations` | id | `provider` openai/gemini/claude/zai/deepseek; `is_default` com unique parcial; `system_prompt_mode` append\|replace; chave = `api_key_vault_id` |

Trigger `set_updated_at` existe em quase todas, mas **não** em `integrations`, `ai_integrations`
nem `student_engagement_snapshots`.

## RLS — três grupos (`05_rls.sql`)

1. **select/insert/update own, sem DELETE**: `workspaces`, `projects`, `tasks`, `ui_preferences`,
   `student_engagement_snapshots`. (O `update` em snapshots existe só porque o upsert
   `on conflict do update` é avaliado como UPDATE real.)
2. **com DELETE físico**: `shortcuts`, `custom_prompts`, `course_notes`, `course_workspace_links`.
3. **RLS ON, zero policies** (`service_role` only): `integrations`, `ai_integrations`.

## Vault (secrets) e RPCs

- Tokens do Canvas e chaves de IA vivem no **Supabase Vault** (pgsodium); nas tabelas só o
  `*_vault_id`. Acesso **exclusivo** via RPCs `SECURITY DEFINER` + `service_role`.
- `integrations`: `upsert_integration_tokens`, `get_integration_tokens`, `delete_integration_tokens`.
- `ai_integrations`: `create_ai_integration`, `update_ai_integration`, `delete_ai_integration`,
  `get_ai_integration`, `list_ai_integrations` (só `service_role`; embrulhados por
  `src/lib/aiIntegrations.js`).

## Invariantes e gotchas

- Timestamps de app (`updatedAt`/`createdAt`/`deletedAt`) são **epoch-ms number**, não ISO.
- `is_default` em `ai_integrations` usa índice único parcial (no máximo um default por usuário).
- Nunca expor `service_role` ao browser; `integrations`/`ai_integrations` só via RPC.

## Dependências

- [data-storage.md](../platform/data-storage.md) · [canvas-integration.md](../platform/canvas-integration.md) ·
  [ai-integrations.md](../capabilities/ai-integrations.md) · [ADR-0008](../decisions/0008-postgres-realtime-migracao.md)
