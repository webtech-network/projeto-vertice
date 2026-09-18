---
title: Autenticação e sessão
status: implemented
domain: frontend
updated: 2026-09-17
---

# Autenticação e sessão

> A sessão do app é **Supabase Auth** (GoTrue), com quatro caminhos de login: Google,
> GitHub, Canvas (bridge) e passkey. O token de API do Canvas é **separado** disso.

## Caminhos de login

- **Google / GitHub**: `supabase.auth.signInWithOAuth({ provider, redirectTo: '/auth/callback' })`
  em `LoginButtons.jsx`. O callback `src/app/auth/callback/route.js` troca o code e
  materializa a sessão.
- **Canvas**: link para `GET /api/auth/login` (único iniciador do handshake OAuth do Canvas),
  que redireciona para `getAuthorizeUrl(state)` e grava o cookie `oauth_state`. O fluxo é
  o **bridge de login** — ver [canvas-integration.md](canvas-integration.md).
- **Passkey**: `supabase.auth.signInWithPasskey()` (experimental, atrás de
  `NEXT_PUBLIC_PASSKEYS_ENABLED`). Gerenciadas em `/perfil` via `supabase.auth.passkey.*`.

## Sessão

- Leitura server-side: `getSupabaseUser()` em `src/lib/supabaseServerClient.js` — memoizado
  por requisição via `cache()` do React; `auth.getUser()` valida o token no GoTrue.
- O gate é o [proxy](routing-and-shell.md); Server Components e rotas de API revalidam via
  `getSupabaseUser()`/`requireCanvasIntegration()`.

## Invariantes e gotchas

- **Contas não são ligadas entre provedores**: Canvas-login mapeia o usuário para um e-mail
  (real ou sintético `canvas-<id>@<host>.vertice.invalid`) e gera um magic-link Supabase;
  logar depois via Google/GitHub com outro e-mail cria uma conta separada. Account linking
  entre provedores é trabalho futuro — não é bug.
- `oauth_state` é um cookie httpOnly com `maxAge: 300`; o callback exige `state === cookie`.
- O `avatarUrl` do `UserMenu` vem do perfil do Canvas (buscado uma vez no OAuth).

## Dependências

- [canvas-integration.md](canvas-integration.md) · [oauth-connections.md](oauth-connections.md) ·
  [routing-and-shell.md](routing-and-shell.md)
