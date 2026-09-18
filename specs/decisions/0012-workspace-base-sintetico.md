---
title: Workspace "Base" é sintético, nunca um registro
status: accepted
date: 2026-09-17
supersedes: []
superseded_by: []
---

# ADR-0012: Workspace "Base" é sintético

## Contexto

Sempre deve existir um contexto "sem filtro" — e ele não pode depender de um seed nem quebrar
se o workspace real for apagado.

## Decisão

`BASE_WORKSPACE_ID`/`BASE_WORKSPACE` são **constantes**, nunca uma linha em `workspaces`.
`getVisibleResourceIds` retorna `null` quando a Base está ativa (= sem filtro).

## Consequências

- Base é sempre a posição #1; apagar o workspace ativo (inclusive via tombstone de outro
  dispositivo) cai para Base.
- Estado inicial é SSR-safe (Base no primeiro render).

## Alternativas consideradas

- Workspace "Base" real no banco — rejeitado: seed + sincronização desnecessários.
