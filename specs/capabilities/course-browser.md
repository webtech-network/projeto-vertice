---
title: Navegador de cursos
status: implemented
domain: canvas
updated: 2026-11-19
---

# Navegador de cursos

> `/courses` lista os cursos do usuário no Canvas (qualquer papel), com favoritos, status e pendências, e
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
- Coluna "Meu papel" (após a estrela): ícone **por papel** no curso (`user_role` de
  `listUserCourses`) — Professor `Presentation`, Tutor/assistente (`ta`) `UserCog`, Designer
  `Palette`, Aluno `GraduationCap`, Observador `Eye`; `title`/`aria-label` com o nome. Se o
  usuário tem mais de um papel no curso, o ícone é o do papel principal (prioridade
  professor > tutor > designer > aluno > observador) e o `title` lista todos (`user_roles`).
- **Nome do curso**: antes do nome, uma **bolinha por workspace** do curso (cor do workspace;
  `title` = nome; vem de `getWorkspaceIdsForResource('course', id)`, Base não conta). Curso sem
  workspace reserva o espaço (invisível) para o nome alinhar com o cabeçalho "Curso".
- **Contadores clicáveis** ([ADR-0023](../decisions/0023-ordem-cronologica-no-curso.md)):
  pendências (a corrigir / a fazer) abrem o curso na aba **Atividades** já na entrega mais próxima;
  o contador de **mensagens** abre a aba **Mensagens** na última conversa
  ([course-workspace.md](course-workspace.md)). Hover: o número cresce levemente e fica laranja.
- Barra de controles: a busca e os grupos favoritos/status ficam na primeira linha; o dropdown
  **"Papel"** vai numa **linha própria logo abaixo**, alinhado à esquerda com a tabela
  (`.browser-controls-row`). Dropdown **"Papel"** (`RoleFilterDropdown`), **sempre visível** —
  inclusive para quem tem um papel só (aluno). Multisseleção por clique, sem teclado: cada
  clique liga/desliga o papel e o menu continua aberto. Opções: **Todos** (limpa a seleção),
  Professor, Tutor, Designer, Aluno, Observador — Tutor/Designer aparecem para todos, mesmo sem
  curso (contagem 0). Nenhum marcado = todos. Um curso passa se **qualquer** de seus papéis
  estiver marcado. Persistido em `courseBrowserState` (`roles` + `rolesChosen`).
- **Papel único abre filtrado**: se todos os cursos do usuário têm **um** papel só (só aluno, só
  professor…), o filtro já abre nele em vez de "Todos os papéis"; com mais de um papel, abre em
  "Todos". Resolvido uma vez quando a lista chega. O estado salvo sempre inclui `roles` (até `[]`),
  então só `rolesChosen: true` — gravado ao clicar no dropdown — conta como escolha do usuário e
  impede o padrão; sem ele o padrão é recalculado.
- Falha na busca de um papel (`listUserCourses` engolia o erro) vira aviso "não foi possível
  carregar cursos como <papel>" (`role_errors` na resposta).
- Coluna **Pendências** (a corrigir / a fazer): ver [pendencias.md](pendencias.md).
- **Legenda de ícones** sob a tabela: sempre numa linha só (`.icon-legend-single-line`); se não
  couber, rola de lado.
- Favoritar/desfavoritar via `addCourseFavorite`/`removeCourseFavorite`.

## Arquivos-chave

- [courses/page.jsx](src/app/(dashboard)/courses/page.jsx) · [CourseBrowser.jsx](src/components/CourseBrowser.jsx) ·
  `RoleFilterDropdown.jsx` · [StatusIcon.jsx](src/components/StatusIcon.jsx).

## Contratos

- [canvas-api.md](../contracts/canvas-api.md) — `listCourses`, `addCourseFavorite`, `removeCourseFavorite`.

## Invariantes e gotchas

- Não reverter para `<Link>` envolvendo o `<tr>` inteiro (padrão substituído de propósito).
- `total_students` (include) alimenta o tile de alunos do dashboard.

## Decisões

- Default favoritos: [ADR-0002](../decisions/0002-favoritos-default.md). Linha não é link:
  [ADR-0003](../decisions/0003-botao-ver-atividades.md).

## Dependências

- [course-workspace.md](course-workspace.md) · [dashboard.md](dashboard.md) · [pendencias.md](pendencias.md) ·
  [canvas-api.md](../contracts/canvas-api.md)
