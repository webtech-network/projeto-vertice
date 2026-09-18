---
title: Token GitHub/Google no navegador, distinto do Canvas
status: accepted
date: 2026-09-17
supersedes: []
superseded_by: []
---

# ADR-0009: Token GitHub/Google no navegador, distinto do Canvas

## Contexto

A conexão deve persistir além da sessão e viajar com o navegador; mas o `client_secret` não
pode ir ao browser, então o code-exchange precisa ser server-side.

## Decisão

- Code-exchange **server-side** (`githubOAuth`/`googleOAuth`); token durável no **IndexedDB**
  (`STORE_GITHUB`/`STORE_GOOGLE`), não na sessão.
- Handoff de uso único via campo de sessão (`*PendingConnection`, lê-e-apaga).

## Consequências

- Token em texto plano em repouso (aceito — mesmo trade-off de atalhos/prompts).
- Google exige rota de refresh stateless (`POST /api/google/refresh`), pois o access token
  expira (~1h); GitHub (classic OAuth App, `gho_...`) não expira.

## Alternativas consideradas

- Token no servidor como o Canvas — rejeitado: não persiste com o navegador.
- GIS Token Model (popup client-side) — rejeitado por decisão explícita do usuário, que pediu
  espelhar o fluxo code-exchange do GitHub.
