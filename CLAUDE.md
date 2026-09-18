# CLAUDE.md

Guia de entrada do **Vértice** (CanvasTools). Este arquivo é **intencionalmente mínimo**:
o conhecimento vive nas specs — aqui só apontamos para elas.

## O que é

App Next.js + CLI que importa questões de múltipla escolha em quizzes do Canvas, com
organização pessoal (tarefas/projetos/ambientes), correção por rubrica, mensagens e geração
de questões por IA. Sessão via Supabase Auth; dados próprios no Postgres/RLS/Realtime; token
do Canvas no Vault. O CLI usa token pessoal fixo do `.env`, sem relação com o OAuth do web.

## Como trabalhar (Spec-Driven Development)

1. **Porta de entrada**: leia `specs/index.md` primeiro.
2. **Resolver a demanda**: `npm run spec -- "<demanda>"` (ou `npm run spec -- list`).
   Ele devolve o **bundle** de specs relevante — carregue só ele, não o repo inteiro.
3. **Spec primeiro**: a demanda muda comportamento? Edite a spec **antes** do código.
4. **Decisão não óbvia**: registre em `specs/decisions/` (ADR numerado, kebab-case).
5. **Multiagente**: `specs/agents/README.md` define 4 agentes de domínio + 3 de papel
   técnico (`backend`/`ux_ui`/`devops_cloud`) + orquestrador; executáveis em `.claude/agents/*.md`.

## Estrutura das specs

- `specs/platform/` — fundamentos (auth, storage, validação, rotas).
- `specs/contracts/` — interfaces (Canvas API, adapter de IA, `quiz.schema.json`, schema Supabase).
- `specs/capabilities/` — funcionalidades.
- `specs/decisions/` — ADRs (o "porquê").
- `specs/agents/` — bundles de contexto + orquestração.

Convenções, ciclo de vida e limites de tamanho: `specs/README.md`. Idioma das specs: pt-BR.

## Não quebre (invariantes críticas)

- A Sidebar é **sempre escura** (`--sidebar-bg`/`--sidebar-fg`) — o logo é marca em traço claro.
- `quiz_id` (classic Quiz) ≠ `is_quiz_assignment` (New Quizzes — não importável por esta API).
- Chaves de IA e token do Canvas são **write-only** (Vault); nunca em texto plano no browser.
- Validação de questões é **duas camadas**: estrutural (bloqueante) × schema (avisos, nunca bloqueia).
