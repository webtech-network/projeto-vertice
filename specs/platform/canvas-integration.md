---
title: Integração Canvas (login + token de API)
status: implemented
domain: canvas
updated: 2026-09-17
---

# Integração Canvas

> O Canvas é ao mesmo tempo um **provedor de login** e uma **integração de API**. O token
> de API vive no Postgres (`public.integrations`), cifrado no Vault — nunca em cookie.

## Duas coisas desacopladas

- **Sessão do app** = Supabase Auth (ver [auth-and-session.md](auth-and-session.md)).
- **Capacidade de API do Canvas** = uma linha em `public.integrations` (`provider='canvas'`)
  com `access_token_vault_id`/`refresh_token_vault_id` + `metadata.base_url`.

## O bridge de login (Fase 1, "Opção B")

O GoTrue self-hosted não tem "canvas" na lista de provedores OAuth embutidos, então o login
"Entrar com Canvas" é um **bridge manual**, validado contra o stack local:

1. `GET /api/auth/login` → `getAuthorizeUrl(state)` + cookie `oauth_state`.
2. `GET /oauth2/callback` (redirect_uri fixo na Developer Key) → `exchangeCodeForToken`,
   busca o perfil (`getSelf`), e:
   - **modo conectar** (`?connect=1` de `/perfil`): só grava a integração no usuário atual.
   - **modo login**: `admin.auth.admin.generateLink({ type:'magiclink', email })` (e-mail
     real ou sintético `canvas-<id>@<host>.vertice.invalid`) → grava a integração → redireciona
     para `{SUPABASE_URL}/auth/v1/verify?...&redirect_to=/auth/canvas-session` (fluxo implícito,
     completado client-side porque o token vem no *fragmento* da URL).
3. Em ambos, `upsertCanvasIntegration` chama a RPC `upsert_integration_tokens`.

## Leitura e refresh do token

`src/lib/canvasIntegration.js` é o substituto do antigo `canvasSession.js`:

- `getCanvasIntegration(userId)` lê via RPC `get_integration_tokens` (SECURITY DEFINER,
  `service_role` — a tabela não tem RLS para `authenticated` de propósito).
- `getCanvasClientForUser(userId)` monta o client Canvas com **refresh proativo** (mesma
  margem de 5 min) e **`onUnauthorized`** (retry de 401), persistindo o token renovado de
  volta na integração. Canvas não devolve refresh_token novo — reusa o mesmo.
- `requireCanvasIntegration()` é o gate compartilhado: `{ user, canvas }`, onde `canvas`
  é `null` quando logado mas sem integração ativa. Todo chamador decide o fallback
  (página: `CanvasNotConnected`; rota: 409) — nunca deixa `canvas` nulo virar chamada quebrada.

## Status / desconectar

- `CanvasConnection.jsx` (aba "Plataformas associadas" do `/perfil`) consulta
  `GET /api/canvas/status` e desconecta via `POST /api/canvas/disconnect` (revogação
  best-effort + `delete_integration_tokens`).

## Invariantes e gotchas

- Nunca ler `public.integrations` direto do browser; só via RPC `service_role`.
- `verification_type` do generateLink varia (`signup` vs `magiclink`) — **nunca** hardcodar.
- O refresh do Canvas voltou a ser responsabilidade do chamador, não do proxy.

## Dependências

- [auth-and-session.md](auth-and-session.md) · [data-storage.md](data-storage.md) ·
  [canvas-api.md](../contracts/canvas-api.md) · [ADR-0001](../decisions/0001-canvas-login-e-token-vault.md) ·
  [ADR-0004](../decisions/0004-margem-5min-refresh.md)
