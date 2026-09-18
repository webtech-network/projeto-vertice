---
title: Integrações de IA (registro/CRUD)
status: implemented
domain: ai
updated: 2026-09-17
---

# Integrações de IA

> Cadastro de integrações de IA no `/perfil`: uma linha por configuração (provedor + chave +
> base URL + modelo + params + prompt), chave guardada no Vault. Driver ≠ integração.

## Comportamento

- `IntegrationManager.jsx` (aba "Plataformas de IA"): lista cada integração como card + form
  "Nova integração". Único lugar onde chaves são digitadas.
- Nova integração: `provider` (`listProviders()` → id/label/defaultModel/supports*), valida a
  chave via `validateApiKey(apiKey, baseUrl)`, `base_url`, `model`, `temperature`/`max_tokens`/
  `presence_penalty`/`frequency_penalty`, `system_prompt`+`system_prompt_mode`, `is_default`,
  `is_active`.
- "Trocar modelo" (por card): picker lazy (`GET /api/ai/integrations/[id]/models`, exige chave
  já salva) → `PATCH { model }` (ou `{ model: null }` p/ voltar ao default do driver).
- Rotas integration-generic: `GET/POST /api/ai/integrations`, `PATCH/DELETE /api/ai/integrations/[id]`,
  `GET .../[id]/models`, `POST .../[id]/generate-questions|suggest-reply|improve-message`.
  `GET /api/ai/integrations/configured` devolve só ativas com chave (formato p/ selectors).
  `POST /api/ai/analyze-student` resolve a default server-side.

## Arquivos-chave

- [IntegrationManager.jsx](src/components/IntegrationManager.jsx) ·
  [aiIntegrations.js](src/lib/aiIntegrations.js) · `src/app/api/ai/integrations/**`.

## Contratos

- [ai-adapter-contract.md](../contracts/ai-adapter-contract.md) (`validateApiKey`, `listModels`) ·
  [supabase-schema.md](../contracts/supabase-schema.md) (`ai_integrations` + RPCs).

## Dados e persistência

- `public.ai_integrations`: `provider`, `name`, `api_key_vault_id` (Vault), `base_url`, `model`,
  `system_prompt`/`system_prompt_mode`, `temperature`, `max_tokens`, `presence_penalty`,
  `frequency_penalty`, `is_default` (unique parcial), `is_active`. Zero RLS p/ `authenticated`;
  acesso só via RPCs `SECURITY DEFINER` + `service_role`.

## Invariantes e gotchas

- Chave é **write-only**: nenhuma rota devolve plaintext (exceto a exceção documentada do
  export, hoje removido). Não há mais fallback `process.env['<PROVIDER>_MODEL']`.

## Decisões

- Chaves **write-only** (nunca retornam em texto plano): [ADR-0006](../decisions/0006-chaves-ia-write-only.md).
  Multi-instância por driver (substitui `ai_provider_keys`): [ADR-0007](../decisions/0007-ai-integrations-multi-instancia.md).

## Dependências

- [ai-adapter-contract.md](../contracts/ai-adapter-contract.md) · [perfil.md](perfil.md) ·
  [prompt-customization.md](prompt-customization.md)
