---
title: Login e página de entrada
status: implemented
domain: frontend
updated: 2026-09-17
---

# Login e página de entrada

> A tela de `/login` (fora do route group, alcançável sem sessão) e o gating da home.
> A "capa" de marketing não fica antes do login — fica **dentro** do dashboard, e hoje é
> o painel de widgets (ver [dashboard.md](dashboard.md)); o conteúdo "Sobre o CanvasTools"
> migrou para `/sobre`.

## Comportamento

- `/login` mostra **apenas** o card "Entrar com Canvas" + `WebTechFooter` (com links legais).
  Nada de pitch/feature list.
- `LoginButtons.jsx` oferece: **Google/GitHub** (`supabase.auth.signInWithOAuth` →
  `/auth/callback`), **Canvas** (link para `GET /api/auth/login`, o bridge) e **passkey**
  (`signInWithPasskey`, atrás de `NEXT_PUBLIC_PASSKEYS_ENABLED`).
- Já autenticado em `/login` → redirect para `/`. Não-autenticado em `/` (e demais rotas
  protegidas) → o proxy redireciona para `/login` antes de renderizar.
- `/` é alcançada por 3 caminhos pós-login: logo da Sidebar, redirect do próprio `/login`,
  ou URL digitada — sempre com Sidebar/Topbar visíveis (é filho de `(dashboard)/layout`).

## Arquivos-chave

- [login/page.jsx](src/app/login/page.jsx) · [LoginButtons.jsx](src/components/LoginButtons.jsx) ·
  [WebTechFooter.jsx](src/components/WebTechFooter.jsx) · [proxy.js](src/proxy.js).

## Invariantes e gotchas

- Não mover a feature list de volta para uma página pré-auth — o split "marketing atrás do
  login, login enxuto antes" é o ponto da estrutura.
- `WebTechFooter.jsx` é compartilhado entre `/login` e `/` (variante "bar" sem links legais
  no dashboard) — um único lugar de editar copy/logo.

## Dependências

- [auth-and-session.md](../platform/auth-and-session.md) · [dashboard.md](dashboard.md) ·
  [tutorial-sobre.md](tutorial-sobre.md)
