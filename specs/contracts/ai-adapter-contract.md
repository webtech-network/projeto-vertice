---
title: Contrato do adapter de IA
status: implemented
domain: ai
updated: 2026-09-17
---

# Contrato do adapter de IA

> `src/lib/aiProviders/` implementa uma camada de **drivers** de protocolo de IA. Driver ≠
> integração: um driver é um protocolo (OpenAI/Gemini/Claude/Z.ai/DeepSeek); uma integração
> (`public.ai_integrations`) é uma config registrada pelo usuário que escolhe um driver.

## Contrato (toda função é `async`)

Cada módulo de driver exporta:

- **`id`** (string estável — usada em `ai_integrations.provider` e nas URLs), **`label`**,
  **`defaultModel`**, **`supportsTemperature`** (bool) e **`supportsPenalties`** (bool).
- **`validateApiKey(apiKey, baseUrl?)`** → `{ valid, error? }`.
- **`listModels(apiKey, baseUrl?)`** → `[{ id, label }]`.
- **`generateQuestions({ apiKey, baseUrl?, model, temperature?, maxTokens?, presencePenalty?,
  frequencyPenalty?, specs, systemPrompt? })`** → objeto no shape de `quiz.schema.json`.
- **`suggestReply({ ...mesmos knobs, context, systemPrompt? })`** → string (sugestão de resposta).
- **`improveMessage({ ...mesmos knobs, text, systemPrompt? })`** → string (rascunho revisado).
- **`analyzeStudent({ ...mesmos knobs, text, systemPrompt? })`** → string (análise do aluno).

`baseUrl` nulo → host padrão do driver. `systemPrompt` nulo → constante da própria capability
(`SYSTEM_PROMPT`/`REPLY_SYSTEM_PROMPT`/`IMPROVE_SYSTEM_PROMPT`/`STUDENT_ANALYSIS_SYSTEM_PROMPT`).
Driver que não suporta um knob (ex.: sem penalties no Claude/Z.ai; sem temperature no Claude
atual) **descarta silenciosamente**, nunca lança.

## Registro — `index.js`

`PROVIDERS = [openai, gemini, claude, zai, deepseek]`. `getProvider(id)` lança em id
desconhecido; `listProviders()` devolve `{ id, label, defaultModel, supportsTemperature,
supportsPenalties }` (sem segredos) para popular o form "Nova integração" e desabilitar
controles inúteis para o driver escolhido. Novo driver = um módulo + inclusão no array; nada
mais muda. Nova "plataforma" que já fala um protocolo existente = só uma integração com `base_url`.

## Os 5 drivers e seus dialetos de structured-output

| driver | host padrão | structured-output | obs |
|---|---|---|---|
| `openai` | `api.openai.com` | `response_format: {type:'json_schema', strict:true}` | Chat Completions (não Responses) |
| `gemini` | padrão | JSON mode só (schema como texto no prompt) | `listModels` filtra `generateContent` |
| `claude` | padrão | tool use forçado (`emit_quiz`), lê `toolUse.input` | sem temperature/penalties |
| `zai` | `api.z.ai/api/paas/v4` | `json_object` só | `listModels` é lista fixa no módulo |
| `deepseek` | `api.deepseek.com` | `json_object` só | compatível OpenAI, timeout 120s |

- `openai.listModels` filtra modelos não-chat por regex (`NON_CHAT_MODEL_PATTERN`) e ordena
  por `created` desc; `claude`/`deepseek` listam só chat (sem filtro); `gemini` filtra por
  `supportedGenerationMethods`; `zai` devolve lista curada à mão.
- Todos os drivers de geração logam via `logAiRequest` (`debugLog.js`) e aplicam
  `REQUEST_TIMEOUT_MS` próprio.

## Validação pós-geração (a rede de segurança real)

`buildQuizOutputSchema()` (em `shared.js`) **remove** o `allOf` `contains/minContains/maxContains`
("exatamente uma correta") e estreita `course_id`/`quiz_id` para `integer` — os dialetos de
structured-output dos vendors não suportam esse `allOf`. A regra vira orientação no prompt e é
re-checada por `validateStructural()` na rota `generate-questions` (sem auto-retry; usuário
regenera).

## Dependências

- [ai-integrations.md](../capabilities/ai-integrations.md) · [questoes.md](../capabilities/questoes.md) ·
  [prompt-customization.md](../capabilities/prompt-customization.md) ·
  [quiz-schema.md](quiz-schema.md) · [ADR-0007](../decisions/0007-ai-integrations-multi-instancia.md)
