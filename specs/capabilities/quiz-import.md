---
title: Importação de questões (JSON → quiz)
status: implemented
domain: canvas
updated: 2026-09-17
---

# Importação de questões (JSON → quiz)

> Fluxo central do produto: pegar um arquivo JSON de questões, validar/preview, selecionar e
> importar num quiz clássico do Canvas via `POST /courses/:id/quizzes/:quiz_id/questions`.

## Comportamento

- Rota `courses/[courseId]/quizzes/[quizId]/import` (não tocada pela consolidação de abas).
- Upload → `validateStructural` (bloqueante) + `createSchemaValidator`/`summarizeSchemaWarnings`
  (avisos, nunca bloqueia) → preview em tabela (`ImportQuestions.jsx`) → selecionar/"selecionar
  tudo" → import em `POST /api/canvas/import`.
- O import **ignora** `course_id`/`quiz_id` do próprio arquivo (valem os `courseId`/`quizId`
  da rota). Mapeamento `toCanvasPayload` (is_correct→answer_weight, answer_comment→
  answer_comment_html).
- `QuizImportPanel.jsx` tem abas folder-style, incluindo a aba "Enviar arquivo".

## Arquivos-chave

- `quizzes/[quizId]/import/page.jsx` · [QuizImportPanel.jsx](src/components/QuizImportPanel.jsx) ·
  [ImportQuestions.jsx](src/components/ImportQuestions.jsx) · `src/app/api/canvas/import/route.js` ·
  [quizValidation.js](src/lib/quizValidation.js).

## Contratos

- [quiz-schema.md](../contracts/quiz-schema.md) · [canvas-api.md](../contracts/canvas-api.md) (`createQuestion`).

## Dependências

- [validation-model.md](../platform/validation-model.md) · [atividades.md](atividades.md) ·
  [cli.md](cli.md)
