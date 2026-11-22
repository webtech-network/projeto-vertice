---
title: Pendências (a corrigir / a fazer)
status: implemented
domain: canvas
updated: 2026-11-19
---

# Pendências (a corrigir / a fazer)

> O que exige ação do usuário no Canvas: **a corrigir** para quem é professor, **a fazer**
> para quem é aluno. Substitui o antigo "Correções pendentes".

## Propósito

O painel era só do professor. O mesmo usuário pode ter papéis diferentes por curso
([course-browser.md](course-browser.md)); cada um vê o que lhe cabe.

## Comportamento

- **Dashboard** ([dashboard.md](dashboard.md)): tiles "Pendências a corrigir" e "Pendências a
  fazer"; cartões `PendingGradingList` (a corrigir; oculto quando não há curso como professor)
  e `PendingTodoList` (a fazer; mostra "Nenhuma atividade a fazer." quando vazio).
- **Lista de cursos**: coluna "Pendências" mostra `needs_grading_count` (professor) e, para
  cursos em que o usuário é aluno, `todo_count`; selo com tooltip do tipo.
- Itens a fazer: nome, curso, prazo (atrasado/em breve) e link para a atividade no Canvas.
  Ordem: vencidas primeiro, depois prazo mais próximo.

## Arquivos-chave

- `src/components/PendingGradingList.jsx` · `src/components/PendingTodoList.jsx` ·
  `src/lib/dashboard.js` (`deriveStudentTodoItems`) · `src/lib/canvasClient.js`
  (`listStudentTodo`, `listMissingSubmissions`) · `src/app/api/dashboard/summary/route.js` ·
  `src/app/api/canvas/courses/route.js`.

## Contratos

- [canvas-api.md](../contracts/canvas-api.md) — `listStudentTodo`, `listMissingSubmissions`.

## Dados e persistência

- Sem tabela própria: vem do Canvas e entra no cache `dashboardSummary`
  ([ADR-0015](../decisions/0015-cache-local-tanstack-query.md)).

## Decisões

- [ADR-0022](../decisions/0022-pendencias-do-aluno-todo-canvas.md).

## Invariantes e gotchas

- Só atividades com `due_at` entram em "a fazer".
- Falha na busca do aluno não derruba o painel (`errors: ['todo']`).
- `needs_grading_count` e `todo_count` nunca se somam: são papéis diferentes.

## Dependências

- [dashboard.md](dashboard.md) · [course-browser.md](course-browser.md) ·
  [canvas-api.md](../contracts/canvas-api.md)
