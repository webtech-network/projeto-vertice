---
title: Workspace do curso (tabs integradas)
status: implemented
domain: canvas
updated: 2026-11-19
---
# Workspace do curso

> A visão integrada de um curso — abas **Anotações / Atividades / Mensagens / Alunos / Arquivos** — que
> substituiu as antigas páginas separadas `atividades`/`mensagens`/`alunos`. Renderizada em
> dois lugares: inline (linha expandida do `CourseBrowser`) e em tela cheia (`/courses/[id]`).

## Comportamento

- `CourseWorkspaceTabs.jsx` (`'use client'`) tem 5 abas (4 na Visão Aluno: **Alunos** é
  oculta quando `viewRole === 'student'`, com fallback para **Anotações**). Cada aba busca
  seus dados **lazily,
  só na primeira vez que abre** (nunca todas de uma vez). Default: **Anotações**; `?tab=`
  preseleciona (ex.: link de tarefa atrelada a uma atividade do Canvas).
- Todas as leituras das abas passam pelo cache de consultas ([ADR-0015](../decisions/0015-cache-local-tanstack-query.md),
  `src/lib/query/canvasQueries.js`): pintam na hora a partir do cache e revalidam em segundo
  plano. **Atividades**/**Alunos** na faixa `volatile` (contadores e notas); **Mensagens** do
  curso na faixa `live`. Trocar entre cursos expandidos não volta ao Canvas.
- **Mensagens**/**Alunos**/**Arquivos** precisam da sessão Canvas (`/api/canvas/status`, faixa `stable`) e
  das integrações de IA (`/api/ai/integrations/configured`, faixa `volatile`), buscadas como
  consultas próprias na primeira dessas abas. Falha degrada para defaults vazios (picker de IA
  some). Enviar mensagem invalida as mensagens do curso e a caixa de entrada.
- `/courses/[courseId]/page.jsx` (Server): `requireCanvasIntegration` → `CanvasNotConnected`
  se sem integração; **não chama o Canvas**. `CoursePageContent.jsx` (cliente) resolve nome e
  código do curso pelo cache (lista de cursos, faixa `stable`; senão
  `GET /api/canvas/courses/[courseId]`) e só então monta `ContextBanner` e
  `CourseWorkspaceTabs` (as Anotações dependem do `course_code`). `loading.jsx` no segmento
  dá resposta imediata ao navegar ([ADR-0016](../decisions/0016-refresh-single-flight-leituras-paralelas.md)).
- **Ordem** ([ADR-0023](../decisions/0023-ordem-cronologica-no-curso.md)): dentro do curso, as
  listas seguem o tempo — Atividades por prazo ([atividades.md](atividades.md)), Arquivos por envio e
  Mensagens abrindo a última conversa ([messages.md](messages.md)).
- **Aba Arquivos** (`CourseFiles.jsx`, todos os papéis): `GET /api/canvas/courses/[id]/files`
  (só metadados: nome, `created_at`, tamanho, tipo; faixa `volatile`, lazy como as outras abas).
  Ordem **mais recente primeiro** por padrão; dropdown **Mais recente / Mais antigo** (por
  `created_at`), cabeçalhos ordenáveis (Arquivo, Enviado em, Tamanho — o dropdown mostra "Ordenado por coluna"
  quando outra coluna manda) e busca por nome (cliente). Cada linha abre o arquivo no Canvas
  (`<baseUrl>/courses/<id>/files/<fileId>`, daí a dependência da sessão). Estados: carregando;
  **vazio** ("Nenhum arquivo enviado neste curso ainda." — inclui resposta `null`/`[]` **e** 401/403 do
  Canvas, que ele devolve tanto para curso sem arquivos quanto para Arquivos oculto ao papel,
  indistinguíveis); **erro** (alerta, só para falha real: rede/5xx/404). Sem paginação na UI:
  a rota busca todas as páginas do Canvas.
- **Padrão visual das abas de lista** (Atividades, Mensagens, Arquivos — toda aba nova segue):
  linha de controles em `.browser-controls` (busca `.search-input` e seletores com a mesma altura,
  borda `--line` e fundo `--paper-raised`; grupos de filtro em `.segmented`); tabela `.data-table`
  dentro de `.data-table-wrap`; **cabeçalhos ordenáveis** com `.th-sort-btn` + `SortIcon` (e
  `aria-sort`), nunca texto solto no `<th>` (que fica sem padding); primeira coluna de ícone/estado
  em `.status-cell`, nome em `.course-name-cell`, valores em `.pending-cell` e botões em
  `.actions-cell` com `.btn.btn-icon`; coluna final **"Ações"**. Em Arquivos a ordenação por
  coluna (nome/data/tamanho) e o dropdown "Mais recente/Mais antigo" são a mesma ordenação — o
  dropdown só controla a data; ordenando por outra coluna ele mostra "Ordenado por coluna".
- **Foco ao chegar pelo `CourseBrowser`**: `CourseWorkspaceTabs` aceita `focusNearest`
  (Atividades → rola e destaca a entrega mais próxima) e `focusLatestMessage` (Mensagens → abre a
  conversa mais recente). O `CourseBrowser` remonta as abas (`key` com um token) para reaplicar o
  foco mesmo com o curso já aberto; chegando por aba normal, nada é rolado.
- `courses/[id]/atividades|mensagens|alunos/page.jsx` são **redirects finos** para
  `/courses/[id]?tab=...` (preservam bookmarks/histórico).

## Arquivos-chave

- [page.jsx](src/app/(dashboard)/courses/[courseId]/page.jsx) · `CoursePageContent.jsx` · `loading.jsx` ·
  [CourseWorkspaceTabs.jsx](src/components/CourseWorkspaceTabs.jsx) ·
  [CourseFiles.jsx](src/components/CourseFiles.jsx) ·
  [files/route.js](src/app/api/canvas/courses/[courseId]/files/route.js) ·
  `ActiveWorkspaceCourseBanner.jsx`, `ContextBanner.jsx`.

## Dados e persistência

- `course_workspace_links` (PK `user_id, course_id`) liga um curso do Canvas a um workspace
  (ver [workspaces.md](workspaces.md)).

## Dependências

- [atividades.md](atividades.md) · [messages.md](messages.md) · [course-notes.md](course-notes.md) ·
  [student-engagement.md](student-engagement.md) · [workspaces.md](workspaces.md)
