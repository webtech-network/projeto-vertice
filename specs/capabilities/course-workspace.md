---
title: Workspace do curso (tabs integradas)
status: implemented
domain: canvas
updated: 2026-09-17
---
# Workspace do curso

> A visão integrada de um curso — abas **Anotações / Atividades / Mensagens / Alunos** — que
> substituiu as antigas páginas separadas `atividades`/`mensagens`/`alunos`. Renderizada em
> dois lugares: inline (linha expandida do `CourseBrowser`) e em tela cheia (`/courses/[id]`).

## Comportamento

- `CourseWorkspaceTabs.jsx` (`'use client'`) tem 4 abas. Cada aba busca seus dados **lazily,
  só na primeira vez que abre** (nunca as 4 de uma vez). Default: **Anotações**; `?tab=`
  preseleciona (ex.: link de tarefa atrelada a uma atividade do Canvas).
- **Atividades**/**Alunos** reusam os fetchers com cache stale-while-revalidate de
  `src/lib/tasks/canvasResolution.js` (`listCourseAssignments`, `listCourseStudentsCached`) —
  trocar entre cursos expandidos não re-bate no Canvas.
- **Mensagens**/**Alunos** precisam da sessão Canvas + integrações de IA; buscam juntos
  (`/api/canvas/status` + `/api/ai/integrations/configured`, um `Promise.all`) uma vez, na
  primeira dessas abas. Falha degrada para defaults vazios (picker de IA some).
- `/courses/[courseId]/page.jsx` (Server): `requireCanvasIntegration` → `CanvasNotConnected`
  se sem integração; senão `getCourse` + `ContextBanner` + `ActiveWorkspaceCourseBanner` +
  `CourseWorkspaceTabs`.
- `courses/[id]/atividades|mensagens|alunos/page.jsx` são **redirects finos** para
  `/courses/[id]?tab=...` (preservam bookmarks/histórico).

## Arquivos-chave

- [page.jsx](src/app/(dashboard)/courses/[courseId]/page.jsx) ·
  [CourseWorkspaceTabs.jsx](src/components/CourseWorkspaceTabs.jsx) ·
  `ActiveWorkspaceCourseBanner.jsx`, `ContextBanner.jsx`.

## Dados e persistência

- `course_workspace_links` (PK `user_id, course_id`) liga um curso do Canvas a um workspace
  (ver [workspaces.md](workspaces.md)).

## Dependências

- [atividades.md](atividades.md) · [messages.md](messages.md) · [course-notes.md](course-notes.md) ·
  [student-engagement.md](student-engagement.md) · [workspaces.md](workspaces.md)
