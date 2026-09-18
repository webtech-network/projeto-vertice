---
title: Customização de prompts de IA
status: implemented
domain: ai
updated: 2026-09-17
---

# Customização de prompts de IA

> Override por usuário do system prompt default de cada capability de IA
> (`generateQuestions`/`suggestReply`/`improveMessage`/`analyzeStudent`).

## Comportamento

- `src/lib/customPrompts.js` — `CAPABILITIES` (key/label/defaultPrompt, default importado da
  constante da própria capability, só p/ display) + CRUD (`getCustomPrompt`,
  `getAllCustomPrompts`, `saveCustomPrompt`, `clearCustomPrompt`), keyed por `user_id,capability`.
- Cada override tem `mode` escolhido no `PromptCustomizer.jsx`: **`append`** (default — texto
  do professor após o default, que segue valendo) ou **`replace`** (substitui o default; UI
  mostra warning explícito, pois regras estruturais como "exatamente uma correta" deixam de
  ser garantidas pelo prompt).
- `src/lib/promptResolution.js` — `resolvePrompt(defaultPrompt, customText, mode)` puro, sem
  dependência de IndexedDB (importável client e server).
- Triggers (`QuestionGenerator`, `MessageList`, `ComposeMessage`, `StudentMessageModal`,
  `StudentEngagementDashboard`) leem `getCustomPrompt(key)` antes do fetch e mandam
  `customPromptText`/`customPromptMode`. Rotas resolvem server-side em **duas camadas**:
  capability default → custom do usuário, depois → `system_prompt`/`system_prompt_mode` da
  integração; o `systemPrompt` final vai pro adapter (que não sabe quantas camadas houve).

## Arquivos-chave

- [customPrompts.js](src/lib/customPrompts.js) · [promptResolution.js](src/lib/promptResolution.js) ·
  [PromptCustomizer.jsx](src/components/PromptCustomizer.jsx).

## Contratos

- [supabase-schema.md](../contracts/supabase-schema.md) (`custom_prompts`, PK `user_id,capability`).

## Decisões

- Custom prompt é **global do usuário por capability** (não por integração); o `system_prompt`
  da integração é uma camada **extra** sobre ele.

## Dependências

- [ai-integrations.md](ai-integrations.md) · [ai-adapter-contract.md](../contracts/ai-adapter-contract.md)
