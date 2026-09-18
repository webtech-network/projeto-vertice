---
title: Conexão Google
status: implemented
domain: frontend
updated: 2026-09-17
---

# Conexão Google

> Conecta a conta a um Google Account, base para futuras integrações (Drive, Calendar). O
> **sync de preferências no Drive foi removido** (Fase 2) — hoje é só a conexão.

## Comportamento

- Espelha o GitHub ([github-connection.md](github-connection.md)): code-exchange server-side
  (`googleOAuth.js`), callback fora de `/api/` (`google/oauth2/callback`), handoff de uso único
  (`session.googlePendingConnection` → `GET /api/google/pending-connection` lê-e-apaga),
  token durável no **IndexedDB** (`STORE_GOOGLE`).
- Diferença estrutural: o access token do Google **expira (~1h)**. Renovar exige o
  `client_secret` (não pode ir ao browser) → existe `POST /api/google/refresh` (stateless,
  sem persistência), chamado por `googleConnection.js`'s `getValidAccessToken()` (margem de
  5 min) antes de qualquer chamada.
- `getAuthorizeUrl()` seta `access_type=offline&prompt=consent` para garantir `refresh_token`.

## Arquivos-chave

- [googleOAuth.js](src/lib/googleOAuth.js) · `src/lib/googleConnection.js` ·
  [GoogleConnection.jsx](src/components/GoogleConnection.jsx) ·
  `src/app/google/oauth2/callback/route.js` · `src/app/api/google/**`.

## Dados e persistência

- `STORE_GOOGLE` no IndexedDB (access + refresh token em **texto plano em repouso** — mesmo
  trade-off do GitHub, ver [ADR-0009](../decisions/0009-tokens-github-google-navegador.md)).

## Decisões

- OAuth espelha GitHub (authorization-code com `client_secret`), **não** o GIS Token Model
  pedido no spec original — por decisão explícita. Ver
  [ADR-0009](../decisions/0009-tokens-github-google-navegador.md).
- Sync no Drive removido na Fase 2 → [ADR-0008](../decisions/0008-postgres-realtime-migracao.md).

## Dependências

- [oauth-connections.md](../platform/oauth-connections.md) · [perfil.md](perfil.md)
