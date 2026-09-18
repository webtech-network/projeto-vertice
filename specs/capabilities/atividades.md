---
title: Atividades (assignments) do curso
status: implemented
domain: canvas
updated: 2026-09-17
---

# Atividades (assignments) do curso

> A aba "Atividades" do workspace do curso: lista os assignments e dá acesso a importar
> questões e corrigir com rubrica.

## Comportamento

- `AssignmentsTable.jsx` lista `listAssignments(courseId)` — cada assignment com
  `needs_grading_count` e `published` (campos já presentes no objeto Assignment; sem `include[]`).
- Botão **"Importar questões"** aparece **somente** quando `assignment.quiz_id` é truthy
  (classic Quiz, `submission_types: ['online_quiz']`); liga a
  `courses/[id]/quizzes/[quizId]/import`. **Nunca** usar `assignment.is_quiz_assignment`
  (sinaliza New Quizzes/LTI, que a API de import não alcança).
- Botão **"Corrigir com rubrica"** é incondicional (não dá para saber se há rubrica pelo
  `listAssignments`) → `courses/[id]/assignments/[assignmentId]/grade`.
- A rota `/courses/[id]/atividades` hoje é redirect para `/courses/[id]?tab=atividades`.

## Arquivos-chave

- [AssignmentsTable.jsx](src/components/AssignmentsTable.jsx) ·
  [atividades/page.jsx](src/app/(dashboard)/courses/[courseId]/atividades/page.jsx) (redirect).

## Contratos

- [canvas-api.md](../contracts/canvas-api.md) — `listAssignments`, `getAssignment`.

## Dependências

- [quiz-import.md](quiz-import.md) · [rubric-grading.md](rubric-grading.md) ·
  [course-workspace.md](course-workspace.md)
