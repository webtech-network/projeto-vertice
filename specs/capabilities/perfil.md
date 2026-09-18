---
title: Perfil (página de abas)
status: implemented
domain: frontend
updated: 2026-09-17
---

# Perfil

> `/perfil` agrupa conta, plataformas (IA/GitHub/Google), atalhos, prompts e preferências em
> abas folder-style. Acessada pelo nome do usuário no `Topbar` (`<Link href="/perfil">`).

## Comportamento

- `perfil/page.jsx` (Server Component: `listAiIntegrations` + `listDriverProviders`) → renderiza
  só `ProfileTabs` (`'use client'`), que usa nav lateral própria de ícones
  (`.profile-layout/.profile-sidebar/.profile-panel`), não o `.tab-folder` horizontal.
- Abas: **Geral** (nome/instituição/tema/passkeys), **Plataformas associadas** (`CanvasConnection`,
  `GithubConnection`, `GoogleConnection`), **Plataformas de IA** (`IntegrationManager`),
  **Prompts de IA** (`PromptCustomizer`), **Atalhos do Dashboard** (`ShortcutsManager`),
  **Preferências** (`TarefasPreferences`).
- Tab inicial lida de `?tab=` (uma vez, para o redirect pós-OAuth GitHub/Google, que aponta
  `?tab=plataformas`) → exige `<Suspense>` em volta de `ProfileTabs` (requisito do
  `useSearchParams()`). Guard de mudanças não salvas (`useUnsavedChangesGuard`) agrega o sinal
  dirty de cada form montado.

## Arquivos-chave

- [perfil/page.jsx](src/app/(dashboard)/perfil/page.jsx) · [ProfileTabs.jsx](src/components/ProfileTabs.jsx) ·
  [IntegrationManager.jsx](src/components/IntegrationManager.jsx) · `ShortcutsManager.jsx`,
  `PromptCustomizer.jsx`, `GithubConnection.jsx`, `GoogleConnection.jsx`.

## Dados e persistência

- Passkeys via `supabase.auth.passkey.*`; nome/instituição/tema em `ui_preferences` (Postgres,
  cache localStorage). Atalhos em `shortcuts` (Postgres).

## Dependências

- [ai-integrations.md](ai-integrations.md) · [github-connection.md](github-connection.md) ·
  [google-connection.md](google-connection.md) · [prompt-customization.md](prompt-customization.md)
