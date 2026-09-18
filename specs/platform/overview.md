---
title: Visão geral
status: implemented
domain: frontend
updated: 2026-09-17
---

# Visão geral

> O Vértice (produto "CanvasTools") é um app Next.js de organização pessoal e acadêmica
> para professores, com o Canvas LMS como integração opcional e geração de questões por IA.

## Stack

- **Next.js 16** (App Router, `src/`), React 19, proxy file (`proxy.js`).
- **Supabase** self-hosted (Postgres + Auth/GoTrue + Realtime + Vault) — ver
  [data-storage.md](data-storage.md).
- Canvas via **client próprio** (`src/lib/canvasClient.js`), não SDK.
- IA via **adapters próprios** (`src/lib/aiProviders/`), sem SDK de vendor.
- libs de apoio: `@dnd-kit/core`, `lucide-react`, `ajv`, `idb` (IndexedDB), `date-fns`.
- Nome npm `canvas-tools`; a pasta legada `tools/CanvasQuiz` não foi renomeada.

## A migração Fase 1 / Fase 2 (contexto essencial)

O app passou por uma migração estrutural que o antigo `CLAUDE.md` ainda não refletia. É
fundamental ler as specs contra **este** estado, não contra comentários antigos:

- **Fase 1 — IndexedDB → Postgres**: `tasks`, `projects`, `workspaces`, `shortcuts`,
  `custom_prompts`, `course_notes` e `ui_preferences` migraram do IndexedDB do navegador
  para o Postgres/Supabase (RLS por `user_id`). O IndexedDB sobrevive só como cache de
  agregados do Canvas e como casa dos tokens de conexão GitHub/Google.
- **Fase 1 — iron-session → Supabase Auth**: a sessão do app deixou de ser o cookie
  `iron-session` com o token do Canvas e passou a ser **Supabase Auth** (Google/GitHub/
  Canvas/passkey). O token do Canvas virou uma **integração** na tabela `integrations`,
  cifrada no Vault. Ver [auth-and-session.md](auth-and-session.md) e
  [canvas-integration.md](canvas-integration.md).
- **Fase 2 — Google Drive sync removido → Supabase Realtime**: o backup de preferências
  no Drive foi removido por completo; a sincronização multi-dispositivo passou a ser o
  Realtime do Supabase (`postgres_changes`).

## Princípios transversais

- **Dois modelos de auth não se confundem**: o **CLI** usa token pessoal fixo do `.env`;
  o **web** usa OAuth (sessão Supabase + token do Canvas no Vault). Ver [cli.md](../capabilities/cli.md).
- **Chaves nunca em texto plano no servidor**: tokens do Canvas e chaves de IA vivem no
  Vault; só o `*_vault_id` fica nas tabelas.
- **Canvas é fonte de verdade** para cursos/atividades/alunos/mensagens — nunca persistido
  em banco próprio, apenas cacheado (IndexedDB, stale-while-revalidate).

## Dependências

- [routing-and-shell.md](routing-and-shell.md) · [data-storage.md](data-storage.md)
