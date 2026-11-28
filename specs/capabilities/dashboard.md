---
title: Dashboard (painel de widgets)
status: implemented
domain: frontend
updated: 2026-11-19
---

# Dashboard (painel de widgets)

> A home `/` é um painel-resumo do dia a dia (professor e aluno), alimentado por agregados do Canvas
> com **stale-while-revalidate** e por tarefas/atalhos próprios (Postgres).

## Comportamento

- `(dashboard)/page.jsx` (Server Component, `getSupabaseUser`) → `<DashboardPanel />`.
- `DashboardPanel.jsx` pinta **instantaneamente** do cache IndexedDB (marcado `stale`) e, em
  paralelo, busca `GET /api/dashboard/summary` (fresh), atualizando UI e cache ao resolver.
  Sem cache (primeira visita) → loading.
- Widgets: `DashboardStats` (disciplinas ativas, alunos, mensagens pendentes, correções
  pendentes), `DashboardDoingTasks` + `DashboardShortcuts`, `DueDateCalendar`,
  `RecentDeadlines`, `PendingGradingList` (a corrigir) e `PendingTodoList` (a fazer) —
  ver [pendencias.md](pendencias.md).
- **Separação por visão ativa** ([ADR-0027](../decisions/0027-sistema-de-roles-e-visao-ativa.md)):
  na Visão Professor exibe "Alunos ao todo", "Pendências a corrigir" e `PendingGradingList`;
  na Visão Aluno exibe "Pendências a fazer" e `PendingTodoList`. O cache IndexedDB e a rota
  `/api/dashboard/summary?role=` são escopados pelo `viewRole` ativo.
- Em "Atividades recentes"/"Correções pendentes", clicar numa linha abre a correção **dentro
  do Vértice**; o ícone externo abre a mesma atividade no SpeedGrader do Canvas.

## Arquivos-chave

- [page.jsx](src/app/(dashboard)/page.jsx) · [DashboardPanel.jsx](src/components/DashboardPanel.jsx) ·
  `DashboardStats.jsx`, `DueDateCalendar.jsx`, `RecentDeadlines.jsx`, `DashboardDoingTasks.jsx`,
  `DashboardShortcuts.jsx`, `PendingGradingList.jsx` · [dashboardCache.js](src/lib/dashboardCache.js) ·
  `src/app/api/dashboard/summary/route.js`.

## Dados e persistência

- Cache IndexedDB nas chaves `dashboard:courses`, `dashboard:messages`, `dashboard:assignments`
  (agregados do Canvas). Fonte fresh: `/api/dashboard/summary`.

## Decisões

- Home virou painel; pitch/features → `/sobre`: [ADR-0010](../decisions/0010-home-painel-sobre.md).

## Dependências

- [pendencias.md](pendencias.md) · [dashboard-shell.md](dashboard-shell.md) · [tasks.md](tasks.md) · [rubric-grading.md](rubric-grading.md) ·
  [course-browser.md](course-browser.md)
