---
title: Navegador de cursos
status: implemented
domain: canvas
updated: 2026-09-17
---

# Navegador de cursos

> `/courses` lista os cursos do professor no Canvas, com favoritos, status e pendências, e
> expande inline a visão integrada do curso ([course-workspace.md](course-workspace.md)).

## Comportamento

- `courses/page.jsx` (Server) → `CourseBrowser.jsx`. Default mostra **só favoritos**
  (`is_favorite`, via `include[]=favorites` em `listCourses`); cai para "Todos" apenas quando
  a conta não tem nenhum favorito — default de produto intencional.
- Tabela: **Pendências** (`needs_grading_count` do próprio Canvas, via
  `include[]=needs_grading_count`) e `StatusIcon` derivado de `workflow_state`
  (`available`→publicado, `unpublished`, `completed`).
- Cada linha **não é um link**: a célula de ações tem botão explícito (e a expansão inline do
  `CourseWorkspaceTabs`) — mais ações por curso virão na mesma célula.
- Favoritar/desfavoritar via `addCourseFavorite`/`removeCourseFavorite`.

## Arquivos-chave

- [courses/page.jsx](src/app/(dashboard)/courses/page.jsx) · [CourseBrowser.jsx](src/components/CourseBrowser.jsx) ·
  [StatusIcon.jsx](src/components/StatusIcon.jsx).

## Contratos

- [canvas-api.md](../contracts/canvas-api.md) — `listCourses`, `addCourseFavorite`, `removeCourseFavorite`.

## Invariantes e gotchas

- Não reverter para `<Link>` envolvendo o `<tr>` inteiro (padrão substituído de propósito).
- `total_students` (include) alimenta o tile de alunos do dashboard.

## Decisões

- Default favoritos: [ADR-0002](../decisions/0002-favoritos-default.md). Linha não é link:
  [ADR-0003](../decisions/0003-botao-ver-atividades.md).

## Dependências

- [course-workspace.md](course-workspace.md) · [dashboard.md](dashboard.md) ·
  [canvas-api.md](../contracts/canvas-api.md)
