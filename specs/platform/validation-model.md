---
title: Modelo de validação (duas camadas)
status: implemented
domain: data
updated: 2026-09-17
---

# Modelo de validação (duas camadas)

> A validação de questões é **intencionalmente em duas camadas**: uma estrutural (bloqueante)
> e uma de schema (não-bloqueante). Não tornar o schema obrigatório.

## As duas camadas

- **`validateStructural(data)`** — **bloqueante**. Mínimo para chamar a API do Canvas com
  segurança: `course_id`/`quiz_id`/`questions` presentes, cada questão tem respostas com
  exatamente um `is_correct: true`, etc.
- **`createSchemaValidator(schemaObject)` + `summarizeSchemaWarnings()`** — **não-bloqueante**,
  `ajv` contra `src/lib/quiz.schema.json`. Deve continuar não-bloqueante: arquivos reais em
  `Questoes/` desviam do schema (sem `question_model`, campo extra `nivel` que esbarra em
  `additionalProperties: false`) e ainda são conteúdo legítimo.

## Onde cada camada roda

- `validateStructural` — no CLI, no preview client-side e de novo no import route (defesa em
  profundidade).
- `createSchemaValidator` — avisos (`summarizeSchemaWarnings`), nunca bloqueia.

## `toCanvasPayload(question)`

Mapeia `is_correct → answer_weight` e `answer_comment → answer_comment_html`. Compartilhado
pelo CLI e pelo import route.

## Invariantes e gotchas

- `quizValidation.js` **recebe** o schema como parâmetro, não importa `quiz.schema.json`
  direto — os três call sites usam sintaxe de import JSON diferente (bundler do Next aceita
  `import ... from '@/lib/quiz.schema.json'`; o CLI sem bundler precisa de
  `import ... with { type: 'json' }`).

## Dependências

- [quiz-schema.md](../contracts/quiz-schema.md) · [quiz-import.md](../capabilities/quiz-import.md) ·
  [cli.md](../capabilities/cli.md) · [ADR-0005](../decisions/0005-validacao-duas-camadas.md)
