---
title: Dashboard (painel de widgets)
status: implemented
domain: frontend
updated: 2026-09-17
---

# Dashboard (painel de widgets)

> A home `/` é um painel-resumo do dia a dia do professor, alimentado por agregados do Canvas
> com **stale-while-revalidate** e por tarefas/atalhos próprios (Postgres).

## Comportamento

- `(dashboard)/page.jsx` (Server Component, `getSupabaseUser`) → `<DashboardPanel />`.
- `DashboardPanel.jsx` pinta **instantaneamente** do cache IndexedDB (marcado `stale`) e, em
  paralelo, busca `GET /api/dashboard/summary` (fresh), atualizando UI e cache ao resolver.
  Sem cache (primeira visita) → loading.
- Widgets: `DashboardStats` (disciplinas ativas, alunos, mensagens pendentes, correções
  pendentes), `DashboardDoingTasks` + `DashboardShortcuts`, `DueDateCalendar`,
  `RecentDeadlines`, `PendingGradingList`.
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

- [dashboard-shell.md](dashboard-shell.md) · [tasks.md](tasks.md) · [rubric-grading.md](rubric-grading.md) ·
  [course-browser.md](course-browser.md)
