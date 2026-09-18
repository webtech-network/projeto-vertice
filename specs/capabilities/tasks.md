---
title: Tarefas (Kanban/Eisenhower/Tabela)
status: implemented
domain: data
updated: 2026-09-17
---

# Tarefas

> Painel de tarefas pessoais em três visões (Kanban por status, matriz de Eisenhower por
> importância × urgência, e tabela), agrupadas em projetos opcionais. Dados no Postgres,
> com Realtime.

## Comportamento

- `tarefas/page.jsx` (Server, sem dados do Canvas) → `TasksProvider` + `TasksView` (`'use client'`).
- Visões: **Kanban** (colunas `BACKLOG`/`BLOCK`/`TODO`/`DOING`/`DONE`), **Eisenhower**
  (`urgent` × `important`), **Tabela**. Drag-and-drop (`@dnd-kit`) entre colunas/quadrantes.
- Card clica → `TaskDetailModal` (editar detalhes; pickers de curso/atividade/aluno do Canvas
  via fetchers cached de `src/lib/tasks/canvasResolution.js`). `TaskContextMenu` p/ ações rápidas.
- Controles: filtrar, mostrar/ocultar Backlog+Bloqueadas, densidade dos cards, agrupar por
  projeto, projetos, exportar/importar tarefas (`FileJson`), preferências (`TarefasPreferences`).
- Campos: `status`, `urgent`/`important`, `priority_rank` 0-9, `due_date` (`YYYY-MM-DD`),
  `canvas_references` (jsonb).

## Arquivos-chave

- [tarefas/page.jsx](src/app/(dashboard)/tarefas/page.jsx) · [TasksProvider.jsx](src/components/TasksProvider.jsx) ·
  [TasksView.jsx](src/components/TasksView.jsx) · `KanbanBoard.jsx`, `EisenhowerMatrix.jsx`,
  `TaskTable.jsx`, [TaskCard.jsx](src/components/TaskCard.jsx), [TaskContextMenu.jsx](src/components/TaskContextMenu.jsx),
  `TaskDetailModal.jsx` · `src/lib/tasks/` (`tasksRepo.js`, `canvasResolution.js`, `tasksViewPreferences.js`).

## Contratos

- [supabase-schema.md](../contracts/supabase-schema.md) — `tasks`, `projects`.

## Dados e persistência

- `tasks`/`projects` no **Postgres** (RLS `auth.uid()`), Realtime (`useRealtimeTable`). Soft
  delete (`deleted_at`). `canvasResolution` cacheia agregados do Canvas (stale-while-revalidate)
  para os pickers.

## Decisões

- IndexedDB → Postgres + Realtime: [ADR-0008](../decisions/0008-postgres-realtime-migracao.md).
  Soft delete: [ADR-0011](../decisions/0011-soft-delete-vs-delete.md).

## Invariantes e gotchas

- O comentário em `tarefas/page.jsx` ainda diz "IndexedDB" — **desatualizado** (Fase 1 migrou
  para Postgres); não se guiar por ele.
- `updatedAt`/`createdAt`/`deletedAt` são epoch-ms number (last-write-wins em `mergeRecords`).
- A página não bate no Canvas no load; os pickers resolvem client-side sob demanda.

## Dependências

- [workspaces.md](workspaces.md) · [data-storage.md](../platform/data-storage.md) ·
  [dashboard.md](dashboard.md)
