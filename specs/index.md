# Índice de specs

Manifesto do Vértice. **Este arquivo é sempre carregado** (é a porta de entrada). Para uma
demanda, ache aqui a capacidade afetada e leia só as specs dela — ou resolva o bundle via
`npm run spec -- "<demanda>"`.

Legenda: `canvas` · `ai` · `data` · `frontend` (domínios de produto) · `backend` ·
`ux` · `devops` (papéis técnicos) · `cli` (ferramenta de linha de comando).

## Platform (fundamentos transversais)

| Spec | Domínio | Status | Resumo |
| --- | --- | --- | --- |
| [overview.md](platform/overview.md) | frontend | implemented | O que é o Vértice, stack e a migração Fase 1/2 (Supabase Auth, Postgres, Realtime) |
| [routing-and-shell.md](platform/routing-and-shell.md) | frontend | implemented | Route groups, proxy/matcher, shell dashboard, PWA/service worker |
| [auth-and-session.md](platform/auth-and-session.md) | frontend | implemented | Login via Supabase Auth (Google/GitHub/Canvas/passkey), sessão e gate |
| [canvas-integration.md](platform/canvas-integration.md) | canvas | implemented | Token do Canvas no Postgres (`integrations`+Vault), refresh e gate |
| [oauth-connections.md](platform/oauth-connections.md) | frontend | implemented | Conexões GitHub/Google (OAuth próprio, token no navegador) |
| [data-storage.md](platform/data-storage.md) | data | implemented | Onde cada dado vive: Postgres+RLS, Vault, IndexedDB, Realtime |
| [validation-model.md](platform/validation-model.md) | data | implemented | Validação em duas camadas (estrutural × schema) |
| [api-routes.md](platform/api-routes.md) | backend | implemented | Mapa das rotas `src/app/api/**`, runtime de servidor e CLI |
| [design-system.md](platform/design-system.md) | ux | implemented | Tokens CSS, tema (3 estados) e primitivas de componente |
| [deployment-and-infra.md](platform/deployment-and-infra.md) | devops | implemented | Supabase self-hosted, containers, env e deploy |

## Contracts (interfaces)

| Spec | Domínio | Status | Resumo |
| --- | --- | --- | --- |
| [canvas-api.md](contracts/canvas-api.md) | canvas | implemented | Endpoints Canvas usados, `include[]` e gotchas |
| [ai-adapter-contract.md](contracts/ai-adapter-contract.md) | ai | implemented | Contrato dos drivers de IA (openai/gemini/claude/zai/deepseek) |
| [quiz-schema.md](contracts/quiz-schema.md) | data | implemented | `quiz.schema.json` + mapeamento `toCanvasPayload` |
| [supabase-schema.md](contracts/supabase-schema.md) | data | implemented | Tabelas, RLS, RPCs SECURITY DEFINER, Vault, publicação Realtime |

## Capabilities (funcionalidades)

| Spec | Domínio | Status | Resumo |
| --- | --- | --- | --- |
| [dashboard-shell.md](capabilities/dashboard-shell.md) | frontend | implemented | Sidebar, Topbar, tema, mobile e instalação PWA |
| [login-and-landing.md](capabilities/login-and-landing.md) | frontend | implemented | Tela de login × capa; `/sobre` como página institucional |
| [dashboard.md](capabilities/dashboard.md) | frontend | implemented | Home = painel de widgets (stats, tarefas, atalhos, calendário, pendências) |
| [course-browser.md](capabilities/course-browser.md) | canvas | implemented | Cursos favoritos, pendências (correção de grupo), status |
| [course-workspace.md](capabilities/course-workspace.md) | canvas | implemented | Página do curso + `CourseWorkspaceTabs` (notas/atividades/mensagens/alunos) |
| [atividades.md](capabilities/atividades.md) | canvas | implemented | Lista de atividades do curso → importar questões / corrigir rubrica |
| [quiz-import.md](capabilities/quiz-import.md) | canvas | implemented | Importação de questões num quiz via Canvas API |
| [rubric-grading.md](capabilities/rubric-grading.md) | canvas | implemented | Correção com rubrica (envia `rubric_assessment` estruturado) |
| [student-engagement.md](capabilities/student-engagement.md) | canvas | implemented | Tabela de alunos, gauges de situação, nível de risco e histórico |
| [ai-integrations.md](capabilities/ai-integrations.md) | ai | implemented | Integrações de IA multi-instância por driver + modelos selecionáveis |
| [questoes.md](capabilities/questoes.md) | ai | implemented | Gerador de questões (specs + JSON + download da skill) |
| [perfil.md](capabilities/perfil.md) | frontend | implemented | Abas do perfil (Geral/Plataformas/IA/Prompts/Atalhos/Preferências) |
| [prompt-customization.md](capabilities/prompt-customization.md) | ai | implemented | Overrides de prompt por capacidade (append/replace) |
| [github-connection.md](capabilities/github-connection.md) | frontend | implemented | Conexão GitHub (token no navegador; base p/ futuros recursos) |
| [google-connection.md](capabilities/google-connection.md) | frontend | implemented | Conexão Google (token no navegador; Drive sync removido) |
| [tasks.md](capabilities/tasks.md) | data | implemented | Tarefas (Kanban/Eisenhower/Tabela), projetos e export/import |
| [messages.md](capabilities/messages.md) | canvas | implemented | Mensagens do Canvas (inbox, resposta, IA) |
| [workspaces.md](capabilities/workspaces.md) | data | implemented | Ambientes (workspaces) e escopo ativo |
| [course-notes.md](capabilities/course-notes.md) | data | implemented | Anotações Markdown por curso |
| [cli.md](capabilities/cli.md) | cli | implemented | CLI de importação de questões (token fixo do `.env`) |
| [tutorial-sobre.md](capabilities/tutorial-sobre.md) | frontend | implemented | Tutorial e página Sobre (conteúdo estático) |

## Decisions (ADRs)

Veja [decisions/README.md](decisions/README.md) — 12 ADRs cobrindo as decisões "intencionais,
não é bug" que antes viviam no `CLAUDE.md`.

## Agents (orquestração)

Veja [agents/README.md](agents/README.md) e [agents/_context-bundles.md](agents/_context-bundles.md).
