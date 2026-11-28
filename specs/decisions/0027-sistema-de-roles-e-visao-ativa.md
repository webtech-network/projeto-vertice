---
title: Sistema de roles e visão ativa (Professor vs. Aluno)
status: accepted
date: 2026-11-28
supersedes: []
superseded_by: []
---

# ADR-0027: Sistema de roles e visão ativa (Professor vs. Aluno)

## Contexto

O Vértice nasceu focado em professores, mas passou a atender também alunos ([ADR-0022](0022-pendencias-do-aluno-todo-canvas.md)). Um mesmo usuário no Canvas pode ter matrículas de professor (`TeacherEnrollment`, `TaEnrollment`, `DesignerEnrollment`) em alguns cursos e de aluno (`StudentEnrollment`, `ObserverEnrollment`) em outros — ou apenas um dos papéis. Exibir widgets e ações docentes para alunos (e vice-versa) polui a interface e confunde os fluxos.

## Decisão

1. **Detecção no OAuth**: o payload de troca de token do Canvas (`/login/oauth2/token`) não traz os papéis do usuário. No callback OAuth (`/oauth2/callback`), o servidor consulta `GET /api/v1/users/self/enrollments?state[]=active` (*best-effort*, em paralelo com `getSelf`) e deriva os papéis de aplicativo (`teacher` e/ou `student`), gravando `roles` e `primary_role` em `integrations.metadata`.
2. **Separação entre papéis possuídos e visão ativa**:
   - `availableRoles` (lido de `integrations.metadata.roles` via `/api/canvas/status`) define o que o usuário **pode** acessar.
   - `activeViewMode` (`'teacher' | 'student'`) define **qual visão está ativa** na UI, persistida em `localStorage` (`vertice:active-view-role`) e sincronizada em `ui_preferences.active_view_mode`.
3. **Alternância individual**: quem possui papel `teacher` pode alternar livremente entre **Professor** e **Aluno** pelo `ViewRoleSwitcher` no Topbar (útil para quem tem ambos os papéis ou quer pré-visualizar como aluno). Quem possui exclusivamente `student` no Canvas permanece na visão `student`.

## Alternativas consideradas

- **Duas rotas/portais separados (`/aluno/*` e `/professor/*`)**: duplicaria páginas, layouts e cache; a troca por contexto (`ViewRoleProvider`) reaproveita as mesmas rotas e isola o cache do Dashboard por chave (`dashboardSummary(viewRole)`).
- **Detectar apenas em `/api/canvas/courses`**: atrasaria o conhecimento do papel até abrir `/courses` e exigiria N chamadas por papel mesmo quando o usuário só usa o Dashboard.

## Consequências

- Contas conectadas antes desta mudança sem `metadata.roles` fazem fallback gracioso até o próximo login/reconexão Canvas.
- Rotas exclusivamente docentes (`/grade`, `/peer-reviews`, `/peer-grading`, `/import`) são protegidas na UI por `TeacherOnlyGuard` quando `viewRole === 'student'`.
