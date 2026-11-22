---
title: Atividades (assignments) do curso
status: implemented
domain: canvas
updated: 2026-11-19
---

# Atividades (assignments) do curso

> A aba "Atividades" do workspace do curso: lista os assignments e dá acesso a importar
> questões, corrigir com rubrica e distribuir e consolidar a avaliação por pares.

## Comportamento

- `AssignmentsTable.jsx` lista `listAssignments(courseId)` — cada assignment com
  `needs_grading_count` e `published` (campos já presentes no objeto Assignment; sem `include[]`).
- **Ordem padrão** ([ADR-0023](../decisions/0023-ordem-cronologica-no-curso.md)), sem ordenação
  manual: (1) as que ainda vencem, da entrega **mais próxima de hoje à mais distante**; (2) as sem
  data, em seguida; (3) numa **camada separada** (linha-divisória "Já encerradas (N)", linhas
  esmaecidas), as de prazo vencido, da mais recente à mais antiga. Ordenar por coluna volta a uma
  lista única. "Encerrada" = `due_at` no passado, **não** "entregue" (a lista não traz a submissão do
  usuário). O filtro publicadas/não publicadas vale antes do agrupamento.
- **Foco** (`focusNearest`, vindo das pendências do `CourseBrowser`): rola até a atividade com a
  entrega mais próxima de agora (a próxima a vencer; sem futura, a vencida mais recente) entre as
  filtradas e a destaca (`is-focused-row`). Uma vez por montagem.
- Botão **"Importar questões"** aparece **somente** quando `assignment.quiz_id` é truthy
  (classic Quiz, `submission_types: ['online_quiz']`); liga a
  `courses/[id]/quizzes/[quizId]/import`. **Nunca** usar `assignment.is_quiz_assignment`
  (sinaliza New Quizzes/LTI, que a API de import não alcança).
- Botão **"Corrigir com rubrica"** é incondicional (não dá para saber se há rubrica pelo
  `listAssignments`) → `courses/[id]/assignments/[assignmentId]/grade`.
- Botão **"Distribuir avaliação por pares"** aparece **somente** quando
  `assignment.peer_reviews` é truthy (campo do objeto Assignment) →
  `courses/[id]/assignments/[assignmentId]/peer-reviews`
  ([peer-review-distribution.md](peer-review-distribution.md)).
- Botão **"Consolidar avaliação por pares"** aparece com a mesma condição
  (`assignment.peer_reviews`) → `courses/[id]/assignments/[assignmentId]/peer-grading`
  ([peer-review-grading.md](peer-review-grading.md)).
- A rota `/courses/[id]/atividades` hoje é redirect para `/courses/[id]?tab=atividades`.

## Arquivos-chave

- [AssignmentsTable.jsx](src/components/AssignmentsTable.jsx) ·
  [atividades/page.jsx](src/app/(dashboard)/courses/[courseId]/atividades/page.jsx) (redirect).

## Contratos

- [canvas-api.md](../contracts/canvas-api.md) — `listAssignments`, `getAssignment`.

## Dependências

- [quiz-import.md](quiz-import.md) · [rubric-grading.md](rubric-grading.md) ·
  [peer-review-distribution.md](peer-review-distribution.md) ·
  [peer-review-grading.md](peer-review-grading.md) · [course-workspace.md](course-workspace.md)
