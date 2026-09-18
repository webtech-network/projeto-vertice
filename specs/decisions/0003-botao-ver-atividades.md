---
title: Linha da tabela não é link; botão "Ver atividades" na célula de ações
status: accepted
date: 2026-09-17
supersedes: []
superseded_by: []
---

# ADR-0003: Linha da tabela não é link

## Contexto

Mais ações por curso virão (importar questões, corrigir, mensagens, workspace). Uma linha
inteira como `<Link>` não escala para múltiplas ações.

## Decisão

Substituir o padrão "linha é um link" por **botão explícito** na célula de ações (hoje a
expansão inline do `CourseWorkspaceTabs` + "Tela cheia").

## Consequências

- Espaço estável para novas ações na mesma célula.
- Não reverter para `<Link>` envolvendo o `<tr>`.

## Alternativas consideradas

- `<Link>` na linha inteira — rejeitado: sem espaço para mais de uma ação.
