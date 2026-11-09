---
title: Workspace do curso (tabs integradas)
status: implemented
domain: canvas
updated: 2026-11-08
---
# Workspace do curso

> A visão integrada de um curso — abas **Anotações / Atividades / Mensagens / Alunos** — que
> substituiu as antigas páginas separadas `atividades`/`mensagens`/`alunos`. Renderizada em
> dois lugares: inline (linha expandida do `CourseBrowser`) e em tela cheia (`/courses/[id]`).

## Comportamento

- `CourseWorkspaceTabs.jsx` (`'use client'`) tem 4 abas. Cada aba busca seus dados **lazily,
  só na primeira vez que abre** (nunca as 4 de uma vez). Default: **Anotações**; `?tab=`
  preseleciona (ex.: link de tarefa atrelada a uma atividade do Canvas).
- Todas as leituras das abas passam pelo cache de consultas ([ADR-0015](../decisions/0015-cache-local-tanstack-query.md),
  `src/lib/query/canvasQueries.js`): pintam na hora a partir do cache e revalidam em segundo
  plano. **Atividades**/**Alunos** na faixa `volatile` (contadores e notas); **Mensagens** do
  curso na faixa `live`. Trocar entre cursos expandidos não volta ao Canvas.
- **Mensagens**/**Alunos** precisam da sessão Canvas (`/api/canvas/status`, faixa `stable`) e
  das integrações de IA (`/api/ai/integrations/configured`, faixa `volatile`), buscadas como
  consultas próprias na primeira dessas abas. Falha degrada para defaults vazios (picker de IA
  some). Enviar mensagem invalida as mensagens do curso e a caixa de entrada.
- `/courses/[courseId]/page.jsx` (Server): `requireCanvasIntegration` → `CanvasNotConnected`
  se sem integração; **não chama o Canvas**. `CoursePageContent.jsx` (cliente) resolve nome e
  código do curso pelo cache (lista de cursos, faixa `stable`; senão
  `GET /api/canvas/courses/[courseId]`) e só então monta `ContextBanner` e
  `CourseWorkspaceTabs` (as Anotações dependem do `course_code`). `loading.jsx` no segmento
  dá resposta imediata ao navegar ([ADR-0016](../decisions/0016-refresh-single-flight-leituras-paralelas.md)).
- `courses/[id]/atividades|mensagens|alunos/page.jsx` são **redirects finos** para
  `/courses/[id]?tab=...` (preservam bookmarks/histórico).

## Arquivos-chave

- [page.jsx](src/app/(dashboard)/courses/[courseId]/page.jsx) · `CoursePageContent.jsx` · `loading.jsx` ·
  [CourseWorkspaceTabs.jsx](src/components/CourseWorkspaceTabs.jsx) ·
  `ActiveWorkspaceCourseBanner.jsx`, `ContextBanner.jsx`.

## Dados e persistência

- `course_workspace_links` (PK `user_id, course_id`) liga um curso do Canvas a um workspace
  (ver [workspaces.md](workspaces.md)).

## Dependências

- [atividades.md](atividades.md) · [messages.md](messages.md) · [course-notes.md](course-notes.md) ·
  [student-engagement.md](student-engagement.md) · [workspaces.md](workspaces.md)
