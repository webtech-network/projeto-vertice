---
title: Importação de questões (JSON → quiz)
status: implemented
domain: canvas
updated: 2026-11-12
---

# Importação de questões (JSON → quiz)

> Fluxo central do produto: pegar um arquivo JSON de questões, validar/preview, selecionar e
> importar num quiz clássico do Canvas via `POST /courses/:id/quizzes/:quiz_id/questions`.
> Aceita múltipla escolha e questões abertas (dissertativa, texto sem questão, envio de arquivo)
> no mesmo arquivo — ver [ADR-0019](../decisions/0019-questoes-abertas.md).

## Comportamento

- Rota `courses/[courseId]/quizzes/[quizId]/import` (não tocada pela consolidação de abas).
- Upload → `validateStructural` (bloqueante) + `createSchemaValidator`/`summarizeSchemaWarnings`
  (avisos, nunca bloqueia) → preview em tabela (`ImportQuestions.jsx`) → selecionar/"selecionar
  tudo" → import em `POST /api/canvas/import`. A tabela de preview mostra o **tipo** de cada
  questão e o nº de alternativas (`—` nos tipos abertos).
- **Revisão em acordeão** (`QuizReviewImport.jsx`, compartilhado com `/questoes`): cada linha
  mostra o título e, abaixo, um trecho do enunciado em texto puro (2 linhas). Clicar no título
  (ou no chevron) abre/fecha a linha de detalhe da questão; várias podem ficar abertas, com
  "Expandir todas"/"Recolher todas". O detalhe ([QuestionPreview.jsx](src/components/QuestionPreview.jsx))
  renderiza a questão como o aluno a verá — enunciado em HTML, alternativas A, B, C… com a
  correta destacada e o comentário de cada uma, e o comentário geral (`feedback_comment`,
  "Padrão de resposta") nas abertas — num `iframe` sandbox, folha sempre clara
  ([ADR-0020](../decisions/0020-preview-html-iframe-sandbox.md)). O detalhe também tem o
  checkbox "Importar esta questão", sincronizado com o da linha.
- O import **ignora** `course_id`/`quiz_id` do próprio arquivo (valem os `courseId`/`quizId`
  da rota). Mapeamento `toCanvasPayload` (is_correct→answer_weight, answer_comment→
  answer_comment_html).
- Página intitulada **"Questões da atividade"**. Ações no título: **"Curso no Canvas"** e
  **"Atividade no Canvas"** (links externos, nova aba — `courseUrl`/`quizUrl` de
  `canvasLinks.js`), mais o `BackButton` (volta ao curso de origem, aba Atividades — ver
  [routing-and-shell.md](../platform/routing-and-shell.md)).
- `QuizImportPanel.jsx` tem abas folder-style, nesta ordem: **"Gerar questões com IA"**
  (padrão ao abrir) e **"Enviar arquivo"**.

## Invariantes e gotchas

- HTML de questão nunca vai para o DOM do app: só dentro do `iframe` sandbox sem
  `allow-scripts` (ADR-0020); o trecho na linha da tabela é texto puro.

## Arquivos-chave

- `quizzes/[quizId]/import/page.jsx` · [QuizImportPanel.jsx](src/components/QuizImportPanel.jsx) ·
  [ImportQuestions.jsx](src/components/ImportQuestions.jsx) ·
  [QuizReviewImport.jsx](src/components/QuizReviewImport.jsx) · [QuestionPreview.jsx](src/components/QuestionPreview.jsx) · `src/app/api/canvas/import/route.js` ·
  [quizValidation.js](src/lib/quizValidation.js).

## Contratos

- [quiz-schema.md](../contracts/quiz-schema.md) · [canvas-api.md](../contracts/canvas-api.md) (`createQuestion`).

## Dependências

- [validation-model.md](../platform/validation-model.md) · [atividades.md](atividades.md) ·
  [cli.md](cli.md)
