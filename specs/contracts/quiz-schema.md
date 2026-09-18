---
title: Schema de questões (quiz.schema.json)
status: implemented
domain: data
updated: 2026-09-17
---

# Schema de questões (quiz.schema.json)

> `src/lib/quiz.schema.json` (JSON Schema draft 2020-12) é o formato canônico de um arquivo
> de questões. É **fonte de verdade para o output da IA** e **referência de aviso** na importação
> (nunca bloqueante — ver [validation-model.md](../platform/validation-model.md)).

## Estrutura raiz

`{ course_id, quiz_id, questions[] }` — os três obrigatórios, `additionalProperties: false`.
`course_id`/`quiz_id` são `["integer","null"]` (nulos quando ainda não definidos; a IA emite `0`).
`questions` tem `minItems: 1`.

## Questão (`$defs.question`)

Obrigatórios: `question_name`, `question_text`, `points_possible`, `answers`, `question_model`.
- `question_name`/`question_text`: string, `minLength: 1` (HTML preferido).
- `points_possible`: number, `exclusiveMinimum: 0`.
- `answers`: array, `minItems: 2`, `maxItems: 10`, de `$defs.answer`.
- `question_model`: enum — `AR`, `AR (Asserção-Razão)`, `RU`, `RU (Resposta Única)`, `CM`,
  `CM (Complementação Múltipla)`, `INT`, `INT (Interpretação)` (formas curta e longa aceitas).

## "Exatamente uma correta" — o mecanismo `allOf`

`answers` carrega um `allOf` com `contains`/`minContains: 1`/`maxContains: 1` sobre
`{ is_correct: { const: true } }` — a forma draft-2020-12 de exigir exatamente um item com
`is_correct: true`.

## Resposta (`$defs.answer`)

Obrigatórios: `answer_text` (string `minLength: 1`), `is_correct` (boolean), `answer_comment`
(string, HTML preferido). `additionalProperties: false`.

## Invariantes e gotchas

- `additionalProperties: false` em raiz, questão e resposta — campo extra (ex.: `nivel` em
  arquivos reais) quebra o schema e vira **aviso** na importação, não erro.
- A IA nunca recebe o `allOf` das respostas: `buildQuizOutputSchema()` o remove e estreita os
  ids (os dialetos de structured-output não suportam). Ver [ai-adapter-contract.md](ai-adapter-contract.md).
- Mapeamento para o Canvas: `is_correct → answer_weight` e `answer_comment → answer_comment_html`
  em `toCanvasPayload()`; `course_id`/`quiz_id` do arquivo são **ignorados** no import (valem os
  da rota).

## Dependências

- [validation-model.md](../platform/validation-model.md) · [ai-adapter-contract.md](ai-adapter-contract.md) ·
  [quiz-import.md](../capabilities/quiz-import.md) · [cli.md](../capabilities/cli.md)
