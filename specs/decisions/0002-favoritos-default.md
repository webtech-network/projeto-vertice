---
title: Cursos favoritos como default no CourseBrowser
status: accepted
date: 2026-09-17
supersedes: []
superseded_by: []
---

# ADR-0002: Cursos favoritos como default no CourseBrowser

## Contexto

Professores acumulam muitos cursos; a lista completa é ruidosa para o dia a dia.

## Decisão

`CourseBrowser` mostra por padrão **só favoritos** (`is_favorite`, via `include[]=favorites`
em `listCourses`), caindo para "Todos" apenas quando a conta não tem nenhum favorito.

## Consequências

- Cursos não-favoritos ficam a um clique (o toggle "Todos").
- É um default de produto **intencional**, não um "oversight".

## Alternativas consideradas

- Listar todos com ordenação padrão — rejeitado: não resolve o ruído de cursos legados.
