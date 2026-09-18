---
title: Conexão GitHub
status: implemented
domain: frontend
updated: 2026-09-17
---

# Conexão GitHub

> Conecta o perfil a uma conta GitHub, base para futuras integrações de repositório (board,
> issues, conteúdo). **Só a conexão existe hoje** — o linking com curso/repo ainda não.

## Comportamento

- OAuth **code-exchange server-side** (`githubOAuth.js` — `client_secret` não pode ir ao
  browser), mas o token resultante vive no **IndexedDB** (`STORE_GITHUB`), não na sessão.
- Handoff de uso único: `GET /github/oauth2/callback` (fora de `/api/`, irmão do callback
  Canvas) troca o code → busca perfil (`getGithubUser`) → grava `session.githubPendingConnection`
  (campo de uso único) → redirect `/perfil?tab=plataformas&github=connected` → `GithubConnection.jsx`
  chama `GET /api/github/pending-connection` **uma vez** (lê-e-apaga) e persiste no IndexedDB.
  O servidor não guarda cópia duradoura.
- **Classic GitHub OAuth App** (`GITHUB_OAUTH_CLIENT_ID/_SECRET/_REDIRECT_URI`, scopes
  `read:user repo project`). Token `gho_...` não expira → sem refresh.

## Arquivos-chave

- [githubOAuth.js](src/lib/githubOAuth.js) · [githubConnection.js](src/lib/githubConnection.js) ·
  [GithubConnection.jsx](src/components/GithubConnection.jsx) ·
  `src/app/github/oauth2/callback/route.js` · `src/app/api/github/**`.

## Dados e persistência

- `STORE_GITHUB` no IndexedDB, **em texto plano em repouso** (trade-off aceito — ver
  [ADR-0009](../decisions/0009-tokens-github-google-navegador.md)).

## Decisões

- Arquitetado **diferente do Canvas** de propósito: token no cliente, persiste além da sessão,
  viaja no export/import. Ver [ADR-0009](../decisions/0009-tokens-github-google-navegador.md).

## Invariantes e gotchas

- Nunca chamar a API do GitHub direto do browser: ler o token no IndexedDB e mandar para uma
  rota própria que chama server-side.

## Dependências

- [oauth-connections.md](../platform/oauth-connections.md) · [perfil.md](perfil.md)
