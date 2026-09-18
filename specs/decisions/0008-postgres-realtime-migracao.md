---
title: IndexedDB → Postgres + Realtime; Google Drive sync removido
status: accepted
date: 2026-09-17
supersedes: []
superseded_by: []
---

# ADR-0008: IndexedDB → Postgres + Realtime; Google Drive sync removido

## Contexto

Dados do app viviam no IndexedDB do navegador; o multi-dispositivo dependia de sync manual
(Google Drive) — fonte de verdade ambígua e propensa a sobrescrita.

## Decisão

- **Fase 1**: dados do app (`tasks`, `projects`, `workspaces`, `shortcuts`, `custom_prompts`,
  `course_notes`, `ui_preferences`) no **Postgres** com RLS `auth.uid()`.
- **Fase 2**: sincronização multi-dispositivo via **Supabase Realtime** (`postgres_changes`);
  o sync de preferências no Google Drive foi **removido**.

## Consequências

- IndexedDB vira cache de agregados do Canvas (`dashboardCache`, `canvasResolution`).
- localStorage vira cache síncrono de UI com write-through para `ui_preferences`.
- Timestamps de app em **epoch-ms** para o merge last-write-wins.

## Alternativas consideradas

- Manter IndexedDB + Drive sync — rejeitado: fonte de verdade dupla e conflitos sem resolução.
