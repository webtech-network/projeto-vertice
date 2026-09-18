---
title: Tutorial e página Sobre
status: implemented
domain: frontend
updated: 2026-09-17
---

# Tutorial e página Sobre

> Conteúdo institucional/onboarding estático: `/sobre` (pitch + features) e `/tutorial`
> (resumo visual interativo de cada tela). Ambas protegidas pelo proxy.

## Comportamento

- **`/sobre`** ("Sobre o Vértice"): pitch do produto + grupos de features (tarefas/ambientes,
  login/integrações, cursos/atividades, questões/IA, mensagens, configurações) + seção "Um
  projeto de extensão da PUC Minas" (WebTech) + `WebTechFooter`.
- **`/tutorial`** ("Bem-vindo(a), …"): banner + `TutorialExplorer` (resumo visual interativo
  de cada tela, escolhendo uma funcionalidade para ver como funciona).
- O pitch/feature list que antes vivia na home foi movido para cá quando a home virou painel.

## Arquivos-chave

- [sobre/page.jsx](src/app/(dashboard)/sobre/page.jsx) · [tutorial/page.jsx](src/app/(dashboard)/tutorial/page.jsx) ·
  [TutorialExplorer.jsx](src/components/TutorialExplorer.jsx) · [WebTechFooter.jsx](src/components/WebTechFooter.jsx) ·
  `src/assets/images/banner_og.jpeg`, `webtech-logo.png`.

## Decisões

- Home virou painel; pitch/features → `/sobre`: [ADR-0010](../decisions/0010-home-painel-sobre.md).

## Dependências

- [login-and-landing.md](login-and-landing.md) · [dashboard.md](dashboard.md)
