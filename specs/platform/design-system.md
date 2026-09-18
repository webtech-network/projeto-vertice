---
title: Sistema de design (tokens e primitivas)
status: implemented
domain: ux
updated: 2026-09-17
---

# Sistema de design (tokens e primitivas)

> A linguagem visual do Vértice: tokens CSS, o mecanismo de tema (3 estados) e as
> primitivas de componente reutilizáveis. O *layout* do shell (Sidebar/Topbar, route
> groups) vive em [routing-and-shell.md](routing-and-shell.md); aqui é o "como parece".

## Tokens (`:root`, em `globals.css`)

- Superfícies: `--paper` / `--paper-raised` / `--ink` / `--ink-soft` / `--line`.
- Marca: `--brand` (`#173a60`, fixa) e `--accent` (`#f55e27`) — accent é a cor de ação/foco;
  brand é o azul de identidade.
- Estado: pares `--ok`/`--ok-bg`, `--err`/`--err-bg`, `--warn`/`--warn-bg`.
- Forma: `--radius` (10px), `--shadow`.
- Sidebar **sempre escura**: `--sidebar-bg`/`--sidebar-fg`; o logo WebTech é marca em
  traço claro e exige fundo escuro.

## Tema (3 estados, sem pré-processador)

- Sem `data-theme` → segue `prefers-color-scheme` do SO.
- `data-theme="light"`/`"dark"` (gravado em `<html>` pelo `ThemeToggle`, em Preferências)
  sobrepõe o SO; aplicado antes do paint por script inline no `layout.jsx` (sem flash).
- `@media (prefers-color-scheme: dark)` e `:root[data-theme='dark']` listam os **mesmos**
  tokens, mantidos em sincronia à mão (não há pré-processador CSS).
- `--brand`/`--accent` de superfície não mudam por tema (identidade); `--sidebar-bg` vira
  o charcoal `--paper-raised` no dark, para ler como parte do mesmo UI escuro do topbar.

## Primitivas

- **Botões**: `.btn` base + `.btn-primary` (brand) / `.btn-secondary` / `.btn-ghost` /
  `.btn-sm` / `.btn-icon` / `.btn-lg`.
- **Abas**: `.tab-folder` (abas sobre o painel, mesclam com ele — QuizImportPanel,
  CourseWorkspaceTabs) × `.segmented` (toggle compacto) × `.profile-layout` (rail lateral
  com `.profile-sidebar`, para as 6 seções do perfil).
- **Tabela**: `.data-table` + `.data-table-wrap` (overflow-x no mobile) + `.th-sort-btn`.
- **Cartões/estados**: `.page` (card base), `.alert-*`, `.badge`, `.card-link`, `.modal`.
- **Grids**: `.spec-list`/`.spec-row` (header e linhas compartilham o mesmo
  `grid-template-columns`), `.profile-info`.

## Responsivo

- Breakpoints: `640px` (sidebar vira drawer off-canvas; botões viram só ícone) e `768px`
  (profile rail estreita para ícone-sobre-rótulo).
- Regra de layout: o que não pode encolher (tabelas, grids, `.tab-folder`) rola em
  `overflow-x: auto` dentro da própria caixa, em vez de esticar a página; flex items com
  conteúdo que não encolhe ganham `min-width: 0`.

## Acessibilidade

- `.sr-only` para texto de screen-reader; `aria-label`/`title` em botões só-ícone.
- Foco visível via `:focus` (borda `--accent`); estados `hover`/`active`/`disabled`
  presentes em toda primitiva.

## Invariantes e gotchas

- **Sidebar sempre escura** — nunca troque `--sidebar-bg` por tom claro.
- Tema é CSS puro + atributo `data-theme` (sem JS de runtime para cores). Manter os dois
  blocos de tema sincronizados à mão.
- Cor de estado é sempre o par token/bg (`--ok` sobre `--ok-bg`), nunca inventar cor nova
  (ex.: `RiskLevelPill` reusa `--ok`/`--warn`/`--err`).

## Dependências

- [routing-and-shell.md](routing-and-shell.md) · [dashboard-shell.md](../capabilities/dashboard-shell.md)
