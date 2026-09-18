---
title: Rotas de API e runtime de servidor
status: implemented
domain: backend
updated: 2026-09-17
---

# Rotas de API e runtime de servidor

> Mapa da superfície HTTP (`src/app/api/**`), o runtime de servidor (clients
> Supabase, auth por request) e o CLI. É a "camada de trás" que serve o frontend;
> o *comportamento* de cada rota vive nas specs de domínio (canvas/ai/data).

## Mapa de rotas (Route Handlers)

- **`/api/canvas/**`** — proxy do Canvas LMS (integração opcional): cursos, atividades,
  import, mensagens/conversas, correção de rubrica, favorito, status, disconnect,
  analytics/students, students/[userId]/message e assignment-analytics.
- **`/api/ai/**`** — IA: `integrations` (CRUD), `integrations/[id]` (models,
  generate-questions, improve-message, suggest-reply), `configured`, `analyze-student`.
- **`/api/auth/**`** — `login` (magic-link do Canvas → sessão Supabase) e `logout`.
- **`/api/github/**` e `/api/google/**`** — OAuth de conexões (login, disconnect,
  pending-connection; google também `refresh`).
- **`/api/dashboard/summary`** — agregados do painel. **`/api/skills/enade-it-questions`**
  — download da skill. **`/api/health`** — healthcheck.

Todas ficam atrás do gate do `src/proxy.js` ([routing-and-shell.md](routing-and-shell.md));
a rota revalida a sessão via `getSupabaseUser()` quando precisa do usuário.

## Runtime de servidor

- `supabaseServerClient.js`: `createSupabaseServerClient()` (cookies `sb-*` via
  `next/headers`; `cookieOptions.name = getSupabaseStorageKey()` — necessário atrás do
  reverse-proxy/Docker) e `getSupabaseUser()` **memoizado por request** (`cache()` do
  React) — uma chamada `getUser()` por request, não uma por componente.
- Dois clients de dados: `supabaseBrowserClient` (anon, RLS) e `supabaseAdminClient`
  (service_role) só para RPCs de secrets — ver [data-storage.md](data-storage.md).
  **Nunca** expor service_role ao browser.
- Chamadas ao Canvas são **sequenciais**, nunca `Promise.all` (multi-step); erros passam
  por `sanitizeAxiosError` (sem vazar token/base URL) — ver
  [canvas-api.md](../contracts/canvas-api.md).

## CLI (processo separado)

- `npm run cli` → `src/cli/index.js`. Usa token **fixo** do `.env` (`CANVAS_API_TOKEN`)
  e sessão própria (iron-session/`SESSION_SECRET`) — **sem** relação com o OAuth do web.
  É um segundo "backend" que fala direto com o Canvas, fora do Next. Ver
  [cli.md](../capabilities/cli.md).

## Invariantes e gotchas

- Rotas de secrets respondem via RPC `SECURITY DEFINER` + service_role; nunca leem as
  tabelas `integrations`/`ai_integrations` com o client anon.
- `cookies()` de `next/headers` é **assíncrono** no Next 16; `setAll` fora de Route
  Handler/Server Action lança (o try/catch em `createSupabaseServerClient` é intencional).
- Rotas respondem JSON com status HTTP + `{ error }`; nunca lançam exceção pro cliente.

## Dependências

- [routing-and-shell.md](routing-and-shell.md) · [data-storage.md](data-storage.md) ·
  [canvas-api.md](../contracts/canvas-api.md) · [ai-adapter-contract.md](../contracts/ai-adapter-contract.md)
