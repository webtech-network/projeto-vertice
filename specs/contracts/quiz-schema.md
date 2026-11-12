---
title: Schema de questões (quiz.schema.json)
status: implemented
domain: data
updated: 2026-11-12
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

Sempre obrigatórios: `question_name`, `question_text`, `points_possible`.
- `question_name`/`question_text`: string, `minLength: 1` (HTML preferido).
- `question_type` (opcional, ver [ADR-0019](../decisions/0019-questoes-abertas.md)): enum —
  `multiple_choice_question` (padrão quando ausente), `essay_question`, `text_only_question`,
  `file_upload_question`.
- `points_possible`: number, `minimum: 0`; `> 0` exceto em `text_only_question` (onde é `0`).
- `answers`: array, `maxItems: 10`, de `$defs.answer`.
- `question_model`: enum — `AR`, `AR (Asserção-Razão)`, `RU`, `RU (Resposta Única)`, `CM`,
  `CM (Complementação Múltipla)`, `INT`, `INT (Interpretação)`, `DISC`, `DISC (Dissertativa)`
  (formas curta e longa aceitas).
- `feedback_comment` (opcional): string HTML — comentário geral da questão (na dissertativa
  gerada por IA: resposta esperada + critérios de correção).

## Regras por tipo — o `allOf` com `if/then` da questão

- **Múltipla escolha** (`question_type` ausente ou `multiple_choice_question`): `answers` e
  `question_model` obrigatórios; `answers` com `minItems: 2` e um `allOf`
  `contains`/`minContains: 1`/`maxContains: 1` sobre `{ is_correct: { const: true } }` —
  exatamente uma correta.
- **Abertos** (`essay_question`, `text_only_question`, `file_upload_question`): `answers`
  opcional e, se presente, vazio (`maxItems: 0`).
- `text_only_question`: `points_possible` `const: 0`; demais tipos: `exclusiveMinimum: 0`.

## Resposta (`$defs.answer`)

Obrigatórios: `answer_text` (string `minLength: 1`), `is_correct` (boolean), `answer_comment`
(string, HTML preferido). `additionalProperties: false`.

## Invariantes e gotchas

- `additionalProperties: false` em raiz, questão e resposta — campo extra (ex.: `nivel` em
  arquivos reais) quebra o schema e vira **aviso** na importação, não erro.
- A IA nunca recebe o `allOf` das respostas: `buildQuizOutputSchema()` o remove e estreita os
  ids (os dialetos de structured-output não suportam). Ver [ai-adapter-contract.md](ai-adapter-contract.md).
- A IA nunca recebe o `allOf` com `if/then` da questão: `buildQuizOutputSchema()` o remove,
  torna todos os campos obrigatórios, limita `question_type` a `multiple_choice_question`/
  `essay_question` e relaxa `answers` para `minItems: 0` (as regras por tipo são re-checadas
  por `validateStructural`).
- Mapeamento para o Canvas: `question_type` repassado; `is_correct → answer_weight`,
  `answer_comment → answer_comment_html` e `feedback_comment → neutral_comments_html` em
  `toCanvasPayload()`; tipos abertos vão sem `answers`; `course_id`/`quiz_id` do arquivo são **ignorados** no import (valem os
  da rota).

## Dependências

- [validation-model.md](../platform/validation-model.md) · [ai-adapter-contract.md](ai-adapter-contract.md) ·
  [quiz-import.md](../capabilities/quiz-import.md) · [cli.md](../capabilities/cli.md)
