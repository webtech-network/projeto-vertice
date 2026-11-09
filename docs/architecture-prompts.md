# Prompts para diagramas de arquitetura do Vértice

Prompts para ferramentas de IA generativa de diagramas. Servem para documentar a arquitetura
para a equipe de manutenção. Foram montados a partir de `specs/platform/*`, `specs/contracts/*`
e da estrutura de `src/`. Quando a arquitetura mudar, atualize as specs primeiro e depois
estes prompts.

- **Prompt 1**: visão geral (C4 Contexto + Contêineres).
- **Prompt 2**: componentes por módulo (C4 Componentes).

> Se a ferramenta limitar o número de elementos, divida o Prompt 2 em dois diagramas:
> **Cliente** e **Servidor + Supabase + CLI**. Os fluxos F1–F5 ficam no que contiver o servidor.

---

## Prompt 1 — Visão geral da arquitetura

```text
Crie um diagrama de arquitetura de alto nível (estilo C4, nível "Contexto + Contêineres") da aplicação web "Vértice". O público é uma equipe técnica que vai assumir a manutenção do sistema e precisa entender, em uma única página, quais são os grandes blocos, onde cada um roda e como eles se comunicam. Todos os rótulos devem estar em português do Brasil.

## O que é o Vértice
Aplicação de organização pessoal e acadêmica para professores. Ela integra o Canvas LMS (opcional) para gerenciar cursos, importar questões de múltipla escolha em quizzes, corrigir atividades por rubrica, distribuir e consolidar avaliação por pares, acompanhar o engajamento dos alunos e trocar mensagens. Também tem tarefas pessoais (Kanban/Eisenhower), projetos, ambientes (workspaces), anotações por curso e geração de questões por IA generativa.

## Atores (fora do sistema, à esquerda)
1. Professor (usuário web): acessa pelo navegador ou pelo app instalado (PWA).
2. Operador via terminal: usa a ferramenta de linha de comando (CLI) para importar questões em lote.

## Fronteira do sistema "Vértice" (retângulo grande ao centro, com 4 contêineres)

A) Cliente Web, no navegador do professor
   - Aplicação React 19 renderizada pelo Next.js, instalável como PWA.
   - Service Worker que guarda em cache apenas o "app shell" (as páginas, nunca as rotas /api).
   - Armazenamento local: IndexedDB (cache das consultas ao Canvas via TanStack Query, mais os tokens das conexões GitHub/Google), localStorage (preferências de UI) e sessionStorage (estado de navegação).

B) Servidor de Aplicação Next.js 16, em contêiner Docker, porta 80
   - "Proxy" (gate de sessão): bloqueia rotas protegidas sem login.
   - Páginas (Server Components) e API HTTP (Route Handlers em /api), agrupadas em: Canvas, IA, Autenticação, Conexões OAuth (GitHub/Google), Painel, Saúde.
   - Funciona como backend-for-frontend: é o único que fala com o Canvas e com os provedores de IA usando segredos.

C) Supabase self-hosted, em contêineres Docker (desenhe como um grupo com 5 sub-blocos)
   - Kong (API Gateway), GoTrue (Autenticação: Google, GitHub, Canvas, passkey), Realtime (sincronização multi-dispositivo via WebSocket), PostgREST e PostgreSQL com RLS por usuário.
   - Dentro do PostgreSQL, destaque o "Vault" (pgsodium) com ícone de cadeado: guarda os tokens do Canvas e as chaves de IA cifrados.

D) CLI de Importação (processo Node.js separado, fora do Next.js)
   - Lê um arquivo JSON de questões, valida e importa direto no Canvas.

## Sistemas externos (à direita, cor cinza, estilo "sistema externo")
- Canvas LMS: API REST + OAuth2. É a fonte de verdade de cursos, atividades, alunos e mensagens. Esses dados nunca são persistidos no banco próprio, só ficam em cache no navegador.
- Provedores de IA generativa (um bloco com 5 itens): OpenAI, Google Gemini, Anthropic Claude, Z.ai e DeepSeek.
- Google (OAuth e APIs) e GitHub (OAuth e APIs).
- Google Analytics.

## Infraestrutura (faixa inferior, fina)
- Produção orquestrada por Dokploy (docker-compose): contêiner do app + stack Supabase (db, auth, rest, realtime, kong).
- Segredos ficam em variáveis de ambiente do servidor e nunca chegam ao navegador.

## Conexões (setas rotuladas; numere-as)
1. Professor → Cliente Web: "usa (HTTPS / PWA)".
2. Cliente Web → Servidor Next.js: "páginas + chamadas /api (JSON)".
3. Cliente Web → Supabase (Kong): "login, dados próprios com chave anônima + RLS".
4. Cliente Web ⇢ Supabase Realtime (linha tracejada, bidirecional): "sincronização em tempo real (WebSocket)".
5. Servidor Next.js → Supabase (rede interna): "valida sessão + RPCs seguras com service_role (Vault)".
6. Servidor Next.js → Canvas LMS: "REST com token do usuário (refresh automático)".
7. Servidor Next.js → Provedores de IA: "geração de questões, sugestão de resposta, análise de aluno".
8. Servidor Next.js ↔ Google/GitHub: "troca do código OAuth" (o token resultante vai para o navegador).
9. Canvas LMS → Servidor Next.js: "callback OAuth (login com Canvas)".
10. Operador → CLI → Canvas LMS: "importa questões com token pessoal fixo (.env)".
11. Cliente Web → Google Analytics: "métricas de uso".

## Destaques visuais obrigatórios
- Cadeado no Vault e na seta 5, com a nota: "Tokens do Canvas e chaves de IA são write-only: nunca vão ao navegador".
- Nota junto ao Canvas: "Canvas = fonte de verdade; Vértice só faz cache".
- Nota junto à CLI: "Autenticação independente do login web".
- Paleta: cliente = azul, servidor = verde, Supabase = verde-escuro/esmeralda, CLI = roxo, externos = cinza. Inclua uma legenda (seta cheia = síncrona HTTP; tracejada = tempo real/assíncrona; cadeado = dado sensível).
- Layout da esquerda para a direita: Atores → Cliente → Servidor → (Supabase abaixo do servidor) → Externos à direita. Limpo, sem cruzamento de setas, com título "Vértice — Visão Geral da Arquitetura".
```

---

## Prompt 2 — Arquitetura detalhada por módulo

```text
Crie um diagrama de componentes detalhado (estilo C4, nível "Componentes") da aplicação "Vértice", uma aplicação Next.js 16 + Supabase self-hosted para professores, integrada ao Canvas LMS e a provedores de IA. O público é a equipe que vai manter o código: o diagrama deve mostrar quais componentes de software existem em cada módulo, os arquivos/pastas principais e os fluxos mais importantes. Rótulos em português do Brasil; nomes de arquivos e componentes em fonte monoespaçada, exatamente como escritos abaixo.

Organize em 5 grandes contêineres (raias verticais, da esquerda para a direita): 1) Cliente Web (navegador), 2) Servidor Next.js, 3) Supabase, 4) CLI, 5) Sistemas Externos. Dentro do Cliente e do Servidor, agrupe os componentes por DOMÍNIO, com uma cor por domínio:
- Frontend/Shell = azul
- Canvas = laranja
- IA = roxo
- Dados (tarefas, ambientes, notas) = verde
Componentes marcados com ★ são os mais relevantes: desenhe-os com borda mais grossa.

────────────────────────────────
1) CLIENTE WEB (navegador / PWA)
────────────────────────────────
[Shell e infraestrutura de UI — azul]
- ★ `(dashboard)/layout.jsx`: casca autenticada que monta os providers.
- `Sidebar` (sempre escura, regra de marca), `Topbar`, `WorkspaceSwitcher`, `UserMenu`, `ThemeToggle`, `BackButton` (retorno no PWA).
- Providers: ★ `QueryProvider` (TanStack Query + persistência no IndexedDB), `TasksProvider`, `WorkspaceScopeProvider`, `UiPreferencesSync`.
- `ServiceWorkerRegistration` + `public/sw.js` (cache só do app shell; ignora /api).

[Módulos de funcionalidade: cada um mostra página → componentes principais]
- Painel (`/`): `DashboardPanel`, `DashboardStats`, `DueDateCalendar`, `PendingGradingList`, `DashboardShortcuts`. Domínio Frontend.
- Cursos (`/courses`, `/courses/[id]`): ★ `CourseBrowser`, ★ `CourseWorkspaceTabs` (abas Notas, Atividades, Mensagens, Alunos), `AssignmentsTable`. Domínio Canvas.
- Importação de questões (`/courses/[id]/quizzes/[id]/import`): ★ `QuizImportPanel`, `ImportQuestions`, `QuizReviewImport`, ★ `QuestionGenerator` (gera com IA). Domínio Canvas + IA.
- Correção por rubrica (`.../grade`): ★ `RubricGrader`, `SubmissionPreview`. Domínio Canvas.
- Avaliação por pares (`.../peer-reviews`, `.../peer-grading`): `PeerReviewDistributor` (distribui entre grupos diferentes, carga equilibrada), `PeerReviewGrader` (consolida notas e penalidades). Domínio Canvas.
- Alunos/Engajamento: `StudentReport`, `StudentEngagementDashboard` (gauges), `RiskLevelPill` (nível de risco de evasão), `EngagementHistoryChart`. Domínio Canvas + IA.
- Mensagens (`/mensagens`): `MessageBrowser`, `MessageList`, `ComposeMessage`. Domínio Canvas + IA.
- Tarefas (`/tarefas`): ★ `TasksView`, `KanbanBoard`, `EisenhowerMatrix`, `TaskTable`, `TaskDetailModal`, `TasksExportImport`. Domínio Dados.
- Perfil (`/perfil`): `ProfileTabs`, `CanvasConnection`, `GithubConnection`, `GoogleConnection`, `PasskeyManager`, ★ `IntegrationManager` (integrações de IA), `PromptCustomizer`, `ShortcutsManager`. Domínio Frontend + IA.

[Camada de dados no cliente — sub-bloco destacado na base da raia]
- ★ `lib/query/canvasQueries.js`: chaves e fetchers centralizados; 3 faixas de validade: live 30 s, volatile 2 min, stable 12 h.
- `lib/query/idbPersister.js`: grava o cache no IndexedDB (retenção de 20 dias, escopo por usuário).
- Repositórios Supabase: `tasksRepo`, `projectsRepo`, `workspacesRepo`, `courseNotesRepo`, `studentEngagementRepo`.
- ★ `lib/realtime/useRealtimeTable.js`: assina mudanças do Postgres em tempo real.
- `recordMerge.js`: reconciliação last-write-wins.
- Armazenamento local (ícones de banco pequeno): IndexedDB `vertice` (stores `cache`, `github`, `google`), localStorage (`vertice:theme`, etc.), sessionStorage (estado da tela de cursos).

────────────────────────────────
2) SERVIDOR NEXT.JS (contêiner Docker)
────────────────────────────────
[Gate] ★ `src/proxy.js`: valida a sessão Supabase em toda rota protegida e redireciona para /login.

[Runtime de servidor]
- ★ `supabaseServerClient.js` (`getSupabaseUser()` memoizado por requisição).
- ★ `supabaseAdminClient.js` (service_role, usado SOMENTE para RPCs de segredos).

[API HTTP: Route Handlers, um bloco com sub-itens]
- `/api/canvas/**`: cursos, atividades, import, mensagens, rubrica, peer-reviews, alunos/analytics, favorito, status, disconnect.
- `/api/ai/**`: integrações (CRUD), models, generate-questions, suggest-reply, improve-message, analyze-student.
- `/api/auth/login|logout`, callbacks `/oauth2/callback` (Canvas), `/auth/callback` (Google/GitHub via Supabase), `/github|google/oauth2/callback`.
- `/api/dashboard/summary`, `/api/health`.

[Domínio Canvas — laranja]
- ★ `canvasIntegration.js`: lê o token do Vault, refresh proativo (margem de 5 min), refresh single-flight por usuário e `requireCanvasIntegration()` como gate.
- ★ `canvasClient.js`: cliente REST próprio (axios, sem SDK); `sanitizeAxiosError` não deixa vazar token.
- `canvasOAuth.js` (login com Canvas via "bridge": OAuth do Canvas → magic link do Supabase).
- Regras de negócio: `rubricGrading.js`, `peerReviewDistribution.js`, `peerReviewGrading.js`, `groupGrading.js`, `studentEngagement/` (`computeClassRisk`, `scoring`), `dashboard.js`.
- `concurrency.js`: leituras paralelas com limite; escritas em lote sempre sequenciais.

[Domínio IA — roxo]
- ★ `aiProviders/index.js`: registro de drivers. Drivers: `openai`, `gemini`, `claude`, `zai`, `deepseek`. Todos com o mesmo contrato: validateApiKey, listModels, generateQuestions, suggestReply, improveMessage, analyzeStudent.
- `aiProviders/shared.js` (schema de saída estruturada) + prompts (`replyPrompt`, `improvePrompt`, `studentAnalysisPrompt`).
- `aiIntegrations.js` (CRUD via RPC no Vault) + `promptResolution.js` (prompt personalizado do usuário em modo append/replace).

[Validação de questões — destaque com dois níveis]
- ★ `quizValidation.js` + `quiz.schema.json`. Camada 1 "estrutural" (BLOQUEIA a importação) e camada 2 "schema/ajv" (só AVISOS, nunca bloqueia). Compartilhado com a CLI.

[OAuth de conexões] `githubOAuth.js`, `googleOAuth.js`: trocam o código no servidor e o token vai para o navegador.

────────────────────────────────
3) SUPABASE SELF-HOSTED (Docker)
────────────────────────────────
- Kong (gateway) → GoTrue (Auth), PostgREST, Realtime.
- PostgreSQL, com as tabelas em 3 grupos de RLS:
  a) Dados do usuário com soft delete: `workspaces`, `projects`, `tasks`, `ui_preferences`, `student_engagement_snapshots`.
  b) Dados com DELETE físico: `shortcuts`, `custom_prompts`, `course_notes`, `course_workspace_links`.
  c) ★ Segredos (RLS sem políticas, só service_role): `integrations` (token do Canvas), `ai_integrations` (chaves de IA). Ligados ao ★ Vault (pgsodium, cadeado) por RPCs SECURITY DEFINER (`get_integration_tokens`, `upsert_integration_tokens`, `create_ai_integration`, etc.).
- Publicação Realtime: tasks, projects, workspaces, course_workspace_links, shortcuts, custom_prompts, course_notes (NUNCA as tabelas de segredos).

────────────────────────────────
4) CLI (processo Node separado)
────────────────────────────────
- `src/cli/index.js`, `prompt.js`, `colors.js`. Opções `--dry-run` e confirmação interativa.
- Reutiliza do servidor (setas tracejadas "compartilha código"): `canvasClient.js`, `quizValidation.js`, `quiz.schema.json`.
- Autentica com `CANVAS_API_TOKEN` fixo no `.env`.

────────────────────────────────
5) SISTEMAS EXTERNOS (cinza)
────────────────────────────────
Canvas LMS (REST + OAuth2) · OpenAI · Gemini · Claude · Z.ai · DeepSeek · Google · GitHub.

## Fluxos principais (desenhe como setas numeradas e coloridas, com uma legenda lateral "Fluxos")
F1 — Importar questões: `QuizImportPanel` → `/api/canvas/import` → `quizValidation` (estrutural bloqueia / schema avisa) → `canvasIntegration` (token do Vault) → `canvasClient` → Canvas LMS.
F2 — Gerar questões com IA: `QuestionGenerator` → `/api/ai/integrations/[id]/generate-questions` → `aiIntegrations` (chave via RPC/Vault) + `promptResolution` → driver (`aiProviders`) → provedor de IA → `validateStructural` → volta ao cliente para revisão.
F3 — Ler dados do Canvas com cache: componente → `canvasQueries` → (se houver cache válido, responde do IndexedDB) → `/api/canvas/**` → Canvas; o resultado é persistido pelo `idbPersister`.
F4 — Sincronização multi-dispositivo: `TasksView` → `tasksRepo` → PostgreSQL (RLS) → Realtime → `useRealtimeTable` em outro dispositivo (linha tracejada).
F5 — Login com Canvas: `/api/auth/login` → Canvas OAuth → `/oauth2/callback` → grava o token no Vault + magic link GoTrue → sessão Supabase.

## Regras de layout e estilo
- Título: "Vértice — Arquitetura de Componentes".
- Legenda com: cores por domínio, ★ = componente crítico, cadeado = segredo, seta cheia = chamada HTTP/função, seta tracejada = tempo real ou "compartilha código".
- Caixa de "Invariantes — não quebre" no canto inferior, com 4 itens:
  1. Tokens do Canvas e chaves de IA são write-only (Vault), nunca vão ao navegador.
  2. Validação em duas camadas: estrutural bloqueia, schema só avisa.
  3. `quiz_id` (Classic Quiz) ≠ New Quizzes (não importável por esta API).
  4. Sidebar sempre escura.
- Priorize a legibilidade: se faltar espaço, mostre os componentes sem ★ apenas como lista de texto dentro do grupo, sem setas próprias.
```
