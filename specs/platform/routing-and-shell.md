---
title: Roteamento e shell
status: implemented
domain: frontend
updated: 2026-09-17
---

# Roteamento e shell

> Como as rotas são organizadas (route groups), como o proxy protege a app e como o
> shell do dashboard (Sidebar/Topbar) é montado — incluindo PWA/service worker.

## Route groups e estrutura de páginas

- Páginas autenticadas vivem em `src/app/(dashboard)/`, empacotadas por
  `(dashboard)/layout.jsx` (route group não muda a URL). `/login`, `/auth/*` e os
  callbacks OAuth ficam **fora** do grupo, sem chrome.
- O shell renderiza `Sidebar.jsx` (rail de ícones, sempre escuro `--sidebar-bg`) e
  `Topbar.jsx` (barra clara com `WorkspaceSwitcher` + `UserMenu`).
- `Sidebar.jsx` é `'use client'` para `usePathname()` (estado ativo). `Topbar.jsx` é
  Server Component (lê `getSupabaseUser()`).

## proxy.js (o gate)

- `src/proxy.js` (Next 16 renomeou `middleware` → `proxy`) é o gate de sessão. Matcher
  cobre `/`, `/courses/:path*`, `/api/canvas/:path*`, `/questoes/:path*`, `/api/ai/:path*`,
  `/perfil/:path*`, `/github/:path*`, `/google/:path*`, `/api/github/:path*`,
  `/api/google/:path*`. **Nunca** `/api/auth/*` nem os callbacks OAuth.
- Usa `createServerClient` (`@supabase/ssr`) + `supabase.auth.getUser()`. Não-autenticado
  em rota protegida → `/login`.
- O antigo refresh proativo de token **do Canvas** dentro do proxy foi removido: refresh
  agora é responsabilidade de quem chama o Canvas ([canvas-integration.md](canvas-integration.md)).

## PWA / service worker

- `public/sw.js` faz **app-shell cache apenas** (`canvastools-shell-v1`): pré-cache
  `/`, `/tarefas`, `/perfil` (só se `ok` e não-redirect); `fetch` GET same-origin
  network-first com fallback de cache; passthrough para `/api/*` e callbacks OAuth.
- Instalabilidade: `src/lib/pwaInstall.js` captura `beforeinstallprompt` (script inlinado
  `beforeInteractive` no `layout.jsx`); `ServiceWorkerRegistration.jsx` registra `/sw.js`
  e alimenta o store; "Instalar app" aparece no `UserMenu` (só Chrome/Edge/Android).

## Invariantes e gotchas

- `getAppBaseUrl()` deriva a origem pública de `CANVAS_OAUTH_REDIRECT_URI` — nunca de
  `request.url` (atrás de reverse-proxy o `Host` é interno).
- `Header.jsx` e `src/lib/session.js` (iron-session) são **legado morto**, não importados
  por nenhuma página do shell atual.

## Dependências

- [auth-and-session.md](auth-and-session.md) · [data-storage.md](data-storage.md)
