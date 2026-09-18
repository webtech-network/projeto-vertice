---
title: Ambientes (workspaces)
status: implemented
domain: data
updated: 2026-09-17
---

# Ambientes (workspaces)

> Ambientes agrupam **projetos** e **cursos** num mesmo contexto (ex.: uma disciplina, um
> semestre) e fornecem o filtro de escopo global (Topbar). "Base" é um workspace **sintético**,
> nunca um registro.

## Comportamento

- `WorkspaceScopeProvider` montado em `(dashboard)/layout.jsx` (não numa página) — o filtro
  alcança toda rota sem remontar. `WorkspaceSwitcher` vive na Topbar.
- Estado começa em **Base** (SSR-safe), hidrata do Postgres (`listWorkspaces` + `listAllLinks`),
  e lê o id ativo do localStorage/`ui_preferences` após mount.
- **Escopo**: `getVisibleResourceIds(resourceType)` → `null` quando Base ativa (sem filtro);
  senão o `Set` de `resourceId`s ligados ao workspace ativo. Filtra Tarefas, Cursos/Atividades
  e Notas de curso.
- **Links são dados derivados**, não tabela: `projects.workspace_id` + `course_workspace_links`.
  Qualquer mudança relevante → refetch completo (mesmo padrão pós-write).
- Atalhos Alt+1..9 trocam de workspace (lê `e.code` `Digit1..9`, não `e.key`). Base é sempre #1.
- Gerenciar via `WorkspaceFormModal`/`WorkspaceManagerModal`; membership por workspace
  (`WorkspaceEditModal`) ou por recurso (`setResourceWorkspaces`).

## Arquivos-chave

- [WorkspaceScopeProvider.jsx](src/components/WorkspaceScopeProvider.jsx) ·
  [WorkspaceSwitcher.jsx](src/components/WorkspaceSwitcher.jsx) · `WorkspaceFormModal.jsx`,
  `WorkspaceManagerModal.jsx`, `WorkspaceEditModal.jsx`, `ActiveWorkspaceCourseBanner.jsx` ·
  `src/lib/workspaces/` (`workspacesRepo.js`, `activeWorkspacePreference.js`).

## Contratos

- [supabase-schema.md](../contracts/supabase-schema.md) — `workspaces`, `course_workspace_links`,
  `projects.workspace_id`.

## Dados e persistência

- `workspaces` no Postgres (soft delete). Realtime em `workspaces`, `projects`,
  `course_workspace_links`. Id ativo em `activeWorkspacePreference` (localStorage + write-through).

## Decisões

- Base é sintético: [ADR-0012](../decisions/0012-workspace-base-sintetico.md).
  Soft delete: [ADR-0011](../decisions/0011-soft-delete-vs-delete.md).

## Invariantes e gotchas

- **Alt**, não Ctrl/Cmd (Ctrl/Cmd+digit é do navegador); `e.code`, não `e.key` (macOS Option
  remapeia `e.key`); ignora quando digitando em input/textarea/contentEditable.
- Workspace ativo deletado em outro dispositivo → tombstone via Realtime → cai para Base.

## Dependências

- [course-workspace.md](course-workspace.md) · [tasks.md](tasks.md) ·
  [data-storage.md](../platform/data-storage.md)
