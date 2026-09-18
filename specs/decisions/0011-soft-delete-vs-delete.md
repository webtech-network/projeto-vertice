---
title: Soft delete (workspaces/projects/tasks) × DELETE físico (shortcuts etc.)
status: accepted
date: 2026-09-17
supersedes: []
superseded_by: []
---

# ADR-0011: Soft delete × DELETE físico

## Contexto

O Realtime precisa de um **tombstone** para outros dispositivos removerem o item; entidades
referenciadas por outras linhas não podem simplesmente sumir.

## Decisão

- **Soft delete** (`deleted_at`): `workspaces`, `projects`, `tasks` — tombstone via Realtime,
  merge LWW compara `deletedAt`.
- **DELETE físico**: `shortcuts`, `custom_prompts`, `course_notes`, `course_workspace_links` —
  chaves simples sem referências.
- `student_engagement_snapshots` não tem delete (imutáveis).

## Consequências

- Realtime propaga a remoção entre dispositivos; `deleted_at` entra no last-write-wins.

## Alternativas consideradas

- Soft delete universal — rejeitado: complexidade desnecessária para chaves simples.
