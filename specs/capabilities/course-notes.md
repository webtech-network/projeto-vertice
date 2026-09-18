---
title: Anotações por curso
status: implemented
domain: data
updated: 2026-09-17
---

# Anotações por curso

> A aba "Anotações" do workspace do curso: um editor Markdown por curso, salvo na conta
> (Postgres), sincronizado entre dispositivos.

## Comportamento

- `CourseNoteEditor` (aba `notas`, default do `CourseWorkspaceTabs`) edita a anotação do curso.
- Persistência keyed por `(user_id, course_code)` — não por `course_id`, para a anotação
  sobreviver a cursos com o mesmo código entre termos/instâncias.
- `courseNotesRepo.js` acessa o Postgres **direto** (Supabase browser client, RLS) — sem rota
  API, mesmo padrão de `uiPreferences.js`/`studentEngagementRepo.js` (é dado do próprio app,
  não chamada Canvas).

## Arquivos-chave

- [CourseNoteEditor.jsx](src/components/CourseNoteEditor.jsx) · `src/lib/courseNotesRepo.js`.

## Contratos

- [supabase-schema.md](../contracts/supabase-schema.md) — `course_notes` (PK `user_id, course_code`).

## Dados e persistência

- `course_notes` no Postgres, DELETE físico, Realtime (multi-dispositivo).

## Decisões

- Chave por `course_code` (estável entre termos), não `course_id`.

## Dependências

- [course-workspace.md](course-workspace.md) · [data-storage.md](../platform/data-storage.md)
