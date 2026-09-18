---
title: Home vira painel de widgets; pitch/features movidos para /sobre
status: accepted
date: 2026-09-17
supersedes: []
superseded_by: []
---

# ADR-0010: Home vira painel de widgets; pitch/features para `/sobre`

## Contexto

A home era a "capa" de marketing (pitch + lista de features) — pouco útil no uso diário
pós-login.

## Decisão

- `/` = `DashboardPanel` (stats, tarefas em andamento, atalhos, calendário de prazos,
  atividades recentes, correções pendentes).
- Pitch/feature list → `/sobre` ("Sobre o Vértice"); onboarding → `/tutorial`.

## Consequências

- Home útil diariamente; conteúdo institucional desacoplado e protegido pelo proxy.
- `WebTechFooter` é compartilhado entre `/login` e `/` (variante "bar", sem links legais).

## Alternativas consideradas

- Manter a capa como home — rejeitado: sem valor recorrente após o login.
