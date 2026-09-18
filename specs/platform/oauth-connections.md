---
title: Conexões OAuth GitHub/Google
status: implemented
domain: frontend
updated: 2026-09-17
---

# Conexões OAuth GitHub/Google

> Conexão da conta a **GitHub** e **Google** para acesso a API no futuro. Distinta do login
> e do Canvas: o token dura no **navegador** (IndexedDB), não no servidor.

## Por que é diferente do Canvas

- **Canvas**: token no servidor (Vault), sessão Supabase separada.
- **GitHub/Google**: OAuth próprio (`githubOAuth.js`/`googleOAuth.js`), code-exchange
  server-side (o `client_secret` não pode ir ao browser), mas o token resultante vai para
  o IndexedDB (`STORE_GITHUB`/`STORE_GOOGLE`). Ver [ADR-0009](../decisions/0009-tokens-github-google-navegador.md).

## Fluxo (idêntico em forma para os dois)

1. `GET /api/github/auth/login` (ou `/api/google/auth/login`) → `getAuthorizeUrl`.
2. Callback **fora de `/api/`**: `GET /github/oauth2/callback` (e `/google/oauth2/callback`),
   irmão de `/oauth2/callback` do Canvas — troca o code, busca o perfil, guarda em campo de
   sessão de **uso único** (`githubPendingConnection`/`googlePendingConnection`) e redireciona
   para `/perfil?tab=plataformas&github=connected`.
3. `GithubConnection.jsx`/`GoogleConnection.jsx` veem o query param, chamam
   `GET /api/github/pending-connection` (ou `/api/google/...`) **uma vez** (lê-e-apaga o campo
   de sessão) e persistem no IndexedDB. O servidor não guarda cópia duradoura do token.

## Google — a exceção do refresh

- O access token do Google expira (~1h) e precisa do `client_secret` para renovar — então
  existe `POST /api/google/refresh` (stateless, sem persistência), chamado por
  `googleConnection.js`'s `getValidAccessToken()` (margem de 5 min).
- GitHub usa classic OAuth App token (`gho_...`), que não expira — sem lógica de refresh.

## Estado atual (importante)

- O **sync de preferências no Google Drive foi removido** (Fase 2). `GoogleConnection.jsx`
  agora só conecta a conta como "base para futuras integrações (Drive, Calendar…)".
- Tokens GitHub/Google ficam em **texto plano no IndexedDB** em repouso — trade-off aceito
  (ver [ADR-0009](../decisions/0009-tokens-github-google-navegador.md)).

## Dependências

- [auth-and-session.md](auth-and-session.md) · [data-storage.md](data-storage.md) ·
  [github-connection.md](../capabilities/github-connection.md) ·
  [google-connection.md](../capabilities/google-connection.md)
