---
title: Correção com rubrica
status: implemented
domain: canvas
updated: 2026-09-17
---

# Correção com rubrica

> Corrige as submissões de uma atividade preenchendo a rubrica estruturada do próprio Canvas
> (não só uma nota somada + comentário em prosa).

## Comportamento

- Página `courses/[id]/assignments/[assignmentId]/grade` busca **sequencialmente** (nunca
  `Promise.all`) `getCourse` → `getAssignment` (fetch fresco de um assignment só, que é a ação
  documentada que garante o campo `rubric`) → `listSubmissions(..., { include: ['user',
  'rubric_assessment'] })`.
- `RubricGrader.jsx` (`'use client'`): tabela única, 1 linha por aluno, 1 `<select>` por
  critério da rubrica, pré-preenchido do `rubric_assessment` existente. Sem rubrica →
  mensagem "sem rubrica".
- Envio por aluno: `PUT /api/canvas/courses/[id]/assignments/[aid]/submissions/[uid]` com
  `buildGradePayload` (de `rubricGrading.js`) no shape real
  `rubric_assessment[criterion_id][points|rating_id|comments]` + `submission[posted_grade]` +
  `comment[text_comment]` — para a UI de rubrica do Canvas ficar populada. `posted_grade` é
  enviado explícito (a soma dos pontos), sem depender do auto-cálculo do Canvas.
- "Enviar todas as notas": sequencial por linha (mesma regra anti-race), após confirm, e
  **pula** qualquer linha sem critério selecionado (evita zerar aluno não revisado).

## Arquivos-chave

- `grade/page.jsx` · [RubricGrader.jsx](src/components/RubricGrader.jsx) ·
  [rubricGrading.js](src/lib/rubricGrading.js) · `src/app/api/canvas/courses/[courseId]/assignments/[assignmentId]/submissions/[userId]/route.js`.

## Contratos

- [canvas-api.md](../contracts/canvas-api.md) — `getAssignment`, `listSubmissions`,
  `gradeSubmissionWithRubric`.

## Decisões

- Portado de `RubricTool/` (protótipo standalone, mantido como referência read-only). O gap
  herdado — só `posted_grade` + comentário em prosa — foi **corrigido** enviando
  `rubric_assessment` estruturado.

## Dependências

- [atividades.md](atividades.md) · [dashboard.md](dashboard.md) ·
  [canvas-api.md](../contracts/canvas-api.md)
