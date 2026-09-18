---
title: Shell do dashboard (Sidebar/Topbar/tema)
status: implemented
domain: frontend
updated: 2026-09-17
---

# Shell do dashboard

> O chrome visual de toda página autenticada: Sidebar (rail escuro de ícones), Topbar
> (barra clara com seletor de workspace + menu do usuário) e o sistema de tema.

## Comportamento

- `(dashboard)/layout.jsx` renderiza `Sidebar.jsx` + `Topbar.jsx` em volta do `<main>`.
- **Sidebar** (`'use client'`, usa `usePathname()` para o estado ativo): rail fixo, **sempre
  escuro** (`--sidebar-bg`/`--sidebar-fg`, independente do tema) — o `logo.png` é marca em
  traço claro e não lê sobre fundo claro. Logo → `<Link href="/">`.
- **Topbar** (Server Component, lê `getSupabaseUser()`): `WorkspaceSwitcher` + `UserMenu`.
  `UserMenu` é um `<Link href="/perfil">` (não dropdown) + botão de logout como
  `<form method="POST">` (sem JS client), e botão "Instalar app" (PWA) quando disponível.
- **Tema** claro/escuro: alternável no UserMenu; persiste em `canvastools:theme`
  (localStorage) + `ui_preferences` (Postgres).
- Cada `<main className="page">` é a superfície de "card" (fundo branco, borda, sombra)
  sobre o `--paper` de `.dashboard-content` — por isso `.page` carrega o estilo de card.

## Arquivos-chave

- [layout.jsx](src/app/(dashboard)/layout.jsx) · [Sidebar.jsx](src/components/Sidebar.jsx) ·
  [Topbar.jsx](src/components/Topbar.jsx) · [WorkspaceSwitcher.jsx](src/components/WorkspaceSwitcher.jsx) ·
  [WorkspaceScopeProvider.jsx](src/components/WorkspaceScopeProvider.jsx) · `globals.css`.

## Dados e persistência

- `canvastools:theme`, `canvastools:sidebar-collapsed`, `canvastools:active-workspace-id` no
  localStorage, com write-through para `ui_preferences` (ver [data-storage.md](../platform/data-storage.md)).

## Invariantes e gotchas

- Não deixar a Sidebar seguir `--paper`/`--ink`; ela usa a paleta escura própria de propósito.
- O link do logo vai para `/` (o dashboard), **não** `/courses`.

## Dependências

- [routing-and-shell.md](../platform/routing-and-shell.md) (rotas/proxy/PWA) ·
  [workspaces.md](workspaces.md) · [perfil.md](perfil.md)
